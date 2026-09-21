'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { z } from 'zod'
import { parseCsv, type ParsedRow } from '@/lib/csv'
import type { ActionResult } from '@/lib/action-result'
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle, DataTable, ErrorNote, Input, Td, Th,
} from '@/components/ui/primitives'

type Props<S extends z.ZodType> = {
  schema: S
  columns: { key: string; label: string; required?: boolean }[]
  sampleRow: Record<string, string>
  commit: (rows: z.infer<S>[]) => Promise<ActionResult<{ inserted: number; enrolled?: number }>>
  extraControls?: React.ReactNode
  doneHref: string
}

/**
 * Preview-and-fix import. A row that fails validation is shown with its
 * problem and can be corrected in place; only valid rows are ever committed.
 */
export function CsvImport<S extends z.ZodType>({
  schema, columns, sampleRow, commit, extraControls, doneHref,
}: Props<S>) {
  const router = useRouter()
  const [rows, setRows] = useState<ParsedRow<z.infer<S>>[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<{ inserted: number; enrolled?: number } | null>(null)

  const valid = rows?.filter((r) => r.ok) ?? []
  const invalid = rows?.filter((r) => !r.ok) ?? []

  async function onFile(file: File) {
    setError(null)
    setResult(null)
    try {
      const parsed = await parseCsv(file, schema)
      if (parsed.rows.length === 0) {
        setError('That file has no data rows.')
        return
      }
      setRows(parsed.rows)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not read that file.')
    }
  }

  function editCell(line: number, key: string, value: string) {
    setRows((current) =>
      (current ?? []).map((row) => {
        if (row.line !== line) return row
        const raw = { ...row.raw, [key]: value }
        const parsed = schema.safeParse(raw)
        if (parsed.success) return { line: row.line, ok: true, value: parsed.data, raw }
        const errors: Record<string, string[]> = {}
        for (const issue of parsed.error.issues) {
          const k = String(issue.path[0] ?? '_')
          errors[k] = [...(errors[k] ?? []), issue.message]
        }
        return { line: row.line, ok: false, errors, raw }
      }),
    )
  }

  async function onCommit() {
    setBusy(true)
    setError(null)
    const outcome = await commit(valid.map((r) => (r as { value: z.infer<S> }).value))
    setBusy(false)
    if (!outcome.ok) {
      setError(outcome.error)
      return
    }
    setResult(outcome.data ?? { inserted: valid.length })
    setRows(null)
    router.refresh()
  }

  const sampleCsv = `${columns.map((c) => c.key).join(',')}\n${columns
    .map((c) => sampleRow[c.key] ?? '')
    .join(',')}`

  return (
    <div className="space-y-4">
      {error ? <ErrorNote>{error}</ErrorNote> : null}

      {result ? (
        <Card>
          <CardBody className="space-y-2">
            <p className="text-sm font-medium">
              Imported {result.inserted} row{result.inserted === 1 ? '' : 's'}.
              {typeof result.enrolled === 'number' && result.enrolled > 0
                ? ` ${result.enrolled} enrolled into class arms.`
                : ''}
            </p>
            <Button size="sm" variant="secondary" onClick={() => router.push(doneHref)}>
              View records
            </Button>
          </CardBody>
        </Card>
      ) : null}

      {!rows ? (
        <Card>
          <CardHeader>
            <CardTitle>Choose a CSV file</CardTitle>
            <a
              href={`data:text/csv;charset=utf-8,${encodeURIComponent(sampleCsv)}`}
              download="template.csv"
              className="text-[13px] font-medium text-accent-on-soft underline underline-offset-2"
            >
              Download template
            </a>
          </CardHeader>
          <CardBody className="space-y-3">
            <Input
              type="file"
              accept=".csv,text/csv"
              className="h-auto py-2"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void onFile(file)
              }}
            />
            <div className="text-[13px] text-ink-muted">
              <p className="font-medium text-ink">Expected columns</p>
              <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {columns.map((c) => (
                  <li key={c.key}>
                    <code className="rounded bg-canvas px-1 py-0.5">{c.key}</code>
                    {c.required ? <span className="text-danger"> *</span> : null}
                  </li>
                ))}
              </ul>
              <p className="mt-2">
                Column names are matched case-insensitively and spaces become underscores.
              </p>
            </div>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Review before importing</CardTitle>
            <div className="flex items-center gap-2">
              <Badge tone="positive">{valid.length} ready</Badge>
              {invalid.length > 0 ? <Badge tone="danger">{invalid.length} need fixing</Badge> : null}
            </div>
          </CardHeader>

          {extraControls ? <CardBody className="border-b border-line">{extraControls}</CardBody> : null}

          <DataTable>
            <thead>
              <tr>
                <Th className="w-14">Line</Th>
                {columns.map((c) => (
                  <Th key={c.key}>{c.label}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.line} className={row.ok ? '' : 'bg-red-50/60'}>
                  <Td className="text-[12px] text-ink-muted tabular-nums">{row.line}</Td>
                  {columns.map((c) => {
                    const issues = row.ok ? undefined : row.errors[c.key]
                    return (
                      <Td key={c.key}>
                        <Input
                          className="h-9 text-[13px]"
                          aria-invalid={Boolean(issues)}
                          aria-label={`${c.label} on line ${row.line}`}
                          value={row.raw[c.key] ?? ''}
                          onChange={(event) => editCell(row.line, c.key, event.target.value)}
                        />
                        {issues ? <p className="mt-1 text-[11px] text-danger">{issues[0]}</p> : null}
                      </Td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </DataTable>

          <CardBody className="flex flex-wrap items-center gap-2 border-t border-line">
            <Button onClick={onCommit} disabled={busy || valid.length === 0}>
              {busy ? 'Importing…' : `Import ${valid.length} row${valid.length === 1 ? '' : 's'}`}
            </Button>
            <Button variant="secondary" onClick={() => setRows(null)}>
              Choose a different file
            </Button>
            {invalid.length > 0 ? (
              <p className="text-[13px] text-ink-muted">
                Rows that still have errors are skipped.
              </p>
            ) : null}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
