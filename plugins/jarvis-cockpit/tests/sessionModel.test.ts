import { test, expect } from 'claude-code/testing'
import type { Activity, DiaryDay, Handoff, SessionRecord, Snapshot } from '../types'
import {
  KEEP_SESSIONS, RECORD_FILES, addSubagent, asRecord, closeRecord, closingOf, diaryDayOf, diaryDaysOf, endRecordTurn, lastSession,
  liveFacts, noteRecordWrites, nowPrompt, nowResume, onPromptRecord, pastSessions, pickNext, promptLine, resumeOf, savedAt,
  sessionFacts, sessionResume, sessionWhen, staleKeys, topicOf,
} from '../hooks/sessionModel'
import { strings } from '../hooks/i18n'
import { handoffName } from './ports'

// Thursday 15 October 2026, 10:00: the worked example of the Last session section.
const T = strings('it')
const HO_COCKPIT = `99 - Jarvis/handoffs/${handoffName('2026-10-15', 'cockpit')}`
export const NOW = new Date(2026, 9, 15, 10).getTime()
const at = (d: number, hr: number, m = 0): number => new Date(2026, 9, d, hr, m).getTime()

export function rec(over: Partial<SessionRecord> = {}): SessionRecord {
  return {
    v: 1, id: 's1', startAt: at(14, 9, 40), lastAt: at(14, 14, 28), endAt: null, prompts: 9, firstPrompt: 'lavoriamo sul cockpit',
    resumeOf: null, files: [], fileCount: 0, handoff: null, diaryDay: null, diaryAt: null, subagents: 0, errors: 0, ...over,
  }
}

const act = (verb: Activity['verb'], path: string, over: Partial<Activity> = {}): Activity =>
  ({ at: 1, verb, path, isProtected: false, isApprox: false, count: 1, turn: 1, ...over })

const ROLES = { Handoff: '99 - Jarvis/handoffs', 'Daily history': '01 - Diary' }

const note = (day: string, md: Partial<Record<'focus' | 'closing', string>>): DiaryDay => ({
  day,
  path: `01 - Diary/${day.slice(0, 4)}/${day.slice(5, 7)}/${day}.md`,
  parts: Object.entries(md).map(([part, rest]) => ({ part: part as 'focus' | 'closing', lines: [{ lead: '', rest }], more: 0 })),
})

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  takenAt: NOW, hasTable: true, missing: [], now: [], nowDue: [], waiting: 0, waitingItems: [], handoffs: [], inbox: null, diary: null, ...over,
})

const ho = (file: string, topic: string, ageDays: number, over: Partial<Handoff> = {}): Handoff => ({ file, topic, ageDays, ...over })

test('promptLine and resumeOf: the prompt on one line and cut; the topic of a cockpit resume text', () => {
  expect(promptLine('  ciao\n\tmondo   bello  ')).toBe('ciao mondo bello')
  expect(promptLine('x'.repeat(200))).toHaveLength(160)
  const name = handoffName('2026-10-14', 'nova-kb', { md: false })
  expect(resumeOf(`/handoff resume ${name}`)).toBe(name)
  expect(resumeOf('Riprendiamo «NOVA Chat — KB»: semplificare il workflow')).toBe('NOVA Chat — KB')
  expect(resumeOf('Riprendiamo la sessione di ieri 09:40–14:28: «jarvis-cockpit». File scritti: a.md')).toBe('jarvis-cockpit')
  expect(resumeOf('riprendiamo il discorso')).toBe(null)
  expect(resumeOf('/briefing')).toBe(null)
})

