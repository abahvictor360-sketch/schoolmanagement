import { requireStudent } from '@/lib/student'
import { PortalShell } from '@/components/portal/shell'
import { brandStyle } from '@/lib/branding'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStudent()
  return (
    <div style={brandStyle(ctx.school.brand_color)} className="contents">
      <PortalShell ctx={ctx}>{children}</PortalShell>
    </div>
  )
}
