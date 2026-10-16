import { test, expect, type Engine } from 'claude-code/testing'
import { PANE, PLUGIN } from '../hooks/state'
import type { Activity, AgentRun, SessionRecord, Snapshot } from '../types'
import { keyText } from '../hooks/format'
import { strings } from '../hooks/i18n'
import { AT, cardTitles, fakeVault, liveState, paneProps } from './harness'
import { handoffName } from './ports'

const SNAP: Snapshot = {
  takenAt: AT, hasTable: true, missing: [],
  now: ['- **NOVA 4.0 — PRD** — chiudere il branding', '- Helios offerta', '- Lumina', '- Core Team'],
  nowTitles: ['NOVA 4.0 — PRD', 'Helios offerta', 'Lumina', 'Core Team'],
  nowDetails: ['chiudere il branding', '', 'Lumina 4xH100', 'bozza pronta'],
  nowDue: [null, '2026-10-08', null, '2026-10-12'], waiting: 2,
  waitingItems: [{ title: 'Docs review of the guide', ageDays: 21 }, { title: 'Registry v2', ageDays: 3 }],
  handoffs: [
    { file: handoffName('2026-10-09', 'nova-chat'), topic: 'NOVA Chat discovery', ageDays: 8, next: 'Risultato parziale, lavoro fermo.' },
    { file: 'b.md', topic: 'Helios bilancio', ageDays: 15 },
    { file: 'c.md', topic: 'C', ageDays: 20 }, { file: 'd.md', topic: 'D', ageDays: 21 }, { file: 'e.md', topic: 'E', ageDays: 22 },
  ],
  inbox: { count: 4, oldestDays: 17 }, diary: { hasToday: false, last: '2026-10-07' },
}
const WRITE: Activity = { at: AT - 30 * 60_000, verb: 'edit', path: 'To Do.md', role: 'futuro op.', isProtected: true, isApprox: false, count: 1, turn: 2 }
// The first prompt of the session: from the first prompt the Recap is on the Session face.
const P = [{ turn: 2, at: AT - 40 * 60_000, text: 'sistema il To Do' }]
// The record of the current session, born with that prompt.
const REC: SessionRecord = {
  v: 1, id: 'cur', startAt: AT - 40 * 60_000, lastAt: AT - 40 * 60_000, endAt: null, prompts: 1, firstPrompt: 'sistema il To Do', resumeOf: null,
  files: [], fileCount: 0, handoff: null, diaryDay: null, diaryAt: null, subagents: 1, errors: 0,
}
const CLAUDE_MD = "## Capacita' Jarvis\n\n| Capacita' | Fonte autorevole |\n|---|---|\n| Futuro operativo | `Da fare.md` |\n| Inbox | `00 - Inbox` |\n| Handoff | `99 - Jarvis/handoffs` |\n"

const mount = ($: Engine) =>
  $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps() })
const alts = async (pane: { findAll: Awaited<ReturnType<typeof mount>>['findAll'] }) =>
  (await pane.findAll({ type: 'Svg' })).map(n => String(n.props.alt))
// The tool counters: one Svg each, the alt says the number and what.
const counters = async (pane: { findAll: Awaited<ReturnType<typeof mount>>['findAll'] }) =>
  (await alts(pane)).filter(a => /^\d+ in (Now|attesa|Inbox)/.test(a))
const logSvgOf = async (pane: { findAll: Awaited<ReturnType<typeof mount>>['findAll'] }, alt = 'Attività:') =>
  (await pane.findAll({ type: 'Svg' })).find(n => String(n.props.alt).startsWith(alt))
// The rows of the Activity log (Svg): the texts of each row joined by a space.
const logOf = async (pane: { findAll: Awaited<ReturnType<typeof mount>>['findAll'] }, alt = 'Attività:') => {
  const svg = await logSvgOf(pane, alt)
  if (svg === undefined) return []
  return [...String(svg.props.source).matchAll(/<g opacity="[^"]*">(.*?)<\/g>/g)]
    .map(m => [...(m[1] ?? '').matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(t => t[1]).join(' '))
}
const writtenOf = async (pane: { findAll: Awaited<ReturnType<typeof mount>>['findAll'] }) =>
  (await pane.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('written:') === true).map(b => b.props.label)
const text = (pane: Awaited<ReturnType<typeof mount>>, re: RegExp) => pane.find({ type: 'Text', text: re })
// The texts the buttons prepare in the prompt, in order.
function fills(on: Parameters<typeof liveState>[0]): string[] {
  const filled: string[] = []
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }) as never)
  on('prompt.fill', (_$, e) => { filled.push(e.text); return { isFilled: true } })
  return filled
}

