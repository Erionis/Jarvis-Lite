import { test, expect, type Engine } from 'claude-code/testing'
import { PANE, PLUGIN } from '../hooks/state'
import type { Activity, DiaryDay, SessionRecord, Snapshot } from '../types'
import { keyText } from '../hooks/format'
import { strings } from '../hooks/i18n'
import { AT, cardTitles, fakeVault, liveState, paneProps } from './harness'
import { handoffName } from './ports'

// The opening face of the Recap: Today, Last session and Next step, as long as no prompt has been sent in the session,
// or after `Show overview`. AT is Friday 9 October 2026, 14:32.

const day = (d: number, hr: number, m: number) => new Date(2026, 9, d, hr, m).getTime()
const RESUME_KB = `/handoff resume ${handoffName('2026-10-09', 'nova-kb', { md: false })}`
const FILES = ['hooks/recap.tsx', 'hooks/recapModel.ts', 'hooks/sessionModel.ts', 'hooks/register.tsx', 'types/index.d.ts', ...Array.from({ length: 7 }, (_, i) => `tests/t${i}.test.ts`)]
// The worked example, one day earlier: yesterday from 9:40 to 14:28 on jarvis-cockpit, 12 files, diary not saved.
const REC: SessionRecord = {
  v: 1, id: 'old', startAt: day(8, 9, 40), lastAt: day(8, 14, 28), endAt: null, prompts: 9, firstPrompt: 'riprendiamo il cockpit', resumeOf: null,
  files: FILES, fileCount: 12, handoff: { file: `99 - Jarvis/handoffs/${handoffName('2026-10-08', 'cockpit')}`, topic: 'jarvis-cockpit', status: 'completed' },
  diaryDay: null, diaryAt: null, subagents: 2, errors: 0,
}
const NOTE_7: DiaryDay = {
  day: '2026-10-07', path: '01 - Diary/2026/10/2026-10-07.md',
  parts: [
    { part: 'focus', lines: [{ lead: 'Jarvis Cockpit', rest: ' — robottino' }, { lead: '', rest: 'NOVA roadmap' }], more: 0 },
    { part: 'closing', lines: [{ lead: '', rest: 'Gate 0.6 passato' }], more: 0 },
  ],
}
const SNAP: Snapshot = {
  takenAt: AT, hasTable: true, missing: [],
  now: ['- **NOVA 4.0 — PRD** — chiudere il branding', '- **Helios offerta** — mandare la [bozza](x.md)', '- Lumina'],
  nowTitles: ['NOVA 4.0 — PRD', 'Helios offerta', 'Lumina'],
  nowDetails: ['chiudere il branding', 'mandare la [bozza](x.md)', ''],
  nowDue: [null, '2026-10-08', null], waiting: 2,
  waitingItems: [{ title: 'Docs review of the guide', ageDays: 21 }, { title: 'Registry v2', ageDays: 3 }],
  handoffs: [
    { file: handoffName('2026-10-09', 'nova-kb'), topic: 'NOVA Chat — semplificare KB workflow', ageDays: 0, next: 'Togliere il passo di conferma.', state: 'Bozza pronta.' },
    { file: 'b.md', topic: 'Helios bilancio', ageDays: 15 },
    { file: 'c.md', topic: 'C', ageDays: 20 }, { file: 'd.md', topic: 'D', ageDays: 21 }, { file: 'e.md', topic: 'E', ageDays: 22 },
  ],
  inbox: { count: 5, oldestDays: 23 }, diary: { hasToday: false, last: '2026-10-07' },
  lastDiary: NOTE_7, diaryDays: [], sessions: [REC],
}
const CLAUDE_MD = "## Capacita' Jarvis\n\n| Capacita' | Fonte autorevole |\n|---|---|\n| Futuro operativo | `Da fare.md` |\n| Inbox | `00 - Inbox` |\n| Diario | `01 - Diary` |\n| Handoff | `99 - Jarvis/handoffs` |\n"
const PROMPT = { turn: 2, at: AT - 60_000, text: 'ciao' }

const mount = ($: Engine) =>
  $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps() })
