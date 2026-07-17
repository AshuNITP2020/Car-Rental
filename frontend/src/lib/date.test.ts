import { describe, expect, it } from 'vitest'
import { dayAtDefaultHour, DEFAULT_RENTAL_HOUR, isValidRange, rentalDays } from './date'

describe('rentalDays', () => {
  it('counts whole calendar days', () => {
    expect(rentalDays('2026-07-20T10:00:00Z', '2026-07-24T10:00:00Z')).toBe(4)
  })
  it('is at least 1 for a same-day rental', () => {
    expect(rentalDays('2026-07-20T08:00:00Z', '2026-07-20T18:00:00Z')).toBe(1)
  })
  it('is 0 for invalid input', () => {
    expect(rentalDays('garbage', '2026-07-20T10:00:00Z')).toBe(0)
  })
})

describe('isValidRange', () => {
  it('requires from strictly before to', () => {
    expect(isValidRange('2026-07-20T10:00:00Z', '2026-07-21T10:00:00Z')).toBe(true)
    expect(isValidRange('2026-07-20T10:00:00Z', '2026-07-20T10:00:00Z')).toBe(false)
    expect(isValidRange('2026-07-21T10:00:00Z', '2026-07-20T10:00:00Z')).toBe(false)
    expect(isValidRange(null, '2026-07-20T10:00:00Z')).toBe(false)
  })
})

describe('dayAtDefaultHour', () => {
  it('pins a calendar day to the default rental hour (local)', () => {
    const iso = dayAtDefaultHour(new Date(2026, 6, 20)) // 20 Jul 2026 local
    expect(new Date(iso).getHours()).toBe(DEFAULT_RENTAL_HOUR)
  })
})
