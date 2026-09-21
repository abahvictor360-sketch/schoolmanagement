'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import type { z } from 'zod'
import { studentSchema } from '@/lib/validation'
import { useAction } from '@/lib/use-action'
import { createStudent, updateStudent } from '@/app/actions/people'
import { Button, ErrorNote, Field, Input, Select } from '@/components/ui/primitives'
import type { StudentRow } from '@/lib/database.types'

type Values = z.input<typeof studentSchema>
type Parsed = z.output<typeof studentSchema>

export function StudentForm({ student }: { student?: StudentRow }) {
  const router = useRouter()
  const editing = Boolean(student)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values, unknown, Parsed>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      admission_number: student?.admission_number ?? '',
      first_name: student?.first_name ?? '',
      last_name: student?.last_name ?? '',
      middle_name: student?.middle_name ?? '',
      date_of_birth: student?.date_of_birth ?? '',
      sex: student?.sex ?? '',
      admitted_on: student?.admitted_on ?? new Date().toISOString().slice(0, 10),
      status: student?.status ?? 'active',
    },
  })

  const action = useAction(
    async (values: Parsed) =>
      student ? updateStudent(student.id, values) : createStudent(values),
    {
      onSuccess: (data) => {
        const id = student?.id ?? (data as { id: string } | undefined)?.id
        router.push(id ? `/students/${id}` : '/students')
        router.refresh()
      },
    },
  )

  const fieldError = (name: keyof Values) =>
    errors[name]?.message ?? action.fieldErrors[name]?.[0]

  return (
    <form onSubmit={handleSubmit((values) => action.run(values))} className="space-y-4" noValidate>
      {action.error ? <ErrorNote>{action.error}</ErrorNote> : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Admission number" error={fieldError('admission_number')}>
          <Input aria-invalid={Boolean(fieldError('admission_number'))} {...register('admission_number')} />
        </Field>
        <Field label="Admitted on" error={fieldError('admitted_on')}>
          <Input type="date" {...register('admitted_on')} />
        </Field>
        <Field label="Last name" error={fieldError('last_name')}>
          <Input aria-invalid={Boolean(fieldError('last_name'))} {...register('last_name')} />
        </Field>
        <Field label="First name" error={fieldError('first_name')}>
          <Input aria-invalid={Boolean(fieldError('first_name'))} {...register('first_name')} />
        </Field>
        <Field label="Middle name" error={fieldError('middle_name')}>
          <Input {...register('middle_name')} />
        </Field>
        <Field label="Date of birth" error={fieldError('date_of_birth')}>
          <Input type="date" {...register('date_of_birth')} />
        </Field>
        <Field label="Sex" error={fieldError('sex')}>
          <Select {...register('sex')}>
            <option value="">Not recorded</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </Select>
        </Field>
        <Field label="Status" error={fieldError('status')}>
          <Select {...register('status')}>
            <option value="active">Active</option>
            <option value="graduated">Graduated</option>
            <option value="withdrawn">Withdrawn</option>
            <option value="transferred">Transferred</option>
          </Select>
        </Field>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={action.pending}>
          {action.pending ? 'Saving…' : editing ? 'Save changes' : 'Add student'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