type Pane = Awaited<ReturnType<typeof mount>>
const text = (pane: Pane, re: RegExp) => pane.find({ type: 'Text', text: re })
const keysOf = async (pane: Pane, prefix: RegExp) => (await pane.findAll({ type: 'Button' })).map(b => b.key ?? '').filter(k => prefix.test(k))
function prompts(on: Parameters<typeof liveState>[0]): string[] {
  const filled: string[] = []
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }) as never)
  on('prompt.fill', (_$, e) => { filled.push(e.text); return { isFilled: true } })
  return filled
}

test('opening face: with the example data, Today, Last session and Next step, with no section numbers or big counters', async ($, on) => {
  liveState(on, { snapshot: SNAP })
  fakeVault(on, {})
  const pane = await mount($)
  expect(await cardTitles(pane)).toEqual(['Oggi', 'Ultima sessione', 'Next step'])
  const titles = (await pane.findAll({ type: 'Svg' })).filter(n => String(n.props.source).includes('class="card-title"'))
  expect(titles.map(n => String(n.props.source).match(/>(▌[^<]*)<\/text>/)?.[1])).toEqual(['▌OGGI', '▌ULTIMA SESSIONE', '▌NEXT STEP'])
  // Today: the full date on the right, the Now item overdue since yesterday (in red) and the wait stalled for 21 days (in yellow).
  expect((await text(pane, /^venerdì 9 ottobre$/))?.props.color).toBe('inactive')
  expect((await pane.find({ key: 'today:Helios offerta' }))?.props.label).toBe('Helios offerta')
  expect((await text(pane, /^Helios offerta$/))?.props).toMatchObject({ bold: true, color: 'text', wrap: 'wrap' })
  expect((await text(pane, /^ieri$/))?.props.color).toBe('error')
  expect((await pane.find({ key: 'today-wait:Docs review of the guide' }))?.props.label).toBe('Docs review of the guide')
  expect((await text(pane, /^in attesa da 21g$/))?.props.color).toBe('warning')
  expect(await keysOf(pane, /^today/)).toEqual(['today:Helios offerta', 'today-wait:Docs review of the guide'])
  // The counts on one row, each a flat button; the Inbox with the oldest note, in yellow beyond 10 days.
  expect((await pane.find({ key: 'count-now' }))?.props).toMatchObject({ label: '3 in Now', plain: true, dimColor: false })
  expect((await pane.find({ key: 'count-waiting' }))?.props).toMatchObject({ label: '2 in attesa', plain: true, dimColor: false })
  expect((await pane.find({ key: 'inbox-open' }))?.props.label).toBe('5 in Inbox, la più vecchia 23g')
  expect((await text(pane, /^5 in Inbox, la più vecchia 23g$/))?.props.color).toBe('warning')
  // No "Sort ›": /ingest is a local skill of the user's vault, not of the cockpit.
  expect(await pane.find({ key: 'inbox-sort' })).toBe(undefined)
  expect(await text(pane, /^Nessuna scadenza$/)).toBe(undefined)
  // Last session: when, about what (the handoff written), the facts and the unsaved closing with Resume this.
  expect((await text(pane, /^ieri · 09:40–14:28$/))?.props.color).toBe('inactive')
  expect((await text(pane, /^jarvis-cockpit$/))?.props).toMatchObject({ bold: true, color: 'text' })
  expect((await text(pane, /^4h48 · 12 file scritti · handoff completato$/))?.props.color).toBe('inactive')
  expect((await text(pane, /^ non salvata $/))?.props.color).toBe('warning')
  expect((await text(pane, /^nel diario non c'è$/))?.props.color).toBe('inactive')
  expect((await pane.find({ key: 'last-resume' }))?.props).toMatchObject({ label: 'Riprendi questa ›', plain: true })
  expect(await pane.find({ key: 'last-diary' })).toBe(undefined)
  // Next step: the most recent handoff, the Next action in gray, the prompt preview and the buttons.
  expect((await text(pane, /^da handoff · oggi$/))?.props.color).toBe('inactive')
  expect((await text(pane, /^NOVA Chat — semplificare KB workflow$/))?.props).toMatchObject({ bold: true, color: 'text', wrap: 'wrap' })
  expect((await text(pane, /^Togliere il passo di conferma\.$/))?.props.color).toBe('inactive')
  const preview = (await pane.findAll({ type: 'Svg' })).find(n => String(n.props.source).includes('class="prompt-preview"'))
  expect(preview?.props.alt).toBe(RESUME_KB)
  expect(String(preview?.props.source)).toContain(`>${RESUME_KB}</text>`)
  expect((await pane.find({ key: 'next' }))?.props).toMatchObject({ label: 'Riprendi ›', variant: 'primary' })
  expect((await pane.find({ key: 'briefing' }))?.props).toMatchObject({ label: 'Briefing', plain: true })
  expect((await text(pane, /^Altri handoff:$/))?.props.color).toBe('inactive')
  expect((await pane.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('next-other:')).map(b => `${b.key} ${b.props.label}`))
    .toEqual(['next-other:b.md Helios bilancio', 'next-other:c.md C', 'next-other:d.md D'])
  expect(await text(pane, /^\+1$/)).toBeDefined()
  // The old layout is gone: big counters, Resume cards, Yesterday and Now, the action bar, "Back to the session".
  expect((await pane.findAll({ type: 'Svg' })).filter(n => /^\d+ in /.test(String(n.props.alt)))).toEqual([])
  expect(await keysOf(pane, /^(now:|resume|ieri-open|handoff|save|count-inbox|see-)/)).toEqual([])
})

test('opening face: each click prepares the right prompt', async ($, on) => {
  liveState(on, { snapshot: SNAP })
  fakeVault(on, {})
  const filled = prompts(on)
  const pane = await mount($)
  for (const key of ['today:Helios offerta', 'next', 'briefing', 'next-other:b.md', 'last-resume']) await pane.press({ key })
  expect(filled).toEqual([
    'Riprendiamo «Helios offerta»: mandare la bozza',
    RESUME_KB,
    '/briefing',
    '/handoff resume b',
    'Riprendiamo la sessione di ieri 09:40–14:28: «jarvis-cockpit». File scritti: hooks/recap.tsx, hooks/recapModel.ts, hooks/sessionModel.ts, hooks/register.tsx, types/index.d.ts e altri 7',
  ])
})

test('opening face: the counts and the stalled wait open the To Do tab, the Inbox line opens its folder in Files', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': '# Da fare\n', '00 - Inbox/idea.md': 'x' }, { '': [{ name: '00 - Inbox', kind: 'dir' }], '00 - Inbox': [{ name: 'idea.md', kind: 'file' }] })
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  for (const key of ['count-now', 'count-waiting', 'today-wait:Docs review of the guide']) {
    state.values.tab = 'recap'
    await pane.redraw()
    await pane.press({ key })
    await state.until('tab', t => t === 'todo')
  }
  state.values.tab = 'recap'
  await pane.redraw()
  await pane.press({ key: 'inbox-open' })
  await state.until('tab', t => t === 'files')
  const tree = state.values.tree as { cursor: string; expanded: string[] }
  expect(tree.cursor).toBe('00 - Inbox')
  expect(tree.expanded).toContain('00 - Inbox')
})

test('today: no due items, zero counts in gray, an empty Inbox or none declared, the section named as the user wrote it', async ($, on) => {
  const calm: Snapshot = { ...SNAP, nowDue: [null, null, null], waiting: 0, waitingItems: [{ title: 'Registry v2', ageDays: 3 }], inbox: { count: 0, oldestDays: null } }
  const state = liveState(on, { snapshot: calm })
  fakeVault(on, {})
  const pane = await mount($)
  expect((await text(pane, /^Nessuna scadenza$/))?.props.color).toBe('inactive')
  expect(await keysOf(pane, /^today/)).toEqual([])
  expect((await pane.find({ key: 'count-waiting' }))?.props).toMatchObject({ label: '0 in attesa', dimColor: true })
  expect(await pane.find({ key: 'inbox-open' })).toBe(undefined)
  state.values.snapshot = { ...calm, inbox: null }
  await pane.redraw()
  expect(await pane.find({ key: 'inbox-open' })).toBe(undefined)
  // Within 10 days the Inbox row is gray; with no known age, no "oldest" part.
  state.values.snapshot = { ...calm, inbox: { count: 1, oldestDays: 3 } }
  await pane.redraw()
  expect((await text(pane, /^1 in Inbox, la più vecchia 3g$/))?.props.color).toBe('inactive')
  state.values.snapshot = { ...calm, inbox: { count: 2, oldestDays: null } }
  await pane.redraw()
  expect(await text(pane, /^2 in Inbox$/)).toBeDefined()
  // Empty Now: the count stays, at zero and gray; the Active section of Jarvis Lite under its own name.
  state.values.snapshot = { ...calm, now: [], nowTitles: [], nowDetails: [], nowDue: [] }
  await pane.redraw()
  expect((await pane.find({ key: 'count-now' }))?.props).toMatchObject({ label: '0 in Now', dimColor: true })
  state.values.snapshot = { ...calm, nowLabel: 'Active' }
  await pane.redraw()
  expect((await pane.find({ key: 'count-now' }))?.props.label).toBe('3 in Active')
  // A missing Now section is flagged in place of its count.
  state.values.snapshot = { ...calm, now: null, nowTitles: undefined, nowDetails: undefined, nowDue: [] }
  await pane.redraw()
  expect((await text(pane, /^sezione Now \(o Active\) non trovata$/))?.props.color).toBe('inactive')
  expect(await pane.find({ key: 'count-now' })).toBe(undefined)
  expect(await pane.find({ key: 'count-waiting' })).toBeDefined()
})

test('last session, saved: the diary closing and Diary ›; the earlier session of the same day on one row', async ($, on) => {
  const note8: DiaryDay = { day: '2026-10-08', path: '01 - Diary/2026/10/2026-10-08.md', parts: [{ part: 'focus', lines: [{ lead: '', rest: 'Cockpit' }], more: 0 }, { part: 'closing', lines: [{ lead: '', rest: 'Cockpit 0.6 chiuso' }], more: 0 }] }
  const saved: SessionRecord = { ...REC, diaryDay: '2026-10-08', diaryAt: day(8, 14, 20) }
  const before: SessionRecord = { ...REC, id: 'early', startAt: day(8, 8, 10), lastAt: day(8, 9, 0), prompts: 2, firstPrompt: '/briefing', files: [], fileCount: 0, handoff: null }
  const state = liveState(on, { snapshot: { ...SNAP, lastDiary: note8, diaryDays: [note8], sessions: [saved, before] } })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, '01 - Diary/2026/10/2026-10-08.md': '## Focus\n- Cockpit\n' }, {
    '01 - Diary': [{ name: '2026', kind: 'dir' }], '01 - Diary/2026': [{ name: '10', kind: 'dir' }],
    '01 - Diary/2026/10': [{ name: '2026-10-08.md', kind: 'file' }],
  })
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  expect((await text(pane, /^✓$/))?.props.color).toBe('success')
  expect((await text(pane, /^Cockpit 0\.6 chiuso$/))?.props.color).toBe('text')
  expect(await text(pane, /^ non salvata $|^nel diario/)).toBe(undefined)
  expect(await pane.find({ key: 'last-resume' })).toBe(undefined)
  expect((await text(pane, /^Prima, stesso giorno: \/briefing · non salvata$/))?.props.color).toBe('inactive')
  expect((await pane.find({ key: 'last-diary' }))?.props).toMatchObject({ label: 'Diario ›', plain: true })
  await pane.press({ key: 'last-diary' })
  await state.until('tab', t => t === 'diary')
  expect(state.values.diary).toMatchObject({ day: '2026-10-08', text: '## Focus\n- Cockpit\n' })
  // The earlier session is saved too; a note without a Closing state gives the first Focus item.
  state.values.tab = 'recap'
  const note8b: DiaryDay = { ...note8, parts: [note8.parts[0]!] }
  state.values.snapshot = { ...SNAP, lastDiary: note8b, diaryDays: [note8b], sessions: [saved, { ...before, diaryDay: '2026-10-08', diaryAt: day(8, 9, 0) }] }
  await pane.redraw()
  expect(await text(pane, /^Cockpit$/)).toBeDefined()
  expect(await text(pane, /^Prima, stesso giorno: \/briefing · ✓ Cockpit$/)).toBeDefined()
  // With no files written, not saved: no Resume this; just the duration in the facts.
  state.values.snapshot = { ...SNAP, lastDiary: null, sessions: [{ ...before, firstPrompt: 'prova veloce' }] }
  await pane.redraw()
  expect(await text(pane, /^ieri · 08:10–09:00$/)).toBeDefined()
  expect(await text(pane, /^50m$/)).toBeDefined()
  expect(await text(pane, /^ non salvata $/)).toBeDefined()
  expect(await pane.find({ key: 'last-resume' })).toBe(undefined)
  expect(await text(pane, /^Prima, stesso giorno/)).toBe(undefined)
})

