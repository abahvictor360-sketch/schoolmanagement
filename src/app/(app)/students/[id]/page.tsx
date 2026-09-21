import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import {
  Badge, Card, CardBody, CardHeader, CardTitle, DataTable, EmptyState, PageHeader, Td, Th,
} from '@/components/ui/primitives'
import { StudentForm } from '@/components/students/student-form'
import { StudentPhoto } from '@/components/students/student-photo'
import { GuardianLinker } from '@/components/students/guardian-linker'
import { PortalInvite } from '@/components/students/portal-invite'
import { PrintButton } from '@/components/print-button'
import type { StudentRow } from '@/lib/database.types'

export const metadata: Metadata = { title: 'Student' }

type EnrollmentRow = {
  id: string
  status: string
  enrolled_at: string
  class_arm: { label: string; class_level: { label: string } } | null
  term: { label: string; academic_session: { label: string } | null } | null
}

type GuardianLink = {
  id: string
  relationship: string
  is_primary: boolean
  guardian: { id: string; full_name: string; phone: string | null; email: string | null } | null
}

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireRole('school_admin')
  const { id } = await params
  const supabase = await createClient()

  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('id', id)
    .eq('school_id', ctx.school.id)
    .maybeSingle<StudentRow>()

  if (!student) notFound()

  const [{ data: enrollments }, { data: links }, { data: guardians }, { data: invite }] = await Promise.all([
    supabase
      .from('enrollments')
      .select(
        'id, status, enrolled_at, class_arm:class_arms(label, class_level:class_levels(label)), term:terms(label, academic_session:academic_sessions(label))',
      )
      .eq('school_id', ctx.school.id)
      .eq('student_id', id)
      .order('enrolled_at', { ascending: false })
      .returns<EnrollmentRow[]>(),
    supabase
      .from('student_guardians')
      .select('id, relationship, is_primary, guardian:guardians(id, full_name, phone, email)')
      .eq('school_id', ctx.school.id)
      .eq('student_id', id)
      .returns<GuardianLink[]>(),
    supabase
      .from('guardians')
      .select('id, full_name')
      .eq('school_id', ctx.school.id)
      .order('full_name')
      .limit(500),
    supabase
      .from('school_invitations')
      .select('email, accepted_at')
      .eq('school_id', ctx.school.id)
      .eq('student_id', id)
      .maybeSingle<{ email: string; accepted_at: string | null }>(),
  ])

  const photoUrl = student.photo_path
    ? (await supabase.storage.from('student-photos').createSignedUrl(student.photo_path, 3600)).data
        ?.signedUrl ?? null
    : null

  return (
    <div className="space-y-4">
      <PageHeader
        title={`${student.last_name} ${student.first_name}`}
        description={`Admission number ${student.admission_number}`}
        actions={
          <>
            <PrintButton label="Print record" />
            <Link
              href="/students"
              className="inline-flex h-9 items-center rounded-lg border border-line bg-surface px-3 text-[13px] font-medium"
            >
              Back to list
            </Link>
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Passport photo</CardTitle>
            </CardHeader>
            <CardBody>
              <StudentPhoto studentId={student.id} url={photoUrl} />
            </CardBody>
          </Card>

          <Card className="no-print">
            <CardHeader>
              <CardTitle>Student portal</CardTitle>
            </CardHeader>
            <CardBody>
              <PortalInvite
                studentId={student.id}
                linked={Boolean(student.profile_id)}
                invitedEmail={invite && !invite.accepted_at ? invite.email : null}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Enrollment history</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              {enrollments && enrollments.length > 0 ? (
                enrollments.map((e) => (
                  <div key={e.id} className="text-sm">
                    <p className="font-medium">
                      {e.class_arm?.class_level.label} {e.class_arm?.label}
                    </p>
                    <p className="text-ink-muted">
                      {e.term?.academic_session?.label} · {e.term?.label}
                    </p>
                    <Badge tone={e.status === 'active' ? 'positive' : 'neutral'} className="mt-1 capitalize">
                      {e.status}
                    </Badge>
                  </div>
                ))
              ) : (
                <p className="text-sm text-ink-muted">Not enrolled in any term yet.</p>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Record</CardTitle>
            </CardHeader>
            <CardBody>
              <StudentForm student={student} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Guardians</CardTitle>
            </CardHeader>
            {links && links.length > 0 ? (
              <DataTable>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Relationship</Th>
                    <Th className="hidden sm:table-cell">Phone</Th>
                    <Th>Primary</Th>
                  </tr>
                </thead>
                <tbody>
                  {links.map((l) => (
                    <tr key={l.id}>
                      <Td className="font-medium">{l.guardian?.full_name}</Td>
                      <Td className="capitalize">{l.relationship}</Td>
                      <Td className="hidden tabular-nums sm:table-cell">{l.guardian?.phone ?? '—'}</Td>
                      <Td>{l.is_primary ? <Badge tone="accent">Primary</Badge> : '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            ) : (
              <EmptyState title="No guardian linked" description="Link at least one guardian for contact and pickup." />
            )}
            <CardBody className="no-print border-t border-line">
              <GuardianLinker studentId={student.id} guardians={guardians ?? []} />
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}
