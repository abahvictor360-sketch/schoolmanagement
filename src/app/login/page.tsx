import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { currentUser } from '@/lib/auth'
import { AuthForm } from '@/components/auth-form'

export const metadata: Metadata = { title: 'Sign in' }

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  if (await currentUser()) redirect('/dashboard')
  const { next } = await searchParams

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-10">
      <div>
        <p className="text-lg font-semibold tracking-[-0.02em]">SchoolHub</p>
        <h1 className="mt-4 text-2xl font-semibold tracking-[-0.02em]">Sign in</h1>
        <p className="mt-1 text-sm text-ink-muted">Use the email address your school registered.</p>
      </div>
      <AuthForm mode="signin" next={next ?? '/dashboard'} />
      <p className="text-sm text-ink-muted">
        Been invited but never signed in?{' '}
        <Link href="/signup" className="font-medium text-accent underline underline-offset-2">
          Create your account
        </Link>
      </p>
    </main>
  )
}
