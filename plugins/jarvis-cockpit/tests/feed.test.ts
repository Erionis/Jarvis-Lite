import { test, expect } from 'claude-code/testing'
import { addTouched, addWritten, pushActivity, statusText, MAX_FEED } from '../hooks/feed'
import { basename, dirname, daysBetween, isoDay } from '../hooks/format'
import { strings } from '../hooks/i18n'
import type { Activity } from '../types'

const a = (over: Partial<Activity>): Activity => ({
  at: new Date(2026, 9, 9, 14, 30).getTime(),
  verb: 'read', path: 'To Do.md', isProtected: true, isApprox: false, count: 1, turn: 1, ...over,
})

test('feed: identical consecutive reads collapse into one', () => {
  const f = pushActivity(pushActivity([], a({})), a({ at: a({}).at + 1000 }))
  expect(f.length).toBe(1)
  expect(f[0]?.count).toBe(2)
})

test('feed: a different turn, agent, verb or detail does not collapse', () => {
  expect(pushActivity([a({})], a({ turn: 2 })).length).toBe(2)
  expect(pushActivity([a({})], a({ agent: 'Explore' })).length).toBe(2)
  expect(pushActivity([a({ verb: 'search', detail: 'x' })], a({ verb: 'search', detail: 'y' })).length).toBe(2)
  expect(pushActivity([a({ verb: 'edit' })], a({ verb: 'edit' })).length).toBe(2)
})

test('feed: the list is capped at MAX_FEED', () => {
  let f: Activity[] = []
  for (let i = 0; i < MAX_FEED + 5; i++) f = pushActivity(f, a({ path: `n${i}.md` }))
  expect(f.length).toBe(MAX_FEED)
  expect(f[0]?.path).toBe('n5.md')
})

test('status line: an edit in the turn wins over reads', () => {
  const f = [a({ verb: 'edit', path: 'x/To Do.md' }), a({ path: 'soul.md' })]
  expect(statusText(f, 1)).toBe('◆ Jarvis · ✎ To Do.md · 14:30')
  expect(statusText(f, 2)).toBe('◆ Jarvis · ◦ soul.md · 14:30')
  expect(statusText([], 1)).toBe(undefined)
})

test('status line: shell shows the command, a search on the root shows the pattern', () => {
  expect(statusText([a({ verb: 'shell', path: '.', detail: 'git status' })], 1)).toBe('◆ Jarvis · $ git status · 14:30')
  const long = 'x'.repeat(40)
  expect(statusText([a({ verb: 'shell', path: '.', detail: long })], 1)).toBe(`◆ Jarvis · $ ${'x'.repeat(29)}… · 14:30`)
  expect(statusText([a({ verb: 'search', path: '.', detail: 'NOVA' })], 1)).toBe('◆ Jarvis · ⌕ "NOVA" · 14:30')
  expect(statusText([a({ verb: 'search', path: '03 - Projects', detail: 'NOVA' })], 1)).toBe('◆ Jarvis · ⌕ 03 - Projects · 14:30')
})

test('format: basename, dirname, daysBetween and isoDay', () => {
  expect(basename('a/b/c.md')).toBe('c.md')
  expect(dirname('a/b/c.md')).toBe('a/b')
  expect(dirname('c.md')).toBe('')
  expect(daysBetween(new Date(2026, 9, 7, 23).getTime(), new Date(2026, 9, 9, 1).getTime())).toBe(2)
  expect(isoDay(new Date(2026, 9, 9, 1).getTime())).toBe('2026-10-09')
})

test('feed: written files keep the latest time for each path, a move renames, a delete removes, reads are ignored', () => {
  const w1 = addWritten({}, [a({ verb: 'edit', path: 'x.md', at: 1 }), a({ verb: 'read', path: 'r.md', at: 2 }), a({ verb: 'create', path: 'Inbox/a.md', at: 3 })])
  expect(w1).toEqual({ 'x.md': 1, 'Inbox/a.md': 3 })
  const w2 = addWritten(w1, [a({ verb: 'move', path: 'Archivio/a.md', detail: '/v/Inbox/a.md', from: 'Inbox/a.md', at: 4 }), a({ verb: 'delete', path: 'x.md', at: 5 }), a({ verb: 'edit', path: 'y.md', at: 6 })])
  expect(w2).toEqual({ 'Archivio/a.md': 4, 'y.md': 6 })
})