test('record: the first prompt creates it, later prompts count; a new id (after /clear) creates another', () => {
  const first = onPromptRecord(null, 's1', at(15, 9, 40), '/handoff resume handoff-x\n')
  expect(first).toEqual({
    v: 1, id: 's1', startAt: at(15, 9, 40), lastAt: at(15, 9, 40), endAt: null, prompts: 1, firstPrompt: '/handoff resume handoff-x',
    resumeOf: 'handoff-x', files: [], fileCount: 0, handoff: null, diaryDay: null, diaryAt: null, subagents: 0, errors: 0,
  })
  const second = onPromptRecord(first, 's1', at(15, 10), 'altro')
  expect(second).toEqual({ ...first, prompts: 2 })
  expect(onPromptRecord(second, 's2', at(15, 11), 'nuova').startAt).toBe(at(15, 11))
  expect(addSubagent(second).subagents).toBe(1)
  expect(closeRecord(second, at(15, 12)).endAt).toBe(at(15, 12))
})

test('record: a prompt with the same id on a record closed by session.end counts it and reopens it', () => {
  const closed = rec({ id: 's1', prompts: 4, endAt: at(15, 9) })
  expect(onPromptRecord(closed, 's1', at(15, 10), 'ancora')).toEqual({ ...closed, prompts: 5, endAt: null })
})

test('record: a handoff in the Handoff folder and today\'s diary note; deletions and nested folders do not count', () => {
  const r = rec()
  const w = noteRecordWrites(r, [
    act('create', HO_COCKPIT),
    act('edit', '01 - Diary/2026/10/2026-10-15.md'),
  ], at(15, 10, 5), ROLES)
  expect(w.handoff).toEqual({ file: HO_COCKPIT, topic: '', status: '' })
  expect([w.diaryDay, w.diaryAt]).toEqual(['2026-10-15', at(15, 10, 5)])
  // The same handoff written again keeps the topic and status read at turn end.
  const known = { ...w, handoff: { file: HO_COCKPIT, topic: 'Cockpit', status: 'active' } }
  expect(noteRecordWrites(known, [act('edit', HO_COCKPIT)], at(15, 11), ROLES).handoff?.topic).toBe('Cockpit')
  // Nothing to mark: the same object.
  const skip = [
    act('delete', '99 - Jarvis/handoffs/h.md'),
    act('edit', '99 - Jarvis/handoffs/old/h.md'),
    act('edit', '99 - Jarvis/handoffs/h.txt'),
    act('edit', '01 - Diary/2026/10/note.md'),
    act('edit', '01 - Diary/2026-10-15.md'),
    act('edit', '01 - Diary/2026/09/2026-10-15.md'),
    act('read', '01 - Diary/2026/10/2026-10-15.md'),
  ]
  expect(noteRecordWrites(r, skip, at(15, 10), ROLES)).toBe(r)
  expect(noteRecordWrites(r, [act('edit', '01 - Diary/2026/10/2026-10-15.md')], at(15, 10), {})).toBe(r)
  // The same note at the same time, the same handoff: already marked.
  expect(noteRecordWrites(w, [act('edit', '01 - Diary/2026/10/2026-10-15.md'), act('edit', HO_COCKPIT)], at(15, 10, 5), ROLES)).toBe(w)
  expect(diaryDayOf('01 - Diary/2026/10/2026-10-15.md', '01 - Diary')).toBe('2026-10-15')
  expect(diaryDayOf('01 - Diaryx/2026/10/2026-10-15.md', '01 - Diary')).toBe(null)
})

test('record at turn end: last activity, files newest first (at most 20) and how many in all, handoff topic and status, errors', () => {
  const written = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`f${i}.md`, 1000 + i]))
  const r = rec({ handoff: { file: 'H/h.md', topic: '', status: '' } })
  const done = endRecordTurn(r, at(15, 11), written, 'answer', { topic: 'Cockpit 0.7', status: 'completed' })
  expect(done.lastAt).toBe(at(15, 11))
  expect(done.files).toHaveLength(RECORD_FILES)
  expect(done.files[0]).toBe('f24.md')
  expect(done.fileCount).toBe(25)
  expect(done.handoff).toEqual({ file: 'H/h.md', topic: 'Cockpit 0.7', status: 'completed' })
  expect(done.errors).toBe(0)
  expect(endRecordTurn(r, 1, {}, 'aborted', null)).toMatchObject({ errors: 0, handoff: { topic: '' } })
  expect(endRecordTurn(r, 1, {}, 'error', null).errors).toBe(1)
  expect(endRecordTurn(rec(), 1, {}, 'answer', { topic: 'x', status: 'active' }).handoff).toBe(null)
})

