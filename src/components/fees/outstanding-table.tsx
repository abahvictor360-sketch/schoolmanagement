'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { recordOfflinePayment, reconcilePayment } from '@/app/actions/fees'
import { useAction } from '@/lib/use-action'
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle, DataTable, EmptyState,
  ErrorNote, Field, Input, Select, Td, Th,
} from '@/components/ui/primitives'

type Row = {
  invoiceId: string
  invoiceNumber: string
  name: string
  admissionNumber: string
  arm: string
  total: number
  paid: number
  balance: number
  dueOn: string | null
}

type Pending = { reference: string; amount: number; provider: string | null; openedAt: string }

export function OutstandingTable({
  rows,
  pending,
  currency,
  locale,
}: {
  rows: Row[]
  pending: Pending[]
  currency: string
  locale: string
}) {
  const router = useRouter()
  const format = (n: number) => new Intl.NumberFormat(locale, { style: 'currency', currency }).format(n)

  const [target, setTarget] = useState<Row | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<'bank_transfer' | 'cash' | 'pos' | 'waiver'>('bank_transfer')
  const [payerName, setPayerName] = useState('')
  const [note, setNote] = useState('')

  const record = useAction(
    async () =>
      recordOfflinePayment({
        invoice_id: target!.invoiceId,
        amount,
        method,
        // Always the bursary: a 'guardian' payer requires a linked guardian
        // record, which a counter payment does not have. The name goes in
        // payer_name, which is what a later dispute actually needs.
        payer_kind: 'bursary',
        payer_name: payerName,
        note,
      }),
    {
      onSuccess: () => {
        setTarget(null)
        setAmount('')
        setPayerName('')
        setNote('')
        router.refresh()
      },
    },
  )

  const reconcile = useAction(async (reference: string) => reconcilePayment(reference), {
    onSuccess: () => router.refresh(),
  })

  return (
    <div className="space-y-4">
      {pending.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Awaiting confirmation</CardTitle>
            <Badge tone="warn">{pending.length}</Badge>
          </CardHeader>
          <CardBody className="space-y-2">
            {reconcile.error ? <ErrorNote>{reconcile.error}</ErrorNote> : null}
            <p className="text-[13px] text-ink-muted">
              A payer who closed the browser before returning leaves a payment open. Asking the
              gateway settles it either way.
            </p>
            <ul className="divide-y divide-line">
              {pending.map((p) => (
                <li key={p.reference} className="flex flex-wrap items-center gap-3 py-2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-[12px] text-ink-muted">{p.reference}</span>
                    <span className="text-sm font-medium">{format(p.amount)}</span>
                    <span className="ml-2 text-[12px] text-ink-muted capitalize">{p.provider}</span>
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={reconcile.pending}
                    onClick={() => reconcile.run(p.reference)}
                  >
                    Check with gateway
                  </Button>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Outstanding</CardTitle>
          <Badge tone={rows.length > 0 ? 'warn' : 'positive'}>{rows.length}</Badge>
        </CardHeader>

        {rows.length === 0 ? (
          <EmptyState title="Nothing outstanding" description="Every invoice raised has been settled." />
        ) : (
          <DataTable>
            <thead>
              <tr>
                <Th>Pupil</Th>
                <Th className="hidden sm:table-cell">Class</Th>
                <Th className="text-right">Paid</Th>
                <Th className="text-right">Balance</Th>
                <Th className="no-print" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.invoiceId}>
                  <Td>
                    <span className="block font-medium">{r.name}</span>
                    <span className="font-mono text-[12px] text-ink-muted">
                      {r.admissionNumber} · {r.invoiceNumber}
                    </span>
                  </Td>
                  <Td className="hidden sm:table-cell">{r.arm}</Td>
                  <Td className="text-right tabular-nums">{format(r.paid)}</Td>
                  <Td className="text-right font-semibold tabular-nums">{format(r.balance)}</Td>
                  <Td className="no-print text-right">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setTarget(r)
                        setAmount(String(r.balance))
                      }}
                    >
                      Record payment
                    </Button>
                  </Td>
                </tr>
              ))}
            </tbody>
          </DataTable>
        )}
      </Card>

      {target ? (
        <Card className="no-print">
          <CardHeader>
            <CardTitle>Record a payment for {target.name}</CardTitle>
            <Badge>{format(target.balance)} outstanding</Badge>
          </CardHeader>
          <CardBody>
            <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); record.run() }}>
              {record.error ? <ErrorNote>{record.error}</ErrorNote> : null}

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Amount" error={record.fieldErrors.amount?.[0]}>
                  <Input
                    type="number"
                    min={0.01}
                    max={target.balance}
                    step="0.01"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </Field>
                <Field label="Method">
                  <Select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="cash">Cash</option>
                    <option value="pos">POS</option>
                    <option value="waiver">Waiver</option>
                  </Select>
                </Field>
              </div>

              <Field
                label="Paid by"
                hint="A name here books it against that person. Left blank, it is booked to the bursary."
              >
                <Input value={payerName} onChange={(e) => setPayerName(e.target.value)} />
              </Field>

              <Field label="Note" hint="Teller number, bank, or anything a later dispute would need.">
                <Input value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>

              <div className="flex gap-2">
                <Button type="submit" disabled={record.pending}>
                  {record.pending ? 'Recording…' : 'Record payment'}
                </Button>
                <Button type="button" variant="secondary" onClick={() => setTarget(null)}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      ) : null}
    </div>
  )
}