test('last session from the diary: no session records, or a more recent note; with neither, no section', async ($, on) => {
  const state = liveState(on, { snapshot: { ...SNAP, sessions: [] } })
  fakeVault(on, {})
  const pane = await mount($)
  expect((await text(pane, /^mer 7 · dal diario$/))?.props.color).toBe('inactive')
  expect((await text(pane, /^Jarvis Cockpit — robottino$/))?.props).toMatchObject({ bold: true, color: 'text' })
  expect((await text(pane, /^✓$/))?.props.color).toBe('success')
  expect(await text(pane, /^Gate 0\.6 passato$/)).toBeDefined()
  expect(await text(pane, /NOVA roadmap/)).toBe(undefined)
  expect(await pane.find({ key: 'last-diary' })).toBeDefined()
  // Today's note, written by a session the records do not have, is more recent than yesterday's record.
  const today: DiaryDay = { day: '2026-10-09', path: '01 - Diary/2026/10/2026-10-09.md', parts: [{ part: 'focus', lines: [{ lead: '', rest: 'Helios' }], more: 0 }] }
  state.values.snapshot = { ...SNAP, lastDiary: today }
  await pane.redraw()
  expect(await text(pane, /^oggi · dal diario$/)).toBeDefined()
  expect(await text(pane, /^Helios$/)).toBeDefined()
  expect(await text(pane, /^✓$/)).toBe(undefined)
  expect(await pane.find({ key: 'last-diary' })).toBeDefined()
  state.values.snapshot = { ...SNAP, lastDiary: null, sessions: [] }
  await pane.redraw()
  expect(await cardTitles(pane)).toEqual(['Oggi', 'Next step'])
})

