import { z } from 'zod'

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> }

export function failed(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { ok: false, error, fieldErrors }
}

export function succeeded<T>(data?: T): ActionResult<T> {
  return { ok: true, data }
}

/** Server-side re-validation of the very same schema the form used. */
export function parse<S extends z.ZodType>(schema: S, input: unknown) {
  const result = schema.safeParse(input)
  if (result.success) return { ok: true as const, value: result.data as z.infer<S> }
  const flat = z.flattenError(result.error)
  return {
    ok: false as const,
    result: failed('Please correct the highlighted fields.', flat.fieldErrors as Record<string, string[]>),
  }
}

/** Postgres errors that mean something specific to a person filling a form. */
export function describeDbError(error: { code?: string; message: string; details?: string | null }) {
  switch (error.code) {
    case '23505':
      return 'That value is already in use. Check for a duplicate.'
    case '23503':
      return 'A linked record is missing or belongs to another school.'
    case '42501':
    case 'PGRST301':
      return 'You do not have permission to do that.'
    default:
      return error.message
  }
}
