/**
 * A school's own colour, applied across the whole app.
 *
 * The design system runs on three accent tokens, so one chosen hex can drive
 * every button, pill, active nav item and focus ring by overriding those
 * tokens on a wrapper element.
 *
 * The hard part is not the plumbing, it is that a school may legitimately pick
 * a pale yellow or a near-white, and a button has to stay readable either way.
 * So the foreground colour is chosen by measured contrast rather than assumed
 * to be white, and the derived shades are computed here in TypeScript rather
 * than with CSS color-mix(), which the older Android browsers a lot of these
 * schools run do not support.
 */

export const DEFAULT_BRAND = '#7c3aed'

/** Ink used across the app; the dark candidate for text on a light accent. */
const INK = '#16112e'

export type Brand = {
  accent: string
  /** Hover and pressed states. */
  strong: string
  /** Tinted backgrounds: active nav pills, badges, soft panels. */
  soft: string
  /** Text and icons sitting on top of `accent`. */
  ink: string
  /**
   * Text and icons sitting on top of `soft`. Not the same as `accent`: a pale
   * brand colour on its own pale tint is unreadable, so this is darkened until
   * it clears 4.5:1 against the tint.
   */
  onSoft: string
  /** Contrast ratio actually achieved between `ink` and `accent`. */
  contrast: number
}

type Rgb = { r: number; g: number; b: number }

export function isHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim())
}

function toRgb(hex: string): Rgb {
  const v = hex.trim().replace('#', '')
  return {
    r: Number.parseInt(v.slice(0, 2), 16),
    g: Number.parseInt(v.slice(2, 4), 16),
    b: Number.parseInt(v.slice(4, 6), 16),
  }
}

function toHex({ r, g, b }: Rgb): string {
  const part = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${part(r)}${part(g)}${part(b)}`
}

/** WCAG relative luminance. */
function luminance({ r, g, b }: Rgb): number {
  const channel = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(toRgb(a))
  const lb = luminance(toRgb(b))
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
}

function mix(hex: string, towards: Rgb, weight: number): string {
  const c = toRgb(hex)
  return toHex({
    r: c.r + (towards.r - c.r) * weight,
    g: c.g + (towards.g - c.g) * weight,
    b: c.b + (towards.b - c.b) * weight,
  })
}

const WHITE: Rgb = { r: 255, g: 255, b: 255 }
const BLACK: Rgb = { r: 0, g: 0, b: 0 }

/**
 * Derives the full accent set from one colour, picking the foreground by
 * measured contrast so a light brand colour gets dark text instead of an
 * unreadable white-on-yellow button.
 */
export function deriveBrand(input: string | null | undefined): Brand {
  const accent = input && isHex(input) ? input.trim().toLowerCase() : DEFAULT_BRAND

  const onWhite = contrastRatio(accent, '#ffffff')
  const onInk = contrastRatio(accent, INK)
  const ink = onWhite >= onInk ? '#ffffff' : INK

  const soft = mix(accent, WHITE, 0.9)

  // Darken the accent in steps until it reads against its own tint. A yellow
  // brand needs a long way; a navy one is already there on the first check.
  let onSoft = accent
  for (let step = 0; step <= 10 && contrastRatio(onSoft, soft) < 4.5; step += 1) {
    onSoft = mix(accent, BLACK, step * 0.08)
  }

  return {
    accent,
    strong: mix(accent, BLACK, 0.14),
    soft,
    ink,
    onSoft,
    contrast: Math.max(onWhite, onInk),
  }
}

/**
 * Inline custom properties for a wrapper element. These shadow the @theme
 * defaults for everything inside, so no component needs to know about
 * branding.
 */
export function brandStyle(input: string | null | undefined): React.CSSProperties {
  const brand = deriveBrand(input)
  return {
    '--color-accent': brand.accent,
    '--color-accent-strong': brand.strong,
    '--color-accent-soft': brand.soft,
    '--color-accent-ink': brand.ink,
    '--color-accent-on-soft': brand.onSoft,
  } as React.CSSProperties
}

/** Presets, so most schools never have to think about hex at all. */
export const BRAND_PRESETS = [
  { label: 'Violet', value: '#7c3aed' },
  { label: 'Indigo', value: '#4f46e5' },
  { label: 'Royal blue', value: '#1d4ed8' },
  { label: 'Teal', value: '#0f766e' },
  { label: 'Emerald', value: '#047857' },
  { label: 'Forest', value: '#166534' },
  { label: 'Maroon', value: '#9f1239' },
  { label: 'Crimson', value: '#be123c' },
  { label: 'Burnt orange', value: '#c2410c' },
  { label: 'Gold', value: '#b45309' },
  { label: 'Navy', value: '#1e3a8a' },
  { label: 'Charcoal', value: '#334155' },
] as const