test('store: a valid record is read (missing fields normalized), anything else is not', () => {
  const r = rec({ files: ['a.md'], fileCount: 1 })
  expect(asRecord(JSON.parse(JSON.stringify(r)))).toEqual(r)
  expect(asRecord({ v: 1, id: 'x', startAt: 1, lastAt: 2, prompts: 1, files: ['a', 3] })).toEqual({
    v: 1, id: 'x', startAt: 1, lastAt: 2, endAt: null, prompts: 1, firstPrompt: '', resumeOf: null, files: ['a'], fileCount: 1,
    handoff: null, diaryDay: null, diaryAt: null, subagents: 0, errors: 0,
  })
  expect(asRecord({ ...r, diaryDay: '15/10' })?.diaryDay).toBe(null)
  expect(asRecord({ ...r, handoff: { topic: 'senza file' } })?.handoff).toBe(null)
  for (const bad of [null, 'x', 3, [], { ...r, v: 2 }, { ...r, id: 5 }, { ...r, lastAt: 'ieri' }, { ...r, startAt: Number.NaN }, { ...r, files: 'a' }]) {
    expect(asRecord(bad)).toBe(null)
  }
})

test('cleanup: the 30 sessions with the highest lastAt stay, an unreadable value and the oldest go, other keys are left alone', () => {
  const entries = [
    { key: 'tab', value: 'recap' },
    { key: 'expanded', value: ['a'] },
    ...Array.from({ length: 31 }, (_, i) => ({ key: `session:${i}`, value: rec({ id: `${i}`, lastAt: 1000 + i }) })),
    { key: 'session:rotta', value: 'x' },
  ]
  expect(KEEP_SESSIONS).toBe(30)
  expect(staleKeys(entries)).toEqual(['session:0', 'session:rotta'])
  expect(staleKeys(entries, 29)).toEqual(['session:1', 'session:0', 'session:rotta'])
  expect(staleKeys(entries.slice(0, 10))).toEqual([])
})

test('past sessions: without the current one or ones with no prompt, newest first, at most two; the diary days in order', () => {
  const list = [rec({ id: 'a', lastAt: 5 }), rec({ id: 'cur', lastAt: 9 }), rec({ id: 'b', lastAt: 7, diaryDay: '2026-10-14' }), rec({ id: 'zero', lastAt: 8, prompts: 0 }), rec({ id: 'c', lastAt: 1, diaryDay: '2026-10-14' })]
  expect(pastSessions(list, 'cur').map(r => r.id)).toEqual(['b', 'a'])
  expect(pastSessions(list, 'cur', 5).map(r => r.id)).toEqual(['b', 'a', 'c'])
  expect(diaryDaysOf([rec({ diaryDay: '2026-10-14' }), rec(), rec({ diaryDay: '2026-10-14' }), rec({ diaryDay: '2026-10-12' })])).toEqual(['2026-10-14', '2026-10-12'])
})

test('topicOf: the handoff topic, then the resumed handoff (with its topic), then the first prompt cut at 80, then untitled', () => {
  const hos = [ho('handoff-nova-kb.md', 'NOVA Chat — semplificare KB workflow', 3)]
  expect(topicOf(rec({ handoff: { file: 'H/h.md', topic: 'Cockpit', status: 'active' }, resumeOf: 'handoff-nova-kb' }), T, hos)).toBe('Cockpit')
  expect(topicOf(rec({ handoff: { file: 'H/h.md', topic: '', status: '' }, resumeOf: 'handoff-nova-kb' }), T, hos)).toBe('NOVA Chat — semplificare KB workflow')
  expect(topicOf(rec({ resumeOf: 'handoff-chiuso' }), T, hos)).toBe('handoff-chiuso')
  expect(topicOf(rec({ firstPrompt: 'x'.repeat(100) }), T)).toBe(`${'x'.repeat(79)}…`)
  expect(topicOf(rec({ firstPrompt: '' }), T)).toBe('sessione senza titolo')
})

