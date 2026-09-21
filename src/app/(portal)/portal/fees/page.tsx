import type { Metadata } from 'next'
import { requireStudent } from '@/lib/student'
import { createClient } from '@/lib/supabase/server'
import { money } from '@/lib/money'
import { PROVIDERS, type ProviderKey } from '@/lib/payments/providers'
import {
  Badge, Card, CardBody, CardHeader, CardTitle, DataTable, EmptyState, PageHeader,
  StatTile, Td, Th,
} from '@/components/ui/primitives'
import { PrintButton } from '@/components/print-button'
import { PayFeesPanel } from '@/components/portal/pay-fees-panel'
import { SchoolMark } from '@/components/school-mark'
import type {
  InvoiceBalanceRow, PaymentMethod, PaymentStatus, SchoolPaymentSettingsRow,
} from '@/lib/database.types'
import { Wallet, ReceiptText, CircleCheck } from 'lucide-react'

export const metadata: Metadata = { title: 'My fees' }

const STATUS_TONE: Record<PaymentStatus, 'positive' | 'warn' | 'danger' | 'neutral'> = {
  confirmed: 'positive',
  pending: 'warn',
  failed: 'danger',
  refunded: 'neutral',
}

const METHOD_LABEL: Record<PaymentMethod, string> = {
  card: 'Card',
  bank_transfer: 'Bank transfer',
  cash: 'Cash',
  pos: 'POS',
  waiver: 'Waiver',
}

