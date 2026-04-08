import { redirect } from 'next/navigation'

export default function SignupPage() {
  // OC Labs is invite-only — self-registration is disabled
  redirect('/login')
}
