'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { switchSchool } from '@/app/actions/session'
import { Select } from '@/components/ui/primitives'

/**
 * Only rendered when the user belongs to more than one school. Switching posts
 * to a server action which re-checks membership before setting the cookie.
 */
export function SchoolSwitcher({
  current,
  schools,
}: {
  current: { id: string; name: string }
  schools: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [pending, start] = useTransition()

  if (schools.length <= 1) {
    return <p className="truncate text-sm font-medium">{current.name}</p>
  }

  return (
    <label className="flex min-w-0 items-center gap-2">
      <span className="sr-only">Active school</span>
      <Select
        className="h-9 max-w-[14rem] text-[13px]"
        value={current.id}
        disabled={pending}
        onChange={(event) => {
          const next = event.target.value
          start(async () => {
            await switchSchool(next)
            router.refresh()
          })
        }}
      >
        {schools.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </Select>
    </label>
  )
}
