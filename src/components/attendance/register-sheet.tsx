'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { saveRegister } from '@/app/actions/attendance'
import { useAction } from '@/lib/use-action'
import { cn } from '@/lib/utils'
import type { AttendanceStatus } from '@/lib/database.types'
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle, ErrorNote, Input,
} from '@/components/ui/primitives'
import { PrintButton } from '@/components/print-button'

type Pupil = {
  enrollmentId: string
  name: string
  admissionNumber: string
  status: AttendanceStatus
  note: string
}

const OPTIONS: { value: AttendanceStatus; short: string; label: string; tone: string }[] = [
  { value: 'present', short: 'P', label: 'Present', tone: 'data-[on=true]:bg-positive data-[on=true]:text-white' },
  { value: 'absent', short: 'A', label: 'Absent', tone: 'data-[on=true]:bg-danger data-[on=true]:text-white' },
  { value: 'late', short: 'L', label: 'Late', tone: 'data-[on=true]:bg-warn data-[on=true]:text-white' },
  { value: 'excused', short: 'E', label: 'Excused', tone: 'data-[on=true]:bg-accent data-[on=true]:text-white' },
]

/**
 * Designed at 360px first: one row per pupil, four thumb-sized buttons, and a
 * single save that posts the whole register in one request.
 */
export function RegisterSheet({
  armId, armLabel, termId, date, pupils, alreadyTakenAt,
}: {
  armId: string
  armLabel: string
  termId: string
  date: string
  pupils: Pupil[]
  alreadyTakenAt: string | null
}) {
  const router = useRouter()
  const [entries, setEntries] = useState<Pupil[]>(pupils)
  const [saved, setSaved] = useState(false)
  const [registerDate, setRegisterDate] = useState(date)

  const action = useAction(
    async () =>
      saveRegister({
        class_arm_id: armId,
        term_id: termId,
        register_date: registerDate,
        entries: entries.map((e) => ({
          enrollment_id: e.enrollmentId,
          status: e.status,
          note: e.note,
        })),
      }),
    {
      onSuccess: () => {
        setSaved(true)
        router.refresh()
      },
    },
  )

  function setStatus(enrollmentId: string, status: AttendanceStatus) {
    setSaved(false)
    setEntries((current) =>
      current.map((e) => (e.enrollmentId === enrollmentId ? { ...e, status } : e)),
    )
  }

  function markAll(status: AttendanceStatus) {
    setSaved(false)
    setEntries((current) => current.map((e) => ({ ...e, status })))
  }

  const counts = OPTIONS.map((o) => ({
    ...o,
    count: entries.filter((e) => e.status === o.value).length,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          {alreadyTakenAt ? <Badge tone="accent">Taken {new Date(alreadyTakenAt).toLocaleTimeString()}</Badge> : null}
          <PrintButton />
        </div>
      </CardHeader>

      <CardBody className="space-y-4">
        {action.error ? <ErrorNote>{action.error}</ErrorNote> : null}
        {saved ? (
          <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-positive">
            Register saved.
          </p>
        ) : null}

        <div className="no-print flex flex-wrap items-end gap-2">
          <label className="flex-1 min-w-[10rem]">
            <span className="mb-1.5 block text-[13px] font-medium">Date</span>
            <Input
              type="date"
              value={registerDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(event) => {
                setRegisterDate(event.target.value)
                router.push(`/attendance/${armId}?date=${event.target.value}`)
              }}
            />
          </label>
          <Button variant="secondary" onClick={() => markAll('present')}>
            Mark all present
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 text-[13px]">
          {counts.map((c) => (
            <span key={c.value} className="rounded-full border border-line px-2.5 py-1 tabular-nums">
              {c.label}: <strong>{c.count}</strong>
            </span>
          ))}
        </div>

        <ul className="divide-y divide-line rounded-lg border border-line">
          {entries.map((pupil) => (
            <li key={pupil.enrollmentId} className="p-3">
              <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{pupil.name}</p>
                  <p className="font-mono text-[12px] text-ink-muted">{pupil.admissionNumber}</p>
                </div>

                <div
                  role="radiogroup"
                  aria-label={`Attendance for ${pupil.name}`}
                  className="no-print grid grid-cols-4 gap-1.5 sm:w-52"
                >
                  {OPTIONS.map((option) => {
                    const on = pupil.status === option.value
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={option.label}
                        data-on={on}
                        onClick={() => setStatus(pupil.enrollmentId, option.value)}
                        className={cn(
                          'h-11 rounded-lg border border-line text-sm font-semibold transition-colors',
                          'hover:bg-canvas',
                          option.tone,
                        )}
                      >
                        {option.short}
                      </button>
                    )
                  })}
                </div>

                <span className="print-only text-sm font-semibold capitalize">{pupil.status}</span>
              </div>
            </li>
          ))}
        </ul>

        <div className="no-print sticky bottom-3">
          <Button className="w-full" disabled={action.pending} onClick={() => action.run()}>
            {action.pending ? 'Saving…' : `Save register for ${armLabel}`}
          </Button>
        </div>
      </CardBody>
    </Card>
  )
}
