import { test, expect } from 'claude-code/testing'
import { clipDiff, diffSource, parseLogHead, parseLsFiles, parseNumstat, parseStatus, toDiffView } from '../hooks/git'

test('git: status reads modified, new, new folders, ignored, renamed and deleted entries', () => {
  const out = [' M To Do.md', '?? 00 - Inbox/nuova.md', '?? 03 - Projects/Nuovo/', '!! 99 - Jarvis/lab/repos/', 'R  b.md', 'a.md', ' D vecchio.md', 'A  aggiunto.md', ''].join('\0')
  expect(parseStatus(out)).toEqual({
    changed: { 'To Do.md': 'mod', '00 - Inbox/nuova.md': 'new', '03 - Projects/Nuovo': 'new', 'b.md': 'mod', 'vecchio.md': 'del', 'aggiunto.md': 'new' },
    ignored: ['99 - Jarvis/lab/repos'],
  })
  expect(parseStatus('')).toEqual({ changed: {}, ignored: [] })
})

test('git: ls-files paths are NUL separated, and the last one is dropped when the output is cut', () => {
  expect(parseLsFiles('a.md\0b/c.md\0', false)).toEqual(['a.md', 'b/c.md'])
  expect(parseLsFiles('a.md\0b/c', true)).toEqual(['a.md'])
})

test('git: the diff source comes from the file status', () => {
  expect(diffSource('?? x.md\0')).toBe('untracked')
  expect(diffSource(' M x.md\0')).toBe('uncommitted')
  expect(diffSource('')).toBe('committed')
  expect(diffSource('!! x.md\0')).toBe('committed')
})

test('git: the log head gives hash, time and subject', () => {
  expect(parseLogHead('abc1234\x001759999999\x00vault: 2026-10-09 11:59:22\n')).toEqual({ hash: 'abc1234', at: 1759999999000, subject: 'vault: 2026-10-09 11:59:22' })
  expect(parseLogHead('')).toBe(null)
})

test('git: a cut diff never stops in the middle of a hunk', () => {
  const h1 = '@@ -1,1 +1,1 @@\n-a\n+b\n'
  const h2 = '@@ -9,1 +9,1 @@\n-c\n+' + 'x'.repeat(50) + '\n'
  expect(clipDiff(h1 + h2, 1000)).toEqual({ text: h1 + h2, isCut: false })
  expect(clipDiff(h1 + h2, h1.length + 10)).toEqual({ text: h1, isCut: true })
})

test('git: a cut diff does not overshoot when a hunk starts exactly at the limit', () => {
  const hA = '@@ -1 +1 @@\n-a\n+b\n'
  const hB = '@@ -2 +2 @@\n-c\n+d\n'
  const max = hA.length + hB.length + 10
  // The `\n@@` of hunk 3 falls exactly at index max: the cut must stay within max.
  const r = clipDiff(hA + hB + 'x'.repeat(10) + '\n@@ -3 +3 @@\n-e\n+f\n', max)
  expect(r).toEqual({ text: hA, isCut: true })
  expect(r.text.length <= max).toBe(true)
})

test('git: the diff view for each case', () => {
  expect(toDiffView('untracked', '', null)).toEqual({ kind: 'untracked' })
  expect(toDiffView('uncommitted', null, null)).toEqual({ kind: 'error' })
  expect(toDiffView('committed', '', null)).toEqual({ kind: 'none' })
  expect(toDiffView('uncommitted', '@@ -1 +1 @@\n-a\n+b\n', null)).toEqual({ kind: 'uncommitted', text: '@@ -1 +1 @@\n-a\n+b\n', isCut: false })
  expect(toDiffView('committed', '@@ -1 +1 @@\n-a\n+b\n', { at: 5, subject: 's' })).toEqual({ kind: 'commit', text: '@@ -1 +1 @@\n-a\n+b\n', isCut: false, at: 5, subject: 's' })
})

test('git: numstat gives added and removed lines for each file, binaries at zero, a rename on the new path', () => {
  const out = ['12\t3\t03 - Projects/NOVA/NOVA.md', '-\t-\tlogo.png', '1\t1\t', 'vecchio.md', 'nuovo.md', '0\t7\tTo Do.md', ''].join('\0')
  expect(parseNumstat(out)).toEqual({
    '03 - Projects/NOVA/NOVA.md': { add: 12, del: 3 },
    'logo.png': { add: 0, del: 0 },
    'nuovo.md': { add: 1, del: 1 },
    'To Do.md': { add: 0, del: 7 },
  })
  expect(parseNumstat('')).toEqual({})
})
