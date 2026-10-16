import { test, expect } from 'claude-code/testing'
import { ACTIVITY_ROWS, activityLog, activityRows, ageText, doing, writtenFiles, bindRun, dropRun, dueLabel, endRun, endText, turnFiles, liveRuns, nowRows, pruneRuns, reconcileRuns, recapMoment, resume, resumeCommand, sortWritten, startRun, waitingRows } from '../hooks/recapModel'
import { addWritten } from '../hooks/feed'
import { longDay } from '../hooks/format'
import { strings } from '../hooks/i18n'
import type { Activity, AgentRun, Snapshot } from '../types'
import { AT } from './harness'
import { handoffName } from './ports'

const T = strings('it')

const SNAP: Snapshot = {
  takenAt: AT, hasTable: true, missing: [], now: null, nowDue: [], waiting: 0, waitingItems: [],
  handoffs: [], inbox: null, diary: null,
}
const MIN = 60_000
const act = (at: number, verb: Activity['verb'], path: string): Activity =>
  ({ at, verb, path, isProtected: false, isApprox: false, count: 1, turn: 1 })

test('dueLabel: yesterday, N days ago and today in red; the weekday within six days, the date beyond; empty with no date', () => {
  // AT is Friday 9 October 2026.
  expect(dueLabel(null, AT, T)).toEqual({ text: '', color: 'inactive' })
  expect(dueLabel('2026-10-08', AT, T)).toEqual({ text: 'ieri', color: 'error' })
  expect(dueLabel('2026-10-05', AT, T)).toEqual({ text: '4g fa', color: 'error' })
  expect(dueLabel('2026-10-09', AT, T)).toEqual({ text: 'oggi', color: 'error' })
  expect(dueLabel('2026-10-10', AT, T)).toEqual({ text: 'sab', color: 'inactive' })
  expect(dueLabel('2026-10-15', AT, T).text).toBe('gio')
  expect(dueLabel('2026-10-16', AT, T).text).toBe('16 ott')
})

