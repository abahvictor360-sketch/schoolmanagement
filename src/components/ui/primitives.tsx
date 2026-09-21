import * as React from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'

/* Card ------------------------------------------------------------------- */
export function Card({ className, ...props }: React.ComponentProps<'section'>) {
  return (
    <section
      className={cn('card rounded-[18px] bg-surface shadow-[var(--shadow-card)]', className)}
      {...props}
    />
  )
}

/**
 * A stat tile. The tint carries the meaning at a glance; the text stays
 * --color-ink on every one of them so contrast never depends on the colour.
 */
const tints = {
  violet: { bg: 'bg-tint-violet', icon: 'text-icon-violet' },
  mint: { bg: 'bg-tint-mint', icon: 'text-icon-mint' },
  peach: { bg: 'bg-tint-peach', icon: 'text-icon-peach' },
  sky: { bg: 'bg-tint-sky', icon: 'text-icon-sky' },
} as const

export type TintName = keyof typeof tints

export function StatTile({
  label,
  value,
  tint = 'violet',
  icon: Icon,
  hint,
  size = 'md',
}: {
  label: string
  value: React.ReactNode
  tint?: TintName
  icon?: React.ComponentType<{ size?: number; 'aria-hidden'?: boolean }>
  hint?: string
  /**
   * 'sm' for tiles nested inside a card. A full-size tile stretched across a
   * third of a wide card reads as inflated next to the page's own top row, so
   * the nested ones keep the tint and drop the height.
   */
  size?: 'md' | 'sm'
}) {
  const t = tints[tint]
  const small = size === 'sm'
  return (
    // h-full so tiles in a grid row match height whether or not they carry a
    // hint; min-h keeps a lone tile from collapsing.
    <div
      className={cn(
        'flex h-full items-start justify-between gap-2 rounded-[18px]',
        small ? 'min-h-[68px] px-3.5 py-3' : 'min-h-[92px] px-4 py-3.5',
        t.bg,
      )}
    >
      <div className="min-w-0">
        <p className="text-[12px] font-medium text-ink-muted">{label}</p>
        <p
          className={cn(
            'mt-0.5 font-bold tracking-[-0.02em] tabular-nums',
            small ? 'text-[19px]' : 'text-2xl',
          )}
        >
          {value}
        </p>
        {hint ? <p className="mt-0.5 line-clamp-1 text-[12px] text-ink-muted">{hint}</p> : null}
      </div>
      {/* Hidden at 360px: a 44px chip costs a third of the tile's width there,
          which pushes the label into a three-line wrap. */}
      {Icon ? (
        <span
          className={cn(
            'hidden size-10 shrink-0 place-items-center rounded-2xl bg-surface/70 sm:grid',
            t.icon,
          )}
        >
          <Icon size={20} aria-hidden />
        </span>
      ) : null}
    </div>
  )
}

/**
 * A single proportion, drawn the same way everywhere it appears. The label is
 * on the element rather than on a nearby caption, because a bar with no
 * accessible name is invisible to a screen reader.
 */
export function Meter({
  value,
  max = 100,
  label,
  className,
}: {
  value: number
  max?: number
  label: string
  className?: string
}) {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('h-3 w-full overflow-hidden rounded-full bg-canvas', className)}
    >
      <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
    </div>
  )
}

export function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex flex-wrap items-center justify-between gap-3 px-4 pt-4 pb-3 sm:px-5', className)}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 className={cn('text-[16px] font-bold tracking-[-0.01em]', className)} {...props} />
}

export function CardBody({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('px-4 py-4 sm:px-5', className)} {...props} />
}

/* Button ----------------------------------------------------------------- */
const buttonStyles = {
  // text colour comes from the brand's contrast-checked foreground, so a pale
  // school colour gets dark text instead of unreadable white.
  primary:
    'bg-accent text-accent-ink shadow-[0_6px_16px_-8px_var(--color-accent)] hover:bg-accent-strong disabled:opacity-50',
  secondary: 'bg-canvas text-ink hover:bg-accent-soft disabled:text-ink-muted',
  ghost: 'text-ink-muted hover:bg-canvas hover:text-ink',
  danger: 'bg-danger text-white hover:brightness-95',
} as const

