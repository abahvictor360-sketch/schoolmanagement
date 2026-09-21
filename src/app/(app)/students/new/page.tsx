import type { Metadata } from 'next'
import { requireRole } from '@/lib/auth'
import { Card, CardBody, PageHeader } from '@/components/ui/primitives'
import { StudentForm } from '@/components/students/student-form'

export const metadata: Metadata = { title: 'Add student' }

export default async function NewStudentPage() {
  await requireRole('school_admin')
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <PageHeader title="Add student" description="Enrollment into a class arm happens separately." />
      <Card>
        <CardBody>
          <StudentForm />
        </CardBody>
      </Card>
    </div>
  )
}
