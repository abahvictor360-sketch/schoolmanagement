import Link from 'next/link'
import { CircleAlert, Lock, Sparkles } from 'lucide-react'
import type { Subscription } from '@/lib/billing'

/**
 * Says what is happening and what to do about it, on every page. Silent while
 * a subscription is healthy — a banner that is always there is wallpaper, and
 * stops being read by the time it matters.
 */
export function SubscriptionBanner({
  subscription,
  canPay,
}: {
  subscription: Subscription
  canPay: boolean
}) {
  const { state, daysLeft, writesUntil } = subscription

  const notice = (() => {
    if (state === 'read_only' || state === 'canceled') {
      return {
        icon: Lock,
        tone: 'bg-tint-rose text-danger',
        title: 'This school is read only',
        body: 'Everything can still be opened and printed, but nothing can be saved until the subscription is renewed.',
      }
    }
    if (state === 'past_due') {
      return {
        icon: CircleAlert,
        tone: 'bg-tint-peach text-warn',
        title: 'Subscription payment is overdue',
        body: `Saving stops on ${writesUntil}. Renew before then and nothing changes.`,
      }
    }
    // Only worth saying near the end. A month-long countdown is noise.
    if (state === 'trialing' && daysLeft !== null && daysLeft <= 7) {
      return {
        icon: Sparkles,
        tone: 'bg-tint-violet text-accent-on-soft',
        title: daysLeft <= 0
          ? 'The free trial ends today'
          : `${daysLeft} day${daysLeft === 1 ? '' : 's'} left of the free trial`,
        body: 'Choose a plan to keep saving work after the trial ends.',
      }
    }
    return null
  })()

  if (!notice) return null
  const Icon = notice.icon

  return (
    <div
      role="status"
      className="no-print mb-4 flex flex-wrap items-center gap-3 rounded-[18px] bg-surface p-3.5 shadow-[var(--shadow-card)]"
    >
      <span className={`grid size-10 shrink-0 place-items-center rounded-2xl ${notice.tone}`}>
        <Icon size={19} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold">{notice.title}</p>
        <p className="text-[13px] text-ink-muted">{notice.body}</p>
      </div>
      {/* w-full below sm so the action takes its own row on a phone. Sharing
          the row squeezes the message into a one-word-per-line column. */}
      {canPay ? (
        <Link
          href="/settings/billing"
          className="inline-flex h-10 w-full shrink-0 items-center justify-center rounded-xl bg-accent px-4 text-[13px] font-semibold text-accent-ink sm:w-auto"
        >
          {state === 'trialing' ? 'Choose a plan' : 'Renew now'}
        </Link>
      ) : (
        <p className="w-full text-[12px] text-ink-muted sm:w-auto">
          Ask a school administrator to renew.
        </p>
      )}
    </div>
  )
}
