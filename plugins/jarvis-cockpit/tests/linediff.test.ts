import { test, expect } from 'claude-code/testing'
import { MAX_CELLS, lineDiff } from '../hooks/linediff'

test('lineDiff: equal texts give no diff', () => {
  expect(lineDiff('a\nb', 'a\nb', 'disco', 'bozza')).toBe('')
})

test('lineDiff: a changed line comes with three lines of context', () => {
  const before = ['1', '2', '3', '4', '5', '6', '7', '8', '9'].join('\n')
  const after = before.replace('5', 'cinque')
  expect(lineDiff(before, after, 'disco', 'bozza')).toBe([
    '--- disco', '+++ bozza', '@@ -2,7 +2,7 @@',
    ' 2', ' 3', ' 4', '-5', '+cinque', ' 6', ' 7', ' 8',
  ].join('\n'))
})

test('lineDiff: equal lines in the middle stay aligned', () => {
  expect(lineDiff('a\nx\nb\ny\nc', 'a\nX\nb\nY\nc', 'disco', 'bozza')).toBe([
    '--- disco', '+++ bozza', '@@ -1,5 +1,5 @@',
    ' a', '-x', '+X', ' b', '-y', '+Y', ' c',
  ].join('\n'))
})

test('lineDiff: lines added at the end and removed at the start', () => {
  expect(lineDiff('a\nb', 'a\nb\nc', 'disco', 'bozza')).toBe(['--- disco', '+++ bozza', '@@ -1,2 +1,3 @@', ' a', ' b', '+c'].join('\n'))
  expect(lineDiff('a\nb\nc', 'c', 'disco', 'bozza')).toBe(['--- disco', '+++ bozza', '@@ -1,3 +1,1 @@', '-a', '-b', ' c'].join('\n'))
  expect(lineDiff('', 'nuovo', 'disco', 'bozza')).toBe(['--- disco', '+++ bozza', '@@ -1,1 +1,1 @@', '-', '+nuovo'].join('\n'))
})

test('lineDiff: over the size cap the changed stretch is a single block', () => {
  const n = Math.ceil(Math.sqrt(MAX_CELLS)) + 1
  const before = Array.from({ length: n }, (_, i) => `a${i}`).join('\n')
  const after = Array.from({ length: n }, (_, i) => `b${i}`).join('\n')
  const lines = lineDiff(before, after, 'disco', 'bozza').split('\n')
  expect(lines[2]).toBe(`@@ -1,${n} +1,${n} @@`)
  expect(lines.slice(3, 3 + n).every(l => l.startsWith('-'))).toBe(true)
  expect(lines.slice(3 + n).every(l => l.startsWith('+'))).toBe(true)
})
