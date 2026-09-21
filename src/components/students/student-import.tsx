'use client'

import { useState } from 'react'
import type { z } from 'zod'
import { CsvImport } from '@/components/csv-import'
import { studentImportRow } from '@/lib/validation'
import { importStudents } from '@/app/actions/people'
import { Field, Select } from '@/components/ui/primitives'

export function StudentImport({
  terms,
  armNames,
}: {
  terms: { id: string; label: string; isCurrent: boolean }[]
  armNames: string[]
}) {
  const [termId, setTermId] = useState(terms.find((t) => t.isCurrent)?.id ?? '')

  return (
    <CsvImport
      schema={studentImportRow}
      doneHref="/students"
      columns={[
        { key: 'admission_number', label: 'Admission no.', required: true },
        { key: 'last_name', label: 'Last name', required: true },
        { key: 'first_name', label: 'First name', required: true },
        { key: 'middle_name', label: 'Middle name' },
        { key: 'date_of_birth', label: 'Date of birth' },
        { key: 'sex', label: 'Sex' },
        { key: 'class_arm', label: 'Class arm' },
      ]}
      sampleRow={{
        admission_number: 'ADM/2025/001',
        last_name: 'Okafor',
        first_name: 'Chidi',
        middle_name: 'Emeka',
        date_of_birth: '2013-04-18',
        sex: 'male',
        class_arm: armNames[0] ?? 'JSS 1 A',
      }}
      extraControls={
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Enroll into term"
            hint="Rows with a class arm are enrolled into that arm for this term."
          >
            <Select value={termId} onChange={(event) => setTermId(event.target.value)}>
              <option value="">Do not enroll</option>
              {terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                  {t.isCurrent ? ' (current)' : ''}
                </option>
              ))}
            </Select>
          </Field>
          <div className="text-[13px] text-ink-muted">
            <p className="font-medium text-ink">Class arm names</p>
            <p className="mt-1">
              Write them exactly as the school has them, for example{' '}
              <code className="rounded bg-canvas px-1">{armNames[0] ?? 'JSS 1 A'}</code>. An arm that
              does not match is skipped, and the student is still created.
            </p>
          </div>
        </div>
      }
      commit={(rows: z.infer<typeof studentImportRow>[]) => importStudents({ rows, term_id: termId })}
    />
  )
}
