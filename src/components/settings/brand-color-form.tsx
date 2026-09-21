'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { setBrandColor } from '@/app/actions/fees'
import { useAction } from '@/lib/use-action'
import { cn } from '@/lib/utils'
import { BRAND_PRESETS, brandStyle, contrastRatio, DEFAULT_BRAND, deriveBrand, isHex } from '@/lib/branding'
import {
  Badge, Button, Card, CardBody, CardHeader, CardTitle, ErrorNote, Field, Input,
} from '@/components/ui/primitives'

export function BrandColorForm({ current }: { current: string | null }) {
  const router = useRouter()
  const [value, setValue] = useState(current ?? DEFAULT_BRAND)
  const [saved, setSaved] = useState(false)

  const valid = isHex(value)
  const brand = deriveBrand(valid ? value : DEFAULT_BRAND)
  const ratio = contrastRatio(brand.accent, brand.ink)

  const action = useAction(async () => setBrandColor({ brand_color: value }), {
    onSuccess: () => {
      setSaved(true)
      router.refresh()
    },
  })

  const reset = useAction(async () => setBrandColor({ brand_color: '' }), {
    onSuccess: () => {
      setValue(DEFAULT_BRAND)
      setSaved(true)
      router.refresh()
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>School colour</CardTitle>
        {current ? <Badge tone="accent">Custom</Badge> : <Badge>Platform default</Badge>}
      </CardHeader>

      <CardBody className="space-y-5">
        {action.error ? <ErrorNote>{action.error}</ErrorNote> : null}
        {saved && !action.pending ? <p className="text-sm text-positive">Saved.</p> : null}

        <fieldset>
          <legend className="mb-2 text-[13px] font-semibold">Pick a colour</legend>
          <div className="flex flex-wrap gap-2">
            {BRAND_PRESETS.map((preset) => {
              const on = value.toLowerCase() === preset.value
              return (
                <button
                  key={preset.value}
                  type="button"
                  aria-label={preset.label}
                  aria-pressed={on}
                  title={preset.label}
                  onClick={() => { setSaved(false); setValue(preset.value) }}
                  className={cn(
                    'size-10 rounded-2xl transition-transform',
                    on ? 'ring-2 ring-ink ring-offset-2' : 'hover:scale-105',
                  )}
                  style={{ background: preset.value }}
                />
              )
            })}
          </div>
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-[auto_1fr]">
          <Field label="Or choose your own">
            <input
              type="color"
              aria-label="School colour"
              className="h-11 w-16 cursor-pointer rounded-xl border border-line bg-surface p-1"
              value={valid ? value : DEFAULT_BRAND}
              onChange={(event) => { setSaved(false); setValue(event.target.value) }}
            />
          </Field>
          <Field label="Hex" error={valid ? undefined : 'Use a six-digit hex colour, like #1d4ed8'}>
            <Input
              value={value}
              aria-invalid={!valid}
              onChange={(event) => { setSaved(false); setValue(event.target.value) }}
            />
          </Field>
        </div>

        {/* Live preview under the chosen palette, so nobody has to save and
            navigate to find out a colour is unusable. */}
        <div style={brandStyle(valid ? value : DEFAULT_BRAND)} className="space-y-3 rounded-2xl bg-canvas p-4">
          <p className="text-[13px] font-semibold">Preview</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-accent-ink">
              Save changes
            </span>
            <span className="inline-flex h-11 items-center gap-2 rounded-2xl bg-accent-soft px-3.5 text-[14px] font-semibold text-accent-on-soft">
              Dashboard
            </span>
            <Badge tone="accent">Current term</Badge>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-surface">
            <div className="h-full w-2/3 rounded-full bg-accent" />
          </div>
        </div>

        <p className="text-[12px] text-ink-muted">
          Text on your colour is picked automatically for legibility — a dark colour gets white
          text, a light one gets dark. This pairing measures{' '}
          <strong className="text-ink">{ratio}:1</strong>
          {ratio >= 4.5
            ? ', which clears the accessibility bar for body text.'
            : ratio >= 3
              ? ', which is readable on a button but tight for small text.'
              : '. That is too low to read comfortably — try a darker or lighter shade.'}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button disabled={action.pending || !valid} onClick={() => action.run()}>
            {action.pending ? 'Saving…' : 'Apply to the whole app'}
          </Button>
          {current ? (
            <Button variant="secondary" disabled={reset.pending} onClick={() => reset.run()}>
              Reset to default
            </Button>
          ) : null}
        </div>
      </CardBody>
    </Card>
  )
}
