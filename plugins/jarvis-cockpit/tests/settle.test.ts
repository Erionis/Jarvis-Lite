import { test, expect } from 'claude-code/testing'
import { SETTLE_MAX_MS, SETTLE_MS } from '../hooks/flight'
import { cellOf, same, shaped } from '../hooks/ports'
import { dirsToReload, resetSettle, settleWrites, type SettleDeps, type Wrote } from '../hooks/settle'
import { flush, memClock } from './ports'

// The work after the writes, with fake ports: every call ends up in `calls`.
function settleWorld(over: { loaded?: string[]; todo?: string | null; mem?: string | null; diary?: string | null } = {}) {
  const clock = memClock()
  const calls: string[] = []
  const log = (what: string) => async (): Promise<void> => { calls.push(what) }
  const deps: SettleDeps = {
    clock,
    loaded: async () => over.loaded ?? [''],
    loadDir: async rel => { calls.push(`dir:${rel}`) },
    refreshGit: async opts => { calls.push(opts.ignored === true ? 'git+ignored' : 'git') },
    measureDirs: log('du'),
    snapshot: log('snapshot'),
    todoPath: async () => over.todo ?? null,
    checkTodo: log('todo'),
    memDir: async () => over.mem ?? null,
    loadMemories: log('memories'),
    diaryRoot: async () => over.diary ?? null,
    loadDiary: log('diary'),
    loadFigure: log('figure'),
  }
  // Goes past the settling time and lets the work finish.
  const settled = async (): Promise<void> => {
    clock.advance(SETTLE_MS)
    await flush()
  }
  return { clock, calls, deps, settled }
}

const edit = (path: string): Wrote => ({ verb: 'edit', path })

test('settle: five Edits in a row make a single settling, with git and folders once', async () => {
  const w = settleWorld({ loaded: ['', 'A'] })
  for (let i = 0; i < 5; i++) settleWrites(w.deps, [edit(`A/n${i}.md`)])
  await flush()
  expect(w.calls).toEqual([])
  await w.settled()
  expect(w.calls.sort()).toEqual(['dir:A', 'git'])
  await w.settled()
  expect(w.calls.length).toBe(2)
})

test('settle: snapshot only for a capability file, sizes only for a cockpit write', async () => {
  const w = settleWorld()
  settleWrites(w.deps, [edit('a.md')])
  settleWrites(w.deps, [edit('To Do.md')], { snapshot: true })
  await w.settled()
  expect(w.calls.sort()).toEqual(['dir:', 'git', 'snapshot'])
  w.calls.length = 0
  settleWrites(w.deps, [edit('To Do.md')], { measure: true })
  await w.settled()
  // The sizes after folders and git.
  expect(w.calls.at(-1)).toBe('du')
})

test('settle: tabs reload only for their own files; a .gitignore reloads the ignored ones', async () => {
  const w = settleWorld({ todo: 'To Do.md', mem: 'mem', diary: 'diary' })
  settleWrites(w.deps, [edit('altro.md')])
  await w.settled()
  expect(w.calls.sort()).toEqual(['dir:', 'git'])
  w.calls.length = 0
  settleWrites(w.deps, [edit('To Do.md'), edit('mem/a.md'), edit('diary/2026/10/2026-10-13.md'), edit('.gitignore')])
  await w.settled()
  expect(w.calls.sort()).toEqual(['diary', 'dir:', 'git+ignored', 'memories', 'todo'])
})

test('settle: a write in the mascot folder reads the figure again, a write outside it does not', async () => {
  const w = settleWorld()
  settleWrites(w.deps, [edit('Notes/a.md'), edit('99 - Jarvis/mascot-off/idle.svg')])
  await w.settled()
  expect(w.calls.sort()).toEqual(['dir:', 'git'])
  w.calls.length = 0
  settleWrites(w.deps, [edit('99 - Jarvis/mascot/idle.svg')])
  await w.settled()
  expect(w.calls.sort()).toEqual(['dir:', 'figure', 'git'])
  w.calls.length = 0
  // The folder itself (renamed away, or deleted) counts too.
  settleWrites(w.deps, [{ verb: 'move', path: '99 - Jarvis/mascot-off', from: '99 - Jarvis/mascot' }])
  await w.settled()
  expect(w.calls.sort()).toEqual(['dir:', 'figure', 'git'])
})

test('settle: a diaryRoot that throws (sources just reset) does not stop the tree and git', async () => {
  const w = settleWorld({ loaded: ['', 'A'] })
  const deps: SettleDeps = { ...w.deps, diaryRoot: async () => { throw new Error('CLAUDE.md non si legge') } }
  settleWrites(deps, [edit('A/x.md')])
  await w.settled()
  expect(w.calls.sort()).toEqual(['dir:A', 'git'])
})

test('resetSettle: pending writes are discarded and the open wait does not fire; the next series starts clean', async () => {
  const w = settleWorld({ loaded: ['', 'A'] })
  settleWrites(w.deps, [edit('A/a.md')])
  resetSettle()
  await w.settled()
  expect(w.calls).toEqual([])
  // The timers of the discarded series are still queued: not even its deadline starts anything.
  w.clock.advance(SETTLE_MAX_MS)
  await flush()
  expect(w.calls).toEqual([])
  // The next series does not carry the discarded write: folder A is not reloaded.
  settleWrites(w.deps, [edit('b.md')])
  await w.settled()
  expect(w.calls.sort()).toEqual(['dir:', 'git'])
})

test('dirsToReload: the deepest loaded folder; a move also reloads the parent of the source', () => {
  const loaded = ['', 'A', 'A/B']
  expect(dirsToReload(loaded, [edit('A/B/C/x.md'), edit('z.md')]).sort()).toEqual(['', 'A/B'])
  expect(dirsToReload(loaded, [{ verb: 'delete', path: 'A/B' }])).toEqual(['A'])
  expect(dirsToReload(loaded, [{ verb: 'move', path: 'A/B', from: 'x.md' }]).sort()).toEqual(['', 'A/B'])
})

test('same: comparison by content, at every level', () => {
  expect(same({ a: [1, { b: 2 }], c: null }, { c: null, a: [1, { b: 2 }] })).toBe(true)
  expect(same({ a: [1, { b: 2 }] }, { a: [1, { b: 3 }] })).toBe(false)
  expect(same({ a: undefined }, {})).toBe(false)
  expect(same([1, 2], { 0: 1, 1: 2 })).toBe(false)
  expect(same(NaN, NaN)).toBe(true)
})

test('cellOf: a set with the same value does not write, a different one reapplies the function to the real value', async () => {
  // A plain store, without the comparison of memCell: if cellOf did not compare, every set would write.
  let v = { n: 1, list: ['a'] }
  let writes = 0
  const cell = cellOf(async () => v, async fn => { writes++; v = fn(v); return v })
  await cell.set(cur => ({ ...cur, list: [...cur.list] }))
  expect(writes).toBe(0)
  await cell.set(cur => ({ ...cur, n: cur.n + 1 }))
  expect(v).toEqual({ n: 2, list: ['a'] })
  expect(writes).toBe(1)
})

test('shaped: missing fields get the empty value; null and undefined give the empty value', () => {
  const EMPTY = { a: 1, b: [] as string[], c: null as string | null }
  expect(shaped(EMPTY, { a: 2 } as typeof EMPTY)).toEqual({ a: 2, b: [], c: null })
  expect(shaped(EMPTY, null)).toBe(EMPTY)
  expect(shaped(EMPTY, undefined)).toBe(EMPTY)
})