export default async function PortalFees() {
  const ctx = await requireStudent()
  const supabase = await createClient()

  if (!ctx.enrollment) {
    return (
      <Card>
        <EmptyState
          title="You are not enrolled this term"
          description="Fees are raised against your place in a class, so there is nothing to show yet."
        />
      </Card>
    )
  }

  const [{ data: balances }, { data: items }, { data: payments }, { data: settings }] =
    await Promise.all([
      supabase
        .from('invoice_balances')
        .select('*')
        .eq('enrollment_id', ctx.enrollment.id)
        .returns<InvoiceBalanceRow[]>(),
      supabase
        .from('invoice_items')
        .select('invoice_id, label, amount, ordinal')
        .order('ordinal')
        .returns<{ invoice_id: string; label: string; amount: number; ordinal: number }[]>(),
      supabase
        .from('payments')
        .select('id, amount, method, status, reference, paid_at, created_at, payer_name, payer_kind')
        .order('created_at', { ascending: false })
        .returns<{
          id: string; amount: number; method: PaymentMethod; status: PaymentStatus
          reference: string; paid_at: string | null; created_at: string
          payer_name: string | null; payer_kind: string
        }[]>(),
      supabase
        .from('school_payment_settings')
        .select('provider, is_enabled, is_live, public_key, merchant_code, service_type_id')
        .eq('school_id', ctx.school.id)
        .maybeSingle<SchoolPaymentSettingsRow>(),
    ])

  const invoices = balances ?? []
  const owed = invoices.reduce((sum, b) => sum + Number(b.balance), 0)
  const paid = invoices.reduce((sum, b) => sum + Number(b.amount_paid), 0)
  const billed = invoices.reduce((sum, b) => sum + Number(b.total_amount), 0)
  const openInvoice = invoices.find((b) => Number(b.balance) > 0) ?? null

  const providerKey = (settings?.provider ?? 'paystack') as ProviderKey
  const canPayOnline = Boolean(settings?.is_enabled && settings?.public_key)

  return (
    <div className="space-y-4">
      <PageHeader
        title="My fees"
        description={`${ctx.enrollment.session_label} · ${ctx.enrollment.term_label} · ${ctx.enrollment.class_label}`}
        actions={<PrintButton label="Print statement" />}
      />

      {/* Paper header, so a printed statement is filing-ready. */}
      <div className="print-only mb-3 flex items-center gap-3 border-b border-ink pb-3">
        <SchoolMark name={ctx.school.name} logoUrl={ctx.school.logo_url} />
        <div>
          <p className="text-base font-semibold">{ctx.school.name}</p>
          <p className="text-sm">
            {ctx.student.last_name} {ctx.student.first_name} · {ctx.student.admission_number} ·{' '}
            {ctx.enrollment.class_label}
          </p>
        </div>
      </div>

      {invoices.length === 0 ? (
        <Card>
          <EmptyState
            title="No fees have been billed yet"
            description="When the bursary raises this term's fees, your invoice will appear here."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile
              label="Outstanding"
              value={money(ctx.config, owed)}
              tint={owed > 0 ? 'peach' : 'mint'}
              icon={Wallet}
            />
            <StatTile label="Paid so far" value={money(ctx.config, paid)} tint="mint" icon={CircleCheck} />
            <StatTile label="Billed this term" value={money(ctx.config, billed)} tint="violet" icon={ReceiptText} />
          </div>

          {openInvoice ? (
            <PayFeesPanel
              invoiceId={openInvoice.invoice_id}
              invoiceNumber={openInvoice.invoice_number}
              balance={Number(openInvoice.balance)}
              pending={Number(openInvoice.amount_pending)}
              currency={ctx.config.currency}
              locale={ctx.config.locale}
              canPayOnline={canPayOnline}
              providerLabel={PROVIDERS[providerKey].label}
              isLive={Boolean(settings?.is_live)}
            />
          ) : (
            <Card>
              <CardBody className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-2xl bg-tint-mint text-positive">
                  <CircleCheck size={20} aria-hidden />
                </span>
                <p className="text-sm font-semibold">
                  Your fees for this term are fully paid. Thank you.
                </p>
              </CardBody>
            </Card>
          )}

          {invoices.map((invoice) => (
            <Card key={invoice.invoice_id}>
              <CardHeader>
                <CardTitle>Invoice {invoice.invoice_number}</CardTitle>
                <div className="flex flex-wrap items-center gap-2">
                  {invoice.due_on ? (
                    <Badge tone={Number(invoice.balance) > 0 ? 'warn' : 'neutral'}>
                      Due {invoice.due_on}
                    </Badge>
                  ) : null}
                  <Badge tone={Number(invoice.balance) > 0 ? 'danger' : 'positive'}>
                    {Number(invoice.balance) > 0
                      ? `${money(ctx.config, invoice.balance)} outstanding`
                      : 'Settled'}
                  </Badge>
                </div>
              </CardHeader>
              <DataTable className="min-w-0">
                <thead>
                  <tr>
                    <Th>Item</Th>
                    <Th className="text-right">Amount</Th>
                  </tr>
                </thead>
                <tbody>
                  {(items ?? [])
                    .filter((i) => i.invoice_id === invoice.invoice_id)
                    .map((i, index) => (
                      <tr key={`${invoice.invoice_id}-${index}`}>
                        <Td>{i.label}</Td>
                        <Td className="text-right tabular-nums">{money(ctx.config, i.amount)}</Td>
                      </tr>
                    ))}
                  <tr>
                    <Td className="font-semibold">Total</Td>
                    <Td className="text-right font-semibold tabular-nums">
                      {money(ctx.config, invoice.total_amount)}
                    </Td>
                  </tr>
                </tbody>
              </DataTable>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle>Payment history</CardTitle>
              <Badge>{payments?.length ?? 0}</Badge>
            </CardHeader>
            {payments && payments.length > 0 ? (
              <DataTable>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Method</Th>
                    <Th className="hidden sm:table-cell">Paid by</Th>
                    <Th className="text-right">Amount</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p.id}>
                      <Td className="tabular-nums whitespace-nowrap">
                        {new Date(p.paid_at ?? p.created_at).toLocaleDateString()}
                      </Td>
                      <Td>{METHOD_LABEL[p.method]}</Td>
                      <Td className="hidden capitalize sm:table-cell">
                        {p.payer_name || p.payer_kind}
                      </Td>
                      <Td className="text-right tabular-nums">{money(ctx.config, p.amount)}</Td>
                      <Td>
                        <Badge tone={STATUS_TONE[p.status]} className="capitalize">
                          {p.status}
                        </Badge>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </DataTable>
            ) : (
              <EmptyState
                title="Nothing paid yet"
                description="Payments you make, and any the bursary records for you, appear here."
              />
            )}
          </Card>
        </>
      )}
    </div>
  )
}
