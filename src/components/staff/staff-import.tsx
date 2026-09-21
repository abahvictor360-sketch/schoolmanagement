'use client'

import type { z } from 'zod'
import { CsvImport } from '@/components/csv-import'
import { staffImportRow } from '@/lib/validation'
import { importStaff } from '@/app/actions/people'

export function StaffImport() {
  return (
    <CsvImport
      schema={staffImportRow}
      doneHref="/staff"
      columns={[
        { key: 'staff_number', label: 'Staff no.', required: true },
        { key: 'full_name', label: 'Full name', required: true },
        { key: 'email', label: 'Email' },
        { key: 'phone', label: 'Phone' },
        { key: 'designation', label: 'Designation' },
      ]}
      sampleRow={{
        staff_number: 'STF/001',
        full_name: 'Amaka Nwosu',
        email: 'amaka@example.edu.ng',
        phone: '08030000000',
        designation: 'Mathematics teacher',
      }}
      commit={(rows: z.infer<typeof staffImportRow>[]) => importStaff({ rows })}
    />
  )
}
