import { describe, expect, it } from 'vitest'
import {
  BRAND_PRESETS, contrastRatio, DEFAULT_BRAND, deriveBrand, isHex,
} from '@/lib/branding'

describe('school brand colour', () => {
  it('accepts a six-digit hex and rejects anything else', () => {
    expect(isHex('#7c3aed')).toBe(true)
    expect(isHex('#7C3AED')).toBe(true)
    for (const bad of ['7c3aed', '#7c3ae', '#7c3aedd', 'violet', '', '#gggggg']) {
      expect(isHex(bad)).toBe(false)
    }
  })

  it('falls back to the default rather than rendering an invalid colour', () => {
    expect(deriveBrand(null).accent).toBe(DEFAULT_BRAND)
    expect(deriveBrand('not a colour').accent).toBe(DEFAULT_BRAND)
    expect(deriveBrand('').accent).toBe(DEFAULT_BRAND)
  })

  it('puts white text on a dark brand and dark text on a light one', () => {
    expect(deriveBrand('#1e3a8a').ink).toBe('#ffffff')   // navy
    expect(deriveBrand('#fde047').ink).toBe('#16112e')   // pale yellow
    expect(deriveBrand('#ffffff').ink).toBe('#16112e')
    expect(deriveBrand('#000000').ink).toBe('#ffffff')
  })

  it('keeps button text readable whatever colour is chosen', () => {
    // Every preset, plus deliberately awkward choices, must clear WCAG AA for
    // large text (3:1) at minimum — that is the floor for a button label.
    const awkward = ['#fde047', '#a3e635', '#22d3ee', '#f9a8d4', '#ffffff', '#808080']
    for (const value of [...BRAND_PRESETS.map((p) => p.value), ...awkward]) {
      const brand = deriveBrand(value)
      expect(
        contrastRatio(brand.accent, brand.ink),
        `${value} produced only ${contrastRatio(brand.accent, brand.ink)}:1`,
      ).toBeGreaterThanOrEqual(3)
    }
  })

  it('every shipped preset clears the stricter 4.5:1 body-text bar', () => {
    for (const preset of BRAND_PRESETS) {
      const brand = deriveBrand(preset.value)
      expect(
        contrastRatio(brand.accent, brand.ink),
        `${preset.label} produced only ${contrastRatio(brand.accent, brand.ink)}:1`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('derives a darker hover shade and a pale tint from the same colour', () => {
    const brand = deriveBrand('#7c3aed')
    expect(brand.strong).not.toBe(brand.accent)
    expect(brand.soft).not.toBe(brand.accent)
    // The tint must be light enough to carry dark text.
    expect(contrastRatio(brand.soft, '#16112e')).toBeGreaterThanOrEqual(4.5)
    // The hover shade must be darker, never lighter.
    expect(contrastRatio(brand.strong, '#ffffff')).toBeGreaterThan(
      contrastRatio(brand.accent, '#ffffff'),
    )
  })

  it('text on the pale tint is readable even for a light brand colour', () => {
    // The bug this guards: a yellow school's accent on its own yellow tint is
    // invisible, so onSoft has to be darkened until it reads.
    const awkward = ['#fde047', '#a3e635', '#22d3ee', '#f9a8d4', '#ffffff']
    for (const value of [...BRAND_PRESETS.map((p) => p.value), ...awkward]) {
      const brand = deriveBrand(value)
      expect(
        contrastRatio(brand.onSoft, brand.soft),
        `${value}: onSoft only reaches ${contrastRatio(brand.onSoft, brand.soft)}:1 on its tint`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('leaves onSoft alone when the accent already reads on its tint', () => {
    const navy = deriveBrand('#1e3a8a')
    expect(navy.onSoft).toBe(navy.accent)
  })

  it('contrastRatio is symmetric and bounded', () => {
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 1)
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(contrastRatio('#7c3aed', '#7c3aed')).toBeCloseTo(1, 1)
  })
})
