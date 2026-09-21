import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function fullName(s: { first_name: string; last_name: string; middle_name?: string | null }) {
  return [s.last_name, s.first_name, s.middle_name].filter(Boolean).join(' ')
}