test('when and facts: relative day with the times (end = endAt, else lastAt), duration, files and handoff state', () => {
  expect(sessionWhen(rec(), NOW, T)).toBe('ieri · 09:40–14:28')
  expect(sessionWhen(rec({ startAt: at(12, 9, 40), endAt: at(12, 15) }), NOW, T)).toBe('lun 12 · 09:40–15:00')
  expect(sessionWhen(rec({ startAt: at(15, 8, 10), lastAt: at(15, 9, 30) }), NOW, T)).toBe('oggi · 08:10–09:30')
  expect(sessionFacts(rec({ fileCount: 12, handoff: { file: 'h', topic: 't', status: 'completed' } }), T)).toBe('4h48 · 12 file scritti · handoff completato')
  expect(sessionFacts(rec({ fileCount: 1, handoff: { file: 'h', topic: 't', status: 'active' } }), T)).toBe('4h48 · 1 file scritto · handoff aperto')
  expect(sessionFacts(rec({ handoff: { file: 'h', topic: 't', status: 'superseded' } }), T)).toBe('4h48 · handoff sostituito')
  expect(sessionFacts(rec({ lastAt: at(14, 9, 43) }), T)).toBe('3m')
  expect(liveFacts(3, 2, 1, 0, T)).toEqual({ text: '3 turni · 2 file scritti · 1 subagent', errors: null })
  expect(liveFacts(1, 0, 0, 2, T)).toEqual({ text: '1 turno', errors: '2 errori' })
  expect(liveFacts(2, 1, 3, 1, T)).toEqual({ text: '2 turni · 1 file scritto · 3 subagent', errors: '1 errore' })
})

test('closing: the first Closing state item of the saved note, else of the Focus, else "saved in the diary"; or not saved', () => {
  const notes = [note('2026-10-14', { focus: 'cockpit', closing: 'spec 0.7 scritta' }), note('2026-10-13', { focus: 'NOVA' })]
  expect(closingOf(rec({ diaryDay: '2026-10-14' }), notes, T)).toEqual({ isSaved: true, day: '2026-10-14', line: 'spec 0.7 scritta' })
  expect(closingOf(rec({ diaryDay: '2026-10-13' }), notes, T)).toEqual({ isSaved: true, day: '2026-10-13', line: 'NOVA' })
  expect(closingOf(rec({ diaryDay: '2026-10-10' }), notes, T)).toEqual({ isSaved: true, day: '2026-10-10', line: 'salvata nel diario' })
  expect(closingOf(rec(), notes, T)).toEqual({ isSaved: false })
  expect(savedAt(rec({ diaryDay: '2026-10-15', diaryAt: at(15, 9, 58) }), NOW)).toBe(at(15, 9, 58))
  expect(savedAt(rec({ diaryDay: '2026-10-14', diaryAt: at(14, 18) }), NOW)).toBe(null)
  expect(savedAt(null, NOW)).toBe(null)
})

