'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { saveAnswers, startAttempt, submitAttempt } from '@/app/actions/cbt'
import { cn } from '@/lib/utils'
import type { CbtQuestionKind } from '@/lib/database.types'
import { Badge, Button, Card, CardBody, ErrorNote } from '@/components/ui/primitives'

type Question = {
  id: string
  ordinal: number
  prompt: string
  kind: CbtQuestionKind
  marks: number
  options: { id: string; ordinal: number; label: string }[]
}

/**
 * Sitting a paper on a cheap phone over a patchy connection.
 *
 * Answers are held locally and flushed to the server every 20 seconds and on
 * every change after a short debounce, so a dropped connection costs at most
 * the last few seconds rather than the whole paper. The countdown shown here
 * is only a display: the deadline that counts is the one the server set when
 * the attempt started, and it refuses a late save regardless of this clock.
 */
export function ExamPaper({
  testId,
  existingAttempt,
  questions,
  saved,
}: {
  testId: string
  existingAttempt: { id: string; expiresAt: string } | null
  questions: Question[]
  saved: Record<string, string[]>
}) {
  const router = useRouter()
  const [attempt, setAttempt] = useState(existingAttempt)
  const [answers, setAnswers] = useState<Record<string, string[]>>(saved)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const dirty = useRef(false)

  const payload = useCallback(
    () =>
      Object.entries(answers).map(([question_id, option_ids]) => ({ question_id, option_ids })),
    [answers],
  )

  // Countdown, for the candidate's benefit only.
  useEffect(() => {
    if (!attempt) return
    const tick = () => {
      const left = Math.max(0, new Date(attempt.expiresAt).getTime() - Date.now())
      setRemaining(left)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [attempt])

  // Flush to the server periodically rather than on every tap.
  useEffect(() => {
    if (!attempt) return
    const id = setInterval(async () => {
      if (!dirty.current) return
      dirty.current = false
      const result = await saveAnswers({ attempt_id: attempt.id, answers: payload() })
      if (result.ok) setSavedAt(new Date())
    }, 20_000)
    return () => clearInterval(id)
  }, [attempt, payload])

  async function begin() {
    setBusy(true)
    setError(null)
    const result = await startAttempt(testId)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  function choose(question: Question, optionId: string) {
    dirty.current = true
    setAnswers((current) => {
      const existing = current[question.id] ?? []
      if (question.kind === 'multi_choice') {
        return {
          ...current,
          [question.id]: existing.includes(optionId)
            ? existing.filter((id) => id !== optionId)
            : [...existing, optionId],
        }
      }
      return { ...current, [question.id]: [optionId] }
    })
  }

  async function finish() {
    if (!attempt) return
    setBusy(true)
    setError(null)
    const result = await submitAttempt({ attempt_id: attempt.id, answers: payload() })
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    router.refresh()
  }

  if (!attempt) {
    return (
      <Card>
        <CardBody className="space-y-3">
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <p className="text-sm text-ink-muted">
            Your time starts the moment you open the paper and does not stop if you close it, so
            begin only when you are ready.
          </p>
          <Button className="w-full" disabled={busy} onClick={begin}>
            {busy ? 'Opening…' : 'Start the test'}
          </Button>
        </CardBody>
      </Card>
    )
  }

  const answered = Object.values(answers).filter((a) => a.length > 0).length
  const minutes = remaining === null ? null : Math.floor(remaining / 60_000)
  const seconds = remaining === null ? null : Math.floor((remaining % 60_000) / 1000)
  const nearlyOut = remaining !== null && remaining < 120_000

  return (
    <div className="space-y-4">
      {/* Sticky so the clock and the count stay visible while scrolling. */}
      <div className="sticky top-14 z-20 flex items-center justify-between gap-3 rounded-lg border border-line bg-surface px-3 py-2">
        <span className="text-[13px] text-ink-muted">
          {answered} of {questions.length} answered
        </span>
        <Badge tone={nearlyOut ? 'danger' : 'accent'}>
          <span aria-live={nearlyOut ? 'assertive' : 'off'} className="tabular-nums">
            {minutes === null ? '—' : `${minutes}:${String(seconds).padStart(2, '0')}`} left
          </span>
        </Badge>
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <ol className="space-y-3">
        {questions.map((q) => {
          const picked = answers[q.id] ?? []
          return (
            <li key={q.id}>
              <Card>
                <CardBody className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium">
                      <span className="text-ink-muted">{q.ordinal}.</span> {q.prompt}
                    </p>
                    <Badge>{q.marks} {q.marks === 1 ? 'mark' : 'marks'}</Badge>
                  </div>

                  {q.kind === 'multi_choice' ? (
                    <p className="text-[12px] text-ink-muted">Choose every answer that applies.</p>
                  ) : null}

                  <div
                    role={q.kind === 'multi_choice' ? 'group' : 'radiogroup'}
                    aria-label={`Question ${q.ordinal}`}
                    className="space-y-2"
                  >
                    {q.options.map((o) => {
                      const on = picked.includes(o.id)
                      return (
                        <button
                          key={o.id}
                          type="button"
                          role={q.kind === 'multi_choice' ? 'checkbox' : 'radio'}
                          aria-checked={on}
                          onClick={() => choose(q, o.id)}
                          className={cn(
                            'flex min-h-11 w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                            on
                              ? 'border-accent bg-accent-soft font-medium text-accent-on-soft'
                              : 'border-line hover:bg-canvas',
                          )}
                        >
                          <span
                            aria-hidden
                            className={cn(
                              'grid size-5 shrink-0 place-items-center border text-[11px]',
                              q.kind === 'multi_choice' ? 'rounded' : 'rounded-full',
                              on ? 'border-accent bg-accent text-white' : 'border-line',
                            )}
                          >
                            {on ? '✓' : ''}
                          </span>
                          {o.label}
                        </button>
                      )
                    })}
                  </div>
                </CardBody>
              </Card>
            </li>
          )
        })}
      </ol>

      <Card>
        <CardBody className="space-y-3">
          <p className="text-[13px] text-ink-muted">
            {savedAt
              ? `Answers saved at ${savedAt.toLocaleTimeString()}.`
              : 'Your answers are saved as you go.'}{' '}
            Submitting is final.
          </p>
          <Button className="w-full" disabled={busy} onClick={finish}>
            {busy ? 'Submitting…' : 'Submit the test'}
          </Button>
        </CardBody>
      </Card>
    </div>
  )
}
