import { CalendarCheck, GraduationCap, LayoutDashboard, UserSquare2, Wallet } from 'lucide-react'

/**
 * A stylised representation of the product, built from the same tokens the
 * real screens use. Not a screenshot: nothing here is a claim about data, and
 * it stays honest when the palette or the type changes.
 */
export function AppPreview({ variant = 'dashboard' }: { variant?: 'dashboard' | 'roster' }) {
  return (
    <div
      aria-hidden
      className="overflow-hidden rounded-[22px] bg-surface shadow-[var(--shadow-raised)]"
    >
      <div className="flex">
        {/* Sidebar */}
        <div className="hidden w-40 shrink-0 flex-col gap-1 p-3 sm:flex">
          <div className="mb-2 flex items-center gap-2 px-1">
            <span className="grid size-7 place-items-center rounded-lg bg-accent text-accent-ink">
              <GraduationCap size={15} />
            </span>
            <span className="h-2 w-16 rounded-full bg-canvas" />
          </div>
          {[LayoutDashboard, CalendarCheck, GraduationCap, Wallet, UserSquare2].map((Icon, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 rounded-xl px-2 py-2 ${
                i === 0 ? 'bg-accent-soft' : ''
              }`}
            >
              <Icon size={14} className={i === 0 ? 'text-accent-on-soft' : 'text-ink-muted'} />
              <span
                className={`h-1.5 rounded-full ${i === 0 ? 'w-14 bg-accent/30' : 'w-12 bg-canvas'}`}
              />
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1 bg-canvas p-3.5">
          <div className="mb-3">
            <div className="h-3 w-32 rounded-full bg-ink/10" />
            <div className="mt-2 h-1.5 w-44 rounded-full bg-ink/5" />
          </div>

          {variant === 'dashboard' ? (
            <>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                {[
                  { tint: 'bg-tint-violet', w: 'w-10' },
                  { tint: 'bg-tint-mint', w: 'w-8' },
                  { tint: 'bg-tint-sky', w: 'w-9' },
                  { tint: 'bg-tint-peach', w: 'w-12' },
                ].map((t, i) => (
                  <div key={i} className={`rounded-xl ${t.tint} p-2.5`}>
                    <div className="h-1.5 w-8 rounded-full bg-ink/10" />
                    <div className={`mt-1.5 h-3 ${t.w} rounded-full bg-ink/25`} />
                  </div>
                ))}
              </div>

              <div className="mt-2.5 rounded-xl bg-surface p-3">
                <div className="flex items-center justify-between">
                  <div className="h-2 w-20 rounded-full bg-ink/10" />
                  <div className="h-4 w-14 rounded-full bg-tint-mint" />
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-canvas">
                  <div className="h-full w-[72%] rounded-full bg-accent" />
                </div>
                <div className="mt-3 space-y-2">
                  {[1, 0.8, 0.6].map((w, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="size-6 shrink-0 rounded-lg bg-accent-soft" />
                      <div className="h-1.5 rounded-full bg-canvas" style={{ width: `${w * 60}%` }} />
                      <div className="ml-auto h-1.5 w-8 rounded-full bg-canvas" />
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            /* A register: the screen this product is really judged on. */
            <div className="rounded-xl bg-surface p-3">
              <div className="flex items-center gap-2">
                <div className="h-2 w-24 rounded-full bg-ink/10" />
                <div className="ml-auto h-5 w-16 rounded-full bg-accent-soft" />
              </div>
              <div className="mt-3 space-y-1.5">
                {[
                  'bg-tint-mint', 'bg-tint-mint', 'bg-tint-peach', 'bg-tint-mint',
                  'bg-tint-rose', 'bg-tint-mint', 'bg-tint-mint',
                ].map((mark, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-lg bg-canvas px-2 py-1.5">
                    <div className="size-5 shrink-0 rounded-full bg-accent-soft" />
                    <div
                      className="h-1.5 rounded-full bg-ink/10"
                      style={{ width: `${38 + ((i * 13) % 26)}%` }}
                    />
                    <div className={`ml-auto h-4 w-10 shrink-0 rounded-full ${mark}`} />
                  </div>
                ))}
              </div>
              <div className="mt-3 h-8 rounded-lg bg-accent" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