test('nowRows: dated items first by date, then the others in order; short title; at most 8', () => {
  const s: Snapshot = {
    ...SNAP,
    now: ['- **A lungo — con trattino** — dettaglio', '- B — dopo', '- C', '- D', '- E', '- F', '- G', '- H', '- I', '- J'],
    nowTitles: ['A lungo — con trattino', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
    nowDue: [null, '2026-10-20', null, '2026-10-09', null, '2026-10-09', null, null, null, null],
  }
  const { rows, more } = nowRows(s, AT, T)
  expect(rows.map(r => r.title)).toEqual(['D', 'F', 'B', 'A lungo — con trattino', 'C', 'E', 'G', 'H'])
  expect(rows.map(r => r.index)).toEqual([3, 5, 1, 0, 2, 4, 6, 7])
  expect(rows[0]?.due).toEqual({ text: 'oggi', color: 'error' })
  expect(rows[2]?.due.text).toBe('20 ott')
  expect(rows[3]?.due.text).toBe('')
  expect(more).toBe(2)
})

test('nowRows: a snapshot without short titles (older versions) derives them from the line; Now section missing or empty', () => {
  const s: Snapshot = { ...SNAP, now: ['NOVA 4.0 — chiudere PRD', 'Helios `GPU-01`'], nowDue: [null, null] }
  expect(nowRows(s, AT, T).rows.map(r => r.title)).toEqual(['NOVA 4.0', 'Helios GPU-01'])
  expect(nowRows({ ...SNAP, now: null }, AT, T)).toEqual({ rows: [], more: 0 })
  expect(nowRows({ ...SNAP, now: [] }, AT, T)).toEqual({ rows: [], more: 0 })
})

test('nowRows: the whole title, never cut (it wraps in the Recap)', () => {
  const long = 'NOVA Chat — file, immagini e artifact come oggetti, con il conteggio delle immagini e la decisione sul formato da prendere'
  const s: Snapshot = { ...SNAP, now: ['- a', '- b'], nowTitles: [long, 'B'], nowDue: [null, '2026-10-09'] }
  // The item with a due date goes to the top.
  expect(nowRows(s, AT, T).rows.map(r => r.title)).toEqual(['B', long])
})

test('longDay: in Italian, the weekday and the date with a capital initial', () => {
  // AT is Friday 9 October 2026.
  expect(longDay(AT, T.dates)).toBe('Venerdì 9 ottobre')
  expect(longDay(new Date(2026, 9, 11, 8).getTime(), T.dates)).toBe('Domenica 11 ottobre')
  expect(longDay(new Date(2026, 11, 1, 8).getTime(), T.dates)).toBe('Martedì 1 dicembre')
})

test('ageText: today, yesterday, then N days («2g»)', () => {
  expect(ageText(0, T)).toBe('oggi')
  expect(ageText(1, T)).toBe('ieri')
  expect(ageText(2, T)).toBe('2g')
  expect(ageText(21, T)).toBe('21g')
})

test('waitingRows: at most 5 rows, the oldest on top, stale beyond 10 days, an unknown age left blank', () => {
  const items = [{ title: 'A', ageDays: 21 }, { title: 'B', ageDays: 10 }, { title: 'C', ageDays: 11 }, { title: 'D', ageDays: 1 }, { title: 'E', ageDays: 0 }, { title: 'F', ageDays: null }, { title: 'G', ageDays: null }]
  const { rows, more } = waitingRows({ ...SNAP, waiting: 7, waitingItems: items }, T)
  expect(rows).toEqual([
    { key: 'A', title: 'A', age: '21g', isStale: true },
    { key: 'B', title: 'B', age: '10g', isStale: false },
    { key: 'C', title: 'C', age: '11g', isStale: true },
    { key: 'D', title: 'D', age: 'ieri', isStale: false },
    { key: 'E', title: 'E', age: 'oggi', isStale: false },
  ])
  expect(more).toBe(2)
  const unknown = waitingRows({ ...SNAP, waiting: 1, waitingItems: [{ title: 'F', ageDays: null }] }, T)
  expect(unknown).toEqual({ rows: [{ key: 'F', title: 'F', age: '', isStale: false }], more: 0 })
  expect(waitingRows(SNAP, T)).toEqual({ rows: [], more: 0 })
})

test('resume: the command without .md, the main handoff, at most 3 others and the rest counted', () => {
  expect(resumeCommand(handoffName('2026-10-09', 'nova-chat'))).toBe(`/handoff resume ${handoffName('2026-10-09', 'nova-chat', { md: false })}`)
  expect(resumeCommand('senza-estensione')).toBe('/handoff resume senza-estensione')
  const hs = ['a', 'b', 'c', 'd', 'e', 'f'].map((t, i) => ({ file: `${t}.md`, topic: t, ageDays: i }))
  const r = resume({ ...SNAP, handoffs: hs })
  expect(r.main?.topic).toBe('a')
  expect(r.others.map(x => x.topic)).toEqual(['b', 'c', 'd'])
  expect(r.more).toBe(2)
  expect(resume(SNAP)).toEqual({ main: null, others: [], more: 0 })
})

test('recapMoment: the opening until a prompt starts, then the session; Show overview keeps the opening even with prompts', () => {
  expect(recapMoment(0, 'auto')).toBe('open')
  expect(recapMoment(1, 'auto')).toBe('work')
  expect(recapMoment(3, 'open')).toBe('open')
  expect(recapMoment(0, 'open')).toBe('open')
})

test('activityLog: reads, searches, writes, commands, subagents and turn ends in time order, the last 60', () => {
  const feed = [
    act(AT - 30 * MIN, 'edit', 'To Do.md'),
    { ...act(AT - 27 * MIN, 'read', 'NOVA.md'), count: 3 },
    { ...act(AT - 26 * MIN, 'search', '.'), detail: 'PromptHint' },
    act(AT - 25 * MIN, 'shell', '.'),
    { ...act(AT - 25 * MIN, 'shell', '.'), detail: 'git commit -m "x"' },
    { ...act(AT - 24 * MIN, 'create', '03 - Projects/NOVA/Release 4.0/Una nota con un nome davvero molto lungo.md'), agent: 'Explore' },
    act(AT - 23 * MIN, 'delete', 'x.md'),
  ]
  const runs: Record<string, AgentRun> = {
    a1: { type: 'Explore', at: AT - 28 * MIN, endAt: AT - 26 * MIN },
    a2: { type: 'general-purpose', at: AT - 2 * MIN, endAt: null },
    a3: { type: '', at: AT, endAt: AT },
  }
  const ends = [{ at: AT - 23 * MIN, reason: 'answer', files: 2 }, { at: AT - MIN, reason: 'aborted', files: 0 }]
  expect(activityLog(feed, runs, ends, T)).toEqual([
    '14:02 ✎ scrive  To Do.md',
    '14:04 ✓ Explore  2m',
    '14:05 ◦ legge   1 file, 1 ricerca · NOVA.md',
    '14:07 $ esegue  vault',
    '14:07 $ esegue  git commit -m "x"',
    '14:08 + crea    Una nota con un nome davvero molto lungo.md  · Explore',
    '14:09 ✕ elimina x.md',
    '14:09 ✓ fatto · 2 file',
    '14:30 ⧗ general-purpose  in corso',
    '14:31 ✗ interrotto',
  ])
  const many = Array.from({ length: 70 }, (_, i) => act(AT + i * MIN, 'edit', `n${i}.md`))
  const log = activityLog(many, {}, [], T)
  expect(ACTIVITY_ROWS).toBe(60)
  expect(log).toHaveLength(60)
  expect(log[59]).toBe('15:41 ✎ scrive  n69.md')
})

test('activityLog: each turn starts with the prompt time, › and its first words between «»; the end gives the duration', () => {
  const prompts = [
    { turn: 1, at: AT, text: 'sistema il cockpit e poi scrivi la nota\tdel diario di oggi' },
    { turn: 2, at: AT + 5 * MIN, text: 'ok' },
  ]
  const feed = [act(AT, 'edit', 'a.md'), { ...act(AT + 6 * MIN, 'edit', 'b.md'), turn: 2 }]
  const ends = [{ at: AT + 3 * MIN, reason: 'answer', files: 1, turn: 1, ms: 190_000 }]
  expect(activityLog(feed, {}, ends, T, prompts)).toEqual([
    '14:32 › «sistema il cockpit e poi scrivi la nota…»',
    '14:32 ✎ scrive  a.md',
    '14:35 ✓ fatto in 3m10 · 1 file',
    '14:37 › «ok»',
    '14:38 ✎ scrive  b.md',
  ])
  expect(activityRows(feed, {}, ends, T, prompts).map(r => r.isHead === true)).toEqual([true, false, false, true, false])
  // Without prompts (the band above the prompt) the log is the same as before.
  expect(activityLog(feed, {}, ends, T)).toHaveLength(3)
})

test('doing: at work since the start of the turn with the last row of the turn; a running subagent takes precedence', () => {
  const feed = [act(AT - MIN, 'read', 'prima.md'), act(AT + MIN, 'edit', 'a.md'), act(AT + 2 * MIN, 'shell', '.')]
  expect(doing(feed, {}, [], true, AT, T)).toEqual({ label: 'al lavoro dalle 14:32', line: '$ esegue vault', color: 'text' })
  expect(doing(feed.slice(0, 1), {}, [], true, AT, T)).toEqual({ label: 'al lavoro dalle 14:32', line: 'sta pensando…', color: 'inactive' })
  const runs: Record<string, AgentRun> = {
    a1: { type: 'Plan', at: AT + MIN, endAt: AT + 2 * MIN },
    a2: { type: 'Explore', at: AT + 15 * MIN, endAt: null },
    a3: { type: 'general-purpose', at: AT + 3 * MIN, endAt: null },
  }
  expect(doing(feed, runs, [], true, AT, T)).toEqual({ label: 'al lavoro dalle 14:32', line: '⧗ Explore in corso · dalle 14:47', color: 'text' })
  expect(doing([], {}, [], true, null, T).label).toBe('al lavoro')
})

test('doing: when idle, the outcome of the last turn and when it ended', () => {
  const end = (reason: string, ms?: number) => ({ at: AT + 3 * MIN, reason, files: 0, ...(ms === undefined ? {} : { ms }) })
  expect(doing([], {}, [end('answer', 190_000)], false, null, T)).toEqual({ label: 'in attesa', line: '✓ ultimo turno finito alle 14:35 in 3m10', color: 'success' })
  expect(doing([], {}, [end('answer')], false, null, T).line).toBe('✓ ultimo turno finito alle 14:35')
  expect(doing([], {}, [end('answer'), end('aborted')], false, null, T)).toEqual({ label: 'in attesa', line: '✗ interrotto alle 14:35', color: 'inactive' })
  expect(doing([], {}, [end('error', 62_000)], false, null, T)).toEqual({ label: 'in attesa', line: '✗ finito con un errore alle 14:35', color: 'error' })
  expect(doing([], {}, [], false, null, T)).toEqual({ label: 'in attesa', line: null, color: 'inactive' })
})

test('activityLog: consecutive reads collapse into one row; reads of Jarvis sources become "review the context"', () => {
  const ctx = (at: number, verb: 'read' | 'search', path: string, role?: string) => ({ ...act(at, verb, path), ...(role === undefined ? {} : { role }) })
  const boot = [
    ctx(AT, 'read', '99 - Jarvis/memory/soul.md'),
    ctx(AT, 'read', '99 - Jarvis/memory/MEMORY.md', 'memoria'),
    ctx(AT, 'read', 'To Do.md', 'futuro op.'),
    { ...ctx(AT, 'search', '99 - Jarvis/handoffs', 'handoff'), count: 2 },
    ctx(AT, 'search', '00 - Inbox', 'inbox'),
  ]
  expect(activityLog(boot, {}, [], T)).toEqual(['14:32 ◦ ripassa il contesto · 3 file, 3 ricerche'])
  // A file outside the sources: "read", with the last file read; a lone read keeps its name.
  const mixed = [...boot, ctx(AT, 'read', '99 - Jarvis/handoffs/h.md', 'handoff'), ctx(AT, 'read', 'NOVA.md'), act(AT + MIN, 'edit', 'x.md'), act(AT + MIN, 'read', 'y.md')]
  expect(activityLog(mixed, {}, [], T)).toEqual(['14:32 ◦ legge   5 file, 3 ricerche · NOVA.md', '14:33 ✎ scrive  x.md', '14:33 ◦ legge   y.md'])
  // Different turns do not merge.
  expect(activityLog([act(AT, 'read', 'a.md'), { ...act(AT, 'read', 'b.md'), turn: 2 }], {}, [], T)).toHaveLength(2)
})

test('endText: how the turn ended, how long it took and how many distinct files it wrote', () => {
  expect(endText('answer', 0, T)).toBe('✓ fatto')
  expect(endText('answer', 1, T)).toBe('✓ fatto · 1 file')
  expect(endText('error', 3, T)).toBe('✗ finito con un errore · 3 file')
  expect(endText('refusal', 0, T)).toBe('✗ finito con un errore')
  expect(endText('answer', 2, T, 190_000)).toBe('✓ fatto in 3m10 · 2 file')
  expect(endText('aborted', 0, T, 45_000)).toBe('✗ interrotto in 45s')
  expect(endText('error', 0, T, 62_000)).toBe('✗ finito con un errore in 1m02')
  const feed = [{ ...act(AT, 'edit', 'a.md'), turn: 2 }, { ...act(AT, 'edit', 'a.md'), turn: 2 }, { ...act(AT, 'create', 'b.md'), turn: 2 }, { ...act(AT, 'read', 'c.md'), turn: 2 }, { ...act(AT, 'edit', 'd.md'), turn: 1 }]
  expect(turnFiles(feed, 2)).toBe(2)
})

test('subagent: provisional start, bound to the id, end before or after the binding, denial', () => {
  let runs = startRun({}, 't:tu1', 'Explore', AT)
  expect(liveRuns(runs)).toBe(1)
  runs = bindRun(runs, 't:tu1', 'a1')
  expect(runs).toEqual({ a1: { type: 'Explore', at: AT, endAt: null } })
  runs = endRun(runs, 'a1', AT + MIN)
  expect(runs.a1?.endAt).toBe(AT + MIN)
  expect(endRun(runs, 'a1', AT + 5 * MIN).a1?.endAt).toBe(AT + MIN)
  expect(liveRuns(runs)).toBe(0)
  // The end arrives before agent.spawn gives the id: bindRun keeps it.
  let early = startRun({}, 't:tu2', 'Plan', AT)
  early = endRun(early, 'a2', AT + MIN)
  expect(liveRuns(early)).toBe(1)
  early = bindRun(early, 't:tu2', 'a2')
  expect(early).toEqual({ a2: { type: 'Plan', at: AT, endAt: AT + MIN } })
  expect(dropRun(startRun({}, 't:tu3', 'Plan', AT), 't:tu3')).toEqual({})
  expect(bindRun({}, 't:nessuno', 'a9')).toEqual({})
})

test('subagent: at turn end, those the engine no longer reports at work are finished', () => {
  const runs: Record<string, AgentRun> = {
    a1: { type: 'Explore', at: AT, endAt: null },
    a2: { type: 'Plan', at: AT, endAt: null },
    't:tu': { type: 'Plan', at: AT, endAt: null },
    a3: { type: 'Plan', at: AT, endAt: AT + 1 },
  }
  expect(reconcileRuns(runs, new Set(['a2']), AT + MIN)).toEqual({
    a1: { type: 'Explore', at: AT, endAt: AT + MIN },
    a2: { type: 'Plan', at: AT, endAt: null },
    't:tu': { type: 'Plan', at: AT, endAt: null },
    a3: { type: 'Plan', at: AT, endAt: AT + 1 },
  })
})

test('activityLog: the file name, not the path; short moves and searches', () => {
  const move: Activity = { ...act(AT, 'move', '04 - Archive/NOVA/nota.md'), from: '03 - Projects/NOVA/nota.md' }
  const rename: Activity = { ...act(AT, 'move', '03 - Projects/NOVA/nuova.md'), from: '03 - Projects/NOVA/vecchia.md' }
  const search: Activity = { ...act(AT + MIN, 'search', '03 - Projects/NOVA/Release 4.0'), detail: 'PromptHint' }
  expect(activityLog([act(AT - MIN, 'edit', '03 - Projects/NOVA/Release 4.0/PRD.md'), move, rename], {}, [], T)).toEqual([
    '14:31 ✎ scrive  PRD.md',
    '14:32 → sposta  nota.md → NOVA/',
    '14:32 → sposta  vecchia.md → nuova.md',
  ])
  expect(activityLog([search], {}, [], T)).toEqual(['14:33 ⌕ cerca   «PromptHint»  Release 4.0'])
})

test('writtenFiles: the most recent first, at most `limit`', () => {
  const w = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`n${i}.md`, i]))
  expect(writtenFiles(w)).toEqual({ files: ['n39.md', 'n38.md', 'n37.md', 'n36.md', 'n35.md'], more: 35 })
  const all = writtenFiles(w, 30)
  expect(all.files).toHaveLength(30)
  expect(all.files[0]).toBe('n39.md')
  expect(all.more).toBe(10)
})