// Sources are counted under the label the activity carries, which is in the catalog's language: the protected
// ones (identity, memory, future work, daily history, the profile, the core) are flagged from the same catalog.
test('addTouched in Italian: the sources written in the session, protected ones flagged, reads left out', () => {
  const it = strings('it')
  const acts = [
    a({ verb: 'edit', path: 'To Do.md', role: 'futuro op.' }),
    a({ verb: 'edit', path: '99 - Jarvis/memory/soul.md', role: 'identità' }),
    a({ verb: 'create', path: '00 - Inbox/n.md', role: 'inbox' }),
    a({ verb: 'edit', path: 'CLAUDE.md', role: 'profilo' }),
    a({ verb: 'edit', path: '99 - Jarvis/system/core-instructions.md', role: 'core' }),
    a({ verb: 'read', path: 'To Do.md', role: 'futuro op.' }),
  ]
  expect(addTouched([], acts, it)).toEqual([
    { role: 'futuro op.', count: 1, isProtected: true },
    { role: 'identità', count: 1, isProtected: true },
    { role: 'inbox', count: 1, isProtected: false },
    { role: 'profilo', count: 1, isProtected: true },
    { role: 'core', count: 1, isProtected: true },
  ])
})

test('addTouched in English: English role names are counted, and the protected ones flagged from the English catalog', () => {
  const en = strings('en')
  const acts = [
    a({ verb: 'edit', path: 'To Do.md', role: 'to do' }),
    a({ verb: 'edit', path: '99 - Jarvis/memory/soul.md', role: 'identity' }),
    a({ verb: 'edit', path: '99 - Jarvis/memory/MEMORY.md', role: 'memory' }),
    a({ verb: 'edit', path: '01 - Diary/2026-10-09.md', role: 'diary' }),
    a({ verb: 'create', path: '99 - Jarvis/handoffs/h.md', role: 'handoff' }),
    a({ verb: 'create', path: '00 - Inbox/n.md', role: 'inbox' }),
    a({ verb: 'edit', path: 'CLAUDE.md', role: 'profile' }),
    a({ verb: 'edit', path: '99 - Jarvis/system/core-instructions.md', role: 'core' }),
    a({ verb: 'read', path: 'To Do.md', role: 'to do' }),
  ]
  expect(addTouched([], acts, en)).toEqual([
    { role: 'to do', count: 1, isProtected: true },
    { role: 'identity', count: 1, isProtected: true },
    { role: 'memory', count: 1, isProtected: true },
    { role: 'diary', count: 1, isProtected: true },
    { role: 'handoff', count: 1, isProtected: false },
    { role: 'inbox', count: 1, isProtected: false },
    { role: 'profile', count: 1, isProtected: true },
    { role: 'core', count: 1, isProtected: true },
  ])
  // A second write counts on the same row, and a move counts for its source too.
  const again = addTouched(addTouched([], acts, en), [
    a({ verb: 'edit', path: 'To Do.md', role: 'to do' }),
    a({ verb: 'move', path: 'Archivio/n.md', role: undefined, fromRole: 'inbox' }),
  ], en)
  expect(again.find(t => t.role === 'to do')).toEqual({ role: 'to do', count: 2, isProtected: true })
  expect(again.find(t => t.role === 'inbox')).toEqual({ role: 'inbox', count: 2, isProtected: false })
  // The Italian name is not a protected label of the English catalog.
  expect(addTouched([], [a({ verb: 'edit', role: 'futuro op.' })], en)).toEqual([{ role: 'futuro op.', count: 1, isProtected: false }])
  expect(addTouched([], [a({ verb: 'edit', role: 'profilo' })], en)).toEqual([{ role: 'profilo', count: 1, isProtected: false }])
})
