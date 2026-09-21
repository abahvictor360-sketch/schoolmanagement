'use client'

import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/client'
import { credentialsSchema, signUpSchema } from '@/lib/validation'
import { Button, ErrorNote, Field, Input, PasswordInput } from '@/components/ui/primitives'

type Props = { mode: 'signin' | 'signup'; next: string }

export function AuthForm({ mode, next }: Props) {
  const schema = mode === 'signup' ? signUpSchema : credentialsSchema
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<z.infer<typeof signUpSchema>>({
    resolver: zodResolver(schema as never),
    defaultValues: { email: '', password: '', full_name: '' },
  })

  async function onSubmit(values: z.infer<typeof signUpSchema>) {
    setFormError(null)
    const supabase = createClient()

    const { error } =
      mode === 'signup'
        ? await supabase.auth.signUp({
            email: values.email,
            password: values.password,
            options: { data: { full_name: values.full_name } },
          })
        : await supabase.auth.signInWithPassword({
            email: values.email,
            password: values.password,
          })

    if (error) {
      setFormError(error.message)
      return
    }

    router.replace(next)
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      {formError ? <ErrorNote>{formError}</ErrorNote> : null}

      {mode === 'signup' ? (
        <Field label="Full name" error={errors.full_name?.message}>
          <Input autoComplete="name" aria-invalid={Boolean(errors.full_name)} {...register('full_name')} />
        </Field>
      ) : null}

      <Field label="Email" error={errors.email?.message}>
        <Input
          type="email"
          inputMode="email"
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          {...register('email')}
        />
      </Field>

      <Field label="Password" error={errors.password?.message}>
        <PasswordInput
          autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
          aria-invalid={Boolean(errors.password)}
          {...register('password')}
        />
      </Field>

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}
      </Button>
    </form>
  )
}
