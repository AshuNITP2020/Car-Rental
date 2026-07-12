import { describe, expect, it } from 'vitest'
import { cn, formatBytes, formatMoney, humanizeStatus } from './utils'

describe('cn', () => {
  it('resolves Tailwind conflicts (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })
  it('handles conditionals', () => {
    const enabled: boolean = [].length > 0
    expect(cn('a', enabled && 'b', undefined, 'c')).toBe('a c')
  })
})

describe('humanizeStatus', () => {
  it('title-cases UPPER_SNAKE enum values', () => {
    expect(humanizeStatus('OUT_OF_SERVICE')).toBe('Out Of Service')
    expect(humanizeStatus('PENDING')).toBe('Pending')
  })
})

describe('formatBytes', () => {
  it('scales through units', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
  })
})

describe('formatMoney', () => {
  it('formats INR amounts', () => {
    const s = formatMoney(802)
    expect(s).toContain('802')
    expect(s).toContain('₹')
  })
  it('tolerates numeric strings and garbage', () => {
    expect(formatMoney('99.5')).toContain('99.5')
    expect(formatMoney('not-a-number')).toContain('0')
  })
})
