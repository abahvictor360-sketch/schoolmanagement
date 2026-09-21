'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { setCurrentTerm } from '@/app/actions/setup'
import { useAction } from '@/lib/use-action'
import type { TermOption } from '@/lib/queries'
import { Button, ErrorNote, Select } from '@/components/ui/primitives'

export function CurrentTermPicker({ terms }: { terms: TermOption[] }) {
  const router = useRouter()
  const [termId, setTermId] = useState(terms.find((t) => t.is_current)?.id ?? terms[0]?.id ?? '')
  const action = useAction(async () => setCurrentTerm(termId), { onSuccess: () => router.refresh() })

  if (terms.length === 0) {
    return <p className="text-sm text-ink-muted">No terms yet.</p>
  }

  return (
    <div className="space-y-2">
      {action.error ? <ErrorNote>{action.error}</ErrorNote> : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1.5 block text-[13px] font-medium">Current term</span>
          <Select value={termId} onChange={(event) => setTermId(event.target.value)}>
            {terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.session_label} · {t.label}
              </option>
            ))}
          </Select>
        </label>
        <Button disabled={action.pending} onClick={() => action.run()}>
          {action.pending ? 'Saving…' : 'Set current term'}
        </Button>
      </div>
      <p className="text-[13px] text-ink-muted">
        Attendance and enrollment always act on the current term.
      </p>
    </div>
  )
}