test('written: under the log, the most recent first, at most 5 (+N opens them all); a click opens the file in Reading', async ($, on) => {
  const written: Record<string, number> = {}
  for (let i = 0; i < 7; i++) written[`03 - Projects/n${i}.md`] = AT - (7 - i) * 60_000
  const state = liveState(on, { snapshot: SNAP, feed: [WRITE], written, prompts: P })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, '03 - Projects/n6.md': '# n6\n' })
  const pane = await mount($)
  expect(await writtenOf(pane)).toEqual(['n6.md ›', 'n5.md ›', 'n4.md ›', 'n3.md ›', 'n2.md ›'])
  // A section of its own, after the log.
  expect((await cardTitles(pane)).slice(-2)).toEqual(['Cosa è successo', 'Scritti'])
  expect((await pane.find({ key: 'written-more' }))?.props).toMatchObject({ label: '+2 ›', dimColor: true })
  // +N opens all the files (and the whole log); "Less" closes it again.
  await pane.press({ key: 'written-more' })
  await state.until('logOpen', x => x === true)
  await pane.redraw()
  expect(await writtenOf(pane)).toHaveLength(7)
  expect(await pane.find({ key: 'written-more' })).toBe(undefined)
  expect((await pane.find({ key: 'written-less' }))?.props.label).toBe('meno')
  state.clock.advance(1000)
  await pane.press({ key: 'written-less' })
  await state.until('logOpen', x => x === false)
  await pane.redraw()
  expect(await writtenOf(pane)).toHaveLength(5)
  await pane.press({ key: 'written:03 - Projects/n6.md' })
  await state.until('reading', r => (r as { path: string | null }).path === '03 - Projects/n6.md')
  expect(state.values.tab).toBe('reading')
})

test('written: code opens in Reading, an image in the Files tab', async ($, on) => {
  const written = { 'hooks/a.tsx': AT - 120_000, 'img/logo.png': AT - 60_000 }
  const state = liveState(on, { snapshot: SNAP, feed: [WRITE], written, prompts: P })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'hooks/a.tsx': 'const a = 1\n', 'img/logo.png': 'png' }, { img: [{ name: 'logo.png', kind: 'file' }] })
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  expect(await writtenOf(pane)).toEqual(['logo.png ›', 'a.tsx ›'])
  await pane.press({ key: 'written:hooks/a.tsx' })
  await state.until('reading', r => (r as { path: string | null }).path === 'hooks/a.tsx')
  expect(state.values.tab).toBe('reading')
  state.values.tab = 'recap'
  await pane.redraw()
  await pane.press({ key: 'written:img/logo.png' })
  await state.until('tab', t => t === 'files')
  expect((state.values.tree as { selected: string }).selected).toBe('img/logo.png')
})

test('session face during a turn: This session, Now, What happened, Written and the footer; nothing from the previous layout', async ($, on) => {
  const runs: Record<string, AgentRun> = { a1: { type: 'Explore', at: AT - 26 * 60_000, endAt: null } }
  liveState(on, { snapshot: SNAP, feed: [WRITE], written: { 'To Do.md': WRITE.at }, prompts: P, session: REC, agentRuns: runs, working: true, turnAt: P[0]!.at })
  fakeVault(on, {})
  const filled = fills(on)
  const pane = await mount($)
  expect(await cardTitles(pane)).toEqual(['Questa sessione', 'Adesso', 'Cosa è successo', 'Scritti'])
  // This session: since what time (fixed, no running counter), on what topic, and the facts.
  expect((await text(pane, /^dalle 13:52$/))?.props.color).toBe('inactive')
  expect((await text(pane, /^sistema il To Do$/))?.props).toMatchObject({ bold: true, color: 'text' })
  expect((await text(pane, /^1 turno · 1 file scritto · 1 subagent$/))?.props.color).toBe('inactive')
  // Now: since what time it has been working; the running subagent takes precedence over the most recent row of the turn.
  expect((await text(pane, /^al lavoro dalle 13:52$/))?.props.color).toBe('#13918b')
  expect((await text(pane, /^⧗ Explore in corso · dalle 14:06$/))?.props.color).toBe('text')
  // What happened: the start of the turn with the time and the first words of the prompt, then the actions.
  expect(await logOf(pane)).toEqual(['13:52 › «sistema il To Do»', '14:02 ✎ scrive To Do.md', '14:06 ⧗ Explore  in corso'])
  // Even during the turn the log is an image: it changes with every activity and a reloaded frame
  // flickered. The cursor stays still.
  const log = await logSvgOf(pane)
  expect(log?.props.isInteractive).toBeUndefined()
  expect(String(log?.props.source)).not.toContain('<animate')
  expect(await pane.find({ key: 'log-toggle' })).toBe(undefined)
  expect(await writtenOf(pane)).toEqual(['To Do.md ›'])
  // The footer: the session is not saved; Save session, Handoff and Show overview.
  expect((await text(pane, /^ non salvata $/))?.props.color).toBe('warning')
  expect((await pane.find({ key: 'save' }))?.props).toMatchObject({ label: 'Save session ›', plain: true })
  expect((await pane.find({ key: 'handoff' }))?.props).toMatchObject({ label: 'Handoff ›', plain: true })
  expect((await pane.find({ key: 'see-open' }))?.props).toMatchObject({ label: 'Vedi apertura', plain: true })
  // Nothing from the previous layout: Resume, big counters, Now, Briefing, section numbers; no Opening.
  for (const key of ['resume', 'count-now', 'now:Core Team', 'briefing', 'next', 'see-work']) expect(await pane.find({ key })).toBe(undefined)
  expect(await counters(pane)).toEqual([])
  expect(await pane.find({ type: 'Text', text: /^al lavoro$/ })).toBe(undefined)
  await pane.press({ key: 'save' })
  await pane.press({ key: 'handoff' })
  expect(filled).toEqual(['/save-session', '/handoff'])
})

