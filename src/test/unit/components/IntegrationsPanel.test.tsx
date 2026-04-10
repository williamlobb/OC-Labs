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
        jiraLastSync={null}
        githubConfigured={false}
        githubOrg={null}
      />
    )

    expect(screen.getByText('Issue type')).toBeInTheDocument()
    expect(screen.getByText('Task (enforced)')).toBeInTheDocument()
  })

  it('does not show compatibility warning because issue type is enforced', () => {
    render(
      <IntegrationsPanel
        jiraConfigured
        jiraBaseUrl="https://jira.example.com"
        jiraProjectKey="OC"
        jiraLastSync={null}
        githubConfigured={false}
        githubOrg={null}
      />
    )

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
