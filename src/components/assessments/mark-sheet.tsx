'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { saveScores, setAssessmentStatus } from '@/app/actions/assessments'
import { useAction } from '@/lib/use-action'
import type { AssessmentStatus } from '@/lib/database.types'
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle, DataTable, ErrorNote, Input, Td, Th,
} from '@/components/ui/primitives'

type Pupil = { enrollmentId: string; name: string; admissionNumber: string; arm: string }

/**
 * Entering a whole class's marks. A blank cell means "not marked" and clears
 * any stored score, which is not the same as a zero and must not become one.
 */
export function MarkSheet({
  assessmentId,
  maxScore,
  status,
  pupils,
  existing,
}: {
  assessmentId: string
  maxScore: number
  status: AssessmentStatus
  pupils: Pupil[]
  existing: Record<string, string>
}) {
  const router = useRouter()
  const [scores, setScores] = useState<Record<string, string>>(existing)
  const [saved, setSaved] = useState(false)

  const save = useAction(
    async () =>
      saveScores({
        assessment_id: assessmentId,
        scores: pupils.map((p) => ({
          enrollment_id: p.enrollmentId,
          score: scores[p.enrollmentId] ?? '',
        })),
      }),
    {
      onSuccess: () => {
        setSaved(true)
        router.refresh()
      },
    },
  )

  const publish = useAction(
    async () => setAssessmentStatus(assessmentId, status === 'published' ? 'draft' : 'published'),
    { onSuccess: () => router.refresh() },
  )

  const entered = pupils.filter((p) => (scores[p.enrollmentId] ?? '') !== '').length
  const overMax = pupils.filter((p) => {
    const v = scores[p.enrollmentId]
    return v !== undefined && v !== '' && Number(v) > maxScore
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Mark sheet</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={entered === pupils.length ? 'positive' : 'warn'}>
            {entered} of {pupils.length} marked
          </Badge>
        </div>
      </CardHeader>

      <CardBody className="space-y-3">
        {save.error ? <ErrorNote>{save.error}</ErrorNote> : null}
        {publish.error ? <ErrorNote>{publish.error}</ErrorNote> : null}
        {overMax.length > 0 ? (
          <ErrorNote>
            {overMax.length} mark{overMax.length === 1 ? '' : 's'} above the maximum of {maxScore}.
          </ErrorNote>
        ) : null}
        {saved && !save.pending ? <p className="text-sm text-positive">Marks saved.</p> : null}
      </CardBody>

      <DataTable>
        <thead>
          <tr>
            <Th>Pupil</Th>
            <Th className="hidden sm:table-cell">Class arm</Th>
            <Th className="w-32 text-right">Score / {maxScore}</Th>
          </tr>
        </thead>
        <tbody>
          {pupils.map((p) => {
            const value = scores[p.enrollmentId] ?? ''
            const invalid = value !== '' && Number(value) > maxScore
            return (
              <tr key={p.enrollmentId}>
                <Td>
                  <span className="block font-medium">{p.name}</span>
                  <span className="font-mono text-[12px] text-ink-muted">{p.admissionNumber}</span>
                </Td>
                <Td className="hidden sm:table-cell">{p.arm}</Td>
                <Td className="text-right">
                  <Input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={maxScore}
                    step="0.5"
                    aria-label={`Score for ${p.name}`}
                    aria-invalid={invalid}
                    className="h-10 w-24 text-right tabular-nums"
                    value={value}
                    onChange={(event) => {
                      setSaved(false)
                      setScores((current) => ({ ...current, [p.enrollmentId]: event.target.value }))
                    }}
                  />
                </Td>
              </tr>
            )
          })}
        </tbody>
      </DataTable>

      <CardBody className="no-print flex flex-wrap items-center gap-2 border-t border-line">
        <Button disabled={save.pending || overMax.length > 0} onClick={() => save.run()}>
          {save.pending ? 'Saving…' : 'Save marks'}
        </Button>
        <Button
          variant="secondary"
          disabled={publish.pending}
          onClick={() => publish.run()}
        >
          {publish.pending
            ? 'Working…'
            : status === 'published'
              ? 'Unpublish from pupils'
              : 'Publish to pupils'}
        </Button>
        <p className="text-[13px] text-ink-muted">
          {status === 'published'
            ? 'Pupils can see these marks and their grade.'
            : 'Pupils cannot see a draft. Publish when the whole class is marked.'}
        </p>
      </CardBody>
    </Card>
  )
}
