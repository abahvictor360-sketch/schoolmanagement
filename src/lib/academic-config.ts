import { z } from 'zod'

/**
 * Academic rules are configuration, not code. Nothing in the application may
 * assume three terms, a 40/60 split, or A1-F9 bands: it all comes from here,
 * per school. A new country is a new preset entry below, never a new branch.
 */

export const gradeBandSchema = z.object({
  label: z.string().min(1).max(8),
  min_score: z.number().min(0).max(100),
  max_score: z.number().min(0).max(100),
  remark: z.string().min(1).max(40),
  is_pass: z.boolean(),
})

export const assessmentComponentSchema = z.object({
  key: z.string().min(1).max(24),
  label: z.string().min(1).max(40),
  weight: z.number().min(0).max(100),
  max_score: z.number().min(1).max(100),
})

export const termTemplateSchema = z.object({
  ordinal: z.number().int().min(1).max(12),
  label: z.string().min(2).max(40),
})

export const academicConfigSchema = z
  .object({
    terms_per_session: z.number().int().min(1).max(12),
    term_templates: z.array(termTemplateSchema).min(1),
    assessment_components: z.array(assessmentComponentSchema).min(1),
    grade_bands: z.array(gradeBandSchema).min(1),
    pass_mark: z.number().min(0).max(100),
    promotion_rule: z.object({
      kind: z.enum(['average_at_least', 'pass_core_subjects', 'manual']),
      threshold: z.number().min(0).max(100).optional(),
    }),
    currency: z.string().length(3),
    locale: z.string().min(2).max(10),
    timezone: z.string().min(3).max(64),
    date_format: z.string().min(3).max(24),
    class_level_templates: z.array(z.string().min(1)).default([]),
    subject_templates: z
      .array(z.object({ name: z.string().min(2), code: z.string().min(2), is_core: z.boolean() }))
      .default([]),
  })
  .refine((c) => c.term_templates.length === c.terms_per_session, {
    message: 'term_templates must have exactly terms_per_session entries',
    path: ['term_templates'],
  })
  .refine(
    (c) => Math.round(c.assessment_components.reduce((sum, a) => sum + a.weight, 0)) === 100,
    { message: 'assessment component weights must total 100', path: ['assessment_components'] },
  )

export type AcademicConfig = z.infer<typeof academicConfigSchema>

const NIGERIA: AcademicConfig = {
  terms_per_session: 3,
  term_templates: [
    { ordinal: 1, label: 'First Term' },
    { ordinal: 2, label: 'Second Term' },
    { ordinal: 3, label: 'Third Term' },
  ],
  assessment_components: [
    { key: 'ca1', label: 'First CA', weight: 20, max_score: 20 },
    { key: 'ca2', label: 'Second CA', weight: 20, max_score: 20 },
    { key: 'exam', label: 'Examination', weight: 60, max_score: 60 },
  ],
  grade_bands: [
    { label: 'A1', min_score: 75, max_score: 100, remark: 'Excellent', is_pass: true },
    { label: 'B2', min_score: 70, max_score: 74, remark: 'Very Good', is_pass: true },
    { label: 'B3', min_score: 65, max_score: 69, remark: 'Good', is_pass: true },
    { label: 'C4', min_score: 60, max_score: 64, remark: 'Credit', is_pass: true },
    { label: 'C5', min_score: 55, max_score: 59, remark: 'Credit', is_pass: true },
    { label: 'C6', min_score: 50, max_score: 54, remark: 'Credit', is_pass: true },
    { label: 'D7', min_score: 45, max_score: 49, remark: 'Pass', is_pass: true },
    { label: 'E8', min_score: 40, max_score: 44, remark: 'Pass', is_pass: true },
    { label: 'F9', min_score: 0, max_score: 39, remark: 'Fail', is_pass: false },
  ],
  pass_mark: 40,
  promotion_rule: { kind: 'average_at_least', threshold: 40 },
  currency: 'NGN',
  locale: 'en-NG',
  timezone: 'Africa/Lagos',
  date_format: 'dd/MM/yyyy',
  class_level_templates: [
    'Primary 1', 'Primary 2', 'Primary 3', 'Primary 4', 'Primary 5', 'Primary 6',
    'JSS 1', 'JSS 2', 'JSS 3', 'SSS 1', 'SSS 2', 'SSS 3',
  ],
  subject_templates: [
    { name: 'English Language', code: 'ENG', is_core: true },
    { name: 'Mathematics', code: 'MTH', is_core: true },
    { name: 'Basic Science', code: 'BSC', is_core: true },
    { name: 'Social Studies', code: 'SOS', is_core: false },
    { name: 'Civic Education', code: 'CIV', is_core: true },
    { name: 'Computer Studies', code: 'CMP', is_core: false },
  ],
}

