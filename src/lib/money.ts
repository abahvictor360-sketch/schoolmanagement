import type { AcademicConfig } from '@/lib/academic-config'

/** Every amount shown anywhere uses the school's own currency and locale. */
export function money(config: AcademicConfig, amount: number | string) {
  return new Intl.NumberFormat(config.locale, {
    style: 'currency',
    currency: config.currency,
    maximumFractionDigits: 2,
  }).format(Number(amount))
}
