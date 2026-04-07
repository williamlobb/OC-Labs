import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { createIssue } from '@/lib/jira/client'

interface TaskRow {
  id: string
  title: string
  body: string | null
  jira_issue_key: string | null
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

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: membership } = await supabase
    .from('project_members')
    .select('role')
    .eq('project_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!membership || !['owner', 'contributor'].includes(membership.role)) {
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
      .select('id, title, body, jira_issue_key')
      .eq('project_id', id)
      .order('created_at', { ascending: true }),
  ])

  if (projectError) return NextResponse.json({ error: projectError.message }, { status: 500 })
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (tasksError) return NextResponse.json({ error: tasksError.message }, { status: 500 })

  const jiraProjectKey = process.env.JIRA_PROJECT_KEY!.trim()
  const jiraIssueType = process.env.JIRA_ISSUE_TYPE?.trim() || 'Task'
  // jira_epic_key may be null if Jira was unavailable at project creation time.
  // In that case, issues are created without an Epic link (graceful degradation).
  const epicKey = (project as { jira_epic_key?: string | null }).jira_epic_key ?? undefined

  let created = 0
  let skipped = 0
  let failed = 0
  const errors: string[] = []

  for (const task of (tasks ?? []) as TaskRow[]) {
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