export type ButtonProps = React.ComponentProps<'button'> & {
  variant?: keyof typeof buttonStyles
  size?: 'sm' | 'md'
}

export function Button({ className, variant = 'primary', size = 'md', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors',
        'disabled:cursor-not-allowed',
        size === 'sm' ? 'h-9 px-3.5 text-[13px]' : 'h-11 px-4 text-sm',
        buttonStyles[variant],
        className,
      )}
      {...props}
    />
  )
}

/* Form ------------------------------------------------------------------- */
export function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return <label className={cn('block text-[13px] font-medium text-ink', className)} {...props} />
}

export const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm',
          'placeholder:text-ink-muted/70 disabled:bg-canvas',
          'focus:border-accent aria-[invalid=true]:border-danger',
          className,
        )}
        {...props}
      />
    )
  },
)

/**
 * Password field with a reveal toggle. Typing a password blind on a phone
 * keyboard is the most common reason a correct password gets typed wrong, so
 * the toggle is a real button: focusable, and it announces its state rather
 * than relying on the icon alone.
 */
export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  Omit<React.ComponentProps<'input'>, 'type'>
>(function PasswordInput({ className, ...props }, ref) {
  const [visible, setVisible] = React.useState(false)

  return (
    <div className="relative">
      <Input
        ref={ref}
        type={visible ? 'text' : 'password'}
        className={cn('pr-11', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setVisible((shown) => !shown)}
        aria-pressed={visible}
        aria-label={visible ? 'Hide password' : 'Show password'}
        title={visible ? 'Hide password' : 'Show password'}
        className={cn(
          'absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg',
          'text-ink-muted transition-colors hover:text-ink',
        )}
      >
        {visible ? <EyeOff aria-hidden size={18} /> : <Eye aria-hidden size={18} />}
      </button>
    </div>
  )
})

export const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<'select'>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          'h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-sm disabled:bg-canvas focus:border-accent',
          className,
        )}
        {...props}
      />
    )
  },
)

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<'textarea'>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn('w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm focus:border-accent', className)}
        {...props}
      />
    )
  },
)

export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string
  error?: string
  hint?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label>{label}</Label>
      {children}
      {hint && !error ? <p className="text-xs text-ink-muted">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/* Badge ------------------------------------------------------------------ */
const badgeStyles = {
  neutral: 'bg-canvas text-ink-muted',
  accent: 'bg-accent-soft text-accent-on-soft',
  positive: 'bg-tint-mint text-positive',
  warn: 'bg-tint-lemon text-warn',
  danger: 'bg-tint-rose text-danger',
} as const

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: React.ComponentProps<'span'> & { tone?: keyof typeof badgeStyles }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap',
        badgeStyles[tone],
        className,
      )}
      {...props}
    />
  )
}

/* Table ------------------------------------------------------------------ */
export function DataTable({ className, ...props }: React.ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full min-w-[640px] border-collapse text-sm', className)} {...props} />
    </div>
  )
}

export function Th({ className, ...props }: React.ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn(
        'bg-canvas/70 px-3 py-3 text-left text-[12px] font-semibold text-ink-muted first:rounded-l-xl last:rounded-r-xl',
        className,
      )}
      {...props}
    />
  )
}

export function Td({ className, ...props }: React.ComponentProps<'td'>) {
  return <td className={cn('border-b border-line px-3 py-3 align-middle', className)} {...props} />
}

/* States ----------------------------------------------------------------- */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="text-sm font-semibold">{title}</p>
      <p className="max-w-sm text-sm text-ink-muted">{description}</p>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  )
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-xl bg-tint-rose px-3.5 py-2.5 text-sm font-medium text-danger">
      {children}
    </p>
  )
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading</span>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton h-8 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.02em]">{title}</h1>
        {description ? <p className="mt-0.5 text-sm text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div> : null}
    </div>
  )
}
