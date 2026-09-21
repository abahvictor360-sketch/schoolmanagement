import Link from 'next/link'

/**
 * A round icon button in the header. The count is a real unread figure, so the
 * dot only appears when there is something to open — no permanent ornament.
 */
export function HeaderIconLink({
  href,
  label,
  count = 0,
  icon: Icon,
}: {
  href: string
  label: string
  count?: number
  icon: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>
}) {
  return (
    <Link
      href={href}
      aria-label={count > 0 ? `${label}, ${count} unread` : label}
      className="relative grid size-11 place-items-center rounded-full bg-surface text-ink-muted shadow-[var(--shadow-card)] transition-colors hover:text-ink"
    >
      <Icon size={18} aria-hidden />
      {count > 0 ? (
        <span className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </Link>
  )
}