test('next step: the overdue Now item, then the first Now item, then nothing planned with Briefing', async ($, on) => {
  const state = liveState(on, { snapshot: { ...SNAP, handoffs: [] } })
  fakeVault(on, {})
  const filled = prompts(on)
  const pane = await mount($)
  expect((await text(pane, /^da Now · scaduta ieri$/))?.props.color).toBe('error')
  // The item title; the detail with links as text.
  expect((await pane.findAll({ type: 'Text', text: /^Helios offerta$/ })).length).toBe(2)
  expect(await text(pane, /^mandare la bozza$/)).toBeDefined()
  expect(await text(pane, /^Altri handoff:$/)).toBe(undefined)
  await pane.press({ key: 'next' })
  expect(filled).toEqual(['Riprendiamo «Helios offerta»: mandare la bozza'])
  // A long detail is cut with … after two rows of the pane.
  state.values.snapshot = { ...SNAP, handoffs: [], nowDue: [null, null, null], nowDetails: ['parola '.repeat(40).trim(), '', ''] }
  await pane.redraw()
  expect((await text(pane, /^da Now$/))?.props.color).toBe('inactive')
  expect(await text(pane, /^NOVA 4\.0 — PRD$/)).toBeDefined()
  const detail = String((await text(pane, /^parola parola/))?.text)
  expect(detail.endsWith('…')).toBe(true)
  expect([...detail].length).toBe(2 * (46 - 4))
  state.values.snapshot = { ...SNAP, handoffs: [], now: [], nowTitles: [], nowDetails: [], nowDue: [] }
  await pane.redraw()
  expect((await text(pane, /^Niente in programma\. Scrivi a Jarvis su cosa vuoi lavorare\.$/))?.props.color).toBe('inactive')
  expect(await pane.find({ key: 'next' })).toBe(undefined)
  expect(await pane.find({ key: 'briefing' })).toBeDefined()
  expect((await pane.findAll({ type: 'Svg' })).some(n => String(n.props.source).includes('class="prompt-preview"'))).toBe(false)
})