test('log: the last 12 rows, one line each, cut with …; N more › opens everything, Latest only closes it again', async ($, on) => {
  const edit = (i: number): Activity => ({ at: AT - (15 - i) * 60_000, verb: 'edit', path: `03 - Projects/NOVA/n${i}.md`, isProtected: false, isApprox: false, count: 1, turn: 2 })
  const shell: Activity = { at: AT - 60_000, verb: 'shell', path: '.', detail: 'python3 /private/tmp/modtest.py tests/a.test.ts tests/b.test.ts', isProtected: false, isApprox: true, count: 1, turn: 2 }
  const state = liveState(on, { snapshot: SNAP, feed: [...Array.from({ length: 14 }, (_, i) => edit(i)), shell], prompts: P, session: REC })
  fakeVault(on, {})
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  const log = await logOf(pane)
  expect(log).toHaveLength(12)
  expect(log.slice(0, 2)).toEqual(['14:20 ✎ scrive n3.md', '14:21 ✎ scrive n4.md'])
  // 46-column pane: the command does not wrap, it is cut with …
  expect(log[11]).toBe('14:31 $ esegue python3 /private/t…')
  expect((await logSvgOf(pane))?.props.height).toBe(12 * 20 + 4)
  expect((await pane.find({ key: 'log-toggle' }))?.props).toMatchObject({ label: 'altre 4 ›', dimColor: true })
  await pane.press({ key: 'log-toggle' })
  await state.until('logOpen', x => x === true)
  await pane.redraw()
  const all = await logOf(pane)
  expect(all).toHaveLength(16)
  expect(all[0]).toBe('13:52 › «sistema il To Do»')
  expect((await pane.find({ key: 'log-toggle' }))?.props.label).toBe('solo le ultime')
  state.clock.advance(1000)
  await pane.press({ key: 'log-toggle' })
  await state.until('logOpen', x => x === false)
  await pane.redraw()
  expect(await logOf(pane)).toHaveLength(12)
})

test('session face between turns: Now shows waiting with the outcome of the last turn; the log closes the turn with its duration; errors in red', async ($, on) => {
  const end = { at: AT - 60_000, reason: 'answer', files: 1, turn: 2, ms: 190_000 }
  const state = liveState(on, { snapshot: { ...SNAP, handoffs: [] }, prompts: P, session: REC, ends: [end], agentRuns: { a1: { type: 'Plan', at: AT - 2 * 60_000, endAt: AT - 60_000 } } })
  fakeVault(on, {})
  const pane = await mount($)
  expect((await text(pane, /^in attesa$/))?.props.color).toBe('inactive')
  expect((await text(pane, /^✓ ultimo turno finito alle 14:31 in 3m10$/))?.props.color).toBe('success')
  expect(await logOf(pane)).toEqual(['13:52 › «sistema il To Do»', '14:30 ✓ Plan  1m', '14:31 ✓ fatto in 3m10 · 1 file'])
  expect(await text(pane, /^1 turno · 1 subagent$/)).toBeDefined()
  // Stopped by the user: not an error.
  state.values.ends = [{ ...end, reason: 'aborted' }]
  await pane.redraw()
  expect((await text(pane, /^✗ interrotto alle 14:31$/))?.props.color).toBe('inactive')
  expect((await logOf(pane))[2]).toBe('14:31 ✗ interrotto in 3m10 · 1 file')
  expect(await text(pane, /errore/)).toBe(undefined)
  state.values.ends = [{ ...end, reason: 'error' }]
  state.values.session = { ...REC, errors: 1 }
  await pane.redraw()
  expect((await text(pane, /^✗ finito con un errore alle 14:31$/))?.props.color).toBe('error')
  // 46-column pane: the row is cut with …
  expect((await logOf(pane))[2]).toBe('14:31 ✗ finito con un errore in 3m…')
  expect(await text(pane, /^1 turno · 1 subagent · 1 errore$/)).toBeDefined()
  expect((await text(pane, /^ · 1 errore$/))?.props.color).toBe('error')
})

test('session face during a turn: Now shows the latest row of the turn, "thinking…" before the first action; the log separates the turns', async ($, on) => {
  const turnAt = AT - 10 * 60_000
  const state = liveState(on, { snapshot: SNAP, prompts: [...P, { turn: 3, at: turnAt, text: 'e adesso il diario' }], session: { ...REC, prompts: 2 }, feed: [WRITE], working: true, turnAt })
  fakeVault(on, {})
  const pane = await mount($)
  expect(await text(pane, /^al lavoro dalle 14:22$/)).toBeDefined()
  // The 14:02 write belongs to the previous turn.
  expect((await text(pane, /^sta pensando…$/))?.props.color).toBe('inactive')
  state.values.feed = [WRITE, { ...WRITE, at: AT - 5 * 60_000, path: '01 - Diary/2026/10/2026-10-09.md', role: 'diario', isProtected: false, turn: 3 }]
  await pane.redraw()
  expect((await text(pane, /^✎ scrive 2026-10-09\.md$/))?.props.color).toBe('text')
  expect(await logOf(pane)).toEqual(['13:52 › «sistema il To Do»', '14:02 ✎ scrive To Do.md', '14:22 › «e adesso il diario»', '14:27 ✎ scrive 2026-10-09.md'])
  expect(await text(pane, /^2 turni · 1 subagent$/)).toBeDefined()
})

