'use client'

import { useState, useTransition } from 'react'
import type { ActionResult } from '@/lib/action-result'

/**
 * Runs a server action, keeps its error state, and surfaces field errors back
 * onto the form. The same Zod schema validated the input in the browser, so a
 * field error here means the server caught something the client could not.
 */
export function useAction<Args extends unknown[], T>(
  action: (...args: Args) => Promise<ActionResult<T>>,
  options: { onSuccess?: (data: T | undefined) => void } = {},
) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({})

  function run(...args: Args) {
    setError(null)
    setFieldErrors({})
    startTransition(async () => {
      const result = await action(...args)
      if (result.ok) {
        options.onSuccess?.(result.data)
      } else {
        setError(result.error)
        setFieldErrors(result.fieldErrors ?? {})
      }
    })
  }

  return { run, pending, error, fieldErrors }
}