test('overview: from the session face to the opening face and back; with no prompt there is no way back', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP, prompts: [PROMPT], recapView: 'auto', feed: [{ at: AT - 30_000, verb: 'edit', path: 'a.md', isProtected: false, isApprox: false, count: 1, turn: 2 } satisfies Activity] })
  fakeVault(on, {})
  const pane = await mount($)
  expect(await cardTitles(pane)).not.toContain('Ultima sessione')
  expect((await pane.find({ key: 'see-open' }))?.props).toMatchObject({ label: 'Vedi apertura', plain: true })
  await pane.press({ key: 'see-open' })
  await state.until('recapView', x => x === 'open')
  await pane.redraw()
  expect(await cardTitles(pane)).toEqual(['Oggi', 'Ultima sessione', 'Next step'])
  expect(await pane.find({ key: 'see-open' })).toBe(undefined)
  expect((await pane.find({ key: 'see-work' }))?.props).toMatchObject({ label: 'Torna alla sessione', plain: true })
  state.clock.advance(1000)
  await pane.press({ key: 'see-work' })
  await state.until('recapView', x => x === 'auto')
  await pane.redraw()
  expect(await cardTitles(pane)).not.toContain('Ultima sessione')
  // With no prompt the opening is the only face: nothing to go back from, even with recapView left on 'open'.
  state.values.prompts = []
  state.values.recapView = 'open'
  await pane.redraw()
  expect(await cardTitles(pane)).toEqual(['Oggi', 'Ultima sessione', 'Next step'])
  expect(await keysOf(pane, /^see-/)).toEqual([])
})