test('footer: "saved at HH:MM" when the session wrote today\'s note; the topic from the handoff it wrote; with no record, from the first prompt', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP, prompts: P, session: { ...REC, diaryDay: '2026-10-09', diaryAt: AT - 5 * 60_000 } })
  fakeVault(on, {})
  const pane = await mount($)
  expect((await text(pane, /^✓ salvata alle 14:27$/))?.props.color).toBe('success')
  expect(await pane.find({ key: 'save' })).toBe(undefined)
  expect(await text(pane, /^ non salvata $/)).toBe(undefined)
  expect(await pane.find({ key: 'handoff' })).toBeDefined()
  expect(await pane.find({ key: 'see-open' })).toBeDefined()
  // The note of another day does not save today's session.
  state.values.session = { ...REC, diaryDay: '2026-10-08', diaryAt: AT - 5 * 60_000 }
  await pane.redraw()
  expect(await pane.find({ key: 'save' })).toBeDefined()
  // The topic is the topic of the handoff written in the session.
  state.values.session = { ...REC, handoff: { file: '99 - Jarvis/handoffs/h.md', topic: 'jarvis-cockpit', status: 'active' } }
  await pane.redraw()
  expect((await text(pane, /^jarvis-cockpit$/))?.props.bold).toBe(true)
  // With no record (the prompt has just started): the time and the topic come from the first prompt.
  state.values.session = null
  await pane.redraw()
  expect(await text(pane, /^dalle 13:52$/)).toBeDefined()
  expect((await text(pane, /^sistema il To Do$/))?.props.bold).toBe(true)
  expect(await text(pane, /^1 turno$/)).toBeDefined()
})

test('session face with no record: real subagents and errors from the atoms; a turn stopped by the user is not an error', async ($, on) => {
  const ends = [{ at: AT - 120_000, reason: 'error', files: 0, turn: 2 }, { at: AT - 60_000, reason: 'aborted', files: 0, turn: 3 }]
  // A subagent with no type (the provisional key of agent.spawn) is not yet a subagent to count.
  const agentRuns = {
    a1: { type: 'Explore', at: AT - 300_000, endAt: AT - 200_000 },
    a2: { type: 'Plan', at: AT - 250_000, endAt: null },
    a3: { type: '', at: AT - 100_000, endAt: null },
  }
  liveState(on, { snapshot: SNAP, prompts: P, session: null, ends, agentRuns })
  fakeVault(on, {})
  const pane = await mount($)
  // Two real subagents (the one with no type does not count) and a single error (the user's interruption does not).
  expect(await text(pane, /^1 turno · 2 subagent · 1 errore$/)).toBeDefined()
  expect((await text(pane, /^ · 1 errore$/))?.props.color).toBe('error')
})

test('recap: the prompts, the session and the face are read only while the Recap tab is chosen', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP, prompts: P, session: REC, tab: 'todo' })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': '## Now\n' })
  const pane = await mount($)
  expect(state.gets.prompts).toBe(undefined)
  expect(state.gets.session).toBe(undefined)
  expect(state.gets.recapView).toBe(undefined)
  state.values.tab = 'recap'
  await pane.redraw()
  expect(state.gets.prompts).toBeGreaterThan(0)
  expect(state.gets.session).toBeGreaterThan(0)
  expect(state.gets.recapView).toBeGreaterThan(0)
})

test('recap: on the Session face the button keys do not change when activities and subagents arrive', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP, prompts: P, session: REC, feed: [WRITE], written: { 'To Do.md': WRITE.at }, working: true, turnAt: P[0]!.at })
  const pane = await mount($)
  const keys = async () => (await pane.findAll({ type: 'Button' })).map(b => b.key ?? '').filter(k => /^(written|save|handoff|see-|log-)/.test(k))
  const before = await keys()
  expect(before).toEqual(['written:To Do.md', 'save', 'handoff', 'see-open'])
  state.values.feed = [WRITE, { at: AT - 60_000, verb: 'read', path: 'x.md', isProtected: false, isApprox: false, count: 1, turn: 2 }]
  state.values.agentRuns = { a1: { type: 'Explore', at: AT - 30_000, endAt: null } }
  await pane.redraw()
  expect(await keys()).toEqual(before)
})

test('recap: when empty it shows "Loading the state…" and nothing else', async ($, on) => {
  liveState(on, {})
  fakeVault(on, {})
  const pane = await mount($)
  expect(await pane.find({ text: /Carico lo stato/ })).toBeDefined()
  expect(await pane.find({ key: 'briefing' })).toBe(undefined)
})

test('recap: a missing source and a missing table in red, at the top of both faces', async ($, on) => {
  const state = liveState(on, { snapshot: { ...SNAP, missing: ['Inbox'] } })
  fakeVault(on, {})
  const pane = await mount($)
  expect(await cardTitles(pane)).toContain('Fonti')
  expect(await pane.find({ text: /✕ Inbox dichiarata ma assente/ })).toBeDefined()
  state.values.snapshot = { ...SNAP, hasTable: false }
  await pane.redraw()
  expect(await pane.find({ text: /Tabella delle capacità di Jarvis non trovata in CLAUDE\.md/ })).toBeDefined()
  // At the top in the Session face too.
  state.values.prompts = P
  await pane.redraw()
  expect((await cardTitles(pane)).slice(0, 2)).toEqual(['Fonti', 'Questa sessione'])
})

