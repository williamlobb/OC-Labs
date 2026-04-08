import { Resend } from 'resend'
import type { PlatformRole, MemberRole } from '@/types'

const resend = new Resend(process.env.RESEND_API_KEY)
const FROM = process.env.RESEND_FROM ?? 'OC Labs <noreply@labs.theoc.ai>'
function formatRoleName(role: PlatformRole | MemberRole): string {
  return role
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function buildInviteHtml(
  role: PlatformRole | MemberRole | null,
  inviterName: string,
  acceptUrl: string
): string {
  const roleDisplay = role ? formatRoleName(role) : 'Member'

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fafafa; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; border: 1px solid #e4e4e7; overflow: hidden;">
    <div style="padding: 32px 32px 24px;">
      <h1 style="margin: 0 0 8px; font-size: 22px; color: #18181b;">You've been invited to OC Labs</h1>
      <p style="margin: 0 0 16px; color: #52525b; font-size: 15px;">
        <strong>${inviterName}</strong> has invited you to join OC Labs with the role of <strong>${roleDisplay}</strong>.
      </p>
      <p style="margin: 0 0 24px; color: #71717a; font-size: 14px;">
        OC Labs is the internal project discovery and collaboration board for the Omnia Collective.
        Click the button below to accept your invitation.
      </p>
      <a href="${acceptUrl}" style="display: inline-block; background: #18181b; color: #fff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: 500;">
        Accept invitation →
      </a>
    </div>
    <div style="padding: 16px 32px 24px; border-top: 1px solid #e4e4e7; background: #fafafa;">
      <p style="margin: 0; font-size: 12px; color: #a1a1aa;">
        If you weren't expecting this invitation, you can safely ignore this email.
        This link is tied to your email address — only you can accept it.
      </p>
      <p style="margin: 8px 0 0; font-size: 12px; color: #a1a1aa;">
        Or copy this link: <span style="color: #71717a;">${acceptUrl}</span>
      </p>
    </div>
  </div>
</body>
</html>`
}

export async function sendRoleInviteEmail(
  email: string,
  role: PlatformRole | MemberRole | null,
  inviterName: string,
  acceptUrl: string
): Promise<void> {
  const { error } = await resend.emails.send({
    from: FROM,
    to: email,
    subject: "You've been invited to OC Labs",
    html: buildInviteHtml(role, inviterName, acceptUrl),
  })

  if (error) {
    throw new Error(`Failed to send invite email to ${email}: ${error.message}`)
  }
}

