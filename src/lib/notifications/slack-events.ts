// Block Kit event helpers — richer Slack messages for key project events.
// All functions are fire-and-forget; callers must not await them in the critical path.

async function postToWebhook(webhookUrl: string, payload: object): Promise<void> {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(`Slack webhook failed: ${res.status} ${res.statusText}`)
  }
}

export async function notifyNewProject(
  projectId: string,
  projectTitle: string,
  ownerName: string,
  appUrl = 'https://labs.theoc.ai'
): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_PROJECTS
  if (!webhookUrl) return

  await postToWebhook(webhookUrl, {
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `🚀 *New project:* <${appUrl}/projects/${projectId}|${projectTitle}>\n*Owner:* ${ownerName}`,
        },
        accessory: {
          type: 'button',
          text: { type: 'plain_text', text: 'View project' },
          url: `${appUrl}/projects/${projectId}`,
        },
      },
    ],
  })
}