test('last session: from the records without the current one, plus the earlier session of that day; the diary if it is newer or there are no records', () => {
  const last = rec({ id: 'a', diaryDay: '2026-10-14' })
  const before = rec({ id: 'b', startAt: at(14, 8), lastAt: at(14, 9) })
  const old = rec({ id: 'c', startAt: at(12, 8), lastAt: at(12, 9) })
  const notes = [note('2026-10-14', { closing: 'chiusa' })]
  expect(lastSession(snap({ sessions: [last, before], diaryDays: notes, lastDiary: notes[0] }), null, T)).toEqual({
    kind: 'record', rec: last, closing: { isSaved: true, day: '2026-10-14', line: 'chiusa' }, before: { rec: before, closing: { isSaved: false } },
  })
  expect(lastSession(snap({ sessions: [last, old] }), null, T)).toMatchObject({ kind: 'record', before: null })
  // The current one does not count (the snapshot from before its first prompt could have it).
  expect(lastSession(snap({ sessions: [rec({ id: 'cur' }), last] }), rec({ id: 'cur' }), T)).toMatchObject({ kind: 'record', rec: { id: 'a' } })
  // A note from a day more recent than the record's last activity: the diary-only view.
  const today = note('2026-10-15', { focus: 'NOVA' })
  expect(lastSession(snap({ sessions: [last], lastDiary: today }), null, T)).toEqual({ kind: 'diary', note: today })
  expect(lastSession(snap({ lastDiary: today }), null, T)).toEqual({ kind: 'diary', note: today })
  // ...but not the note this session wrote.
  expect(lastSession(snap({ sessions: [last], lastDiary: today }), rec({ id: 'cur', diaryDay: '2026-10-15' }), T)).toMatchObject({ kind: 'record' })
  expect(lastSession(snap({ lastDiary: today }), rec({ id: 'cur', diaryDay: '2026-10-15' }), T)).toBe(null)
  expect(lastSession(snap(), null, T)).toBe(null)
})

test('next step: the most recent handoff, then the longest-overdue Now item, then the first Now item, then nothing', () => {
  const now = {
    now: ['**A** — prima', '**B 13/10** — scaduta', '**C 12/10** — piu vecchia', '**D 15/10** — oggi'],
    nowTitles: ['A', 'B 13/10', 'C 12/10', 'D 15/10'],
    nowDetails: ['prima', 'scaduta', 'piu vecchia', 'oggi'],
    nowDue: [null, '2026-10-13', '2026-10-12', '2026-10-15'],
  }
  const hos = [ho('handoff-nova-kb.md', 'NOVA Chat — semplificare KB workflow', 3, { next: 'Togliere il passo di revisione', state: 'fermo' }), ho('b.md', 'B', 20), ho('c.md', 'C', 1), ho('d.md', 'D', 2), ho('e.md', 'E', 4)]
  expect(pickNext(snap({ ...now, handoffs: hos }), NOW, T)).toEqual({
    title: 'NOVA Chat — semplificare KB workflow', detail: 'Togliere il passo di revisione', prompt: '/handoff resume handoff-nova-kb',
    source: 'da handoff · 3g', sourceColor: 'inactive', others: hos.slice(1, 4), more: 1,
  })
  expect(pickNext(snap({ handoffs: [ho('h.md', 'H', 14, { state: 'fermo' })] }), NOW, T)).toMatchObject({ detail: 'fermo', source: 'da handoff · 14g', sourceColor: 'warning' })
  expect(pickNext(snap({ handoffs: [ho('h.md', 'H', 0)] }), NOW, T)).toMatchObject({ detail: '', source: 'da handoff · oggi' })
  expect(pickNext(snap(now), NOW, T)).toEqual({
    title: 'C 12/10', detail: 'piu vecchia', prompt: 'Riprendiamo «C 12/10»: piu vecchia', source: 'da Now · scaduta 3g fa', sourceColor: 'error', others: [], more: 0,
  })
  const dueToday = { ...now, nowDue: [null, null, null, '2026-10-15'] }
  expect(pickNext(snap({ ...dueToday, nowLabel: 'Active' }), NOW, T)).toMatchObject({ title: 'D 15/10', source: 'da Active · scade oggi' })
  expect(pickNext(snap({ ...now, nowDue: [null, '2026-10-14', null, null] }), NOW, T)).toMatchObject({ source: 'da Now · scaduta ieri' })
  expect(pickNext(snap({ ...now, nowDue: [null, null, null, '2026-10-20'] }), NOW, T)).toMatchObject({ title: 'A', source: 'da Now', sourceColor: 'inactive', prompt: 'Riprendiamo «A»: prima' })
  expect(pickNext(snap(), NOW, T)).toBe(null)
  expect(pickNext(snap({ now: null }), NOW, T)).toBe(null)
})