const GHANA: AcademicConfig = {
  ...NIGERIA,
  term_templates: [
    { ordinal: 1, label: 'Term 1' },
    { ordinal: 2, label: 'Term 2' },
    { ordinal: 3, label: 'Term 3' },
  ],
  assessment_components: [
    { key: 'ca', label: 'Continuous Assessment', weight: 30, max_score: 30 },
    { key: 'exam', label: 'Examination', weight: 70, max_score: 70 },
  ],
  grade_bands: [
    { label: '1', min_score: 80, max_score: 100, remark: 'Excellent', is_pass: true },
    { label: '2', min_score: 70, max_score: 79, remark: 'Very Good', is_pass: true },
    { label: '3', min_score: 60, max_score: 69, remark: 'Good', is_pass: true },
    { label: '4', min_score: 50, max_score: 59, remark: 'Credit', is_pass: true },
    { label: '5', min_score: 40, max_score: 49, remark: 'Pass', is_pass: true },
    { label: '6', min_score: 0, max_score: 39, remark: 'Fail', is_pass: false },
  ],
  pass_mark: 40,
  currency: 'GHS',
  locale: 'en-GH',
  timezone: 'Africa/Accra',
  class_level_templates: [
    'Basic 1', 'Basic 2', 'Basic 3', 'Basic 4', 'Basic 5', 'Basic 6',
    'JHS 1', 'JHS 2', 'JHS 3',
  ],
}

const KENYA: AcademicConfig = {
  ...NIGERIA,
  term_templates: [
    { ordinal: 1, label: 'Term 1' },
    { ordinal: 2, label: 'Term 2' },
    { ordinal: 3, label: 'Term 3' },
  ],
  assessment_components: [
    { key: 'cat', label: 'CAT', weight: 30, max_score: 30 },
    { key: 'exam', label: 'End of Term Exam', weight: 70, max_score: 70 },
  ],
  grade_bands: [
    { label: 'A', min_score: 80, max_score: 100, remark: 'Exceeding expectation', is_pass: true },
    { label: 'B', min_score: 65, max_score: 79, remark: 'Meeting expectation', is_pass: true },
    { label: 'C', min_score: 50, max_score: 64, remark: 'Approaching expectation', is_pass: true },
    { label: 'D', min_score: 0, max_score: 49, remark: 'Below expectation', is_pass: false },
  ],
  pass_mark: 50,
  currency: 'KES',
  locale: 'en-KE',
  timezone: 'Africa/Nairobi',
  class_level_templates: [
    'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4', 'Grade 5', 'Grade 6',
    'Grade 7', 'Grade 8', 'Grade 9',
  ],
}

export const PRESETS = {
  NG: { key: 'NG', label: 'Nigeria (WAEC-style, 3 terms, 40/60 CA split)', config: NIGERIA },
  GH: { key: 'GH', label: 'Ghana (3 terms, 30/70 CA split)', config: GHANA },
  KE: { key: 'KE', label: 'Kenya (CBC, 3 terms, 30/70 CA split)', config: KENYA },
} as const

export type PresetKey = keyof typeof PRESETS

export function presetConfig(key: string): AcademicConfig {
  const preset = PRESETS[key as PresetKey]
  return preset ? preset.config : NIGERIA
}

export function gradeFor(config: AcademicConfig, score: number) {
  return config.grade_bands.find((b) => score >= b.min_score && score <= b.max_score) ?? null
}

export function formatMoney(config: AcademicConfig, amount: number) {
  return new Intl.NumberFormat(config.locale, { style: 'currency', currency: config.currency }).format(amount)
}
