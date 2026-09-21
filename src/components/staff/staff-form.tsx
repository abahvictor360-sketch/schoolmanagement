'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import type { z } from 'zod'
import { staffSchema } from '@/lib/validation'
import { createStaff } from '@/app/actions/people'
import { useAction } from '@/lib/use-action'
import { Button, Card, CardBody, CardHeader, CardTitle, ErrorNote, Field, Input, Select } from '@/components/ui/primitives'

type Values = z.input<typeof staffSchema>
type Parsed = z.output<typeof staffSchema>

export function StaffForm() {
  const router = useRouter()
  const { register, handleSubmit, reset, formState: { errors } } = useForm<Values, unknown, Parsed>({
    resolver: zodResolver(staffSchema),
    defaultValues: { staff_number: '', full_name: '', email: '', phone: '', designation: '', employment_status: 'active' },
  })

  const action = useAction(async (values: Parsed) => createStaff(values), {
    onSuccess: () => {
      reset()
      router.refresh()
    },
  })

  const fieldError = (name: keyof Values) => errors[name]?.message ?? action.fieldErrors[name]?.[0]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add staff member</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleSubmit((v) => action.run(v))} className="space-y-3" noValidate>
          {action.error ? <ErrorNote>{action.error}</ErrorNote> : null}
          <Field label="Staff number" error={fieldError('staff_number')}>
            <Input {...register('staff_number')} />
          </Field>
          <Field label="Full name" error={fieldError('full_name')}>
            <Input {...register('full_name')} />
          </Field>
          <Field label="Email" error={fieldError('email')} hint="Used to match an invitation later.">
            <Input type="email" inputMode="email" {...register('email')} />
          </Field>
          <Field label="Phone" error={fieldError('phone')}>
            <Input inputMode="tel" {...register('phone')} />
          </Field>
          <Field label="Designation" error={fieldError('designation')}>
            <Input placeholder="Mathematics teacher" {...register('designation')} />
          </Field>
          <Field label="Employment status" error={fieldError('employment_status')}>
            <Select {...register('employment_status')}>
              <option value="active">Active</option>
              <option value="on_leave">On leave</option>
              <option value="resigned">Resigned</option>
              <option value="terminated">Terminated</option>
            </Select>
          </Field>
          <Button type="submit" className="w-full" disabled={action.pending}>
            {action.pending ? 'Saving…' : 'Add staff member'}
          </Button>
        </form>
      </CardBody>
    </Card>
  )
}
