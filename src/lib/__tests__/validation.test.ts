import { describe, expect, it } from 'vitest'
import {
  createSchoolSchema, studentImportRow, studentSchema, attendanceSchema,
} from '@/lib/validation'

describe('shared validation', () => {
  it('turns blank optional fields into null rather than empty strings', () => {
    const parsed = studentSchema.parse({
      admission_number: 'ADM/1',
      first_name: 'Chidi',
      last_name: 'Okafor',
      middle_name: '',
      date_of_birth: '',
      sex: '',
      admitted_on: '2025-09-01',
    })
    expect(parsed.middle_name).toBeNull()
    expect(parsed.date_of_birth).toBeNull()
    expect(parsed.sex).toBeNull()
  })

  it('trims and lower-cases a subdomain, and refuses an invalid one', () => {
    expect(createSchoolSchema.parse({
      name: 'Greenfield Academy',
      slug: '  GreenField  ',
      admin_email: 'Admin@Greenfield.test',
      preset_key: 'NG',
    })).toMatchObject({ slug: 'greenfield', admin_email: 'admin@greenfield.test' })

    for (const slug of ['a', '-bad', 'bad-', 'Has Space', 'under_score']) {
      expect(createSchoolSchema.safeParse({
        name: 'X School', slug, admin_email: 'a@b.test', preset_key: 'NG',
      }).success).toBe(false)
    }
  })

  it('normalises the sex column that spreadsheets actually contain', () => {
    expect(studentImportRow.parse({
      admission_number: 'A1', first_name: 'A', last_name: 'B', sex: 'M',
    }).sex).toBe('male')
    expect(studentImportRow.parse({
      admission_number: 'A1', first_name: 'A', last_name: 'B', sex: 'f',
    }).sex).toBe('female')
  })

  it('rejects an import row missing an admission number', () => {
    expect(studentImportRow.safeParse({ first_name: 'A', last_name: 'B' }).success).toBe(false)
  })

  it('refuses to save an empty register', () => {
    expect(attendanceSchema.safeParse({
      class_arm_id: '00000000-0000-4000-8000-000000000001',
      term_id: '00000000-0000-4000-8000-000000000002',
      register_date: '2026-01-12',
      entries: [],
    }).success).toBe(false)
  })
})
