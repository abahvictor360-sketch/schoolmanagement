import { requireStudent } from '@/lib/student'
import { PortalShell } from '@/components/portal/shell'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStudent()
  return <PortalShell ctx={ctx}>{children}</PortalShell>
}
