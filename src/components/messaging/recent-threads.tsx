import Link from 'next/link'
import { Card, CardBody, CardHeader, CardTitle, EmptyState } from '@/components/ui/primitives'
import type { ThreadSummary } from '@/lib/messaging'

/**
 * A compact read of the caller's newest conversations for the dashboard. It
 * takes the same ThreadSummary the messages page renders, so there is no
 * second query and no second idea of what "unread" means.
 */
export function RecentThreads({
  threads,
  basePath,
  limit = 4,
}: {
  threads: ThreadSummary[]
  basePath: string
  limit?: number
}) {
  const shown = threads.slice(0, limit)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Messages</CardTitle>
        <Link
          href={basePath}
          className="text-[13px] font-semibold text-accent-on-soft underline underline-offset-2"
        >
          View all
        </Link>
      </CardHeader>
      <CardBody className="pt-0">
        {shown.length === 0 ? (
          <EmptyState
            title="No conversations yet"
            description="Threads you take part in appear here."
          />
        ) : (
          <ul className="-mx-1.5">
            {shown.map((t) => (
              <li key={t.id}>
                <Link
                  href={`${basePath}/${t.id}`}
                  className="flex items-center gap-3 rounded-xl px-1.5 py-2.5 hover:bg-canvas"
                >
                  <span
                    aria-hidden
                    className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-[12px] font-bold text-accent-on-soft"
                  >
                    {(t.others[0] ?? '?').slice(0, 2).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      {t.unread ? (
                        <span aria-label="Unread" className="size-2 shrink-0 rounded-full bg-accent" />
                      ) : null}
                      <span className="truncate text-[13px] font-semibold">{t.subject}</span>
                    </span>
                    <span className="block truncate text-[12px] text-ink-muted">
                      {t.others.join(', ') || 'No other participant'}
                    </span>
                  </span>
                  <time
                    dateTime={t.lastMessageAt}
                    className="shrink-0 text-[11px] text-ink-muted tabular-nums"
                  >
                    {t.lastMessageAt.slice(0, 10)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  )
}
