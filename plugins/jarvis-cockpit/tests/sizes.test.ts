import { test, expect } from 'claude-code/testing'
import { duTargets, formatSize, parseDu, staleDirs } from '../hooks/sizes'

test('formatSize: bytes, whole kB, MB and GB with one decimal under 10', () => {
  expect(formatSize(0, ',')).toBe('0 B')
  expect(formatSize(999, ',')).toBe('999 B')
  expect(formatSize(14_000, ',')).toBe('14 kB')
  expect(formatSize(999_499, ',')).toBe('999 kB')
  expect(formatSize(999_600, ',')).toBe('1,0 MB')
  expect(formatSize(6_100_000, ',')).toBe('6,1 MB')
  expect(formatSize(48_000_000, ',')).toBe('48 MB')
  expect(formatSize(2_300_000_000, ',')).toBe('2,3 GB')
})

test('parseDu: du -sk kilobytes to bytes; odd or empty output gives null', () => {
  expect(parseDu('48212\t/v/03 - Projects\n')).toBe(48212 * 1024)
  expect(parseDu('0\t/v/vuota\n')).toBe(0)
  expect(parseDu('du: /v/x: Permission denied\n')).toBe(null)
  expect(parseDu('')).toBe(null)
})

test('duTargets: only folders with no value and not already in progress are measured', () => {
  const sizes = { A: 10, B: null }
  expect(duTargets(['A', 'B', 'C', 'D'], sizes, new Set(['D']), new Set())).toEqual(['C'])
  // To remeasure: measured even with a cached value, but not twice at once.
  expect(duTargets(['A', 'B', 'C', 'D'], sizes, new Set(['D']), new Set(['A', 'D']))).toEqual(['A', 'C'])
})

test('staleDirs: a write marks the path and the folders containing it for remeasuring', () => {
  expect(staleDirs(['03 - Projects/NOVA/NOVA.md'])).toEqual(['03 - Projects/NOVA/NOVA.md', '03 - Projects', '03 - Projects/NOVA'])
  expect(staleDirs(['04 - Team', '04 - Team/x.md'])).toEqual(['04 - Team', '04 - Team/x.md'])
})
