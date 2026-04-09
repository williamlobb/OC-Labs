import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { canEditProjectContent } from '@/lib/auth/permissions'
import { createEpic, createIssue } from '@/lib/jira/client'

interface TaskRow {
  id: string
  title: string
  body: string | null
  jira_issue_key: string | null
  assignee_id: string | null
}

interface SyncRequestBody {
  allowUnassigned?: boolean
}

interface FriendlyJiraMessage {
  userMessage: string
  technicalDetails?: string
}

const UNASSIGNED_TASKS_CONFIRMATION_CODE = 'UNASSIGNED_TASKS_CONFIRMATION_REQUIRED'
const SUPPORTED_EPIC_CHILD_ISSUE_TYPE = 'task'

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Unknown error'
}

function hasRequiredJiraConfig(): string | null {
  const missingVars = ['JIRA_BASE_URL', 'JIRA_EMAIL', 'JIRA_API_TOKEN', 'JIRA_PROJECT_KEY'].filter(
    (name) => !process.env[name]?.trim()
  )
  if (missingVars.length === 0) return null
  return `Missing Jira env vars: ${missingVars.join(', ')}`
}

function isParentLinkConflictError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  return (error as { jiraErrorCode?: string }).jiraErrorCode === 'PARENT_LINK_CONFLICT'
}

function toFriendlyJiraMessage(
  rawMessage: string,
  options?: { parentLinkConflict?: boolean }
): FriendlyJiraMessage {
  const message = rawMessage.trim()
  const lower = message.toLowerCase()

  if (
    options?.parentLinkConflict
    || (
      lower.includes('parent')
      && (
        lower.includes('issue type')
        || lower.includes('hierarchy')
        || lower.includes('child issue')
        || lower.includes('not a valid parent')
      )
    )
  ) {
    return {
      userMessage: 'Jira rejected the Epic link for this task type. Set JIRA_ISSUE_TYPE to Task and retry sync.',
      technicalDetails: message,
    }
  }

  if (
    lower.includes('customfield_10011')
    || lower.includes('epic name')
    || lower.includes('appropriate screen')
  ) {
    return {
      userMessage: 'Jira needs a quick Epic field setup update before this sync can finish.',
      technicalDetails: message,
    }
  }

  if (lower.includes('missing jira env vars') || lower.includes('is not configured')) {
    return {
      userMessage: 'Jira connection settings are incomplete. Ask an admin to finish setup, then try again.',
      technicalDetails: message,
    }
  }

  if (
    lower.includes('not authorized')
    || lower.includes('unauthorized')
    || lower.includes('forbidden')
    || lower.includes('jira request failed (401)')
    || lower.includes('jira request failed (403)')
  ) {
    return {
      userMessage: 'OC Labs could not authenticate with Jira. Please ask an admin to reconnect Jira credentials.',
      technicalDetails: message,
    }
  }

  if (
    lower.includes('fetch failed')
    || lower.includes('network')
    || lower.includes('timeout')
    || lower.includes('econnreset')
    || lower.includes('etimedout')
  ) {
    return {
      userMessage: 'We could not reach Jira just now. Please try again in a moment.',
      technicalDetails: message,
    }
  }

  return {
    userMessage: 'Jira sync hit an unexpected issue. Please try again.',
    technicalDetails: message,
  }
}

function getIssueTypeCompatibilityError(jiraIssueType: string): FriendlyJiraMessage | null {
  if (jiraIssueType.trim().toLowerCase() === SUPPORTED_EPIC_CHILD_ISSUE_TYPE) {
    return null
  }

  const technicalDetails = `JIRA_ISSUE_TYPE=${jiraIssueType} is incompatible with Epic parent linkage. Use Task.`
  return {
    userMessage: 'Jira issue type must be Task for Epic-linked sync. Update JIRA_ISSUE_TYPE and try again.',
    technicalDetails,
  }
}

async function parseAllowUnassigned(req: NextRequest): Promise<boolean> {
  try {
    const body = (await req.json()) as SyncRequestBody
    return body?.allowUnassigned === true
  } catch {
    return false
  }
}

function buildIssueSummary(projectTitle: string, taskTitle: string): string {
  const summary = `${projectTitle.trim()}: ${taskTitle.trim()}`.trim()
  if (summary.length <= 255) return summary
  return `${summary.slice(0, 252)}...`
}

function buildIssueDescription(projectId: string, projectTitle: string, taskTitle: string, taskBody: string | null): string {
  const lines = [
    `Project: ${projectTitle.trim()}`,
    `Task: ${taskTitle.trim()}`,
  ]

  if (taskBody?.trim()) {
    lines.push('', 'Details:', taskBody.trim())
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, '')
  if (appUrl) {
    lines.push('', `Source: ${appUrl}/projects/${projectId}/plan`)
  }

  return lines.join('\n')
}

