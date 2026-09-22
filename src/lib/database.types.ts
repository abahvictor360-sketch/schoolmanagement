/**
 * Database types. Regenerate after every migration with:
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 * Kept hand-shaped here (same shape, less noise) so the data model stays
 * readable alongside the SQL in supabase/migrations.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type UserRole = 'platform_admin' | 'school_admin' | 'teacher' | 'bursar' | 'student' | 'guardian'
export type MembershipStatus = 'active' | 'invited' | 'suspended'
export type SchoolStatus = 'pending' | 'active' | 'suspended'
export type StudentStatus = 'active' | 'graduated' | 'withdrawn' | 'transferred'
export type EmploymentStatus = 'active' | 'on_leave' | 'resigned' | 'terminated'
export type Sex = 'male' | 'female'
export type EnrollmentStatus =
  | 'active' | 'promoted' | 'repeated' | 'withdrawn' | 'transferred_out' | 'graduated'
export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused'
export type AssessmentStatus = 'draft' | 'published'
export type CbtQuestionKind = 'single_choice' | 'multi_choice' | 'true_false'
export type CbtAttemptStatus = 'in_progress' | 'submitted' | 'expired'
export type FeeInvoiceStatus = 'draft' | 'issued' | 'void'
export type PaymentMethod = 'card' | 'bank_transfer' | 'cash' | 'pos' | 'waiver'
export type PaymentStatus = 'pending' | 'confirmed' | 'failed' | 'refunded'
export type PayerKind = 'student' | 'guardian' | 'bursary'
export type PaymentProvider = 'paystack' | 'flutterwave' | 'remita' | 'stripe'

type Timestamps = { created_at: string; updated_at: string }

export type SchoolRow = Timestamps & {
  id: string; name: string; slug: string; logo_url: string | null
  address: string | null; phone: string | null; email: string | null; status: SchoolStatus
  /** Six-digit hex, or null for the platform default. */
  brand_color: string | null
}
export type SchoolSettingsRow = Timestamps & {
  school_id: string; preset_key: string; academic_config: Json; onboarded_at: string | null
}
export type ProfileRow = Timestamps & {
  id: string; full_name: string; phone: string | null
  photo_url: string | null; is_platform_admin: boolean
}
export type MembershipRow = Timestamps & {
  id: string; user_id: string; school_id: string; role: UserRole; status: MembershipStatus
}
export type AuditLogRow = {
  id: number; school_id: string | null; actor_id: string | null; entity: string
  entity_id: string | null; action: string; before: Json | null; after: Json | null; created_at: string
}
export type AcademicSessionRow = Timestamps & {
  id: string; school_id: string; label: string; starts_on: string; ends_on: string; is_current: boolean
}
export type TermRow = Timestamps & {
  id: string; school_id: string; academic_session_id: string; ordinal: number
  label: string; starts_on: string; ends_on: string; is_current: boolean
}
export type ClassLevelRow = Timestamps & {
  id: string; school_id: string; label: string; ordinal: number
}
export type ClassArmRow = Timestamps & {
  id: string; school_id: string; class_level_id: string; label: string
  capacity: number | null; form_teacher_id: string | null
}
export type SubjectRow = Timestamps & {
  id: string; school_id: string; name: string; code: string; is_core: boolean
}
export type ClassSubjectRow = Timestamps & {
  id: string; school_id: string; subject_id: string; class_level_id: string
  academic_session_id: string; teacher_id: string | null
}
export type StaffRow = Timestamps & {
  id: string; school_id: string; profile_id: string | null; staff_number: string; full_name: string
  email: string | null; phone: string | null; designation: string | null
  employment_status: EmploymentStatus
}
export type StudentRow = Timestamps & {
  id: string; school_id: string; admission_number: string; first_name: string; last_name: string
  middle_name: string | null; date_of_birth: string | null; sex: Sex | null
  photo_path: string | null; admitted_on: string; status: StudentStatus
  /** The login this pupil uses for the portal, when they have been invited. */
  profile_id: string | null
}
export type GuardianRow = Timestamps & {
  id: string; school_id: string; full_name: string; phone: string | null
  email: string | null; occupation: string | null; address: string | null
}
export type StudentGuardianRow = {
  id: string; school_id: string; student_id: string; guardian_id: string
  relationship: string; is_primary: boolean; created_at: string
}
export type EnrollmentRow = Timestamps & {
  id: string; school_id: string; student_id: string; class_arm_id: string
  term_id: string; status: EnrollmentStatus; enrolled_at: string
}
export type AttendanceRegisterRow = Timestamps & {
  id: string; school_id: string; class_arm_id: string; term_id: string
  register_date: string; taken_by: string | null; taken_at: string
}
export type AttendanceEntryRow = Timestamps & {
  id: string; school_id: string; register_id: string; enrollment_id: string
  status: AttendanceStatus; note: string | null
}
export type SchoolInvitationRow = {
  id: string; school_id: string; email: string; role: UserRole
  invited_by: string | null; accepted_at: string | null; created_at: string
  /** Required when role is 'student', forbidden otherwise (check constraint). */
  student_id: string | null
}

