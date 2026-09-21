'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { PRESETS, type PresetKey } from '@/lib/academic-config'
import { completeOnboarding } from '@/app/actions/setup'
import { useAction } from '@/lib/use-action'
import { cn } from '@/lib/utils'
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle, ErrorNote, Field, Input, Select, Textarea,
} from '@/components/ui/primitives'

type Term = { ordinal: number; label: string; starts_on: string; ends_on: string }

const STEPS = ['School profile', 'Academic preset', 'Session and terms', 'Classes', 'Subjects'] as const

/**
 * First-login setup. Every value here is written as configuration, so a school
 * in another country gets a different calendar and grading scheme without a
 * line of new code.
 */
export function OnboardingWizard({
  school,
  presetKey,
}: {
  school: { name: string; address: string; phone: string; email: string }
  presetKey: PresetKey
}) {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [profile, setProfile] = useState(school)
  const [preset, setPreset] = useState<PresetKey>(presetKey)
  const [sessionLabel, setSessionLabel] = useState(defaultSessionLabel())
  const [sessionStart, setSessionStart] = useState(`${new Date().getFullYear()}-09-01`)
  const [sessionEnd, setSessionEnd] = useState(`${new Date().getFullYear() + 1}-07-31`)
  const [terms, setTerms] = useState<Term[]>(() => defaultTerms(presetKey, new Date().getFullYear()))
  const [currentTerm, setCurrentTerm] = useState(1)
  const [levels, setLevels] = useState<string[]>(PRESETS[presetKey].config.class_level_templates)
  const [armLabels, setArmLabels] = useState('A, B')
  const [subjects, setSubjects] = useState(PRESETS[presetKey].config.subject_templates)

  const arms = useMemo(
    () => armLabels.split(',').map((a) => a.trim()).filter(Boolean),
    [armLabels],
  )

  const action = useAction(
    async () =>
      completeOnboarding({
        profile: {
          name: profile.name,
          address: profile.address,
          phone: profile.phone,
          email: profile.email,
        },
        preset_key: preset,
        session: { label: sessionLabel, starts_on: sessionStart, ends_on: sessionEnd },
        terms,
        class_levels: levels.map((label, index) => ({ label, ordinal: index + 1 })),
        arms_per_level: arms,
        subjects,
        current_term_ordinal: currentTerm,
      }),
    {
      onSuccess: () => {
        router.push('/dashboard')
        router.refresh()
      },
    },
  )

  function applyPreset(key: PresetKey) {
    setPreset(key)
    setLevels(PRESETS[key].config.class_level_templates)
    setSubjects(PRESETS[key].config.subject_templates)
    setTerms(defaultTerms(key, new Date(sessionStart).getFullYear()))
    setCurrentTerm(1)
  }

  const canAdvance =
    (step === 0 && profile.name.trim().length >= 2) ||
    step === 1 ||
    (step === 2 && sessionLabel.trim().length >= 2 && terms.length > 0) ||
    (step === 3 && levels.length > 0 && arms.length > 0) ||
    (step === 4 && subjects.length > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Set up {profile.name || 'your school'}</CardTitle>
        <Badge tone="accent">
          Step {step + 1} of {STEPS.length}
        </Badge>
      </CardHeader>

      <div className="no-print flex gap-1 border-b border-line px-4 pb-3 sm:px-5">
        {STEPS.map((label, index) => (
          <div key={label} className="flex-1">
            <div
              className={cn(
                'h-1 rounded-full',
                index <= step ? 'bg-accent' : 'bg-line',
              )}
            />
            <p className="mt-1.5 hidden text-[11px] text-ink-muted sm:block">{label}</p>
          </div>
        ))}
      </div>

      <CardBody className="space-y-4">
        {action.error ? <ErrorNote>{action.error}</ErrorNote> : null}

        {step === 0 ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="School name" className="sm:col-span-2">
              <Input
                value={profile.name}
                onChange={(event) => setProfile({ ...profile, name: event.target.value })}
              />
            </Field>
            <Field label="Phone">
              <Input
                inputMode="tel"
                value={profile.phone}
                onChange={(event) => setProfile({ ...profile, phone: event.target.value })}
              />
            </Field>
            <Field label="Email">
              <Input
                type="email"
                value={profile.email}
                onChange={(event) => setProfile({ ...profile, email: event.target.value })}
              />
            </Field>
            <Field label="Address" className="sm:col-span-2">
              <Textarea
                rows={3}
                value={profile.address}
                onChange={(event) => setProfile({ ...profile, address: event.target.value })}
              />
            </Field>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">
              The preset sets your term count, assessment weighting, grade bands, pass mark,
              currency and date format. You can change any of it afterwards in Settings.
            </p>
            {Object.values(PRESETS).map((option) => (
              <label
                key={option.key}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors',
                  preset === option.key ? 'border-accent bg-accent-soft/40' : 'border-line hover:bg-canvas',
                )}
              >
                <input
                  type="radio"
                  name="preset"
                  className="mt-1"
                  checked={preset === option.key}
                  onChange={() => applyPreset(option.key as PresetKey)}
                />
                <span>
                  <span className="block text-sm font-medium">{option.label}</span>
                  <span className="mt-1 block text-[13px] text-ink-muted">
                    {option.config.assessment_components.map((c) => `${c.label} ${c.weight}%`).join(' · ')}
                    {' · '}
                    Grades {option.config.grade_bands.map((b) => b.label).join(' ')}
                  </span>
                </span>
              </label>
            ))}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Session label" hint="For example 2025/2026">
                <Input value={sessionLabel} onChange={(event) => setSessionLabel(event.target.value)} />
              </Field>
              <Field label="Starts">
                <Input type="date" value={sessionStart} onChange={(event) => setSessionStart(event.target.value)} />
              </Field>
              <Field label="Ends">
                <Input type="date" value={sessionEnd} onChange={(event) => setSessionEnd(event.target.value)} />
              </Field>
            </div>

            <div className="space-y-2">
              <p className="text-[13px] font-medium">Terms</p>
              {terms.map((term, index) => (
                <div key={term.ordinal} className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-4">
                  <Field label="Label">
                    <Input
                      value={term.label}
                      onChange={(event) =>
                        setTerms(terms.map((t, i) => (i === index ? { ...t, label: event.target.value } : t)))
                      }
                    />
                  </Field>
                  <Field label="Starts">
                    <Input
                      type="date"
                      value={term.starts_on}
                      onChange={(event) =>
                        setTerms(terms.map((t, i) => (i === index ? { ...t, starts_on: event.target.value } : t)))
                      }
                    />
                  </Field>
                  <Field label="Ends">
                    <Input
                      type="date"
                      value={term.ends_on}
                      onChange={(event) =>
                        setTerms(terms.map((t, i) => (i === index ? { ...t, ends_on: event.target.value } : t)))
                      }
                    />
                  </Field>
                  <div className="flex items-end gap-2 pb-2">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="current-term"
                        checked={currentTerm === term.ordinal}
                        onChange={() => setCurrentTerm(term.ordinal)}
                      />
                      Current
                    </label>
                    {terms.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setTerms(
                            terms
                              .filter((_, i) => i !== index)
                              .map((t, i) => ({ ...t, ordinal: i + 1 })),
                          )
                        }
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  setTerms([
                    ...terms,
                    {
                      ordinal: terms.length + 1,
                      label: `Term ${terms.length + 1}`,
                      starts_on: sessionStart,
                      ends_on: sessionEnd,
                    },
                  ])
                }
              >
                Add a term
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-4">
            <Field label="Class arms per level" hint="Comma separated, for example A, B, Gold">
              <Input value={armLabels} onChange={(event) => setArmLabels(event.target.value)} />
            </Field>

            <div className="space-y-2">
              <p className="text-[13px] font-medium">
                Class levels <span className="text-ink-muted">(in promotion order)</span>
              </p>
              {levels.map((level, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={level}
                    aria-label={`Class level ${index + 1}`}
                    onChange={(event) =>
                      setLevels(levels.map((l, i) => (i === index ? event.target.value : l)))
                    }
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setLevels(levels.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>
              ))}
              <Button type="button" variant="secondary" size="sm" onClick={() => setLevels([...levels, ''])}>
                Add a level
              </Button>
              <p className="text-[13px] text-ink-muted">
                {levels.filter(Boolean).length} levels × {arms.length} arms ={' '}
                {levels.filter(Boolean).length * arms.length} class arms
              </p>
            </div>
          </div>
        ) : null}

        {step === 4 ? (
          <div className="space-y-2">
            <p className="text-[13px] font-medium">Subjects</p>
            {subjects.map((subject, index) => (
              <div key={index} className="grid gap-2 sm:grid-cols-[1fr_120px_auto]">
                <Input
                  value={subject.name}
                  aria-label={`Subject ${index + 1} name`}
                  onChange={(event) =>
                    setSubjects(subjects.map((s, i) => (i === index ? { ...s, name: event.target.value } : s)))
                  }
                />
                <Input
                  value={subject.code}
                  aria-label={`Subject ${index + 1} code`}
                  onChange={(event) =>
                    setSubjects(
                      subjects.map((s, i) => (i === index ? { ...s, code: event.target.value.toUpperCase() } : s)),
                    )
                  }
                />
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[13px]">
                    <input
                      type="checkbox"
                      checked={subject.is_core}
                      onChange={(event) =>
                        setSubjects(
                          subjects.map((s, i) => (i === index ? { ...s, is_core: event.target.checked } : s)),
                        )
                      }
                    />
                    Core
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSubjects(subjects.filter((_, i) => i !== index))}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setSubjects([...subjects, { name: '', code: '', is_core: true }])}
            >
              Add a subject
            </Button>
          </div>
        ) : null}
      </CardBody>

      <CardBody className="flex items-center justify-between gap-2 border-t border-line">
        <Button variant="secondary" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button disabled={!canAdvance} onClick={() => setStep((s) => s + 1)}>
            Continue
          </Button>
        ) : (
          <Button disabled={action.pending || !canAdvance} onClick={() => action.run()}>
            {action.pending ? 'Setting up…' : 'Finish setup'}
          </Button>
        )}
      </CardBody>
    </Card>
  )
}

function defaultSessionLabel() {
  const year = new Date().getFullYear()
  return `${year}/${year + 1}`
}

function defaultTerms(key: PresetKey, year: number): Term[] {
  const spans = [
    { start: `${year}-09-01`, end: `${year}-12-15` },
    { start: `${year + 1}-01-08`, end: `${year + 1}-04-05` },
    { start: `${year + 1}-04-22`, end: `${year + 1}-07-25` },
  ]
  return PRESETS[key].config.term_templates.map((t, index) => ({
    ordinal: t.ordinal,
    label: t.label,
    starts_on: spans[index]?.start ?? `${year}-09-01`,
    ends_on: spans[index]?.end ?? `${year + 1}-07-25`,
  }))
}
