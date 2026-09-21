'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import type { z } from 'zod'
import { guardianSchema } from '@/lib/validation'
import { createGuardian } from '@/app/actions/people'
import { useAction } from '@/lib/use-action'
import { Button, Card, CardBody, CardHeader, CardTitle, ErrorNote, Field, Input, Textarea } from '@/components/ui/primitives'

type Values = z.input<typeof guardianSchema>
type Parsed = z.output<typeof guardianSchema>

export function GuardianForm() {
  const router = useRouter()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values, unknown, Parsed>({
    resolver: zodResolver(guardianSchema),
    defaultValues: { full_name: '', phone: '', email: '', occupation: '', address: '' },
  })

  const action = useAction(async (values: Parsed) => createGuardian(values), {
    onSuccess: () => {
      reset()
      router.refresh()
    },
  })

  const fieldError = (name: keyof Values) => errors[name]?.message ?? action.fieldErrors[name]?.[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add guardian</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit((v) => action.run(v))} className="space-y-3" noValidate>
          {action.error ? <ErrorNote>{action.error}</ErrorNote> : null}
          <Field label="Full name" error={fieldError('full_name')}>
            <Input {...register('full_name')} />
          </Field>
          <Field label="Phone" error={fieldError('phone')}>
            <Input inputMode="tel" {...register('phone')} />
          </Field>
          <Field label="Email" error={fieldError('email')}>
            <Input type="email" inputMode="email" {...register('email')} />
          </Field>
          <Field label="Occupation" error={fieldError('occupation')}>
            <Input {...register('occupation')} />
          </Field>
          <Field label="Address" error={fieldError('address')}>
            <Textarea rows={3} {...register('address')} />
          </Field>
          <Button type="submit" className="w-full" disabled={action.pending}>
            {action.pending ? 'Saving…' : 'Add guardian'}
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
