'use client'

import { useRouter } from 'next/navigation'
import type { TermOption } from '@/lib/queries'
import { Select } from '@/components/ui/primitives'

export function TermPicker({ terms, active }: { terms: TermOption[]; active: string }) {
  const router = useRouter()
  return (
    <label className="no-print block max-w-sm">
      <span className="mb-1.5 block text-[13px] font-medium">Term</span>
      <Select
        value={active}
        onChange={(event) => router.push(`/attendance/summary?term=${event.target.value}`)}
      >
        {terms.map((t) => (
          <option key={t.id} value={t.id}>
            {t.session_label} · {t.label}
            {t.is_current ? ' (current)' : ''}
          </option>
        ))}
      </Select>
    </label>
  )
}
