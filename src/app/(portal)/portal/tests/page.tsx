import type { Metadata } from 'next'
import Link from 'next/link'
import { requireStudent } from '@/lib/student'
import { createClient } from '@/lib/supabase/server'
import { Badge, Card, CardBody, EmptyState, PageHeader } from '@/components/ui/primitives'
import type { CbtAttemptStatus } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Tests' }

export default async function PortalTests() {
  const ctx = await requireStudent()
  const supabase = await createClient()

  const [{ data: tests }, { data: attempts }] = await Promise.all([
    supabase
      .from('cbt_tests')
      .select('id, title, duration_minutes, opens_at, closes_at, subject:subjects(name)')
      .eq('status', 'published')
      .order('closes_at')
      .returns<{
        id: string
        title: string
        duration_minutes: number
        opens_at: string
        closes_at: string
        subject: { name: string } | null
      }[]>(),
    supabase
      .from('cbt_attempts')
      .select('test_id, status, score, max_score')
      .returns<{ test_id: string; status: CbtAttemptStatus; score: number | null; max_score: number | null }[]>(),
  ])

  const attemptFor = new Map((attempts ?? []).map((a) => [a.test_id, a]))
  const now = Date.now()

  return (
    <div className="space-y-4">
      <PageHeader title="Tests" description="Papers set for your class." />

      {!tests || tests.length === 0 ? (
        <Card>
          <EmptyState
            title="No tests set"
            description="When your teacher publishes a paper for your class, it appears here."
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {tests.map((t) => {
            const attempt = attemptFor.get(t.id)
            const opens = new Date(t.opens_at).getTime()
            const closes = new Date(t.closes_at).getTime()
            const open = now >= opens && now <= closes
            const done = attempt?.status === 'submitted'

            return (
              <li key={t.id}>
                <Card>
                  <CardBody className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium">{t.title}</p>
                      <p className="text-[13px] text-ink-muted">
                        {t.subject?.name} · {t.duration_minutes} minutes ·{' '}
                        {open
                          ? `closes ${new Date(t.closes_at).toLocaleString()}`
                          : now < opens
                            ? `opens ${new Date(t.opens_at).toLocaleString()}`
                            : `closed ${new Date(t.closes_at).toLocaleDateString()}`}
                      </p>
                    </div>

                    {done ? (
                      <Badge tone="positive">
                        Submitted · {attempt?.score ?? 0}/{attempt?.max_score ?? 0}
                      </Badge>
                    ) : open ? (
                      <Link
                        href={`/portal/tests/${t.id}`}
                        className="inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-white"
                      >
                        {attempt?.status === 'in_progress' ? 'Continue' : 'Start'}
                      </Link>
                    ) : (
                      <Badge tone={now < opens ? 'warn' : 'neutral'}>
                        {now < opens ? 'Not open yet' : 'Closed'}
                      </Badge>
                    )}
                  </CardBody>
                </Card>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