test('row keys: Now and Waiting are keyed by text with a copy number; an item added above does not change the keys', () => {
  const s: Snapshot = { ...SNAP, now: ['- A', '- B', '- A'], nowTitles: ['A', 'B', 'A'], nowDue: [null, null, null] }
  expect(nowRows(s, AT, T).rows.map(r => r.key)).toEqual(['A', 'B', 'A\\n2'])
  const above: Snapshot = { ...SNAP, now: ['- C', '- A', '- B', '- A'], nowTitles: ['C', 'A', 'B', 'A'], nowDue: [null, null, null, null] }
  expect(nowRows(above, AT, T).rows.map(r => r.key)).toEqual(['C', 'A', 'B', 'A\\n2'])
  const w = waitingRows({ ...SNAP, waiting: 2, waitingItems: [{ title: 'X', ageDays: 20 }, { title: 'X', ageDays: 12 }] }, T)
  expect(w.rows.map(r => r.key)).toEqual(['X', 'X\\n2'])
})

test('row keys: the keys of Now and Waiting have no control characters and stay distinct', () => {
  const titles = ['NOVA\x1b[31m', 'NOVA\x1b[31m', 'NOVA\x07[31m', 'NOVA\\u001b[31m']
  const s: Snapshot = { ...SNAP, now: titles.map(t => `- ${t}`), nowTitles: titles, nowDue: [null, null, null, null] }
  expect(nowRows(s, AT, T).rows.map(r => r.key)).toEqual(['NOVA\\u001b[31m', 'NOVA\\u001b[31m\\n2', 'NOVA\\u0007[31m', 'NOVA\\\\u001b[31m'])
  const w = waitingRows({ ...SNAP, waiting: 3, waitingItems: titles.slice(0, 3).map(title => ({ title, ageDays: 3 })) }, T)
  expect(w.rows.map(r => r.key)).toEqual(['NOVA\\u001b[31m', 'NOVA\\u001b[31m\\n2', 'NOVA\\u0007[31m'])
})

