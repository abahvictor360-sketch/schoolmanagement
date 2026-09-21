'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { setStudentPhotoPath, studentPhotoUploadTarget } from '@/app/actions/people'
import { Button, ErrorNote } from '@/components/ui/primitives'

/**
 * Uploads straight to Storage with a signed URL scoped to this school's folder,
 * so the photo never travels through a server action payload.
 */
export function StudentPhoto({ studentId, url }: { studentId: string; url: string | null }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function upload(file: File) {
    setBusy(true)
    setError(null)
    try {
      if (file.size > 3 * 1024 * 1024) throw new Error('Photo must be under 3 MB.')

      const target = await studentPhotoUploadTarget(studentId)
      if (!target.ok) throw new Error(target.error)
      const { path, token } = target.data as { path: string; token: string }

      const supabase = createClient()
      const upload = await supabase.storage
        .from('student-photos')
        .uploadToSignedUrl(path, token, file, { upsert: true })
      if (upload.error) throw new Error(upload.error.message)

      const saved = await setStudentPhotoPath(studentId, path)
      if (!saved.ok) throw new Error(saved.error)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Upload failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="aspect-[3/4] w-full overflow-hidden rounded-lg border border-line bg-canvas">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Student passport photo" className="size-full object-cover" />
        ) : (
          <div className="grid size-full place-items-center text-[13px] text-ink-muted">No photo</div>
        )}
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void upload(file)
          event.target.value = ''
        }}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="no-print w-full"
        disabled={busy}
        onClick={() => input.current?.click()}
      >
        {busy ? 'Uploading…' : url ? 'Replace photo' : 'Upload photo'}
      </Button>
    </div>
  )
}
