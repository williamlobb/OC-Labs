'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { upsertUser } from '@/lib/auth/upsert-user'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { emailsEqual, normalizeEmail } from '@/lib/utils/email'
import { extractInvitationTokenFromRedirect } from '@/lib/utils/invitations'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://oclabs.space'

interface SignupState {
  error: string | null
  confirmation?: boolean
  loginHref?: string
}

function loginHrefForRedirect(redirectTo: string): string {
  return `/login?redirectTo=${encodeURIComponent(redirectTo)}`
}

function mapSignupError(message: string): string {
  if (message.toLowerCase().includes('already registered') ||
      message.toLowerCase().includes('already exists') ||
      message.toLowerCase().includes('email address is already')) {
    // Don't reveal email existence — show same message as success path
    return 'Check your email — if this address is new, a confirmation link is on its way.'
  }
  if (message.toLowerCase().includes('invalid email')) {
    return 'Please enter a valid email address.'
  }
  if (message.toLowerCase().includes('password')) {
    return 'Password must be at least 6 characters.'
  }
  return 'Something went wrong. Please try again.'
}

export async function signupAction(
  _prevState: SignupState | null,
  formData: FormData
): Promise<SignupState> {
  const rawName = formData.get('name') as string
  const rawEmail = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = formData.get('redirectTo') as string

  const name = rawName?.trim().slice(0, 100)
  const email = normalizeEmail(rawEmail)
  const inviteToken = extractInvitationTokenFromRedirect(redirectTo)

  if (!inviteToken || !redirectTo) {
    return { error: 'Invalid invite link. Please reopen your invitation email.' }
  }

  if (!name) {
    return { error: 'Name is required.' }
  }
  if (!email) {
    return { error: 'Email is required.' }
  }
  if (!password || password.length < 6) {
    return { error: 'Password must be at least 6 characters.' }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Please enter a valid email address.', confirmation: false }
  }

  const { data: invitation, error: invitationError } = await supabaseAdmin
    .from('role_invitations')
    .select('id, email, accepted_at')
    .eq('token', inviteToken)
    .maybeSingle()

  if (invitationError || !invitation || invitation.accepted_at !== null) {
    return { error: 'This invitation link is invalid or has already been used.' }
  }

  if (!emailsEqual(invitation.email, email)) {
    return { error: `Please sign up with ${invitation.email} to accept this invitation.` }
  }

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
      emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(redirectTo)}`,
    },
  })

  if (error) {
    return { error: mapSignupError(error.message) }
  }

  const user = data.session?.user ?? data.user ?? null

  if (!user) {
    // No session and no error means confirmation email was sent
    return { error: null, confirmation: true, loginHref: loginHrefForRedirect(redirectTo) }
  }

  // Verify the user has a confirmed session (not just a stub)
  if (!data.session) {
    return { error: null, confirmation: true, loginHref: loginHrefForRedirect(redirectTo) }
  }

  try {
    await upsertUser(user)
  } catch {
    return { error: 'Account created but profile setup failed. Please contact support.' }
  }

  redirect(redirectTo)
}
