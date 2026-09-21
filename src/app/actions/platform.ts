'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { requirePlatformAdmin } from '@/lib/auth'
import { describeDbError, failed, parse, succeeded, type ActionResult } from '@/lib/action-result'
import { createSchoolSchema } from '@/lib/validation'
import { presetConfig } from '@/lib/academic-config'

/**
 * Creates a school, its settings row, and an invitation for its first
 * administrator — all inside one database function, under the caller's own
 * credentials. The admin account materialises when that person signs up, so no
 * service_role key is needed anywhere in this path.
 */
export async function createSchool(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = parse(createSchoolSchema, input)
  if (!parsed.ok) return parsed.result

  await requirePlatformAdmin()
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('create_school', {
    p_name: parsed.value.name,
    p_slug: parsed.value.slug,
    p_admin_email: parsed.value.admin_email,
    p_config: presetConfig(parsed.value.preset_key),
    p_preset: parsed.value.preset_key,
  })
  if (error) return failed(describeDbError(error))

  revalidatePath('/platform')
  return succeeded({ id: data as string })
}
