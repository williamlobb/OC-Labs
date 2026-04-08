import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/supabase/admin'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM ?? 'OC Labs <noreply@oclabs.space>'
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://oclabs.space'

interface DigestProject {
  id: string
  title: string
  summary: string | null
  vote_count: number
  brand: string | null
}

interface DigestRecipient {
  id: string
  email: string
  name: string
}

function buildEmailHtml(projects: DigestProject[], recipientId: string): string {
  const projectRows = projects
    .slice(0, 5)
    .map(
      (p) => `
      <tr>
        <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7;">
          <a href="${APP_URL}/projects/${p.id}" style="font-weight: 600; color: #18181b; text-decoration: none;">
            ${p.title}
          </a>
          ${p.brand ? `<span style="color: #71717a; font-size: 12px; margin-left: 8px;">${p.brand}</span>` : ''}
          ${p.summary ? `<p style="margin: 4px 0 0; color: #52525b; font-size: 14px;">${p.summary.slice(0, 120)}${p.summary.length > 120 ? '…' : ''}</p>` : ''}
        </td>
        <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; text-align: right; white-space: nowrap; color: #71717a; font-size: 13px;">
          ▲ ${p.vote_count}
        </td>
      </tr>`
    )
    .join('')

  const unsubscribeUrl = `${APP_URL}/api/v1/users/me/unsubscribe?uid=${recipientId}`

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fafafa; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; border: 1px solid #e4e4e7; overflow: hidden;">
    <div style="padding: 32px 32px 0;">
      <h1 style="margin: 0 0 4px; font-size: 22px; color: #18181b;">OC Labs Weekly</h1>
      <p style="margin: 0 0 24px; color: #71717a; font-size: 14px;">Top projects this week across the Omnia Collective</p>
      <table style="width: 100%; border-collapse: collapse;">
        ${projectRows}
      </table>
    </div>
    <div style="padding: 24px 32px 32px;">
      <a href="${APP_URL}/discover" style="display: inline-block; background: #18181b; color: #fff; text-decoration: none; padding: 10px 20px; border-radius: 8px; font-size: 14px; font-weight: 500;">
        Browse all projects →
      </a>
    </div>
    <div style="padding: 16px 32px; border-top: 1px solid #e4e4e7; background: #fafafa;">
      <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
        You're receiving this because you're a member of the Omnia Collective.
        <a href="${unsubscribeUrl}" style="color: #71717a;">Unsubscribe</a>
      </p>
    </div>
  </div>
</body>
</html>`
}

export async function sendWeeklyDigest(): Promise<{ sent: number; errors: number }> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Top 5 projects by vote_count updated in the last 7 days
  const { data: projects } = await supabaseAdmin
    .from('projects')
    .select('id, title, summary, vote_count, brand')
    .gte('updated_at', sevenDaysAgo)
    .order('vote_count', { ascending: false })
    .limit(5)

  if (!projects || projects.length === 0) {
    return { sent: 0, errors: 0 }
  }

  // All users opted in to digest
  const { data: recipients } = await supabaseAdmin
    .from('users')
    .select('id, email, name')
    .eq('email_digest', true)

  if (!recipients || recipients.length === 0) {
    return { sent: 0, errors: 0 }
  }

  let sent = 0
  let errors = 0

  for (const recipient of recipients as DigestRecipient[]) {
    try {
      await resend.emails.send({
        from: FROM,
        to: recipient.email,
        subject: 'OC Labs — your weekly project digest',
        html: buildEmailHtml(projects as DigestProject[], recipient.id),
      })
      sent++
    } catch (err) {
      console.error(`Digest send failed for ${recipient.email}:`, err)
      errors++
    }
  }

  return { sent, errors }
}