test('resume texts: the session with up to 5 files and the tail «e altri N»; the Now item with clean links, cut at 300', () => {
  const files = ['a.md', 'b.md', 'c.md', 'd.md', 'e.md', 'f.md', 'g.md']
  expect(sessionResume(rec({ files, fileCount: 12 }), NOW, T)).toBe('Riprendiamo la sessione di ieri 09:40–14:28: «lavoriamo sul cockpit». File scritti: a.md, b.md, c.md, d.md, e.md e altri 7')
  expect(sessionResume(rec({ files: ['a.md'], fileCount: 1, firstPrompt: 'riga\nnuova' }), NOW, T)).toBe('Riprendiamo la sessione di ieri 09:40–14:28: «riga nuova». File scritti: a.md')
  expect(nowResume('NOVA', 'vedi [PRD](<03 - Projects/NOVA/PRD.md>) e `kubectl` **ok**', T)).toBe('Riprendiamo «NOVA»: vedi PRD e kubectl ok')
  expect(nowResume('NOVA', '', T)).toBe('Riprendiamo «NOVA»')
  // The clean detail fits in 200 characters (like a diary item): a long title takes it beyond 300.
  const long = nowResume('T'.repeat(150), 'parola '.repeat(80), T)
  expect([...long]).toHaveLength(300)
  expect(long.endsWith('…')).toBe(true)
  expect(nowPrompt(snap({ now: ['**A** — x'], nowTitles: ['A'], nowDetails: ['x'] }), 0, T)).toBe('Riprendiamo «A»: x')
  expect(nowPrompt(snap({ now: ['- solo titolo'] }), 0, T)).toBe('Riprendiamo «solo titolo»')
})

// The same texts in English: they come from the catalog.
const E = strings('en')

test('English: when, facts, topic and closing of a session come from the catalog', () => {
  expect(sessionWhen(rec(), NOW, E)).toBe('yesterday · 09:40–14:28')
  expect(sessionWhen(rec({ startAt: at(12, 9, 40), endAt: at(12, 15) }), NOW, E)).toBe('Mon 12 · 09:40–15:00')
  expect(sessionFacts(rec({ fileCount: 12, handoff: { file: 'h', topic: 't', status: 'completed' } }), E)).toBe('4h48 · 12 files written · handoff completed')
  expect(sessionFacts(rec({ fileCount: 1, handoff: { file: 'h', topic: 't', status: 'active' } }), E)).toBe('4h48 · 1 file written · handoff open')
  expect(sessionFacts(rec({ handoff: { file: 'h', topic: 't', status: 'superseded' } }), E)).toBe('4h48 · handoff superseded')
  expect(liveFacts(3, 2, 1, 0, E)).toEqual({ text: '3 turns · 2 files written · 1 subagent', errors: null })
  expect(liveFacts(1, 0, 0, 2, E)).toEqual({ text: '1 turn', errors: '2 errors' })
  expect(liveFacts(2, 1, 3, 1, E)).toEqual({ text: '2 turns · 1 file written · 3 subagents', errors: '1 error' })
  expect(topicOf(rec({ firstPrompt: '' }), E)).toBe('untitled session')
  const notes = [note('2026-10-14', { focus: 'cockpit', closing: 'spec 0.7 written' })]
  expect(closingOf(rec({ diaryDay: '2026-10-14' }), notes, E)).toEqual({ isSaved: true, day: '2026-10-14', line: 'spec 0.7 written' })
  expect(closingOf(rec({ diaryDay: '2026-10-10' }), notes, E)).toEqual({ isSaved: true, day: '2026-10-10', line: 'saved in the diary' })
  expect(closingOf(rec(), notes, E)).toEqual({ isSaved: false })
  expect(lastSession(snap({ sessions: [rec({ id: 'a', diaryDay: '2026-10-10' })] }), null, E)).toMatchObject({ closing: { line: 'saved in the diary' } })
})