test('hook: agent.spawn records the subagent under the provisional key and then under its id', async ($, on) => {
  const state = liveState(on, {})
  let seen: unknown = null
  on('agent.spawn', () => { seen = structuredClone(state.values.agentRuns); return { model: 'haiku', agentId: 'a1' } as never })
  await $.agent.spawn({ tool_use_id: 'tu1', prompt: 'x', description: 'cerca', subagentType: 'Explore' } as never)
  // The provisional key is unique on every hook call: `t:<tool_use_id>:<n>`.
  expect(Object.keys(seen as object)).toHaveLength(1)
  expect(Object.keys(seen as object)[0]).toMatch(/^t:tu1:\d+$/)
  expect(Object.values(seen as object)).toEqual([{ type: 'Explore', at: AT, endAt: null }])
  expect(state.values.agentRuns).toEqual({ a1: { type: 'Explore', at: AT, endAt: null } })
})

test('hook: a denied agent.spawn leaves no trace', async ($, on) => {
  const state = liveState(on, {})
  on('agent.spawn', () => ({ deny: 'no' }) as never)
  await $.agent.spawn({ tool_use_id: 'tu2', prompt: 'x', description: 'cerca', subagentType: 'Explore' } as never).catch(() => {})
  expect(state.values.agentRuns).toEqual({})
})

test('hook: turn.complete with an agentId closes that subagent; the main turn\'s closes every subagent no longer running', async ($, on) => {
  const state = liveState(on, {
    agentRuns: { a1: { type: 'Explore', at: AT - 60_000, endAt: null }, a2: { type: 'Plan', at: AT - 60_000, endAt: null }, a3: { type: 'Plan', at: AT - 60_000, endAt: null } },
  })
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [{ id: 'a2', type: 'Plan', description: '', status: 'running' as const }] }) as never)
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 's1', agentId: 'a1', reason: 'answer' } as never)
  expect((state.values.agentRuns as Record<string, AgentRun>).a1?.endAt).toBe(AT)
  expect((state.values.agentRuns as Record<string, AgentRun>).a3?.endAt).toBe(null)
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  expect(state.values.agentRuns).toEqual({
    a1: { type: 'Explore', at: AT - 60_000, endAt: AT },
    a2: { type: 'Plan', at: AT - 60_000, endAt: null },
    a3: { type: 'Plan', at: AT - 60_000, endAt: AT },
  })
})

test('hook: a turn.complete with an unseen agentId leaves a placeholder; with no prompt the Recap stays on the opening face', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP })
  fakeVault(on, {})
  on('turn.complete', () => ({ text: '' }))
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 's9', agentId: 'ghost', reason: 'answer' } as never)
  expect(state.values.agentRuns).toEqual({ ghost: { type: '', at: AT, endAt: AT } })
  const pane = await mount($)
  expect(await cardTitles(pane)).toEqual(['Oggi', 'Next step'])
  expect(await pane.find({ key: 'next' })).toBeDefined()
})

test('hook: an agent.spawn that fails leaves no provisional key and rethrows the error', async ($, on) => {
  const state = liveState(on, {})
  on('agent.spawn', () => { throw new Error('boom') })
  await expect($.agent.spawn({ tool_use_id: 'tu3', prompt: 'x', description: 'cerca', subagentType: 'Explore' } as never)).rejects.toThrow()
  expect(state.values.agentRuns).toEqual({})
})

test('hook: two agent.spawn calls with the same tool_use_id (workflow) are both recorded', async ($, on) => {
  const state = liveState(on, {})
  let n = 0
  on('agent.spawn', async () => { await Promise.resolve(); return { model: 'haiku', agentId: `w${++n}` } as never })
  await Promise.all([
    $.agent.spawn({ tool_use_id: 'wf', prompt: 'x', description: 'a', subagentType: 'Explore' } as never),
    $.agent.spawn({ tool_use_id: 'wf', prompt: 'y', description: 'b', subagentType: 'Plan' } as never),
  ])
  expect(Object.keys(state.values.agentRuns as object).sort()).toEqual(['w1', 'w2'])
})

// The test answers calls like the engine and carries Jarvis's write through to the feed.
function toolCalls(on: Parameters<typeof liveState>[0]) {
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'nota.md': 'x' })
  on('agent.list', () => ({ value: [] }))
  on('tool.call', () => ({ result: 'ok' }) as never)
}

test('hook: a deletion is added to the log with its own row and no written files', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP, prompts: P })
  toolCalls(on)
  await $.tool.call({ tool: 'Bash', command: 'rm /v/nota.md' } as never)
  expect(state.values.written).toEqual({})
  const pane = await mount($)
  expect(await cardTitles(pane)).toEqual(['Questa sessione', 'Adesso', 'Cosa è successo'])
  expect(await logOf(pane)).toEqual(['13:52 › «sistema il To Do»', '14:32 ✕ elimina nota.md'])
  expect(await pane.find({ type: 'Text', text: /^al lavoro/ })).toBe(undefined)
})

test('hook: a command in the vault is added to the log with the names of the programs', async ($, on) => {
  liveState(on, { snapshot: SNAP, prompts: P })
  toolCalls(on)
  await $.tool.call({ tool: 'Bash', command: 'cd /v && F=("/v/a.md" "/v/b.md") && git add -- "${F[@]}" && git commit -m "x" -- "${F[@]}"' } as never)
  const pane = await mount($)
  expect(await logOf(pane)).toEqual(['13:52 › «sistema il To Do»', '14:32 $ esegue git add, git commit'])
})