test('writtenFiles: during the turn in key order with a new file at the end; outside the turn, newest first', () => {
  const w = { 'b.md': 1, 'a.md': 3, 'c.md': 2 }
  expect(writtenFiles(w, 5, true).files).toEqual(['b.md', 'a.md', 'c.md'])
  expect(writtenFiles(w, 5).files).toEqual(['a.md', 'c.md', 'b.md'])
  expect(Object.keys(sortWritten(w))).toEqual(['a.md', 'c.md', 'b.md'])
  const next = addWritten(sortWritten(w), [act(4, 'edit', 'b.md'), act(5, 'create', 'd.md')])
  expect(writtenFiles(next, 5, true).files).toEqual(['a.md', 'c.md', 'b.md', 'd.md'])
})

test('subagent: a running one reads «in corso» with no duration; finished runs beyond the log are pruned', () => {
  const runs: Record<string, AgentRun> = { a1: { type: 'Explore', at: AT - 2 * MIN, endAt: null } }
  expect(activityLog([], runs, [], T)).toEqual(['14:30 ⧗ Explore  in corso'])
  expect(pruneRuns(runs)).toBe(runs)
  const many: Record<string, AgentRun> = { live: { type: 'Plan', at: AT - 100 * MIN, endAt: null } }
  for (let i = 0; i < 65; i++) many[`d${i}`] = { type: 'Explore', at: AT + i * MIN, endAt: AT + i * MIN + 1 }
  const kept = pruneRuns(many)
  expect(Object.keys(kept)).toHaveLength(61)
  expect(kept.live).toBeDefined()
  expect(kept.d4).toBe(undefined)
  expect(kept.d5).toBeDefined()
})

