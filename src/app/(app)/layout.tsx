import { redirect } from 'next/navigation'
import { requireSchool, myMemberships } from '@/lib/auth'
import { AppShell } from '@/components/app-shell'
import { brandStyle } from '@/lib/branding'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireSchool()

  // Pupils get their own shell; the staff navigation is not theirs.
  if (ctx.role === 'student') redirect('/portal')

  const memberships = await myMemberships()

  // A school that has never completed setup has no terms, so nothing else in
  // the app can work. Admins get sent to the wizard; teachers get told to wait.
  if (!ctx.onboarded && ctx.role === 'school_admin') redirect('/onboarding')

  // Overriding the accent tokens on a wrapper re-themes every component
  // inside, so nothing below has to know the school picked a colour.
  return (
    <div style={brandStyle(ctx.school.brand_color)} className="contents">
      <AppShell
        ctx={ctx}
        schools={memberships.map((m) => ({ id: m.school.id, name: m.school.name, role: m.role }))}
      >
        {children}
      </AppShell>
    </div>
  )
}