test('hook: a read is added to the log; with no prompt the Recap stays on the opening face', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP })
  toolCalls(on)
  await $.tool.call({ tool: 'Read', file_path: '/v/nota.md' } as never)
  const pane = await mount($)
  expect(await cardTitles(pane)).toEqual(['Oggi', 'Next step'])
  state.values.prompts = P
  await pane.redraw()
  expect(await logOf(pane)).toEqual(['13:52 › «sistema il To Do»', '14:32 ◦ legge nota.md'])
  // Outside a turn the cursor stays still and the Svg does not need to be interactive.
  const log = await logSvgOf(pane)
  expect(log?.props.isInteractive).toBeUndefined()
  expect(String(log?.props.source)).toMatch(/<rect [^>]*class="ac"><\/rect>/)
})

test('log: control characters in the Svgs become U+FFFD', async ($, on) => {
  liveState(on, { snapshot: SNAP, prompts: P, feed: [{ ...WRITE, path: 'x\x1by.md' }] })
  fakeVault(on, {})
  const pane = await mount($)
  const source = String((await logSvgOf(pane))?.props.source)
  expect(source).not.toMatch(/[\u0000-\u0008\u000b-\u001f]/)
  expect(source).toContain('x\uFFFDy.md')
})

// The keys of the written files come from the paths: with a control character the engine rejects the drawing, and two paths
// that differ by that character must not get the same key. Today and other handoffs: recapOpen.test.ts.
test('written: paths with control characters give keys with no control characters, and each key opens its own file', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP, prompts: P, feed: [WRITE], written: { 'a\x1bb.md': AT - 60_000, 'a\x07b.md': AT - 120_000 } })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'a\x1bb.md': 'x', 'a\x07b.md': 'y' })
  on('store.set', () => ({ value: undefined }))
  const keysOf = async (pane: Awaited<ReturnType<typeof mount>>, prefix: RegExp) =>
    (await pane.findAll({ type: 'Button' })).map(b => b.key ?? '').filter(k => prefix.test(k))
  const pane = await mount($)
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect(await keysOf(pane, /^written:/)).toEqual(['written:a\\u001bb.md', 'written:a\\u0007b.md'])
  expect(await keysOf(pane, /[\u0000-\u001f\u007f-\u009f]/)).toEqual([])
  await pane.press({ key: `written:${keyText('a\x07b.md')}` })
  await state.until('reading', r => (r as { path: string | null }).path === 'a\x07b.md')
})

test('written: during the turn a new file goes to the end and the ones already in the row keep their place; after the turn, newest first', async ($, on) => {
  // Stored oldest first: at the start of the turn the row is newest first.
  const written = { 'a.md': AT - 2 * 60_000, 'b.md': AT - 60_000 }
  const state = liveState(on, { snapshot: SNAP, feed: [WRITE], written, prompts: P })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'a.md': '# a\n', 'b.md': '# b\n', 'c.md': '# c\n' })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  on('tool.call', () => ({ result: 'ok' }) as never)
  const pane = await mount($)
  expect(await writtenOf(pane)).toEqual(['b.md ›', 'a.md ›'])
  await $.turn.start({ text: 'ciao', turnId: 't1' })
  await state.clock.advance(1000)
  await $.tool.call({ tool: 'Edit', file_path: '/v/a.md', old_string: 'a', new_string: 'x' })
  await state.clock.advance(1000)
  await $.tool.call({ tool: 'Edit', file_path: '/v/c.md', old_string: 'c', new_string: 'x' })
  await pane.redraw()
  expect(await writtenOf(pane)).toEqual(['b.md ›', 'a.md ›', 'c.md ›'])
  await pane.press({ key: 'written:b.md' })
  await state.until('reading', r => (r as { path: string | null }).path === 'b.md')
  state.values.tab = 'recap'
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  await pane.redraw()
  expect(await writtenOf(pane)).toEqual(['c.md ›', 'a.md ›', 'b.md ›'])
})

test('agentRuns: at turn end, finished runs beyond what the log shows are dropped from the atom', async ($, on) => {
  const runs: Record<string, AgentRun> = { live: { type: 'Plan', at: AT - 99 * 60_000, endAt: null } }
  for (let i = 0; i < 65; i++) runs[`d${i}`] = { type: 'Explore', at: AT - (70 - i) * 60_000, endAt: AT - (70 - i) * 60_000 + 1000 }
  const state = liveState(on, { snapshot: SNAP, agentRuns: runs, working: true })
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [{ id: 'live', status: 'running' }] }) as never)
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  await state.until('agentRuns', r => Object.keys(r as object).length === 61)
  const kept = state.values.agentRuns as Record<string, AgentRun>
  expect(kept.live).toBeDefined()
  expect(kept.d4).toBe(undefined)
  expect(kept.d5).toBeDefined()
})

