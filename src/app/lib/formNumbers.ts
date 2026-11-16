declare const digitBrand: unique symbol

export type DigitString = string & { readonly [digitBrand]: true }
export type JenisIdentitas = 'KTP' | 'SIM' | 'Kartu Pelajar' | 'Paspor'

export const IDENTITAS_OPTIONS: readonly JenisIdentitas[] = [
  'KTP',
  'SIM',
  'Kartu Pelajar',
  'Paspor',
]

export const EMPTY_DIGITS = '' as DigitString

export function needs16DigitIdentity(jenis: string): boolean {
  return jenis === 'KTP' || jenis === 'SIM'
}

export function toDigits(value: string, maxLength?: number): DigitString {
  const digits = value.replace(/\D/g, '')
  return (maxLength != null ? digits.slice(0, maxLength) : digits) as DigitString
}

export function sanitizeIdentitas(value: string, jenis: string): string {
  return needs16DigitIdentity(jenis)
    ? toDigits(value, 16)
    : value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 20)
}

export function sanitizeUsia(value: string): DigitString {
  return toDigits(value, 3)
}

export function sanitizeWhatsapp(value: string): DigitString {
  let digits: string = toDigits(value)
  if (digits.startsWith('62')) digits = digits.slice(2)
  else if (digits.startsWith('0')) digits = digits.slice(1)
  return digits.slice(0, 13) as DigitString
}

export function isValidIdentitas(value: string, jenis: string): boolean {
  const v = value.trim()
  return needs16DigitIdentity(jenis) ? /^\d{16}$/.test(v) : /^[A-Za-z0-9]{4,20}$/.test(v)
}

export function isValidUsia(value: string): boolean {
  const v = value.trim()
  if (!/^\d{1,3}$/.test(v)) return false
  const n = Number(v)
  return n >= 1 && n <= 120
}

export function isValidWhatsapp(value: string): boolean {
  return /^8\d{8,11}$/.test(sanitizeWhatsapp(value))
}
