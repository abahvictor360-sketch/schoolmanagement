import Papa from 'papaparse'
import type { z } from 'zod'

export type ParsedRow<T> =
  | { line: number; ok: true; value: T; raw: Record<string, string> }
  | { line: number; ok: false; errors: Record<string, string[]>; raw: Record<string, string> }

const normaliseHeader = (header: string) =>
  header.trim().toLowerCase().replace(/[\s-]+/g, '_')

/**
 * Parses a CSV client-side so the administrator sees, and can fix, every bad
 * row before anything is written. Nothing is committed until they say so.
 */
export function parseCsv<S extends z.ZodType>(
  file: File,
  schema: S,
): Promise<{ rows: ParsedRow<z.infer<S>>[]; headers: string[] }> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: normaliseHeader,
      complete: (result) => {
        const headers = result.meta.fields ?? []
        const rows = result.data.map((raw, index): ParsedRow<z.infer<S>> => {
          const parsed = schema.safeParse(raw)
          if (parsed.success) {
            return { line: index + 2, ok: true, value: parsed.data, raw }
          }
          const errors: Record<string, string[]> = {}
          for (const issue of parsed.error.issues) {
            const key = String(issue.path[0] ?? '_')
            errors[key] = [...(errors[key] ?? []), issue.message]
          }
          return { line: index + 2, ok: false, errors, raw }
        })
        resolve({ rows, headers })
      },
      error: (error) => reject(error),
    })
  })
}

export function toCsv(rows: Record<string, unknown>[]) {
  return Papa.unparse(rows)
}
