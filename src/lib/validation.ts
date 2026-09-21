import { z } from 'zod'

/** One definition per shape, used by the browser form and the server action. */

const trimmed = (min: number, max: number) => z.string().trim().min(min).max(max)

/** Empty form fields become SQL NULL, never the empty string. */
const optionalText = (max: number) =>
  z.string().trim().max(max).optional().transform((v) => v || null)
const optionalEmail = () =>
  z.union([z.literal(''), z.string().trim().toLowerCase().email('Enter a valid email address')])
    .optional()
    .transform((v) => v || null)
const optionalDate = () =>
  z.union([z.literal(''), z.string().date()]).optional().transform((v) => v || null)
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.union([z.literal(''), z.enum(values)]).optional().transform((v) => (v || null) as T[number] | null)

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters'),
})

export const signUpSchema = credentialsSchema.extend({
  full_name: trimmed(2, 120),
})

export const schoolProfileSchema = z.object({
  name: trimmed(2, 160),
  address: optionalText(400),
  phone: optionalText(40),
  email: optionalEmail(),
})

export const createSchoolSchema = z.object({
  name: trimmed(2, 160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/, 'Lower-case letters, digits and hyphens, 3-40 characters'),
  admin_email: z.string().trim().toLowerCase().email('Enter the first administrator’s email'),
  preset_key: z.enum(['NG', 'GH', 'KE']),
})

export const academicSessionSchema = z
  .object({
    label: trimmed(2, 40),
    starts_on: z.string().date(),
    ends_on: z.string().date(),
  })
  .refine((v) => v.ends_on > v.starts_on, { message: 'End date must follow the start date', path: ['ends_on'] })

export const termSchema = z
  .object({
    id: z.string().uuid().optional(),
    ordinal: z.coerce.number().int().min(1).max(12),
    label: trimmed(2, 40),
    starts_on: z.string().date(),
    ends_on: z.string().date(),
  })
  .refine((v) => v.ends_on > v.starts_on, { message: 'End date must follow the start date', path: ['ends_on'] })

export const classLevelSchema = z.object({
  label: trimmed(1, 60),
  ordinal: z.coerce.number().int().min(1).max(100),
})

export const classArmSchema = z.object({
  class_level_id: z.string().uuid('Choose a class level'),
  label: trimmed(1, 30),
  capacity: z.union([z.literal(''), z.coerce.number().int().min(1).max(500)]).optional()
    .transform((v) => (v === '' || v === undefined ? null : Number(v))),
  form_teacher_id: z.union([z.literal(''), z.string().uuid()]).optional()
    .transform((v) => v || null),
})

export const subjectSchema = z.object({
  name: trimmed(2, 80),
  code: trimmed(2, 16).transform((v) => v.toUpperCase()),
  is_core: z.coerce.boolean().default(true),
})

export const studentSchema = z.object({
  admission_number: trimmed(1, 40),
  first_name: trimmed(1, 80),
  last_name: trimmed(1, 80),
  middle_name: optionalText(80),
  date_of_birth: optionalDate(),
  sex: optionalEnum(['male', 'female'] as const),
  admitted_on: z.string().date(),
  status: z.enum(['active', 'graduated', 'withdrawn', 'transferred']).default('active'),
})

export const guardianSchema = z.object({
  full_name: trimmed(2, 160),
  phone: optionalText(40),
  email: optionalEmail(),
  occupation: optionalText(120),
  address: optionalText(400),
})

export const linkGuardianSchema = z.object({
  student_id: z.string().uuid(),
  guardian_id: z.string().uuid(),
  relationship: trimmed(2, 40),
  is_primary: z.coerce.boolean().default(false),
})

export const staffSchema = z.object({
  staff_number: trimmed(1, 40),
  full_name: trimmed(2, 160),
  email: optionalEmail(),
  phone: optionalText(40),
  designation: optionalText(120),
  employment_status: z.enum(['active', 'on_leave', 'resigned', 'terminated']).default('active'),
})

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: z.enum(['school_admin', 'teacher']),
})

export const enrollSchema = z.object({
  term_id: z.string().uuid('Choose a term'),
  class_arm_id: z.string().uuid('Choose a class arm'),
  student_ids: z.array(z.string().uuid()).min(1, 'Select at least one student'),
})

export const attendanceEntrySchema = z.object({
  enrollment_id: z.string().uuid(),
  status: z.enum(['present', 'absent', 'late', 'excused']),
  note: optionalText(200),
})

export const attendanceSchema = z.object({
  class_arm_id: z.string().uuid(),
  term_id: z.string().uuid(),
  register_date: z.string().date(),
  entries: z.array(attendanceEntrySchema).min(1, 'Nobody is enrolled in this class arm'),
})

export const rolloverSchema = z.object({
  from_term: z.string().uuid(),
  to_term: z.string().uuid(),
  mapping: z.record(z.string().uuid(), z.string().uuid()),
})

/** CSV import rows are validated one by one so a single bad line never blocks a file. */
export const studentImportRow = z.object({
  admission_number: trimmed(1, 40),
  first_name: trimmed(1, 80),
  last_name: trimmed(1, 80),
  middle_name: z.string().trim().max(80).optional().default(''),
  date_of_birth: z.string().trim().optional().default(''),
  sex: z
    .string()
    .trim()
    .toLowerCase()
    .transform((v) => (v === 'm' ? 'male' : v === 'f' ? 'female' : v))
    .pipe(z.enum(['male', 'female', '']))
    .optional()
    .default(''),
  class_arm: z.string().trim().max(90).optional().default(''),
})

