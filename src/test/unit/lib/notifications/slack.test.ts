import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dmOwnerRaisedHand } from '@/lib/notifications/slack'

describe('dmOwnerRaisedHand', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    delete process.env.SLACK_WEBHOOK_HAND_RAISES
    delete process.env.SLACK_WEBHOOK_PROJECTS
  })

  it('posts to the dedicated hand-raise webhook', async () => {
    process.env.SLACK_WEBHOOK_HAND_RAISES = 'https://hooks.slack.com/services/private-hand-raises'
    process.env.SLACK_WEBHOOK_PROJECTS = 'https://hooks.slack.com/services/broad-projects'
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 })
    )

    await dmOwnerRaisedHand('Alex Owner', 'Sam Builder', 'Realtime AI Board')

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://hooks.slack.com/services/private-hand-raises',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('does not fall back to the broad projects webhook', async () => {
    process.env.SLACK_WEBHOOK_PROJECTS = 'https://hooks.slack.com/services/broad-projects'
    const fetchMock = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response(null, { status: 200 })
    )

    await dmOwnerRaisedHand('Alex Owner', 'Sam Builder', 'Realtime AI Board')

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
