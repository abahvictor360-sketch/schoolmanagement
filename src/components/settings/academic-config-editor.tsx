'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { AcademicConfig } from '@/lib/academic-config'
import { updateAcademicConfig } from '@/app/actions/setup'
import { useAction } from '@/lib/use-action'
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle, DataTable, ErrorNote, Field, Input, Select, Td, Th,
} from '@/components/ui/primitives'

/**
 * Editing grade bands, CA weighting and the pass mark is an ordinary settings
 * change, not a deployment.
 */
export function AcademicConfigEditor({ config }: { config: AcademicConfig }) {
  const router = useRouter()
  const [draft, setDraft] = useState<AcademicConfig>(config)
  const [saved, setSaved] = useState(false)

  const action = useAction(async () => updateAcademicConfig(draft), {
    onSuccess: () => {
      setSaved(true)
      router.refresh()
    },
  })

  const weightTotal = draft.assessment_components.reduce((sum, c) => sum + Number(c.weight || 0), 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Assessment and grading</CardTitle>
        <Badge tone={Math.round(weightTotal) === 100 ? 'positive' : 'danger'}>
          Weights total {weightTotal}%
        </Badge>
      </CardHeader>

      <CardBody className="space-y-5">
        {action.error ? <ErrorNote>{action.error}</ErrorNote> : null}
        {saved ? <p className="text-sm text-positive">Saved.</p> : null}

        <section className="space-y-2">
          <h3 className="text-[13px] font-semibold">Assessment components</h3>
          {draft.assessment_components.map((component, index) => (
            <div key={index} className="grid gap-2 sm:grid-cols-[1fr_110px_110px_auto]">
              <Input
                aria-label={`Component ${index + 1} label`}
                value={component.label}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    assessment_components: draft.assessment_components.map((c, i) =>
                      i === index ? { ...c, label: event.target.value } : c,
                    ),
                  })
                }
              />
              <Input
                type="number"
                aria-label={`Component ${index + 1} weight`}
                value={component.weight}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    assessment_components: draft.assessment_components.map((c, i) =>
                      i === index ? { ...c, weight: Number(event.target.value) } : c,
                    ),
                  })
                }
              />
              <Input
                type="number"
                aria-label={`Component ${index + 1} maximum score`}
                value={component.max_score}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    assessment_components: draft.assessment_components.map((c, i) =>
                      i === index ? { ...c, max_score: Number(event.target.value) } : c,
                    ),
                  })
                }
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setDraft({
                    ...draft,
                    assessment_components: draft.assessment_components.filter((_, i) => i !== index),
                  })
                }
              >
                Remove
              </Button>
            </div>
          ))}
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              setDraft({
                ...draft,
                assessment_components: [
                  ...draft.assessment_components,
                  { key: `c${draft.assessment_components.length + 1}`, label: '', weight: 0, max_score: 10 },
                ],
              })
            }
          >
            Add a component
          </Button>
        </section>

        <section className="space-y-2">
          <h3 className="text-[13px] font-semibold">Grade bands</h3>
          <DataTable className="min-w-[520px]">
            <thead>
              <tr>
                <Th>Label</Th>
                <Th>From</Th>
                <Th>To</Th>
                <Th>Remark</Th>
                <Th>Pass</Th>
              </tr>
            </thead>
            <tbody>
              {draft.grade_bands.map((band, index) => (
                <tr key={index}>
                  <Td>
                    <Input
                      className="h-9"
                      aria-label={`Band ${index + 1} label`}
                      value={band.label}
                      onChange={(event) => updateBand(index, { label: event.target.value })}
                    />
                  </Td>
                  <Td>
                    <Input
                      className="h-9"
                      type="number"
                      aria-label={`Band ${index + 1} minimum`}
                      value={band.min_score}
                      onChange={(event) => updateBand(index, { min_score: Number(event.target.value) })}
                    />
                  </Td>
                  <Td>
                    <Input
                      className="h-9"
                      type="number"
                      aria-label={`Band ${index + 1} maximum`}
                      value={band.max_score}
                      onChange={(event) => updateBand(index, { max_score: Number(event.target.value) })}
                    />
                  </Td>
                  <Td>
                    <Input
                      className="h-9"
                      aria-label={`Band ${index + 1} remark`}
                      value={band.remark}
                      onChange={(event) => updateBand(index, { remark: event.target.value })}
                    />
                  </Td>
                  <Td>
                    <input
                      type="checkbox"
                      aria-label={`Band ${index + 1} is a pass`}
                      checked={band.is_pass}
                      onChange={(event) => updateBand(index, { is_pass: event.target.checked })}
                    />
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <Field label="Pass mark">
            <Input
              type="number"
              value={draft.pass_mark}
              onChange={(event) => setDraft({ ...draft, pass_mark: Number(event.target.value) })}
            />
          </Field>
          <Field label="Promotion rule">
            <Select
              value={draft.promotion_rule.kind}
              onChange={(event) =>
                setDraft({
                  ...draft,
                  promotion_rule: {
                    ...draft.promotion_rule,
                    kind: event.target.value as AcademicConfig['promotion_rule']['kind'],
                  },
                })
              }
            >
              <option value="average_at_least">Average at least the threshold</option>
              <option value="pass_core_subjects">Pass all core subjects</option>
              <option value="manual">Decided by the school each term</option>
            </Select>
          </Field>
          <Field label="Currency">
            <Input
              value={draft.currency}
              maxLength={3}
              onChange={(event) => setDraft({ ...draft, currency: event.target.value.toUpperCase() })}
            />
          </Field>
          <Field label="Locale">
            <Input value={draft.locale} onChange={(event) => setDraft({ ...draft, locale: event.target.value })} />
          </Field>
          <Field label="Timezone">
            <Input value={draft.timezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })} />
          </Field>
          <Field label="Date format">
            <Input
              value={draft.date_format}
              onChange={(event) => setDraft({ ...draft, date_format: event.target.value })}
            />
          </Field>
        </section>

        <Button
          disabled={action.pending}
          onClick={() => {
            setSaved(false)
            action.run()
          }}
        >
          {action.pending ? 'Saving…' : 'Save academic rules'}
        </Button>
      </CardBody>
    </Card>
  )

  function updateBand(index: number, patch: Partial<AcademicConfig['grade_bands'][number]>) {
    setDraft((current) => ({
      ...current,
      grade_bands: current.grade_bands.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }))
  }
}
