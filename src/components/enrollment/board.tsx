'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { enrollStudents, moveEnrollment } from '@/app/actions/enrollment'
import { useAction } from '@/lib/use-action'
import type { ArmOption, TermOption } from '@/lib/queries'
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle, EmptyState, ErrorNote, Input, Select,
} from '@/components/ui/primitives'
import { PrintButton } from '@/components/print-button'

type RosterEntry = {
  enrollmentId: string
  status: string
  id: string
  name: string
  admissionNumber: string
}

type Candidate = { id: string; name: string; admissionNumber: string }

export function EnrollmentBoard({
  terms, arms, activeTermId, activeArmId, roster, candidates,
}: {
  terms: TermOption[]
  arms: ArmOption[]
  activeTermId: string
  activeArmId: string
  roster: RosterEntry[]
  candidates: Candidate[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [moveTarget, setMoveTarget] = useState('')

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return candidates
    return candidates.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.admissionNumber.toLowerCase().includes(needle),
    )
  }, [candidates, search])

  const enroll = useAction(
    async () =>
      enrollStudents({
        term_id: activeTermId,
        class_arm_id: activeArmId,
        student_ids: [...selected],
      }),
    {
      onSuccess: () => {
        setSelected(new Set())
        router.refresh()
      },
    },
  )

  const move = useAction(
    async (enrollmentId: string) =>
      moveEnrollment({ enrollment_id: enrollmentId, class_arm_id: moveTarget }),
    { onSuccess: () => router.refresh() },
  )

  function navigate(next: { term?: string; arm?: string }) {
    const params = new URLSearchParams({
      term: next.term ?? activeTermId,
      arm: next.arm ?? activeArmId,
    })
    router.push(`/enrollment?${params}`)
  }

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const armLabel = arms.find((a) => a.id === activeArmId)?.full_label ?? ''

  return (
    <div className="space-y-4">
      <div className="no-print grid gap-3 sm:grid-cols-2">
        <label>
          <span className="mb-1.5 block text-[13px] font-medium">Term</span>
          <Select value={activeTermId} onChange={(event) => navigate({ term: event.target.value })}>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.session_label} · {t.label}
                {t.is_current ? ' (current)' : ''}
              </option>
            ))}
          </Select>
        </label>
        <label>
          <span className="mb-1.5 block text-[13px] font-medium">Class arm</span>
          <Select value={activeArmId} onChange={(event) => navigate({ arm: event.target.value })}>
            {arms.map((a) => (
              <option key={a.id} value={a.id}>
                {a.full_label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Roster · {armLabel}</CardTitle>
            <div className="flex items-center gap-2">
              <Badge tone="accent">{roster.length} enrolled</Badge>
              <PrintButton label="Print roster" />
            </div>
          </CardHeader>
          {roster.length === 0 ? (
            <EmptyState title="Nobody enrolled yet" description="Select students on the right and enroll them." />
          ) : (
            <CardBody className="space-y-2">
              <label className="no-print block">
                <span className="mb-1.5 block text-[13px] font-medium">Move a student to</span>
                <Select value={moveTarget} onChange={(event) => setMoveTarget(event.target.value)}>
                  <option value="">Choose a class arm…</option>
                  {arms
                    .filter((a) => a.id !== activeArmId)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.full_label}
                      </option>
                    ))}
                </Select>
              </label>

              {move.error ? <ErrorNote>{move.error}</ErrorNote> : null}

              <ul className="divide-y divide-line">
                {roster.map((r) => (
                  <li key={r.enrollmentId} className="flex items-center gap-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{r.name}</p>
                      <p className="font-mono text-[12px] text-ink-muted">{r.admissionNumber}</p>
                    </div>
                    {r.status !== 'active' ? (
                      <Badge className="capitalize">{r.status}</Badge>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="no-print"
                      disabled={!moveTarget || move.pending}
                      onClick={() => move.run(r.enrollmentId)}
                    >
                      Move
                    </Button>
                  </li>
                ))}
              </ul>
            </CardBody>
          )}
        </Card>

        <Card className="no-print">
          <CardHeader>
            <CardTitle>Not enrolled this term</CardTitle>
            <Badge>{filtered.length}</Badge>
          </CardHeader>
          <CardBody className="space-y-3">
            {enroll.error ? <ErrorNote>{enroll.error}</ErrorNote> : null}

            <Input
              type="search"
              placeholder="Search by name or admission number"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />

            {filtered.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-muted">
                Every active student already has an enrollment for this term.
              </p>
            ) : (
              <>
                <div className="max-h-[420px] overflow-y-auto rounded-lg border border-line">
                  <ul className="divide-y divide-line">
                    {filtered.slice(0, 300).map((c) => (
                      <li key={c.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-canvas">
                          <input
                            type="checkbox"
                            className="size-4"
                            checked={selected.has(c.id)}
                            onChange={() => toggle(c.id)}
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm">{c.name}</span>
                            <span className="block font-mono text-[12px] text-ink-muted">
                              {c.admissionNumber}
                            </span>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button disabled={selected.size === 0 || enroll.pending} onClick={() => enroll.run()}>
                    {enroll.pending ? 'Enrolling…' : `Enroll ${selected.size} into ${armLabel}`}
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => setSelected(new Set(filtered.map((c) => c.id)))}
                  >
                    Select all shown
                  </Button>
                  {selected.size > 0 ? (
                    <Button variant="ghost" onClick={() => setSelected(new Set())}>
                      Clear
                    </Button>
                  ) : null}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