test('English: the Next step source and the resume prompts come from the catalog', () => {
  const items = { now: ['**A** — first', '**B 13/10** — late'], nowTitles: ['A', 'B 13/10'], nowDetails: ['first', 'late'], nowDue: [null, '2026-10-13'] }
  expect(pickNext(snap({ handoffs: [ho('h.md', 'H', 0)] }), NOW, E)).toMatchObject({ source: 'from handoff · today', prompt: '/handoff resume h' })
  expect(pickNext(snap({ handoffs: [ho('h.md', 'H', 14)] }), NOW, E)).toMatchObject({ source: 'from handoff · 14d', sourceColor: 'warning' })
  expect(pickNext(snap(items), NOW, E)).toMatchObject({ title: 'B 13/10', prompt: `Let's resume "B 13/10": late`, source: 'from Now · overdue 2d', sourceColor: 'error' })
  expect(pickNext(snap({ ...items, nowDue: [null, '2026-10-14'] }), NOW, E)?.source).toBe('from Now · overdue since yesterday')
  expect(pickNext(snap({ ...items, nowDue: [null, '2026-10-15'], nowLabel: 'Active' }), NOW, E)?.source).toBe('from Active · due today')
  expect(pickNext(snap({ ...items, nowDue: [null, null] }), NOW, E)).toMatchObject({ title: 'A', source: 'from Now', prompt: `Let's resume "A": first` })
  const files = ['a.md', 'b.md', 'c.md', 'd.md', 'e.md', 'f.md', 'g.md']
  expect(sessionResume(rec({ files, fileCount: 12 }), NOW, E)).toBe(`Let's resume the session from yesterday 09:40–14:28: "lavoriamo sul cockpit". Files written: a.md, b.md, c.md, d.md, e.md and 7 more`)
  expect(sessionResume(rec({ files: ['a.md'], fileCount: 1 }), NOW, E)).toBe(`Let's resume the session from yesterday 09:40–14:28: "lavoriamo sul cockpit". Files written: a.md`)
  expect(nowResume('NOVA', 'see [PRD](<03 - Projects/NOVA/PRD.md>) and **ok**', E)).toBe(`Let's resume "NOVA": see PRD and ok`)
  expect(nowResume('NOVA', '', E)).toBe(`Let's resume "NOVA"`)
  expect(nowPrompt(snap({ now: ['- only a title'] }), 0, E)).toBe(`Let's resume "only a title"`)
})

test('the first prompt of a resumed session is recognized in the resume prompts of both catalogs', () => {
  for (const t of [T, E]) {
    expect(resumeOf(nowResume('NOVA Chat — KB', 'semplificare il workflow', t))).toBe('NOVA Chat — KB')
    expect(resumeOf(sessionResume(rec({ files: ['a.md'], fileCount: 1 }), NOW, t))).toBe('lavoriamo sul cockpit')
    expect(resumeOf(sessionResume(rec(), NOW, t))).toBe('lavoriamo sul cockpit')
  }
  expect(resumeOf("let's resume the discussion")).toBe(null)
  // English titles sit between plain double quotes, and may hold quotes of their own; the Italian ones keep «».
  expect(resumeOf(nowResume('Fix the "foo" bug', 'next', E))).toBe('Fix the "foo" bug')
  expect(resumeOf(`Let's resume "v1.2 plan"`)).toBe('v1.2 plan')
  expect(resumeOf(`Let's resume «NOVA»`)).toBe(null)
  expect(resumeOf('Riprendiamo "NOVA"')).toBe(null)
})
