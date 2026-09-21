'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { rolloverTerm } from '@/app/actions/enrollment'
import { useAction } from '@/lib/use-action'
import type { ArmOption, TermOption } from '@/lib/queries'
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle, ErrorNote, Select,
} from '@/components/ui/primitives'

export function RolloverForm({
  terms, arms, counts,
}: {
  terms: TermOption[]
  arms: ArmOption[]
  counts: Record<string, Record<string, number>>
}) {
  const router = useRouter()
  const currentIndex = Math.max(0, terms.findIndex((t) => t.is_current))
  const [fromTerm, setFromTerm] = useState(terms[currentIndex]?.id ?? terms[0]!.id)
  const [toTerm, setToTerm] = useState(terms[currentIndex + 1]?.id ?? terms[terms.length - 1]!.id)
  const [mapping, setMapping] = useState<Record<string, string>>(() => suggest(arms))
  const [moved, setMoved] = useState<number | null>(null)

  const populated = useMemo(
    () => arms.filter((a) => (counts[fromTerm]?.[a.id] ?? 0) > 0),
    [arms, counts, fromTerm],
  )

  const action = useAction(
    async () =>
      rolloverTerm({
        from_term: fromTerm,
        to_term: toTerm,
        mapping: Object.fromEntries(
          Object.entries(mapping).filter(([armId, target]) =>
            Boolean(target) && populated.some((a) => a.id === armId),
          ),
        ),
      }),
    {
      onSuccess: (data) => {
        setMoved((data as { moved: number } | undefined)?.moved ?? 0)
        router.refresh()
      },
    },
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Plan the rollover</CardTitle>
        <Badge tone="accent">
          {populated.reduce((sum, a) => sum + (counts[fromTerm]?.[a.id] ?? 0), 0)} students
        </Badge>
      </CardHeader>

      <CardBody className="space-y-4">
        {action.error ? <ErrorNote>{action.error}</ErrorNote> : null}
        {moved !== null ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-positive">
            {moved} enrollment{moved === 1 ? '' : 's'} carried into the new term.
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className="mb-1.5 block text-[13px] font-medium">Roll from</span>
            <Select value={fromTerm} onChange={(event) => setFromTerm(event.target.value)}>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.session_label} · {t.label}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span className="mb-1.5 block text-[13px] font-medium">Roll into</span>
            <Select value={toTerm} onChange={(event) => setToTerm(event.target.value)}>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.session_label} · {t.label}
                </option>
              ))}
            </Select>
          </label>
        </div>

        {populated.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">
            No active enrollments in that term.
          </p>
        ) : (
          <ul className="divide-y divide-line rounded-lg border border-line">
            {populated.map((arm) => (
              <li key={arm.id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-sm font-medium">{arm.full_label}</span>
                  <Badge>{counts[fromTerm]?.[arm.id] ?? 0}</Badge>
                </div>
                <label className="sm:w-64">
                  <span className="sr-only">Destination for {arm.full_label}</span>
                  <Select
                    value={mapping[arm.id] ?? ''}
                    onChange={(event) =>
                      setMapping((current) => ({ ...current, [arm.id]: event.target.value }))
                    }
                  >
                    <option value="">Do not carry over</option>
                    {arms.map((target) => (
                      <option key={target.id} value={target.id}>
                        {target.full_label}
                        {target.id === arm.id ? ' (repeat)' : ''}
                      </option>
                    ))}
                  </Select>
                </label>
              </li>
            ))}
          </ul>
        )}

        <Button
          disabled={action.pending || fromTerm === toTerm || populated.length === 0}
          onClick={() => action.run()}
        >
          {action.pending ? 'Rolling over…' : 'Run rollover'}
        </Button>
      </CardBody>
    </Card>
  )
}

/** Default each arm to the same-labelled arm one class level up. */
function suggest(arms: ArmOption[]): Record<string, string> {
  const mapping: Record<string, string> = {}
  for (const arm of arms) {
    const next = arms.find(
      (a) => a.level_ordinal === arm.level_ordinal + 1 && a.label === arm.label,
    )
    if (next) mapping[arm.id] = next.id
  }
  return mapping
}