/* Release 2 ------------------------------------------------------------- */

export type AssessmentRow = Timestamps & {
  id: string; school_id: string; term_id: string; class_level_id: string; subject_id: string
  component_key: string; title: string; max_score: number; held_on: string | null
  status: AssessmentStatus; created_by: string | null
}
export type AssessmentScoreRow = Timestamps & {
  id: string; school_id: string; assessment_id: string; enrollment_id: string
  score: number; recorded_by: string | null
}
export type CbtTestRow = Timestamps & {
  id: string; school_id: string; term_id: string; class_level_id: string; subject_id: string
  assessment_id: string | null; title: string; instructions: string | null
  duration_minutes: number; opens_at: string; closes_at: string; shuffle: boolean
  status: AssessmentStatus; created_by: string | null
}
export type CbtQuestionRow = Timestamps & {
  id: string; school_id: string; test_id: string; ordinal: number
  prompt: string; kind: CbtQuestionKind; marks: number
}
export type CbtOptionRow = {
  id: string; school_id: string; question_id: string; ordinal: number
  label: string; created_at: string
}
/** No student-readable policy exists for this table, by design. */
export type CbtAnswerKeyRow = Timestamps & {
  question_id: string; school_id: string; option_ids: string[]
}
export type CbtAttemptRow = Timestamps & {
  id: string; school_id: string; test_id: string; enrollment_id: string
  status: CbtAttemptStatus; started_at: string; expires_at: string
  submitted_at: string | null; score: number | null; max_score: number | null
}
export type CbtAnswerRow = Timestamps & {
  id: string; school_id: string; attempt_id: string; question_id: string
  option_ids: string[]; is_correct: boolean | null; marks_awarded: number | null
}
export type MessageThreadRow = Timestamps & {
  id: string; school_id: string; subject: string
  created_by: string | null; last_message_at: string
}
export type ThreadParticipantRow = {
  id: string; school_id: string; thread_id: string; user_id: string
  role_at_join: UserRole; last_read_at: string | null; created_at: string
}
export type MessageRow = Timestamps & {
  id: string; school_id: string; thread_id: string; sender_id: string | null
  body: string; withdrawn_at: string | null
}

/* Fees ------------------------------------------------------------------- */

export type FeeStructureRow = Timestamps & {
  id: string; school_id: string; term_id: string; class_level_id: string
  name: string; is_active: boolean
}
export type FeeItemRow = Timestamps & {
  id: string; school_id: string; fee_structure_id: string
  label: string; amount: number; is_optional: boolean; ordinal: number
}
export type InvoiceRow = Timestamps & {
  id: string; school_id: string; enrollment_id: string; fee_structure_id: string
  invoice_number: string; total_amount: number; status: FeeInvoiceStatus
  issued_on: string; due_on: string | null
}
export type InvoiceItemRow = {
  id: string; school_id: string; invoice_id: string
  label: string; amount: number; ordinal: number; created_at: string
}
export type PaymentRow = Timestamps & {
  id: string; school_id: string; invoice_id: string; amount: number
  method: PaymentMethod; status: PaymentStatus
  payer_kind: PayerKind; payer_user_id: string | null
  payer_guardian_id: string | null; payer_name: string | null
  reference: string; provider: string | null; provider_reference: string | null
  note: string | null; paid_at: string | null
  confirmed_by: string | null; confirmed_at: string | null
}
/** No secret key is stored here by design — see migration 0017. */
export type SchoolPaymentSettingsRow = Timestamps & {
  school_id: string; provider: PaymentProvider
  is_enabled: boolean; is_live: boolean
  public_key: string | null; merchant_code: string | null; service_type_id: string | null
}
/** security_invoker view: answers under the caller's own RLS. */
export type InvoiceBalanceRow = {
  invoice_id: string
  school_id: string
  enrollment_id: string
  invoice_number: string
  total_amount: number
  amount_paid: number
  balance: number
  amount_pending: number
  status: FeeInvoiceStatus
  due_on: string | null
}

export type ResultSheetRow = {
  subject_id: string
  subject_name: string
  subject_code: string
  components: Json
  percentage: number
  grade_label: string | null
  remark: string | null
  is_pass: boolean | null
}

