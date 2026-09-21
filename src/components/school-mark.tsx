import { GraduationCap } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * A school's badge. Reads schools.logo_url, so uploading a logo in Settings
 * changes it everywhere this appears — both sidebars, the printed report card
 * and the printed invoice — with nothing else to update.
 *
 * Falls back to a mortarboard on the accent colour when a school has not
 * uploaded one, so the layout never shifts when they do.
 */
export function SchoolMark({
  name,
  logoUrl,
  size = 'md',
  className,
}: {
  name: string
  logoUrl: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const box = size === 'sm' ? 'size-8' : size === 'lg' ? 'size-14' : 'size-9'
  const icon = size === 'sm' ? 16 : size === 'lg' ? 26 : 19

  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={`${name} logo`}
        className={cn(box, 'shrink-0 rounded-xl bg-surface object-contain', className)}
      />
    )
  }

  return (
    <span
      aria-hidden
      className={cn(box, 'grid shrink-0 place-items-center rounded-xl bg-accent text-white', className)}
    >
      <GraduationCap size={icon} />
    </span>
  )
}