test('written: turn.start does not rewrite it when it is already in order', async ($, on) => {
  // Already newest first: at the start of the turn there is nothing to reorder.
  const written = { 'b.md': AT - 60_000, 'a.md': AT - 2 * 60_000 }
  const state = liveState(on, { snapshot: SNAP, feed: [WRITE], written, prompts: P })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  const pane = await mount($)
  await $.turn.start({ text: 'ciao', turnId: 't1' })
  await state.until('working', w => w === true)
  await pane.redraw()
  expect(state.sets.written).toBeUndefined()
  expect(Object.keys(state.values.written as Record<string, number>)).toEqual(['b.md', 'a.md'])
})

test('written: turn.start reorders it before working becomes true, so the old order is never seen, not even for a moment', async ($, on) => {
  // Stored oldest first: the key order is the old one until turn.start reorders it.
  const written = { 'a.md': AT - 2 * 60_000, 'b.md': AT - 60_000 }
  const state = liveState(on, { snapshot: SNAP, feed: [WRITE], written, prompts: P })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD })
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  await mount($)
  // What `written` holds at the moment working is written true.
  let atWorking: string[] | null = null
  const working = state.until('working', w => {
    if (w === true) atWorking = Object.keys(state.values.written as Record<string, number>)
    return w === true
  })
  await $.turn.start({ text: 'ciao', turnId: 't1' })
  await working
  expect(atWorking).toEqual(['b.md', 'a.md'])
})

test('agentRuns: at turn end with 60 finished runs or fewer it is not rewritten', async ($, on) => {
  const runs: Record<string, AgentRun> = {}
  for (let i = 0; i < 3; i++) runs[`d${i}`] = { type: 'Explore', at: AT - (10 - i) * 60_000, endAt: AT - (10 - i) * 60_000 + 1000 }
  const state = liveState(on, { snapshot: SNAP, agentRuns: runs, working: true })
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }) as never)
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  // turn.complete ends with the write of ends: agentRuns is not looked at before that.
  await state.until('ends', e => Array.isArray(e) && e.length === 1)
  expect(state.sets.agentRuns).toBeUndefined()
  expect(Object.keys(state.values.agentRuns as Record<string, AgentRun>)).toHaveLength(3)
})

// The Session face in English: a vault with the English capability table. The texts come from the catalog.
const CLAUDE_MD_EN = '## Capabilities\n\n| Capability | Authoritative source |\n|---|---|\n| Future work | `To Do.md` |\n| Inbox | `00 - Inbox` |\n| Handoff | `99 - Jarvis/handoffs` |\n'
const exact = (s: string): RegExp => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
const ACTIVITY = 'Activity:'

test('Session face in English: the cards, the Now line, the log, Written and the footer come from the catalog', async ($, on) => {
  const t = strings('en')
  const runs: Record<string, AgentRun> = { a1: { type: 'Explore', at: AT - 26 * 60_000, endAt: null } }
  liveState(on, { snapshot: SNAP, feed: [WRITE], written: { 'To Do.md': WRITE.at }, prompts: P, session: REC, agentRuns: runs, working: true, turnAt: P[0]!.at })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN })
  const filled = fills(on)
  const pane = await mount($)
  expect(await cardTitles(pane)).toEqual([t.recap.work.title, t.recap.now.title, t.recap.work.logTitle, t.recap.work.writtenTitle])
  expect(await cardTitles(pane)).toEqual(['This session', 'Now', 'What happened', 'Written'])
  expect((await text(pane, /^since 13:52$/))?.props.color).toBe('inactive')
  expect(await text(pane, /^1 turn · 1 file written · 1 subagent$/)).toBeDefined()
  expect((await text(pane, exact(t.recap.now.workingSince('13:52'))))?.props.color).toBe('#13918b')
  expect(await text(pane, /^at work since 13:52$/)).toBeDefined()
  expect(await text(pane, exact(t.recap.now.agentRunning('Explore', '14:06')))).toBeDefined()
  expect(await logOf(pane, ACTIVITY)).toEqual(['13:52 › «sistema il To Do»', '14:02 ✎ edit To Do.md', '14:06 ⧗ Explore  running'])
  expect((await logSvgOf(pane, ACTIVITY))?.props.alt).toBe(t.recap.work.logAlt(3))
  expect(await writtenOf(pane)).toEqual(['To Do.md ›'])
  // The footer: not saved, Save session, Handoff and the way back to the overview; the slash commands stay as they are.
  expect((await text(pane, exact(` ${t.recap.last.unsaved} `)))?.props.color).toBe('warning')
  expect((await pane.find({ key: 'save' }))?.props.label).toBe(t.recap.work.save)
  expect((await pane.find({ key: 'handoff' }))?.props.label).toBe(t.recap.work.handoff)
  expect((await pane.find({ key: 'see-open' }))?.props.label).toBe(t.recap.work.seeOpen)
  expect(t.recap.work.seeOpen).toBe('Show overview')
  await pane.press({ key: 'save' })
  await pane.press({ key: 'handoff' })
  expect(filled).toEqual(['/save-session', '/handoff'])
})