export type BillingInterval = 'monthly' | 'yearly'
export type BillingChargeStatus = 'pending' | 'paid' | 'failed' | 'abandoned'

/**
 * The state is never stored. app.subscription_state() derives it from the
 * dates on every read, so there is no cron to run and nothing to go stale.
 * 'unbilled' is a school that predates billing.
 */
export type SubscriptionState =
  | 'unbilled' | 'trialing' | 'active' | 'past_due' | 'read_only' | 'canceled'

export type BillingPlanRow = {
  id: string
  code: string
  name: string
  /** null on the top band: no ceiling. */
  max_students: number | null
  monthly_amount: number
  yearly_amount: number
  currency: string
  sort_order: number
  is_active: boolean
  created_at: string
}

export type SchoolSubscriptionRow = Timestamps & {
  school_id: string
  plan_id: string
  billing_interval: BillingInterval
  trial_ends_on: string | null
  current_period_start: string
  current_period_end: string
  grace_days: number
  canceled_at: string | null
}

export type BillingChargeRow = Timestamps & {
  id: string
  school_id: string
  plan_id: string
  billing_interval: BillingInterval
  period_start: string
  period_end: string
  /** The roll the band was chosen from, frozen so the bill stays defensible. */
  student_count: number
  amount: number
  currency: string
  status: BillingChargeStatus
  provider: string | null
  provider_reference: string | null
  paid_at: string | null
}

