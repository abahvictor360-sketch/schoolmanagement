import Link from 'next/link'

export default function NotFound() {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">Not found</h1>
      <p className="text-sm text-ink-muted">
        This page does not exist, or it belongs to a school you are not a member of.
      </p>
      <Link href="/dashboard" className="text-sm font-medium text-accent underline underline-offset-2">
        Back to the dashboard
      </Link>
    </main>
  )
}