test('opening face: incoming activities do not change the button keys', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP, prompts: [PROMPT], recapView: 'open', working: true })
  const pane = await mount($)
  const before = await keysOf(pane, /./)
  state.values.feed = [{ at: AT, verb: 'edit', path: 'b.md', isProtected: false, isApprox: false, count: 1, turn: 2 } satisfies Activity]
  state.values.written = { 'b.md': AT }
  state.values.ends = [{ at: AT, reason: 'answer', files: 1, turn: 2 }]
  await pane.redraw()
  expect(await keysOf(pane, /./)).toEqual(before)
})

// The keys of Today and of the other handoffs come from file texts: with a control character the engine rejects the
// drawing, and two texts that differ by that character must not get the same key.
test('opening face: Today and other handoffs with control characters give keys with no control characters, and each key prepares the prompt of its own row', async ($, on) => {
  const titles = ['Sale\x1b su', 'Sale\x1b su', 'Sale\x07 su', 'Altra']
  const snapshot: Snapshot = {
    ...SNAP, now: titles.map(t => `- ${t}`), nowTitles: titles, nowDetails: ['uno', 'due', 'tre', ''], nowDue: ['2026-10-09', '2026-10-09', '2026-10-09', null],
    waitingItems: [{ title: 'Ferma\x1b', ageDays: 21 }, { title: 'Ferma\x1b', ageDays: 20 }],
    handoffs: [SNAP.handoffs[0]!, { file: 'h\x1bx.md', topic: 'Strano\x1b', ageDays: 9 }, { file: 'h\x07x.md', topic: 'Altro', ageDays: 10 }],
  }
  liveState(on, { snapshot })
  fakeVault(on, {})
  const filled = prompts(on)
  const pane = await mount($)
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect(await keysOf(pane, /^(today|next-other)/)).toEqual([
    'today:Sale\\u001b su', 'today:Sale\\u001b su\\n2', 'today:Sale\\u0007 su',
    'today-wait:Ferma\\u001b', 'today-wait:Ferma\\u001b\\n2',
    'next-other:h\\u001bx.md', 'next-other:h\\u0007x.md',
  ])
  expect(await keysOf(pane, /[\u0000-\u001f\u007f-\u009f]/)).toEqual([])
  expect((await pane.findAll({ type: 'Button' })).some(b => b.props.label === 'Sale� su')).toBe(true)
  await pane.press({ key: 'today:Sale\\u001b su\\n2' })
  await pane.press({ key: `next-other:${keyText('h\x07x.md')}` })
  expect(filled).toEqual(['Riprendiamo «Sale\uFFFD su»: due', '/handoff resume h\x07x'])
})

