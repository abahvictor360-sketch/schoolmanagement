import Link from 'next/link'
import { Badge, Card, DataTable, EmptyState, Td, Th } from '@/components/ui/primitives'
import type { ThreadSummary } from '@/lib/messaging'

export function ThreadList({
  threads,
  basePath,
  emptyHint,
}: {
  threads: ThreadSummary[]
  basePath: string
  emptyHint: string
}) {
  if (threads.length === 0) {
    return (
      <Card>
        <EmptyState title="No conversations yet" description={emptyHint} />
      </Card>
    )
  }

  return (
    <Card>
      <DataTable className="min-w-0">
        <thead>
          <tr>
            <Th>Subject</Th>
            <Th className="hidden sm:table-cell">With</Th>
            <Th className="text-right">Last message</Th>
          </tr>
        </thead>
        <tbody>
          {threads.map((t) => (
            <tr key={t.id} className="hover:bg-canvas/60">
              <Td>
                <Link href={`${basePath}/${t.id}`} className="flex items-center gap-2 font-medium">
                  {t.unread ? (
                    <span
                      aria-label="Unread"
                      className="size-2 shrink-0 rounded-full bg-accent"
                    />
                  ) : null}
                  {t.subject}
                </Link>
                <span className="text-[12px] text-ink-muted sm:hidden">{t.others.join(', ')}</span>
              </Td>
              <Td className="hidden sm:table-cell">{t.others.join(', ')}</Td>
              <Td className="text-right text-[13px] whitespace-nowrap text-ink-muted">
                {new Date(t.lastMessageAt).toLocaleDateString()}
              </Td>
            </tr>
          ))}
        </tbody>
      </DataTable>
    </Card>
  )
}
