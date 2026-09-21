'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { clearSchoolLogo, logoUploadTarget, setSchoolLogo } from '@/app/actions/fees'
import { Button, Card, CardBody, CardHeader, CardTitle, ErrorNote } from '@/components/ui/primitives'
import { SchoolMark } from '@/components/school-mark'

export function LogoForm({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setBusy(true)
    setError(null)
    try {
      if (file.size > 2 * 1024 * 1024) throw new Error('The logo must be under 2 MB.')
      const extension = file.name.split('.').pop() ?? 'png'

      const target = await logoUploadTarget(extension)
      if (!target.ok) throw new Error(target.error)
      const { path, token } = target.data as { path: string; token: string }

      const supabase = createClient()
      const uploaded = await supabase.storage
        .from('school-logos')
        .uploadToSignedUrl(path, token, file, { upsert: true })
      if (uploaded.error) throw new Error(uploaded.error.message)

      const saved = await setSchoolLogo(path)
      if (!saved.ok) throw new Error(saved.error)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    const result = await clearSchoolLogo()
    setBusy(false)
    if (!result.ok) setError(result.error)
    else router.refresh()
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>School logo</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {error ? <ErrorNote>{error}</ErrorNote> : null}

        <div className="flex items-center gap-4">
          <SchoolMark name={name} logoUrl={logoUrl} size="lg" />
          <div className="min-w-0">
            <p className="text-sm font-semibold">{name}</p>
            <p className="text-[13px] text-ink-muted">
              {logoUrl
                ? 'Shown in the sidebar, on report cards and on printed invoices.'
                : 'No logo yet. Until you add one, a default badge is used.'}
            </p>
          </div>
        </div>

        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void upload(file)
            event.target.value = ''
          }}
        />

        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy} onClick={() => input.current?.click()}>
            {busy ? 'Uploading…' : logoUrl ? 'Replace logo' : 'Upload logo'}
          </Button>
          {logoUrl ? (
            <Button type="button" variant="secondary" disabled={busy} onClick={remove}>
              Remove
            </Button>
          ) : null}
        </div>

        <p className="text-[12px] text-ink-muted">
          A square PNG or SVG works best. Under 2 MB. It appears across the whole system the
          moment it is saved, for staff and pupils alike.
        </p>
      </CardBody>
    </Card>
  )
}