test('writtenFiles outside the turn: the exact order, newest first, even with an all-digit key', () => {
  expect(writtenFiles({ 'b.md': 1, '2026': 3, 'a.md': 2 }).files).toEqual(['2026', 'a.md', 'b.md'])
  // JavaScript puts all-digit keys first: the oldest one must stay at the end.
  expect(writtenFiles({ 'b.md': 3, '7': 1 }).files).toEqual(['b.md', '7'])
})

// The same texts in English: they come from the catalog, never from a literal in the model.
const E = strings('en')

test('English: ages and due dates come from the catalog', () => {
  expect(ageText(0, E)).toBe('today')
  expect(ageText(1, E)).toBe('yesterday')
  expect(ageText(21, E)).toBe('21d')
  expect(dueLabel('2026-10-08', AT, E)).toEqual({ text: 'yesterday', color: 'error' })
  expect(dueLabel('2026-10-05', AT, E)).toEqual({ text: '4d ago', color: 'error' })
  expect(dueLabel('2026-10-09', AT, E)).toEqual({ text: 'today', color: 'error' })
  expect(dueLabel('2026-10-10', AT, E)).toEqual({ text: 'Sat', color: 'inactive' })
  expect(waitingRows({ ...SNAP, waiting: 1, waitingItems: [{ title: 'A', ageDays: 21 }] }, E).rows[0]?.age).toBe('21d')
})

