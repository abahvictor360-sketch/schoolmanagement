'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Input, Select } from '@/components/ui/primitives'

export function StudentFilters({ q, status }: { q: string; status: string }) {
  const router = useRouter()
  const [search, setSearch] = useState(q)

  function apply(next: { q?: string; status?: string }) {
    const params = new URLSearchParams()
    const query = next.q ?? search
    const stat = next.status ?? status
    if (query.trim()) params.set('q', query.trim())
    params.set('status', stat)
    router.push(`/students?${params}`)
  }

  return (
    <form
      className="no-print flex flex-col gap-2 sm:flex-row"
      onSubmit={(event) => {
        event.preventDefault()
        apply({})
      }}
      role="search"
    >
      <label className="flex-1">
        <span className="sr-only">Search students</span>
        <Input
          type="search"
          placeholder="Search by name or admission number"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <label className="sm:w-48">
        <span className="sr-only">Status</span>
        <Select value={status} onChange={(event) => apply({ status: event.target.value })}>
          <option value="active">Active</option>
          <option value="graduated">Graduated</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="transferred">Transferred</option>
          <option value="all">All statuses</option>
        </Select>
      </label>
      <button type="submit" className="h-11 rounded-lg bg-accent px-4 text-sm font-medium text-white sm:w-auto">
        Search
      </button>
    </form>
  )
}