type Table<Row, Required extends keyof Row> = {
  Row: Row
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>
  Update: Partial<Row>
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      schools: Table<SchoolRow, 'name' | 'slug'>
      school_settings: Table<SchoolSettingsRow, 'school_id' | 'academic_config'>
      profiles: Table<ProfileRow, 'id'>
      memberships: Table<MembershipRow, 'user_id' | 'school_id' | 'role'>
      audit_log: Table<AuditLogRow, 'entity' | 'action'>
      academic_sessions: Table<AcademicSessionRow, 'school_id' | 'label' | 'starts_on' | 'ends_on'>
      terms: Table<TermRow, 'school_id' | 'academic_session_id' | 'ordinal' | 'label' | 'starts_on' | 'ends_on'>
      class_levels: Table<ClassLevelRow, 'school_id' | 'label' | 'ordinal'>
      class_arms: Table<ClassArmRow, 'school_id' | 'class_level_id' | 'label'>
      subjects: Table<SubjectRow, 'school_id' | 'name' | 'code'>
      class_subjects: Table<ClassSubjectRow, 'school_id' | 'subject_id' | 'class_level_id' | 'academic_session_id'>
      staff: Table<StaffRow, 'school_id' | 'staff_number' | 'full_name'>
      students: Table<StudentRow, 'school_id' | 'admission_number' | 'first_name' | 'last_name'>
      guardians: Table<GuardianRow, 'school_id' | 'full_name'>
      student_guardians: Table<StudentGuardianRow, 'school_id' | 'student_id' | 'guardian_id'>
      enrollments: Table<EnrollmentRow, 'school_id' | 'student_id' | 'class_arm_id' | 'term_id'>
      attendance_registers: Table<AttendanceRegisterRow, 'school_id' | 'class_arm_id' | 'term_id' | 'register_date'>
      attendance_entries: Table<AttendanceEntryRow, 'school_id' | 'register_id' | 'enrollment_id' | 'status'>
      school_invitations: Table<SchoolInvitationRow, 'school_id' | 'email' | 'role'>
      assessments: Table<AssessmentRow, 'school_id' | 'term_id' | 'class_level_id' | 'subject_id' | 'component_key' | 'title' | 'max_score'>
      assessment_scores: Table<AssessmentScoreRow, 'school_id' | 'assessment_id' | 'enrollment_id' | 'score'>
      cbt_tests: Table<CbtTestRow, 'school_id' | 'term_id' | 'class_level_id' | 'subject_id' | 'title' | 'duration_minutes' | 'opens_at' | 'closes_at'>
      cbt_questions: Table<CbtQuestionRow, 'school_id' | 'test_id' | 'ordinal' | 'prompt'>
      cbt_options: Table<CbtOptionRow, 'school_id' | 'question_id' | 'ordinal' | 'label'>
      cbt_answer_keys: Table<CbtAnswerKeyRow, 'question_id' | 'school_id' | 'option_ids'>
      cbt_attempts: Table<CbtAttemptRow, 'school_id' | 'test_id' | 'enrollment_id' | 'expires_at'>
      cbt_answers: Table<CbtAnswerRow, 'school_id' | 'attempt_id' | 'question_id'>
      message_threads: Table<MessageThreadRow, 'school_id' | 'subject'>
      thread_participants: Table<ThreadParticipantRow, 'school_id' | 'thread_id' | 'user_id' | 'role_at_join'>
      messages: Table<MessageRow, 'school_id' | 'thread_id' | 'body'>
      fee_structures: Table<FeeStructureRow, 'school_id' | 'term_id' | 'class_level_id' | 'name'>
      fee_items: Table<FeeItemRow, 'school_id' | 'fee_structure_id' | 'label' | 'amount'>
      invoices: Table<InvoiceRow, 'school_id' | 'enrollment_id' | 'fee_structure_id' | 'invoice_number' | 'total_amount'>
      invoice_items: Table<InvoiceItemRow, 'school_id' | 'invoice_id' | 'label' | 'amount'>
      payments: Table<PaymentRow, 'school_id' | 'invoice_id' | 'amount' | 'method' | 'payer_kind' | 'reference'>
      school_payment_settings: Table<SchoolPaymentSettingsRow, 'school_id'>
      billing_plans: Table<BillingPlanRow, 'code' | 'name' | 'monthly_amount' | 'yearly_amount' | 'sort_order'>
      school_subscriptions: Table<SchoolSubscriptionRow, 'school_id' | 'plan_id' | 'current_period_end'>
      billing_charges: Table<BillingChargeRow, 'school_id' | 'plan_id' | 'billing_interval' | 'period_start' | 'period_end' | 'student_count' | 'amount' | 'currency'>
    }
    Views: {
      invoice_balances: {
        Row: InvoiceBalanceRow
        Insert: never
        Update: never
        Relationships: []
      }
    }
    Functions: {
      create_school: {
        Args: { p_name: string; p_slug: string; p_admin_email: string; p_config: Json; p_preset?: string }
        Returns: string
      }
      enroll_students: {
        Args: { p_school_id: string; p_term_id: string; p_class_arm_id: string; p_student_ids: string[] }
        Returns: number
      }
      rollover_term: {
        Args: { p_school_id: string; p_from_term: string; p_to_term: string; p_promote: Json }
        Returns: number
      }
      save_attendance: {
        Args: { p_school_id: string; p_class_arm_id: string; p_term_id: string; p_date: string; p_entries: Json }
        Returns: string
      }
      result_sheet: { Args: { p_enrollment: string }; Returns: ResultSheetRow[] }
      start_cbt_attempt: { Args: { p_test: string }; Returns: string }
      save_cbt_answers: { Args: { p_attempt: string; p_answers: Json }; Returns: number }
      submit_cbt_attempt: { Args: { p_attempt: string; p_answers?: Json }; Returns: Json }
      start_thread: {
        Args: { p_school_id: string; p_subject: string; p_recipient: string; p_body: string }
        Returns: string
      }
      post_message: { Args: { p_thread: string; p_body: string }; Returns: string }
      start_subscription_checkout: {
        Args: { target_school: string; chosen_interval: BillingInterval }
        Returns: Json
      }
      confirm_subscription_payment: {
        Args: { charge_reference: string; paid_provider: string }
        Returns: Json
      }
      abandon_subscription_charge: { Args: { charge_reference: string }; Returns: undefined }
      set_school_subscription: {
        Args: {
          target_school: string; plan_code: string
          chosen_interval?: BillingInterval; period_end?: string | null; trial_ends?: string | null
        }
        Returns: undefined
      }
      cancel_subscription: { Args: { target_school: string }; Returns: undefined }
      messageable_staff: {
        Args: { p_school_id: string }
        Returns: { user_id: string; full_name: string; designation: string | null }[]
      }
      generate_invoices: {
        Args: { p_school_id: string; p_fee_structure_id: string; p_due_on?: string | null }
        Returns: number
      }
      begin_card_payment: {
        Args: {
          p_invoice_id: string
          p_amount?: number
          p_payer_kind?: PayerKind
          p_payer_guardian_id?: string | null
          p_payer_name?: string | null
        }
        Returns: Json
      }
      confirm_card_payment: {
        Args: { p_reference: string; p_provider_reference: string; p_amount_paid: number }
        Returns: Json
      }
      fail_card_payment: { Args: { p_reference: string; p_note?: string | null }; Returns: undefined }
      record_offline_payment: {
        Args: {
          p_invoice_id: string
          p_amount: number
          p_method: PaymentMethod
          p_payer_kind: PayerKind
          p_payer_guardian_id?: string | null
          p_payer_name?: string | null
          p_note?: string | null
        }
        Returns: string
      }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