async function ensureProjectEpicKey(
  projectId: string,
  projectTitle: string,
  currentEpicKey: string | null | undefined
): Promise<{ epicKey?: string; error?: string }> {
  const trimmedCurrent = currentEpicKey?.trim()
  if (trimmedCurrent) {
    return { epicKey: trimmedCurrent }
  }

  try {
    const createdEpicKey = await createEpic(projectTitle)
    const trimmedCreated = createdEpicKey.trim()
    if (!trimmedCreated) {
      return { error: 'Jira epic creation returned an empty key.' }
    }

    const { error: updateError } = await supabaseAdmin
      .from('projects')
      .update({ jira_epic_key: trimmedCreated })
      .eq('id', projectId)

    if (updateError) {
      return { error: `Created Jira epic but failed to save it on project (${updateError.message}).` }
    }

    return { epicKey: trimmedCreated }
  } catch (error) {
    return { error: `Failed to create Jira epic for this project (${getErrorMessage(error)}).` }
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()
  const allowUnassigned = await parseAllowUnassigned(req)

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await canEditProjectContent(supabase, user.id, id)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const configError = hasRequiredJiraConfig()
  if (configError) {
    const friendly = toFriendlyJiraMessage(configError)
    return NextResponse.json(
      {
        error: friendly.userMessage,
        message: friendly.userMessage,
        technicalDetails: friendly.technicalDetails,
      },
      { status: 500 }
    )
  }

  const [{ data: project, error: projectError }, { data: tasks, error: tasksError }] = await Promise.all([
    supabase.from('projects').select('id, title, jira_epic_key').eq('id', id).single(),
    supabase
      .from('tasks')
      .select('id, title, body, jira_issue_key, assignee_id')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (tasksError) return NextResponse.json({ error: tasksError.message }, { status: 500 })

  const jiraProjectKey = process.env.JIRA_PROJECT_KEY!.trim()
  const jiraIssueType = process.env.JIRA_ISSUE_TYPE?.trim() || 'Task'
  const compatibilityError = getIssueTypeCompatibilityError(jiraIssueType)
  if (compatibilityError) {
    return NextResponse.json(
      {
        error: compatibilityError.userMessage,
        message: compatibilityError.userMessage,
        technicalDetails: compatibilityError.technicalDetails,
      },
      { status: 500 }
    )
  }

  const taskRows = (tasks ?? []) as TaskRow[]
  const unassignedUnsyncedTasks = taskRows.filter(
    (task) => !task.jira_issue_key?.trim() && !task.assignee_id
  )
  if (unassignedUnsyncedTasks.length > 0 && !allowUnassigned) {
    const unassignedTaskPreview = unassignedUnsyncedTasks
      .slice(0, 5)
      .map((task) => task.title)
    const message = 'Some tasks are still unassigned. Confirm if you want to sync them anyway.'
    return NextResponse.json(
      {
        code: UNASSIGNED_TASKS_CONFIRMATION_CODE,
        message,
        error: message,
        unassignedTaskCount: unassignedUnsyncedTasks.length,
        unassignedTaskPreview,
      },
      { status: 409 }
    )
  }

  const { epicKey, error: epicError } = await ensureProjectEpicKey(
    project.id,
    project.title,
    (project as { jira_epic_key?: string | null }).jira_epic_key
  )
  if (epicError) {
    const friendly = toFriendlyJiraMessage(epicError)
    return NextResponse.json(
      {
        error: friendly.userMessage,
        message: friendly.userMessage,
        technicalDetails: friendly.technicalDetails,
      },
      { status: 500 }
    )
  }

  let created = 0
  let skipped = 0
  let failed = 0
  const errors: string[] = []
  const technicalErrors: string[] = []

  for (const task of taskRows) {
    if (task.jira_issue_key?.trim()) {
      skipped += 1
      continue
    }

    try {
      const issue = await createIssue({
        summary: buildIssueSummary(project.title, task.title),
        description: buildIssueDescription(project.id, project.title, task.title, task.body),
        projectKey: jiraProjectKey,
        issueType: jiraIssueType,
        epicKey,
      })

      const nowIso = new Date().toISOString()
      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          jira_issue_key: issue.key,
          jira_issue_url: issue.url,
          jira_synced_at: nowIso,
          updated_at: nowIso,
        })
        .eq('id', task.id)
        .eq('project_id', id)

      if (updateError) {
        failed += 1
        errors.push(`${task.title}: Synced to Jira, but we could not save the Jira link in OC Labs.`)
        technicalErrors.push(`${task.title}: failed to save Jira mapping (${updateError.message})`)
        continue
      }

      created += 1
    } catch (error) {
      failed += 1
      const friendly = toFriendlyJiraMessage(getErrorMessage(error), {
        parentLinkConflict: isParentLinkConflictError(error),
      })
      errors.push(`${task.title}: ${friendly.userMessage}`)
      if (friendly.technicalDetails) {
        technicalErrors.push(`${task.title}: ${friendly.technicalDetails}`)
      }
    }
  }

  const warning = allowUnassigned && unassignedUnsyncedTasks.length > 0
    ? `Included ${unassignedUnsyncedTasks.length} unassigned task${unassignedUnsyncedTasks.length === 1 ? '' : 's'} because you confirmed sync anyway.`
    : undefined

  const message = failed > 0
    ? `Jira sync finished with some issues: ${created} created, ${skipped} skipped, ${failed} failed.`
    : `Jira sync complete: ${created} created and ${skipped} skipped.`

  return NextResponse.json({
    created,
    skipped,
    failed,
    errors,
    technicalErrors,
    warning,
    message,
  })
}
