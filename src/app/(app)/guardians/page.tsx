import type { Metadata } from 'next'
import Link from 'next/link'
import { requireRole } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { Card, DataTable, EmptyState, PageHeader, Td, Th } from '@/components/ui/primitives'
import { PrintButton } from '@/components/print-button'
import { GuardianForm } from '@/components/guardians/guardian-form'

export const metadata: Metadata = { title: 'Guardians' }

type Row = {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  occupation: string | null
  student_guardians: { student: { id: string; first_name: string; last_name: string } | null }[]
}

export default async function GuardiansPage() {
  const ctx = await requireRole('school_admin')
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('guardians')
    .select(
      'id, full_name, phone, email, occupation, student_guardians(student:students(id, first_name, last_name))',
    )
    .eq('school_id', ctx.school.id)
    .order('full_name')
    .limit(500)
    .returns<Row[]>()

  return (
    <div className="space-y-4">
      <PageHeader
        title="Guardians"
        description={`${data?.length ?? 0} record${data?.length === 1 ? '' : 's'}`}
        actions={<PrintButton />}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Card>
          {error ? (
            <EmptyState title="Could not load guardians" description={error.message} />
          ) : data && data.length > 0 ? (
            <DataTable>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th className="hidden sm:table-cell">Phone</Th>
                  <Th className="hidden md:table-cell">Email</Th>
                  <Th>Children</Th>
                </tr>
              </thead>
              <tbody>
                {data.map((g) => (
                  <tr key={g.id}>
                    <Td className="font-medium">{g.full_name}</Td>
                    <Td className="hidden tabular-nums sm:table-cell">{g.phone ?? '—'}</Td>
                    <Td className="hidden md:table-cell">{g.email ?? '—'}</Td>
                    <Td>
                      {g.student_guardians.length === 0
                        ? '—'
                        : g.student_guardians.map((link, index) =>
                            link.student ? (
                              <span key={link.student.id}>
                                {index > 0 ? ', ' : ''}
                                <Link
                                  href={`/students/${link.student.id}`}
                                  className="underline underline-offset-2"
                                >
                                  {link.student.last_name} {link.student.first_name}
                                </Link>
                              </span>
                            ) : null,
                          )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </DataTable>
          ) : (
            <EmptyState
              title="No guardians yet"
              description="Guardians can also be created while linking them to a student."
            />
          )}
        </Card>

        <div className="no-print">
          <GuardianForm />
        </div>
      </div>
    </div>
  )
}
