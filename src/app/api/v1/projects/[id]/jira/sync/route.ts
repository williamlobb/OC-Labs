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
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const allowed = await canEditProjectContent(supabase, user.id, id)
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const configError = hasRequiredJiraConfig()
  if (configError) {
    return NextResponse.json({ error: configError }, { status: 500 })
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

  const taskRows = (tasks ?? []) as TaskRow[]
  const unassignedUnsyncedTasks = taskRows.filter(
    (task) => !task.jira_issue_key?.trim() && !task.assignee_id
  )
  if (unassignedUnsyncedTasks.length > 0) {
    const preview = unassignedUnsyncedTasks
      .slice(0, 3)
      .map((task) => task.title)
      .join(', ')
    const suffix = unassignedUnsyncedTasks.length > 3 ? ', ...' : ''
    return NextResponse.json(
      {
        error: `Assign each unsynced task before Jira sync. Unassigned: ${preview}${suffix}`,
      },
      { status: 400 }
    )
  }

  const jiraProjectKey = process.env.JIRA_PROJECT_KEY!.trim()
  const jiraIssueType = process.env.JIRA_ISSUE_TYPE?.trim() || 'Task'
  const { epicKey, error: epicError } = await ensureProjectEpicKey(
    project.id,
    project.title,
    (project as { jira_epic_key?: string | null }).jira_epic_key
  )
  if (epicError) {
    return NextResponse.json({ error: epicError }, { status: 500 })
  }

  let created = 0
  let skipped = 0
  let failed = 0
  const errors: string[] = []

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
        errors.push(`${task.title}: failed to save Jira mapping (${updateError.message})`)
        continue
      }

      created += 1
    } catch (error) {
      failed += 1
      errors.push(`${task.title}: ${getErrorMessage(error)}`)
    }
  }

  return NextResponse.json({ created, skipped, failed, errors })
}
