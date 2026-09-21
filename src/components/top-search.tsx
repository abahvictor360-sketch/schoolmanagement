import { Search } from 'lucide-react'

/**
 * The header's search field. It is a plain GET form onto the students list,
 * which already searches name and admission number and is already paginated —
 * so this is a shortcut into an existing index, not a second search path.
 * Only rendered for roles that may open that list.
 */
export function TopSearch() {
  return (
    <form
      action="/students"
      method="get"
      role="search"
      className="hidden min-w-0 flex-1 sm:block sm:max-w-[26rem]"
    >
      <label className="relative block">
        <span className="sr-only">Search students by name or admission number</span>
        <Search
          aria-hidden
          size={17}
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-muted"
        />
        <input
          type="search"
          name="q"
          placeholder="Search students…"
          className="h-11 w-full rounded-full bg-surface pr-4 pl-11 text-sm shadow-[var(--shadow-card)] placeholder:text-ink-muted/80"
        />
      </label>
    </form>
  )
}
