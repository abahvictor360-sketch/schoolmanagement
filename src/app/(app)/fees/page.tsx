import type { Metadata } from 'next'
import { requireSchool } from '@/lib/auth'
import { createClient } from '@/lib/supabase/server'
import { listTerms } from '@/lib/queries'
import { money } from '@/lib/money'
import {
  Badge, Card, CardHeader, CardTitle, DataTable, EmptyState, PageHeader, StatTile, Td, Th,
} from '@/components/ui/primitives'
import { PrintButton } from '@/components/print-button'
import { FeeStructureForm } from '@/components/fees/fee-structure-form'
import { OutstandingTable } from '@/components/fees/outstanding-table'
import type { InvoiceBalanceRow, PaymentStatus } from '@/lib/database.types'
import { CircleCheck, Clock, Wallet } from 'lucide-react'

export const metadata: Metadata = { title: 'Fees' }

type StructureRow = {
  id: string
  name: string
  is_active: boolean
  term: { label: string } | null
  class_level: { label: string } | null
  fee_items: { amount: number; is_optional: boolean }[]
}

export default async function FeesPage() {
  const ctx = await requireSchool()
  const supabase = await createClient()

  const [{ data: structures }, { data: levels }, terms, { data: balances }, { data: pendingPays }] =
    await Promise.all([
      supabase
        .from('fee_structures')
        .select(
          'id, name, is_active, term:terms(label), class_level:class_levels(label), fee_items(amount, is_optional)',
        )
        .eq('school_id', ctx.school.id)
        .returns<StructureRow[]>(),
      supabase.from('class_levels').select('id, label').eq('school_id', ctx.school.id).order('ordinal'),
      listTerms(ctx.school.id),
      supabase
        .from('invoice_balances')
        .select('*')
        .eq('school_id', ctx.school.id)
        .returns<InvoiceBalanceRow[]>(),
      supabase
        .from('payments')
        .select('id, reference, amount, status, created_at, provider')
        .eq('school_id', ctx.school.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(50)
        .returns<{
          id: string; reference: string; amount: number
          status: PaymentStatus; created_at: string; provider: string | null
        }[]>(),
    ])

  const rows = balances ?? []
  const billed = rows.reduce((sum, r) => sum + Number(r.total_amount), 0)
  const collected = rows.reduce((sum, r) => sum + Number(r.amount_paid), 0)
  const outstanding = rows.reduce((sum, r) => sum + Number(r.balance), 0)
  const settled = rows.filter((r) => Number(r.balance) <= 0).length

  // Names for the outstanding list, fetched separately so RLS stays simple.
  const enrollmentIds = rows.filter((r) => Number(r.balance) > 0).map((r) => r.enrollment_id)
  const { data: pupils } = enrollmentIds.length
    ? await supabase
        .from('enrollments')
        .select('id, student:students(first_name, last_name, admission_number), class_arm:class_arms(label, class_level:class_levels(label))')
        .in('id', enrollmentIds)
        .returns<{
          id: string
          student: { first_name: string; last_name: string; admission_number: string } | null
          class_arm: { label: string; class_level: { label: string } } | null
        }[]>()
    : { data: [] }

  const nameFor = new Map(
    (pupils ?? []).map((e) => [
      e.id,
      {
        name: e.student ? `${e.student.last_name} ${e.student.first_name}` : 'Unknown',
        admissionNumber: e.student?.admission_number ?? '',
        arm: e.class_arm ? `${e.class_arm.class_level.label} ${e.class_arm.label}` : '',
      },
    ]),
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="Fees"
        description="What each class level is charged, and who still owes."
        actions={<PrintButton />}
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Billed" value={money(ctx.config, billed)} tint="violet" icon={Wallet} />
        <StatTile label="Collected" value={money(ctx.config, collected)} tint="mint" icon={CircleCheck} />
        <StatTile label="Outstanding" value={money(ctx.config, outstanding)} tint="peach" icon={Clock} />
        <StatTile
          label="Invoices settled"
          value={`${settled}/${rows.length}`}
          tint="sky"
        />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Fee structures</CardTitle>
              <Badge>{structures?.length ?? 0}</Badge>
            </CardHeader>
            {structures && structures.length > 0 ? (
              <DataTable>
                <thead>
                  <tr>
                    <Th>Structure</Th>
                    <Th className="hidden sm:table-cell">Class level</Th>
                    <Th className="text-right">Compulsory total</Th>
                  </tr>
                </thead>
                <tbody>
                  {structures.map((s) => (
                    <tr key={s.id}>
                      <Td>
                        <span className="block font-medium">{s.name}</span>
                        <span className="text-[12px] text-ink-muted">{s.term?.label}</span>
                      </Td>
                      <Td className="hidden sm:table-cell">{s.class_level?.label}</Td>
                      <Td className="text-right tabular-nums">
                        {money(
                          ctx.config,
                          s.fee_items.filter((i) => !i.is_optional).reduce((t, i) => t + Number(i.amount), 0),
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            ) : (
              <EmptyState
                title="No fee structure yet"
                description="Set what a class level is charged for a term, then raise the invoices."
              />
            )}
          </Card>

          <OutstandingTable
            currency={ctx.config.currency}
            locale={ctx.config.locale}
            rows={rows
              .filter((r) => Number(r.balance) > 0)
              .map((r) => ({
                invoiceId: r.invoice_id,
                invoiceNumber: r.invoice_number,
                total: Number(r.total_amount),
                paid: Number(r.amount_paid),
                balance: Number(r.balance),
                dueOn: r.due_on,
                ...(nameFor.get(r.enrollment_id) ?? { name: 'Unknown', admissionNumber: '', arm: '' }),
              }))}
            pending={(pendingPays ?? []).map((p) => ({
              reference: p.reference,
              amount: Number(p.amount),
              provider: p.provider,
              openedAt: p.created_at,
            }))}
          />
        </div>

        <div className="no-print">
          <FeeStructureForm
            terms={terms.map((t) => ({
              id: t.id,
              label: `${t.session_label} · ${t.label}`,
              isCurrent: t.is_current,
            }))}
            levels={levels ?? []}
            structures={(structures ?? []).map((s) => ({
              id: s.id,
              label: `${s.class_level?.label ?? ''} — ${s.name}`,
            }))}
            currency={ctx.config.currency}
          />
        </div>
      </div>
    </div>
  )
}
