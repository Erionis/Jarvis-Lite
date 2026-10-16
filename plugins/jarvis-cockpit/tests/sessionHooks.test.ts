import { test, expect } from 'claude-code/testing'
import type { SessionRecord, Snapshot, TurnEnd } from '../types'
import { COMMAND } from '../hooks/state'
import { AT, ROOT, fakeStore, fakeVault, liveState } from './harness'
import { handoffName } from './ports'

// The session records in the hooks: the record is born at the first prompt, follows writes, subagents
// and turn ends, closes at session.end and goes to the store only when it changes; session.start cleans the store and the
// snapshot carries the latest past sessions.

const CLAUDE_MD = "## Capacita' Jarvis\n\n| Capacita' | Fonte autorevole |\n|---|---|\n| Futuro operativo | `Da fare.md` |\n| Diario | `01 - Diary` |\n| Handoff | `99 - Jarvis/handoffs` |\n"
const SNAP: Snapshot = { takenAt: AT, hasTable: true, missing: [], now: [], nowDue: [], waiting: 0, waitingItems: [], handoffs: [], inbox: null, diary: null }
const HO = `99 - Jarvis/handoffs/${handoffName('2026-10-09', 'nova-kb')}`
// A session started ten minutes ago, with one prompt.
const REC: SessionRecord = {
  v: 1, id: 's1', startAt: AT - 600_000, lastAt: AT - 600_000, endAt: null, prompts: 1, firstPrompt: 'sistema il cockpit', resumeOf: null,
  files: [], fileCount: 0, handoff: null, diaryDay: null, diaryAt: null, subagents: 0, errors: 0,
}
const END = (reason = 'answer') => ({ answer: '', durationMs: 1, isAborted: reason === 'aborted', turnId: 't1', reason }) as never

// The engine under prompts, turns and calls; `id` null: `$.session.id()` does not answer.
function engine(on: Parameters<typeof liveState>[0], id: string | null = 's1') {
  if (id !== null) on('session.id', () => ({ value: id }) as never)
  on('prompt.submit', (_$, e) => ({ text: e.text }) as never)
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  on('tool.call', () => ({ result: 'ok' }) as never)
}

test('hook: the first prompt creates the record and its turn entry, stores it and returns the Recap to the session; the second only counts, no rewrite', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP, recapView: 'open' })
  const store = fakeStore(on)
  engine(on)
  await $.prompt.submit({ text: 'sistema il cockpit\n\n  e poi   scrivi la nota' } as never)
  const first: SessionRecord = {
    v: 1, id: 's1', startAt: AT, lastAt: AT, endAt: null, prompts: 1, firstPrompt: 'sistema il cockpit e poi scrivi la nota', resumeOf: null,
    files: [], fileCount: 0, handoff: null, diaryDay: null, diaryAt: null, subagents: 0, errors: 0,
  }
  expect(state.values.session).toEqual(first)
  expect(store.data['session:s1']).toEqual(first)
  // The turn of the prompt: liveState starts at turn 1, the prompt opens turn 2.
  expect(state.values.prompts).toEqual([{ turn: 2, at: AT, text: 'sistema il cockpit e poi scrivi la nota' }])
  expect(state.values.recapView).toBe('auto')
  await state.clock.advance(60_000)
  await $.prompt.submit({ text: 'ok' } as never)
  expect((state.values.session as SessionRecord).prompts).toBe(2)
  expect(state.values.prompts).toEqual([{ turn: 2, at: AT, text: 'sistema il cockpit e poi scrivi la nota' }, { turn: 3, at: AT + 60_000, text: 'ok' }])
  // The store is written when the record is born and then at turn end, not on every prompt; recapView already 'auto' is not rewritten.
  expect(store.sets).toEqual(['session:s1'])
  expect(state.sets.recapView).toBe(1)
})

test('hook: the first prompt that resumes a handoff from the cockpit keeps its file name as resumeOf', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP })
  fakeStore(on)
  engine(on)
  const name = handoffName('2026-10-09', 'nova-kb', { md: false })
  await $.prompt.submit({ text: `/handoff resume ${name}` } as never)
  expect((state.values.session as SessionRecord).resumeOf).toBe(name)
})