test('English: the activity log reads the verbs, the context review, the turn ends and the running agents from the catalog', () => {
  const feed = [
    act(AT - 30 * MIN, 'edit', 'To Do.md'),
    { ...act(AT - 27 * MIN, 'read', 'NOVA.md'), count: 3 },
    { ...act(AT - 26 * MIN, 'search', '.'), detail: 'PromptHint' },
    act(AT - 25 * MIN, 'shell', '.'),
  ]
  const runs: Record<string, AgentRun> = {
    a1: { type: 'Explore', at: AT - 28 * MIN, endAt: AT - 26 * MIN },
    a2: { type: 'Plan', at: AT - 2 * MIN, endAt: null },
  }
  const ends = [{ at: AT - 23 * MIN, reason: 'answer', files: 2, ms: 190_000 }, { at: AT - MIN, reason: 'aborted', files: 0 }]
  expect(activityLog(feed, runs, ends, E)).toEqual([
    '14:02 ✎ edit    To Do.md',
    '14:04 ✓ Explore  2m',
    '14:05 ◦ read    1 file, 1 search · NOVA.md',
    '14:07 $ run     vault',
    '14:09 ✓ done in 3m10 · 2 files',
    '14:30 ⧗ Plan  running',
    '14:31 ✗ stopped',
  ])
  const ctx = (verb: 'read' | 'search', path: string, role: string, count = 1) => ({ ...act(AT, verb, path), role, count })
  expect(activityLog([ctx('read', '99 - Jarvis/memory/MEMORY.md', 'memory'), ctx('search', '00 - Inbox', 'inbox', 2)], {}, [], E)).toEqual(['14:32 ◦ review  the context · 1 file, 2 searches'])
  expect(endText('answer', 0, E)).toBe('✓ done')
  expect(endText('answer', 1, E)).toBe('✓ done · 1 file')
  expect(endText('error', 3, E)).toBe('✗ ended with an error · 3 files')
  expect(endText('refusal', 0, E)).toBe('✗ ended with an error')
  expect(endText('aborted', 0, E, 45_000)).toBe('✗ stopped in 45s')
})

