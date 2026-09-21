import { requireStudent } from '@/lib/student'
import { PortalShell } from '@/components/portal/shell'
import { brandStyle } from '@/lib/branding'
import { countUnreadThreads } from '@/lib/messaging'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStudent()
  const unreadMessages = await countUnreadThreads(ctx.userId)
  return (
    <div style={brandStyle(ctx.school.brand_color)} className="contents">
      <PortalShell ctx={ctx} unreadMessages={unreadMessages}>
        {children}
      </PortalShell>
    </div>
  )
}
