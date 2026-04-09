import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { IntegrationsPanel } from '@/components/settings/IntegrationsPanel'

describe('IntegrationsPanel Jira config visibility', () => {
  it('shows Jira issue type in configured state', () => {
    render(
      <IntegrationsPanel
        jiraConfigured
        jiraBaseUrl="https://jira.example.com"
        jiraProjectKey="OC"
        jiraIssueType="Task"
        jiraLastSync={null}
        githubConfigured={false}
        githubOrg={null}
      />
    )

    expect(screen.getByText('Issue type')).toBeInTheDocument()
    expect(screen.getByText('Task')).toBeInTheDocument()
  })

  it('shows warning when Jira issue type is incompatible with Epic linkage', () => {
    render(
      <IntegrationsPanel
        jiraConfigured
        jiraBaseUrl="https://jira.example.com"
        jiraProjectKey="OC"
        jiraIssueType="Epic"
        jiraLastSync={null}
        githubConfigured={false}
        githubOrg={null}
      />
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/JIRA_ISSUE_TYPE=Task/i)
  })
})