test('Session face in English: how the last turn ended, the errors and the time of the save', async ($, on) => {
  const t = strings('en')
  const end = { at: AT - 60_000, reason: 'answer', files: 1, turn: 2, ms: 190_000 }
  const state = liveState(on, { snapshot: { ...SNAP, handoffs: [] }, prompts: P, session: REC, ends: [end], agentRuns: { a1: { type: 'Plan', at: AT - 2 * 60_000, endAt: AT - 60_000 } } })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN })
  const pane = await mount($)
  expect((await text(pane, exact(t.recap.now.waiting)))?.props.color).toBe('inactive')
  expect((await text(pane, /^✓ last turn done at 14:31 in 3m10$/))?.props.color).toBe('success')
  expect(await logOf(pane, ACTIVITY)).toEqual(['13:52 › «sistema il To Do»', '14:30 ✓ Plan  1m', '14:31 ✓ done in 3m10 · 1 file'])
  expect(await text(pane, /^1 turn · 1 subagent$/)).toBeDefined()
  state.values.ends = [{ ...end, reason: 'aborted' }]
  await pane.redraw()
  expect((await text(pane, /^✗ stopped at 14:31$/))?.props.color).toBe('inactive')
  state.values.ends = [{ ...end, reason: 'error' }]
  state.values.session = { ...REC, errors: 1 }
  await pane.redraw()
  expect((await text(pane, /^✗ ended with an error at 14:31$/))?.props.color).toBe('error')
  expect(await text(pane, /^1 turn · 1 subagent · 1 error$/)).toBeDefined()
  // The note of today, written by this session: the footer says when.
  state.values.session = { ...REC, diaryDay: '2026-10-09', diaryAt: AT - 5 * 60_000 }
  await pane.redraw()
  expect((await text(pane, exact(t.recap.work.saved('14:27'))))?.props.color).toBe('success')
  expect(t.recap.work.saved('14:27')).toBe('✓ saved at 14:27')
  // Without a record the topic is the first prompt; without one either, the catalog's untitled session.
  state.values.session = null
  state.values.prompts = [{ turn: 2, at: AT - 40 * 60_000, text: '' }]
  await pane.redraw()
  expect(await text(pane, exact(t.session.untitled))).toBeDefined()
  expect(t.session.untitled).toBe('untitled session')
})

test('Session face in English: the log and Written open and close with the catalog labels', async ($, on) => {
  const t = strings('en')
  const feed: Activity[] = Array.from({ length: 20 }, (_, i) => ({ ...WRITE, at: AT - (30 - i) * 60_000, path: `n${i}.md`, turn: 2 }))
  const written: Record<string, number> = {}
  for (let i = 0; i < 7; i++) written[`n${i}.md`] = AT - (7 - i) * 60_000
  const state = liveState(on, { snapshot: SNAP, feed, written, prompts: P, session: REC })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN })
  const pane = await mount($)
  // 20 activities and the start of the turn: 21 rows, the last 12 shown.
  expect((await pane.find({ key: 'log-toggle' }))?.props.label).toBe(t.recap.work.logMore(9))
  expect(t.recap.work.logMore(9)).toBe('9 more ›')
  await pane.press({ key: 'log-toggle' })
  await state.until('logOpen', x => x === true)
  await pane.redraw()
  expect((await pane.find({ key: 'log-toggle' }))?.props.label).toBe(t.recap.work.logLess)
  expect((await pane.find({ key: 'written-less' }))?.props.label).toBe(t.recap.work.writtenLess)
  expect(t.recap.work.writtenLess).toBe('Less')
})

test('Recap in English: the loading text, the missing source lines and the missing table come from the catalog', async ($, on) => {
  const t = strings('en')
  const state = liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN })
  const pane = await mount($)
  expect(await pane.find({ text: exact(t.recap.loading) })).toBeDefined()
  expect(t.recap.loading).toBe('Loading the state…')
  // The four sources the panel names, and one the user declared with a name of their own, which is shown as written.
  state.values.snapshot = { ...SNAP, missing: ['Identity', 'Durable memory', 'Future work', 'Daily history', 'Inbox'] }
  await pane.redraw()
  expect(await cardTitles(pane)).toContain(t.recap.sources.title)
  expect(await cardTitles(pane)).toContain('Sources')
  for (const line of ['✕ Identity declared but missing', '✕ Durable memory declared but missing', '✕ Future work declared but missing', '✕ Daily history declared but missing', '✕ Inbox declared but missing']) {
    expect((await pane.find({ type: 'Text', text: exact(line) }))?.props.color).toBe('error')
  }
  expect(t.recap.sources.missing(t.recap.sources.names['Future work'])).toBe('✕ Future work declared but missing')
  state.values.snapshot = { ...SNAP, hasTable: false }
  await pane.redraw()
  expect((await pane.find({ type: 'Text', text: exact(t.recap.sources.noTable) }))?.props.color).toBe('error')
  expect(t.recap.sources.noTable).toBe('Jarvis capability table not found in CLAUDE.md')
})

test('Recap in Italian: the four named sources keep their Italian names, any other is shown as written', async ($, on) => {
  const state = liveState(on, { snapshot: { ...SNAP, missing: ['Identity', 'Durable memory', 'Future work', 'Daily history', 'Inbox'] } })
  fakeVault(on, {})
  const pane = await mount($)
  const lines = (await pane.findAll({ type: 'Text' })).map(n => n.text).filter(x => x.startsWith('✕'))
  expect(lines).toEqual(["✕ Identita' dichiarata ma assente", '✕ Memoria durevole dichiarata ma assente', '✕ Futuro operativo dichiarata ma assente', '✕ Diario dichiarata ma assente', '✕ Inbox dichiarata ma assente'])
  state.values.snapshot = { ...SNAP, missing: ['constructor'] }
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^✕ constructor dichiarata ma assente$/ })).toBeDefined()
})
