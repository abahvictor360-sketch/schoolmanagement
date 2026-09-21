import { redirect } from 'next/navigation'
import { requireSchool, myMemberships } from '@/lib/auth'
import { AppShell } from '@/components/app-shell'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireSchool()
  const memberships = await myMemberships()

  // A school that has never completed setup has no terms, so nothing else in
  // the app can work. Admins get sent to the wizard; teachers get told to wait.
  if (!ctx.onboarded && ctx.role === 'school_admin') redirect('/onboarding')

  return (
    <AppShell
      ctx={ctx}
      schools={memberships.map((m) => ({ id: m.school.id, name: m.school.name, role: m.role }))}
    >
      {children}
    </AppShell>
  )
}
