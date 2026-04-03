'use server'

import { createServerSupabaseClient } from '@/lib/supabase/server'
import { upsertUser } from '@/lib/auth/upsert-user'
import { redirect } from 'next/navigation'

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
  _prevState: { error: string | null; confirmation?: boolean } | null,
  formData: FormData
): Promise<{ error: string | null; confirmation?: boolean }> {
  const rawName = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const name = rawName?.trim().slice(0, 100)

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

  const supabase = await createServerSupabaseClient()

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name },
    },
  })

  if (error) {
    return { error: mapSignupError(error.message) }
  }

  const user = data.session?.user ?? data.user ?? null

  if (!user) {
    // No session and no error means confirmation email was sent
    return { error: null, confirmation: true }
  }

  // Verify the user has a confirmed session (not just a stub)
  if (!data.session) {
    return { error: null, confirmation: true }
  }

  try {
    await upsertUser(user)
  } catch {
    return { error: 'Account created but profile setup failed. Please contact support.' }
  }

  redirect('/discover')
}
