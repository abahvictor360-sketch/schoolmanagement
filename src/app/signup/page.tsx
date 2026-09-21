import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { AuthForm } from '@/components/auth-form'

export const metadata: Metadata = { title: 'Create account' }

export default async function SignUpPage() {
  if (await currentUser()) redirect('/dashboard')

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div>
        <p className="text-lg font-semibold tracking-[-0.02em]">SchoolHub</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em]">Create your account</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Sign up with the exact email your invitation was sent to. Your school access is attached
          automatically.
        </p>
      </div>
      <AuthForm mode="signup" next="/dashboard" />
      <p className="text-sm text-ink-muted">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-accent-on-soft underline underline-offset-2">
          Sign in
        </Link>
      </p>
    </main>
  )
}