test('opening face: control characters in the prompt preview, a missing source and the section name still draw', async ($, on) => {
  liveState(on, { snapshot: { ...SNAP, missing: ['In\x1bbox'], nowLabel: 'Ac\x1btive', handoffs: [], nowTitles: ['NOVA\x1b PRD', 'Helios offerta', 'Lumina'], nowDue: [null, null, null] } })
  fakeVault(on, {})
  const pane = await mount($)
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect(await cardTitles(pane)).toEqual(['Fonti', 'Oggi', 'Ultima sessione', 'Next step'])
  expect(await text(pane, /^✕ In�box dichiarata ma assente$/)).toBeDefined()
  expect((await pane.find({ key: 'count-now' }))?.props.label).toBe('3 in Ac�tive')
  const preview = (await pane.findAll({ type: 'Svg' })).find(n => String(n.props.source).includes('class="prompt-preview"'))
  expect(String(preview?.props.alt)).toBe('Riprendiamo «NOVA� PRD»: chiudere il branding')
  expect(String(preview?.props.source)).not.toMatch(/[\u0000-\u0008\u000b-\u001f]/)
})

test('pane: outside the desktop app, even with a live session, the pane shows only the one-line desktop-only message', async ($, on) => {
  liveState(on, { snapshot: SNAP, prompts: [PROMPT], session: { ...REC, id: 'now' } })
  fakeVault(on, {})
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: paneProps() })
  expect(await pane.find({ text: /Il cockpit è disegnato per l'app desktop/ })).toBeDefined()
})

// The Opening face in English: a vault with the English capability table. The texts come from the catalog.
const CLAUDE_MD_EN = '## Capabilities\n\n| Capability | Authoritative source |\n|---|---|\n| Future work | `To Do.md` |\n| Inbox | `00 - Inbox` |\n| Daily history | `01 - Diary` |\n| Handoff | `99 - Jarvis/handoffs` |\n'
const exact = (s: string): RegExp => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
const EARLIER: SessionRecord = { ...REC, id: 'earlier', startAt: day(8, 8, 0), lastAt: day(8, 9, 0), prompts: 2, firstPrompt: 'prima cosa', files: [], fileCount: 0, handoff: null }

test('Opening in English: the titles, the rows, the buttons and the prompts come from the catalog', async ($, on) => {
  const t = strings('en')
  liveState(on, { snapshot: { ...SNAP, sessions: [REC, EARLIER] } })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN })
  const filled = prompts(on)
  const pane = await mount($)
  expect(await cardTitles(pane)).toEqual([t.recap.today.title, t.recap.last.title, t.recap.next.title])
  expect(await cardTitles(pane)).toEqual(['Today', 'Last session', 'Next step'])
  // Today: the full date, the item due yesterday, the wait that is too old, the counts and the Inbox.
  expect((await text(pane, /^Friday 9 October$/))?.props.color).toBe('inactive')
  expect((await text(pane, exact(t.dates.yesterday)))?.props.color).toBe('error')
  expect((await text(pane, exact(t.recap.today.waitingSince('21d'))))?.props.color).toBe('warning')
  expect(t.recap.today.waitingSince('21d')).toBe('waiting for 21d')
  expect((await pane.find({ key: 'count-now' }))?.props.label).toBe(t.recap.today.inNow(3, 'Now'))
  expect((await pane.find({ key: 'count-waiting' }))?.props.label).toBe('2 waiting')
  expect((await pane.find({ key: 'inbox-open' }))?.props.label).toBe('5 in Inbox, oldest 23d')
  expect(await text(pane, exact(t.recap.today.none))).toBe(undefined)
  // Last session: when, the facts, the closing, the button and the session before on the same day.
  expect(await text(pane, /^yesterday · 09:40–14:28$/)).toBeDefined()
  expect(await text(pane, /^4h48 · 12 files written · handoff completed$/)).toBeDefined()
  expect((await text(pane, exact(` ${t.recap.last.unsaved} `)))?.props.color).toBe('warning')
  expect(await text(pane, exact(t.recap.last.notInDiary))).toBeDefined()
  expect((await pane.find({ key: 'last-resume' }))?.props.label).toBe(t.recap.last.resumeThis)
  expect(await text(pane, exact(t.recap.last.before('prima cosa', t.recap.last.unsaved)))).toBeDefined()
  expect(t.recap.last.before('prima cosa', 'not saved')).toBe('Earlier that day: prima cosa · not saved')
  // Next step: the source, the buttons and the other handoffs.
  expect(await text(pane, /^from handoff · today$/)).toBeDefined()
  expect((await pane.find({ key: 'next' }))?.props).toMatchObject({ label: t.recap.next.resume, variant: 'primary' })
  expect(t.recap.next.resume).toBe('Resume ›')
  expect((await pane.find({ key: 'briefing' }))?.props.label).toBe(t.recap.next.briefing)
  expect(await text(pane, exact(t.recap.next.others))).toBeDefined()
  // The clicks prepare the prompts of the catalog; the slash commands stay as they are.
  for (const key of ['today:Helios offerta', 'next', 'briefing', 'last-resume']) await pane.press({ key })
  expect(filled).toEqual([
    `Let's resume "Helios offerta": mandare la bozza`,
    `/handoff resume ${SNAP.handoffs[0]!.file.replace(/\.md$/, '')}`,
    '/briefing',
    `Let's resume the session from yesterday 09:40–14:28: "jarvis-cockpit". Files written: hooks/recap.tsx, hooks/recapModel.ts, hooks/sessionModel.ts, hooks/register.tsx, types/index.d.ts and 7 more`,
  ])
})

