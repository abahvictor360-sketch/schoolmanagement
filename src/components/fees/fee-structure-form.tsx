'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { createFeeStructure, raiseInvoices } from '@/app/actions/fees'
import { useAction } from '@/lib/use-action'
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle, ErrorNote, Field, Input, Select,
} from '@/components/ui/primitives'

type Item = { label: string; amount: string; is_optional: boolean }

const STARTER: Item[] = [
  { label: 'Tuition', amount: '', is_optional: false },
  { label: 'Development levy', amount: '', is_optional: false },
  { label: 'Books and materials', amount: '', is_optional: false },
]

export function FeeStructureForm({
  terms,
  levels,
  structures,
  currency,
}: {
  terms: { id: string; label: string; isCurrent: boolean }[]
  levels: { id: string; label: string }[]
  structures: { id: string; label: string }[]
  currency: string
}) {
  const router = useRouter()
  const [termId, setTermId] = useState(terms.find((t) => t.isCurrent)?.id ?? terms[0]?.id ?? '')
  const [levelId, setLevelId] = useState('')
  const [name, setName] = useState('Term fees')
  const [items, setItems] = useState<Item[]>(STARTER)

  const [raiseId, setRaiseId] = useState(structures[0]?.id ?? '')
  const [dueOn, setDueOn] = useState('')
  const [raised, setRaised] = useState<number | null>(null)

  const create = useAction(
    async () =>
      createFeeStructure({
        term_id: termId,
        class_level_id: levelId,
        name,
        items: items.filter((i) => i.label.trim() && i.amount !== ''),
      }),
    {
      onSuccess: () => {
        setItems(STARTER)
        router.refresh()
      },
    },
  )

  const raise = useAction(async () => raiseInvoices(raiseId, dueOn), {
    onSuccess: (data) => {
      setRaised((data as { created: number } | undefined)?.created ?? 0)
      router.refresh()
    },
  })

  const total = items
    .filter((i) => !i.is_optional)
    .reduce((sum, i) => sum + (Number(i.amount) || 0), 0)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Set a fee structure</CardTitle>
          <Badge tone="accent">
            {new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(total)}
          </Badge>
        </CardHeader>
        <CardBody>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.run() }}>
            {create.error ? <ErrorNote>{create.error}</ErrorNote> : null}

            <Field label="Term" error={create.fieldErrors.term_id?.[0]}>
              <Select value={termId} onChange={(e) => setTermId(e.target.value)}>
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>{t.label}{t.isCurrent ? ' (current)' : ''}</option>
                ))}
              </Select>
            </Field>

            <Field label="Class level" error={create.fieldErrors.class_level_id?.[0]}>
              <Select value={levelId} onChange={(e) => setLevelId(e.target.value)}>
                <option value="">Choose…</option>
                {levels.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
              </Select>
            </Field>

            <Field label="Name" error={create.fieldErrors.name?.[0]}>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>

            <fieldset className="space-y-2">
              <legend className="text-[13px] font-semibold">Items</legend>
              {create.fieldErrors.items?.[0] ? (
                <p role="alert" className="text-xs text-danger">{create.fieldErrors.items[0]}</p>
              ) : null}
              {items.map((item, index) => (
                <div key={index} className="grid gap-2 sm:grid-cols-[1fr_110px_auto]">
                  <Input
                    value={item.label}
                    aria-label={`Item ${index + 1} label`}
                    onChange={(e) =>
                      setItems(items.map((it, i) => (i === index ? { ...it, label: e.target.value } : it)))
                    }
                  />
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    aria-label={`Item ${index + 1} amount`}
                    value={item.amount}
                    onChange={(e) =>
                      setItems(items.map((it, i) => (i === index ? { ...it, amount: e.target.value } : it)))
                    }
                  />
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 text-[12px]">
                      <input
                        type="checkbox"
                        checked={item.is_optional}
                        onChange={(e) =>
                          setItems(items.map((it, i) => (i === index ? { ...it, is_optional: e.target.checked } : it)))
                        }
                      />
                      Optional
                    </label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setItems(items.filter((_, i) => i !== index))}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setItems([...items, { label: '', amount: '', is_optional: false }])}
              >
                Add an item
              </Button>
              <p className="text-[12px] text-ink-muted">
                Optional items are listed but left off the invoice total.
              </p>
            </fieldset>

            <Button type="submit" className="w-full" disabled={create.pending}>
              {create.pending ? 'Saving…' : 'Save fee structure'}
            </Button>
          </form>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Raise invoices</CardTitle>
        </CardHeader>
        <CardBody>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); raise.run() }}>
            {raise.error ? <ErrorNote>{raise.error}</ErrorNote> : null}
            {raised !== null ? (
              <p className="text-sm text-positive">
                {raised === 0
                  ? 'Everyone at that level already has this invoice.'
                  : `${raised} invoice${raised === 1 ? '' : 's'} raised.`}
              </p>
            ) : null}

            <Field label="Fee structure">
              <Select value={raiseId} onChange={(e) => setRaiseId(e.target.value)}>
                <option value="">Choose…</option>
                {structures.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </Select>
            </Field>

            <Field label="Due date">
              <Input type="date" value={dueOn} onChange={(e) => setDueOn(e.target.value)} />
            </Field>

            <Button type="submit" className="w-full" disabled={raise.pending || !raiseId}>
              {raise.pending ? 'Raising…' : 'Raise invoices for this level'}
            </Button>
            <p className="text-[12px] text-ink-muted">
              One invoice per active enrollment at that class level, for that term. Running it
              twice never double-bills.
            </p>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
