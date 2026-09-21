'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { z } from 'zod'
import { createSchoolSchema } from '@/lib/validation'
import { createSchool } from '@/app/actions/platform'
import { useAction } from '@/lib/use-action'
import { PRESETS } from '@/lib/academic-config'
import { Button, Card, CardBody, CardHeader, CardTitle, ErrorNote, Field, Input, Select } from '@/components/ui/primitives'

type Values = z.input<typeof createSchoolSchema>
type Parsed = z.output<typeof createSchoolSchema>

export function CreateSchoolForm() {
  const router = useRouter()
  const [created, setCreated] = useState<string | null>(null)

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<Values, unknown, Parsed>({
    resolver: zodResolver(createSchoolSchema),
    defaultValues: { name: '', slug: '', admin_email: '', preset_key: 'NG' },
  })

  const action = useAction(async (values: Parsed) => createSchool(values), {
    onSuccess: () => {
      setCreated(watch('admin_email'))
      reset()
      router.refresh()
    },
  })

  const fieldError = (name: keyof Values) => errors[name]?.message ?? action.fieldErrors[name]?.[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a school</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit((v) => action.run(v))} className="space-y-3" noValidate>
          {action.error ? <ErrorNote>{action.error}</ErrorNote> : null}
          {created ? (
            <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-positive">
              School created. {created} can now sign up and will land in the setup wizard.
            </p>
          ) : null}

          <Field label="School name" error={fieldError('name')}>
            <Input {...register('name')} />
          </Field>
          <Field
            label="Subdomain"
            error={fieldError('slug')}
            hint="Permanent. Used as the school's own address."
          >
            <Input placeholder="greenfield" {...register('slug')} />
          </Field>
          <Field
            label="First administrator's email"
            error={fieldError('admin_email')}
            hint="They get access by signing up with this exact address."
          >
            <Input type="email" inputMode="email" {...register('admin_email')} />
          </Field>
          <Field label="Academic preset" error={fieldError('preset_key')}>
            <Select {...register('preset_key')}>
              {Object.values(PRESETS).map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>

          <Button type="submit" className="w-full" disabled={action.pending}>
            {action.pending ? 'Creating…' : 'Create school'}
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