export const staffImportRow = z.object({
  staff_number: trimmed(1, 40),
  full_name: trimmed(2, 160),
  email: z.string().trim().toLowerCase().optional().default(''),
  phone: z.string().trim().max(40).optional().default(''),
  designation: z.string().trim().max(120).optional().default(''),
})

export type StudentInput = z.infer<typeof studentSchema>
export type GuardianInput = z.infer<typeof guardianSchema>
export type StaffInput = z.infer<typeof staffSchema>

/* Release 2 --------------------------------------------------------------
   These live here rather than beside their server actions because a
   'use server' module may only export async functions. */

export const assessmentSchema = z.object({
  term_id: z.string().uuid('Choose a term'),
  class_level_id: z.string().uuid('Choose a class level'),
  subject_id: z.string().uuid('Choose a subject'),
  component_key: z.string().trim().min(1, 'Choose an assessment component').max(24),
  title: trimmed(2, 120),
  max_score: z.coerce.number().positive('Must be more than zero').max(1000),
  held_on: optionalDate(),
})

export const cbtTestSchema = z.object({
  term_id: z.string().uuid('Choose a term'),
  class_level_id: z.string().uuid('Choose a class level'),
  subject_id: z.string().uuid('Choose a subject'),
  assessment_id: z.union([z.literal(''), z.string().uuid()]).optional().transform((v) => v || null),
  title: trimmed(2, 120),
  instructions: optionalText(2000),
  duration_minutes: z.coerce.number().int().min(1).max(600),
  opens_at: z.string().min(1, 'When does it open?'),
  closes_at: z.string().min(1, 'When does it close?'),
})

export const cbtQuestionSchema = z
  .object({
    test_id: z.string().uuid(),
    prompt: trimmed(1, 2000),
    kind: z.enum(['single_choice', 'multi_choice', 'true_false']),
    marks: z.coerce.number().positive().max(100),
    options: z.array(trimmed(1, 500)).min(2, 'A question needs at least two options').max(8),
    correct: z.array(z.number().int().min(0)).min(1, 'Mark at least one option correct'),
  })
  .refine((v) => v.correct.every((i) => i < v.options.length), {
    message: 'A correct answer points at an option that does not exist',
    path: ['correct'],
  })
  .refine((v) => v.kind === 'multi_choice' || v.correct.length === 1, {
    message: 'Only a multiple-answer question may have more than one correct option',
    path: ['correct'],
  })

export const startThreadSchema = z.object({
  recipient_id: z.string().uuid('Choose somebody to write to'),
  subject: trimmed(1, 160),
  body: trimmed(1, 4000),
})

export const replySchema = z.object({
  thread_id: z.string().uuid(),
  body: trimmed(1, 4000),
})

export const cbtAnswersSchema = z.object({
  attempt_id: z.string().uuid(),
  answers: z
    .array(z.object({
      question_id: z.string().uuid(),
      option_ids: z.array(z.string().uuid()).max(20),
    }))
    .max(500),
})

/* Fees ------------------------------------------------------------------- */

export const feeStructureSchema = z.object({
  term_id: z.string().uuid('Choose a term'),
  class_level_id: z.string().uuid('Choose a class level'),
  name: trimmed(2, 120),
  items: z
    .array(z.object({
      label: trimmed(1, 120),
      amount: z.coerce.number().min(0, 'Cannot be negative').max(100_000_000),
      is_optional: z.coerce.boolean().default(false),
    }))
    .min(1, 'Add at least one fee item')
    .max(40),
})

export const paymentSettingsSchema = z.object({
  provider: z.enum(['paystack', 'flutterwave', 'remita', 'stripe']),
  is_enabled: z.coerce.boolean().default(false),
  is_live: z.coerce.boolean().default(false),
  public_key: optionalText(200),
  merchant_code: optionalText(80),
  service_type_id: optionalText(80),
})

export const startPaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  // Blank means "the whole outstanding balance"; the database decides either way.
  amount: z.union([z.literal(''), z.coerce.number().positive()]).optional()
    .transform((v) => (v === '' || v === undefined ? null : Number(v))),
  payer_kind: z.enum(['student', 'guardian', 'bursary']).default('student'),
  payer_guardian_id: z.union([z.literal(''), z.string().uuid()]).optional()
    .transform((v) => v || null),
  payer_name: optionalText(160),
})

export const offlinePaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  amount: z.coerce.number().positive('Enter an amount'),
  method: z.enum(['bank_transfer', 'cash', 'pos', 'waiver']),
  payer_kind: z.enum(['student', 'guardian', 'bursary']),
  payer_guardian_id: z.union([z.literal(''), z.string().uuid()]).optional()
    .transform((v) => v || null),
  payer_name: optionalText(160),
  note: optionalText(400),
})

export const brandColorSchema = z.object({
  // Null restores the platform default. Anything else must be a plain hex:
  // this value ends up in a style attribute, so the format is a boundary.
  brand_color: z
    .union([z.literal(''), z.string().trim().toLowerCase().regex(/^#[0-9a-f]{6}$/, 'Use a six-digit hex colour, like #1d4ed8')])
    .transform((v) => v || null),
})
