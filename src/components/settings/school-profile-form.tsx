'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { z } from 'zod'
import { schoolProfileSchema } from '@/lib/validation'
import { updateSchoolProfile } from '@/app/actions/setup'
import { useAction } from '@/lib/use-action'
import { Button, ErrorNote, Field, Input, Textarea } from '@/components/ui/primitives'

type Values = z.input<typeof schoolProfileSchema>
type Parsed = z.output<typeof schoolProfileSchema>

export function SchoolProfileForm({ school }: { school: Values }) {
  const router = useRouter()
  const [saved, setSaved] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<Values, unknown, Parsed>({
    resolver: zodResolver(schoolProfileSchema),
    defaultValues: school,
  })

  const action = useAction(async (values: Parsed) => updateSchoolProfile(values), {
    onSuccess: () => {
      setSaved(true)
      router.refresh()
    },
  })

  const fieldError = (name: keyof Values) => errors[name]?.message ?? action.fieldErrors[name]?.[0]

  return (
    <form
      onSubmit={handleSubmit((v) => {
        setSaved(false)
        action.run(v)
      })}
      className="space-y-4"
      noValidate
    >
      {action.error ? <ErrorNote>{action.error}</ErrorNote> : null}
      {saved ? <p className="text-sm text-positive">Saved.</p> : null}

      <Field label="School name" error={fieldError('name')}>
        <Input {...register('name')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone" error={fieldError('phone')}>
          <Input inputMode="tel" {...register('phone')} />
        </Field>
        <Field label="Email" error={fieldError('email')}>
          <Input type="email" {...register('email')} />
        </Field>
      </div>
      <Field label="Address" error={fieldError('address')}>
        <Textarea rows={3} {...register('address')} />
      </Field>

      <Button type="submit" disabled={action.pending}>
        {action.pending ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  )
}