test('Opening in English: the empty states, the diary-only last session and the way back to the session', async ($, on) => {
  const t = strings('en')
  const calm: Snapshot = { ...SNAP, now: null, nowTitles: undefined, nowDetails: undefined, nowDue: [], waiting: 0, waitingItems: [], handoffs: [], inbox: null, sessions: [] }
  const state = liveState(on, { snapshot: calm })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN })
  const pane = await mount($)
  expect(await text(pane, exact(t.recap.today.none))).toBeDefined()
  expect(await text(pane, exact(t.recap.today.noNow))).toBeDefined()
  expect(t.recap.today.noNow).toBe('Now (or Active) section not found')
  expect((await pane.find({ key: 'count-waiting' }))?.props.label).toBe(t.recap.today.waiting(0))
  // The last session from the diary note: the day, where it comes from and the Diary button.
  expect(await text(pane, exact(`Wed 7 · ${t.recap.last.fromDiary}`))).toBeDefined()
  expect((await pane.find({ key: 'last-diary' }))?.props.label).toBe(t.recap.last.diaryButton)
  expect(t.recap.last.diaryButton).toBe('Diary ›')
  // Nothing planned: it says so and keeps Briefing.
  expect(await text(pane, exact(t.recap.next.nothing))).toBeDefined()
  expect(t.recap.next.nothing).toBe('Nothing planned. Tell Jarvis what you want to work on.')
  expect((await pane.find({ key: 'briefing' }))?.props.label).toBe('Briefing')
  // From the session face, the way back says so in English.
  state.values.prompts = [PROMPT]
  state.values.recapView = 'open'
  await pane.redraw()
  expect((await pane.find({ key: 'see-work' }))?.props.label).toBe(t.recap.next.backToWork)
})