test('the log verbs of both languages fit the verb column of the log drawing', () => {
  // lettering.ts draws the verb in a column of 8 characters: the longest word plus one space.
  for (const t of [T, E]) {
    for (const word of [...Object.values(t.recap.activity.verbs), t.recap.activity.review]) expect(word.length).toBeLessThanOrEqual(7)
  }
})

test('English: the Now line says what Jarvis is doing, or how the last turn ended', () => {
  const feed = [act(AT - MIN, 'read', 'prima.md'), act(AT + MIN, 'edit', 'a.md'), act(AT + 2 * MIN, 'shell', '.')]
  expect(doing(feed, {}, [], true, AT, E)).toEqual({ label: 'at work since 14:32', line: '$ run vault', color: 'text' })
  expect(doing(feed.slice(0, 1), {}, [], true, AT, E)).toEqual({ label: 'at work since 14:32', line: 'thinking…', color: 'inactive' })
  const runs: Record<string, AgentRun> = { a2: { type: 'Explore', at: AT + 15 * MIN, endAt: null } }
  expect(doing(feed, runs, [], true, AT, E).line).toBe('⧗ Explore running · since 14:47')
  expect(doing([], {}, [], true, null, E).label).toBe('at work')
  const end = (reason: string, ms?: number) => ({ at: AT + 3 * MIN, reason, files: 0, ...(ms === undefined ? {} : { ms }) })
  expect(doing([], {}, [end('answer', 190_000)], false, null, E)).toEqual({ label: 'waiting', line: '✓ last turn done at 14:35 in 3m10', color: 'success' })
  expect(doing([], {}, [end('aborted')], false, null, E).line).toBe('✗ stopped at 14:35')
  expect(doing([], {}, [end('error', 62_000)], false, null, E).line).toBe('✗ ended with an error at 14:35')
  expect(doing([], {}, [], false, null, E)).toEqual({ label: 'waiting', line: null, color: 'inactive' })
})
