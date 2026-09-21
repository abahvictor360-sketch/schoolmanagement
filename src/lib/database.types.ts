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

type Timestamps = { created_at: string; updated_at: string }

export type SchoolRow = Timestamps & {
  id: string; name: string; slug: string; logo_url: string | null
  address: string | null; phone: string | null; email: string | null; status: SchoolStatus
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
    }
    Views: Record<never, never>
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
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
