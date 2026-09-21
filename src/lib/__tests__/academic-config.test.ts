import { describe, expect, it } from 'vitest'
import {
  academicConfigSchema, gradeFor, PRESETS, presetConfig, formatMoney,
} from '@/lib/academic-config'

describe('academic presets', () => {
  it('every shipped preset is internally consistent', () => {
    for (const preset of Object.values(PRESETS)) {
      expect(academicConfigSchema.safeParse(preset.config).success).toBe(true)
    }
  })

  it('rejects assessment weights that do not total 100', () => {
    const broken = {
      ...PRESETS.NG.config,
      assessment_components: [{ key: 'exam', label: 'Exam', weight: 80, max_score: 80 }],
    }
    const result = academicConfigSchema.safeParse(broken)
    expect(result.success).toBe(false)
  })

  it('rejects a term template list that disagrees with terms_per_session', () => {
    const broken = { ...PRESETS.NG.config, terms_per_session: 2 }
    expect(academicConfigSchema.safeParse(broken).success).toBe(false)
  })

  it('grades a score using the school’s own bands, not a hardcoded scale', () => {
    expect(gradeFor(PRESETS.NG.config, 78)?.label).toBe('A1')
    expect(gradeFor(PRESETS.NG.config, 41)?.label).toBe('E8')
    expect(gradeFor(PRESETS.NG.config, 12)?.is_pass).toBe(false)

    // The same score is a different grade in a different country.
    expect(gradeFor(PRESETS.KE.config, 78)?.label).toBe('B')
    expect(gradeFor(PRESETS.GH.config, 78)?.label).toBe('2')
  })

  it('a score of 40 passes in Nigeria and fails in Kenya', () => {
    expect(gradeFor(PRESETS.NG.config, 40)?.is_pass).toBe(true)
    expect(gradeFor(PRESETS.KE.config, 40)?.is_pass).toBe(false)
  })

  it('formats money in each school’s currency', () => {
    expect(formatMoney(PRESETS.NG.config, 1500)).toContain('1,500')
    expect(formatMoney(PRESETS.GH.config, 1500)).toContain('1,500')
  })

  it('falls back to the Nigeria preset for an unknown key', () => {
    expect(presetConfig('ZZ').currency).toBe('NGN')
  })
})