test('hook: a session resumed in a new process restarts from its record in the store, reopened; the first prompt counts it without rewriting it', async ($, on) => {
  const old: SessionRecord = {
    ...REC, prompts: 3, lastAt: AT - 300_000, endAt: AT - 300_000, files: ['01 - Diary/2026/10/2026-10-09.md'], fileCount: 1,
    diaryDay: '2026-10-09', diaryAt: AT - 400_000, subagents: 1,
  }
  const state = liveState(on, { snapshot: SNAP })
  const store = fakeStore(on, { 'session:s1': old })
  engine(on)
  await $.prompt.submit({ text: 'riprendiamo' } as never)
  expect(state.values.session).toEqual({ ...old, prompts: 4, endAt: null })
  expect(store.sets).toEqual([])
})

test('hook: without the session id the record stays in the state and does not go to the store', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP })
  const store = fakeStore(on)
  engine(on, null)
  await $.prompt.submit({ text: 'ciao' } as never)
  expect((state.values.session as SessionRecord).id).toBe('')
  await $.turn.complete(END())
  expect(store.sets).toEqual([])
})

test('hook: a write to the Handoff folder or to today\'s diary note is added to the record; a read is not', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP, session: REC })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, [HO]: '# h\n', '01 - Diary/2026/10/2026-10-09.md': '# d\n' })
  engine(on)
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/${HO}`, old_string: 'h', new_string: 'x' } as never)
  await state.clock.advance(60_000)
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/01 - Diary/2026/10/2026-10-09.md`, old_string: 'd', new_string: 'x' } as never)
  // The handoff's topic and status are read at turn end.
  expect(state.values.session).toEqual({ ...REC, handoff: { file: HO, topic: '', status: '' }, diaryDay: '2026-10-09', diaryAt: AT + 60_000 })
  const writes = state.sets.session
  await $.tool.call({ tool: 'Read', file_path: `${ROOT}/${HO}` } as never)
  // The same note again, at the same time: nothing to mark, the record is not rewritten.
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/01 - Diary/2026/10/2026-10-09.md`, old_string: 'x', new_string: 'y' } as never)
  expect(state.sets.session).toBe(writes)
})

test('hook: a subagent that started counts in the session record, a denied one does not', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP, session: REC })
  engine(on)
  let n = 0
  on('agent.spawn', () => (++n === 1 ? { model: 'haiku', agentId: 'a1' } : { deny: 'no' }) as never)
  await $.agent.spawn({ tool_use_id: 'tu1', prompt: 'x', description: 'cerca', subagentType: 'Explore' } as never)
  await $.agent.spawn({ tool_use_id: 'tu2', prompt: 'x', description: 'cerca', subagentType: 'Explore' } as never).catch(() => {})
  expect((state.values.session as SessionRecord).subagents).toBe(1)
})

test('hook: at turn end the record takes the time, the written files, and the handoff topic and status, and goes to the store only if it changed', async ($, on) => {
  const state = liveState(on, {
    snapshot: SNAP, session: { ...REC, handoff: { file: HO, topic: '', status: '' } }, working: true, turnAt: AT - 190_000,
    written: { 'a.md': AT - 2000, 'b.md': AT - 1000 },
  })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, [HO]: '---\ntype: handoff\nstatus: active\ntopic: NOVA KB workflow\n---\n# H\n' })
  const store = fakeStore(on)
  engine(on)
  await $.turn.complete(END())
  const saved = { ...REC, lastAt: AT, files: ['b.md', 'a.md'], fileCount: 2, handoff: { file: HO, topic: 'NOVA KB workflow', status: 'active' } }
  expect(state.values.session).toEqual(saved)
  expect(store.data['session:s1']).toEqual(saved)
  expect((state.values.ends as TurnEnd[]).at(-1)).toEqual({ at: AT, reason: 'answer', files: 0, turn: 1, ms: 190_000 })
  // The same turn end at the same time: the record is equal, the store is not rewritten.
  await $.turn.complete(END())
  expect(store.sets).toEqual(['session:s1'])
  // A turn that ended with an error counts; one stopped by the user does not.
  await $.turn.complete(END('error'))
  await $.turn.complete(END('aborted'))
  expect((store.data['session:s1'] as SessionRecord).errors).toBe(1)
})

test('hook: a subagent\'s turn end does not touch the record', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP, session: REC, agentRuns: { a1: { type: 'Explore', at: AT - 1000, endAt: null } } })
  const store = fakeStore(on)
  engine(on)
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't2', reason: 'answer', agentId: 'a1' } as never)
  expect(state.values.session).toEqual(REC)
  expect(store.sets).toEqual([])
})

test('hook: session.end writes the closing time in the record; without an id taken at the prompt it uses the ending session\'s; without a record, nothing', async ($, on) => {
  const state = liveState(on, { session: REC })
  const store = fakeStore(on)
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }) as never)
  await $.session.end({ reason: 'prompt_input_exit', sessionId: 's1', resume: { id: 's1' } } as never)
  expect(store.data['session:s1']).toEqual({ ...REC, endAt: AT })
  expect(state.values.session).toEqual({ ...REC, endAt: AT })
})

test('hook: session.end writes a record with no id under the id of the ending session', async ($, on) => {
  liveState(on, { session: { ...REC, id: '' } })
  const store = fakeStore(on)
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }) as never)
  await $.session.end({ reason: 'clear', sessionId: 's9', resume: { id: 's9' } } as never)
  expect(store.data['session:s9']).toEqual({ ...REC, id: 's9', endAt: AT })
})

test('hook: session.end with no record does not write the store', async ($, on) => {
  liveState(on, {})
  const store = fakeStore(on)
  on('session.end', (_$, e) => ({ sessionId: e.sessionId }) as never)
  await $.session.end({ reason: 'other', sessionId: 's1', resume: { id: 's1' } } as never)
  expect(store.sets).toEqual([])
})

test('hook: session.start keeps the 30 latest sessions in the store, leaves other keys alone; the snapshot gets the last two past sessions and their note', async ($, on) => {
  const old = (i: number): SessionRecord => ({ ...REC, id: `k${i}`, startAt: AT - (40 - i) * 3_600_000, lastAt: AT - (40 - i) * 3_600_000 + 60_000 })
  const init: Record<string, unknown> = { tab: 'files', expanded: ['A'] }
  for (let i = 0; i < 31; i++) init[`session:k${i}`] = old(i)
  init['session:k30'] = { ...old(30), diaryDay: '2026-10-08', diaryAt: AT - 9 * 3_600_000 }
  // The current session, resumed: it is not a past session.
  init['session:s1'] = { ...REC, lastAt: AT - 1000 }
  const state = liveState(on, {})
  const store = fakeStore(on, init)
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': '## Now\n', '01 - Diary/2026/10/2026-10-08.md': '## Focus\n- NOVA KB\n\n## Stato di chiusura\n- PRD chiuso\n' })
  engine(on)
  on('session.start', () => ({ cwd: ROOT }) as never)
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  await $.session.start({ cwd: ROOT } as never)
  await store.until(() => store.deletes.length === 2)
  expect(store.deletes).toEqual(['session:k1', 'session:k0'])
  expect(store.data.tab).toBe('files')
  expect(store.data.expanded).toEqual(['A'])
  await state.until('snapshot', s => s != null)
  const snap = state.values.snapshot as Snapshot
  expect(snap.sessions?.map(r => r.id)).toEqual(['k30', 'k29'])
  expect(snap.diaryDays?.map(d => d.day)).toEqual(['2026-10-08'])
})

test('hook: a store read that is rejected does not leave an empty record list in the cache: the next refresh tries again', async ($, on) => {
  const past: SessionRecord = { ...REC, id: 'k1', startAt: AT - 7_200_000, lastAt: AT - 3_600_000 }
  const state = liveState(on, {})
  // A hand-made store: the first read of the record is rejected, the others answer (the other keys, like `tab`, are empty).
  let reads = 0
  on('store.keys', () => ({ value: ['session:k1'] }) as never)
  on('store.get', (_$, e) => {
    if (e.key !== 'session:k1') return { value: undefined } as never
    if (++reads === 1) throw new Error('store')
    return { value: past } as never
  })
  on('store.delete', () => ({ value: undefined }) as never)
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': '## Now\n' })
  engine(on)
  on('session.start', () => ({ cwd: ROOT }) as never)
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  await $.session.start({ cwd: ROOT } as never)
  await state.until('snapshot', s => s != null)
  expect((state.values.snapshot as Snapshot).sessions).toEqual([])
  await $.command.run({ command: COMMAND } as never)
  expect((state.values.snapshot as Snapshot).sessions?.map(r => r.id)).toEqual(['k1'])
})

test('hook: a store that rejects does not break prompt and turn: the record stays in the state and is retried at the next turn end', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP, working: true })
  const store = fakeStore(on, {}, { failSet: true })
  on('session.id', () => ({ value: 's1' }) as never)
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  let reached = 0
  on('prompt.submit', (_$, e) => { reached++; return { text: e.text } as never })
  await $.prompt.submit({ text: 'ciao' } as never)
  expect(reached).toBe(1)
  expect((state.values.session as SessionRecord).id).toBe('s1')
  await $.turn.complete(END())
  expect(state.values.working).toBe(false)
  expect(state.values.ends as TurnEnd[]).toHaveLength(1)
  await $.turn.complete(END())
  expect(store.sets).toEqual(['session:s1', 'session:s1', 'session:s1'])
})

test('hook: a session resumed in a new process keeps its files at the first turn end', async ($, on) => {
  const old: SessionRecord = { ...REC, prompts: 3, lastAt: AT - 300_000, endAt: AT - 300_000, files: ['a.md', 'b.md'], fileCount: 2 }
  const state = liveState(on, { snapshot: SNAP, working: true })
  const store = fakeStore(on, { 'session:s1': old })
  engine(on)
  await $.prompt.submit({ text: 'riprendiamo' } as never)
  await $.turn.complete(END())
  expect((state.values.session as SessionRecord).fileCount).toBe(2)
  expect((store.data['session:s1'] as SessionRecord).files).toEqual(['a.md', 'b.md'])
})

test('hook: /resume in the same process to a session in the store reopens and counts it, without rewriting it at the prompt', async ($, on) => {
  const other: SessionRecord = { ...REC, id: 'B', prompts: 5, startAt: AT - 86_400_000, lastAt: AT - 80_000_000, endAt: AT - 80_000_000, files: ['x.md'], fileCount: 1 }
  const state = liveState(on, { snapshot: SNAP, session: { ...REC, id: 'A', endAt: AT - 1000 } })
  const store = fakeStore(on, { 'session:B': other })
  engine(on, 'B')
  await $.prompt.submit({ text: 'eccomi' } as never)
  expect((state.values.session as SessionRecord).prompts).toBe(6)
  expect((store.data['session:B'] as SessionRecord).prompts).toBe(5)
  expect((store.data['session:B'] as SessionRecord).startAt).toBe(other.startAt)
})

test('hook: after /clear the new record does not take the files written by the closed session', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP, session: { ...REC, id: 'A', endAt: AT - 1000 }, written: { 'old.md': AT - 500_000 }, working: true })
  fakeStore(on)
  engine(on, 'B')
  await $.prompt.submit({ text: 'nuovo lavoro' } as never)
  await $.turn.complete(END())
  expect((state.values.session as SessionRecord).id).toBe('B')
  expect((state.values.session as SessionRecord).fileCount).toBe(0)
})

test('hook: a $.session.id() that does not answer in an open session does not reset the record', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP, session: { ...REC, prompts: 4 } })
  fakeStore(on)
  engine(on, null)
  await $.prompt.submit({ text: 'ancora' } as never)
  expect((state.values.session as SessionRecord).id).toBe('s1')
  expect((state.values.session as SessionRecord).prompts).toBe(5)
})
