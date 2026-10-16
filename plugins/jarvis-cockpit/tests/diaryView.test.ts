import { test, expect, type Engine } from 'claude-code/testing'
import { PANE, PLUGIN } from '../hooks/state'
import { defaultDay, diaryNotes, diaryTitle, stepDay } from '../hooks/diary'
import { strings } from '../hooks/i18n'
import { MAX_RENDER_CHARS, fileUrl } from '../hooks/reader'
import type { DiaryState, Reading } from '../types'
import { AT, ROOT, cardTitles, fakeGit, fakeVault, liveState, paneProps, settled } from './harness'

const CLAUDE_MD = "## Capacita' Jarvis\n\n| Capacita' | Fonte autorevole |\n|---|---|\n| Futuro operativo | `Da fare.md` |\n| Diario | `01 - Diary` |\n| Memoria durevole | `M/MEMORY.md` |\n"
const D = '01 - Diary'
const N08 = `${D}/2026/10/2026-10-08.md`
const PIANO = '99 - Jarvis/roadmap/Piano.md'
const LONG = 'una frase lunga che deve andare a capo e si deve leggere tutta, senza tagli né puntini in fondo alla riga'
const NOTE08 = `---\ntype: diary\n---\n# Giovedì 8 ottobre\n\n## Fatto\n- **Cockpit** — ${LONG}, vedi [piano](<../../../${PIANO}>)\n\n## Decisioni\n- niente tagli\n`
// The user's diary: year/month folders, an old note at the root, a file that is not a note, a note from tomorrow.
const FILES = {
  'CLAUDE.md': CLAUDE_MD,
  [`${D}/2026-09-01.md`]: '# Primo settembre\n',
  [`${D}/2026/09/2026-09-30.md`]: '# Fine settembre\n',
  [`${D}/2026/10/2026-10-07.md`]: '# Mercoledì\n',
  [N08]: NOTE08,
  [`${D}/2026/10/2026-10-09.md`]: '# Oggi\n',
  [`${D}/2026/10/2026-10-12.md`]: '# Domani\n',
  [PIANO]: '# Piano\n',
}
const file = (name: string) => ({ name, kind: 'file' as const })
const dir = (name: string) => ({ name, kind: 'dir' as const })
const DIRS = {
  [D]: [dir('2026'), file('2026-09-01.md'), file('README.md')],
  [`${D}/2026`]: [dir('09'), dir('10')],
  [`${D}/2026/09`]: [file('2026-09-30.md')],
  [`${D}/2026/10`]: [file('2026-10-07.md'), file('2026-10-08.md'), file('2026-10-09.md'), file('2026-10-12.md'), file('note.txt')],
}

const mount = ($: Engine) => $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps() })
const diary = (s: { values: Record<string, unknown> }) => s.values.diary as DiaryState
const tabLabels = async (pane: Awaited<ReturnType<typeof mount>>) => (await pane.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('tab-')).map(b => b.props.label)

test('diary: notes up to today from the month folders and the root, in order; the default day and the steps', () => {
  const notes = diaryNotes([
    { dir: `${D}/2026/10`, names: ['2026-10-08.md', '2026-10-12.md', 'x.md', '2026-10-07.md'] },
    { dir: D, names: ['2026-09-01.md', '2026-10-08.md', 'README.md'] },
  ], '2026-10-09')
  expect(notes).toEqual([
    { day: '2026-09-01', path: `${D}/2026-09-01.md` },
    { day: '2026-10-07', path: `${D}/2026/10/2026-10-07.md` },
    { day: '2026-10-08', path: N08 },
  ])
  // The last one before today; if only today's note exists, that one.
  expect(defaultDay(notes, '2026-10-09')).toBe('2026-10-08')
  expect(defaultDay([{ day: '2026-10-09', path: 'x' }], '2026-10-09')).toBe('2026-10-09')
  expect(defaultDay([], '2026-10-09')).toBe(null)
  expect(stepDay(notes, '2026-10-08', -1)).toBe('2026-10-07')
  expect(stepDay(notes, '2026-10-07', 1)).toBe('2026-10-08')
  expect(stepDay(notes, '2026-10-08', 1)).toBe(null)
  expect(stepDay(notes, '2026-09-01', -1)).toBe(null)
})

test('diary: the title says today and yesterday, further back only the date', () => {
  expect(diaryTitle('2026-10-09', AT, strings('it'))).toBe('Venerdì 9 ottobre · oggi')
  expect(diaryTitle('2026-10-08', AT, strings('it'))).toBe('Giovedì 8 ottobre · ieri')
  expect(diaryTitle('2026-10-06', AT, strings('it'))).toBe('Martedì 6 ottobre')
  expect(diaryTitle('2026-10-06', AT, strings('en'))).toBe('Tuesday 6 October')
})

test('tabs: the Italian bar lists Recap, Diary, To Do, Files, Reading, Memories and wraps instead of cutting', async ($, on) => {
  liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD })
  const pane = await mount($)
  expect(await tabLabels(pane)).toEqual(['Diario', 'Da fare', 'File', 'Lettura', 'Memorie'])
  expect((await pane.findAll({ type: 'Box' })).filter(b => b.props.flexWrap === 'wrap').map(b => [b.props.columnGap, b.props.rowGap])).toContainEqual([2, 0])
})

test('diary tab: opens on the last note before today, whole and with its links; ‹ › step through the notes up to today', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, FILES, DIRS)
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'tab-diary' })
  await state.until('diary', d => (d as DiaryState).text !== null)
  await pane.redraw()
  expect(diary(state).day).toBe('2026-10-08')
  expect(diary(state).notes?.map(n => n.day)).toEqual(['2026-09-01', '2026-09-30', '2026-10-07', '2026-10-08', '2026-10-09'])
  expect(await cardTitles(pane)).toEqual(['Giovedì 8 ottobre · ieri'])
  // The whole file, without frontmatter: the app Markdown wraps lines; internal links can be pressed.
  const doc = (await pane.find({ key: 'diary-doc' }))?.props
  expect(doc?.text).toContain(`- **Cockpit** — ${LONG}, vedi [piano](${fileUrl(ROOT, PIANO)})`)
  expect(doc?.text).toContain('## Decisioni\n- niente tagli')
  expect(doc?.text).not.toContain('type: diary')
  expect(doc?.pressableLinks).toEqual([fileUrl(ROOT, PIANO)])
  await pane.press({ key: 'diary-prev' })
  await state.until('diary', d => (d as DiaryState).day === '2026-10-07')
  expect(diary(state).text).toBe('# Mercoledì\n')
  await pane.redraw()
  expect(await cardTitles(pane)).toEqual(['Mercoledì 7 ottobre'])
  await pane.press({ key: 'diary-next' })
  await state.until('diary', d => (d as DiaryState).day === '2026-10-08')
  await pane.redraw()
  await pane.press({ key: 'diary-next' })
  await state.until('diary', d => (d as DiaryState).day === '2026-10-09')
  await pane.redraw()
  // Today is the last one: › can no longer be pressed (tomorrow's note does not count).
  expect(await cardTitles(pane)).toEqual(['Venerdì 9 ottobre · oggi'])
  expect(await pane.find({ key: 'diary-next' })).toBe(undefined)
  expect(await pane.find({ type: 'Text', text: /^›$/ })).toBeDefined()
})

test('diary tab: the first note has no ‹; an internal link opens the note in Reading', async ($, on) => {
  const state = liveState(on, { tab: 'diary', diary: { notes: null, day: '2026-09-01', text: null, isTooBig: false, error: null } })
  fakeVault(on, FILES, DIRS)
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'tab-recap' })
  await pane.redraw()
  await pane.press({ key: 'tab-diary' })
  // The chosen note stays when you come back to the tab.
  await state.until('diary', d => (d as DiaryState).text === '# Primo settembre\n')
  await pane.redraw()
  expect(await pane.find({ key: 'diary-prev' })).toBe(undefined)
  expect(await pane.find({ type: 'Text', text: /^‹$/ })).toBeDefined()
  state.values.diary = { ...diary(state), day: '2026-10-08', text: NOTE08 }
  await pane.redraw()
  await pane.press({ key: 'diary-doc', link: { href: fileUrl(ROOT, PIANO) } })
  await state.until('tab', t => t === 'reading')
  expect((state.values.reading as Reading).path).toBe(PIANO)
})

test('diary tab: an empty, unreadable or too big note says so; a too big one opens in Reading', async ($, on) => {
  const big = `${D}/2026/10/2026-10-08.md`
  const state = liveState(on, { tab: 'diary' })
  fakeVault(on, { ...FILES, [big]: 'x'.repeat(MAX_RENDER_CHARS + 1) }, DIRS)
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'tab-recap' })
  await pane.redraw()
  await pane.press({ key: 'tab-diary' })
  await state.until('diary', d => (d as DiaryState).isTooBig)
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^La nota è troppo grande per la scheda$/ })).toBeDefined()
  await pane.press({ key: 'diary-read' })
  await state.until('tab', t => t === 'reading')
  expect((state.values.reading as Reading).path).toBe(big)
  state.values.tab = 'diary'
  state.values.diary = { notes: [], day: null, text: null, isTooBig: false, error: null }
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^Nessuna nota nel diario$/ })).toBeDefined()
  state.values.diary = { notes: null, day: null, text: null, isTooBig: false, error: 'EACCES' }
  await pane.redraw()
  expect((await pane.find({ type: 'Text', text: /^Non riesco a leggere il diario: EACCES$/ }))?.props.color).toBe('error')
})

test('diary tab: when Jarvis writes the displayed note, the tab rereads it', async ($, on) => {
  const state = liveState(on, { tab: 'diary' })
  const files = fakeVault(on, FILES, DIRS)
  fakeGit(on, {})
  on('store.set', () => ({ value: undefined }))
  on('agent.list', () => ({ value: [] }))
  on('ui.status', () => ({ value: undefined }) as never)
  on('tool.call', () => { files.set(`${ROOT}/${N08}`, `${NOTE08}- aggiunta\n`); return { result: 'ok' } as never })
  const pane = await mount($)
  await pane.press({ key: 'tab-recap' })
  await pane.redraw()
  await pane.press({ key: 'tab-diary' })
  await state.until('diary', d => (d as DiaryState).text === NOTE08)
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/${N08}`, old_string: 'a', new_string: 'b' })
  await settled(state.clock)
  await state.until('diary', d => (d as DiaryState).text === `${NOTE08}- aggiunta\n`)
  expect(diary(state).day).toBe('2026-10-08')
})

test('diary tab: an error or a file name with a control character still draws, the control character becomes U+FFFD', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, FILES, DIRS)
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'tab-diary' })
  await state.until('diary', d => (d as DiaryState).text !== null)
  await pane.redraw()
  state.values.diary = { notes: [{ day: '2026-10-08', path: `${D}/x\x1by.md` }], day: '2026-10-08', text: null, isTooBig: false, error: 'EA\x1bCCES' }
  await pane.redraw()
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect((await pane.find({ type: 'Text', text: /^Non riesco a leggere 01 - Diary\/x�y\.md: EA�CCES$/ }))?.props.color).toBe('error')
  state.values.diary = { notes: null, day: null, text: null, isTooBig: false, error: 'EA\x1bCCES' }
  await pane.redraw()
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect((await pane.find({ type: 'Text', text: /^Non riesco a leggere il diario: EA�CCES$/ }))?.props.color).toBe('error')
})

// The Diary tab in English: a vault with the English capability table. The texts come from the catalog.
const CLAUDE_MD_EN = '## Capabilities\n\n| Capability | Authoritative source |\n|---|---|\n| Future work | `To Do.md` |\n| Daily history | `01 - Diary` |\n| Durable memory | `M/MEMORY.md` |\n'
const exact = (s: string): RegExp => new RegExp(`^${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)

test('diary tab in English: the title says today and yesterday, from the catalog', () => {
  const t = strings('en')
  expect(diaryTitle('2026-10-09', AT, t)).toBe(`Friday 9 October · ${t.dates.today}`)
  expect(diaryTitle('2026-10-08', AT, t)).toBe('Thursday 8 October · yesterday')
  expect(diaryTitle('2026-10-06', AT, t)).toBe('Tuesday 6 October')
})

test('Diary tab in English: the states, the title and the buttons come from the catalog', async ($, on) => {
  const t = strings('en')
  const state = liveState(on, { tab: 'diary', diary: { notes: [], day: null, text: null, isTooBig: false, error: null } })
  fakeVault(on, { ...FILES, 'CLAUDE.md': CLAUDE_MD_EN }, DIRS)
  const pane = await mount($)
  expect(t.diary.empty).toBe('No notes in the diary')
  expect(await pane.find({ type: 'Text', text: exact(t.diary.empty) })).toBeDefined()
  state.values.diary = { notes: null, day: null, text: null, isTooBig: false, error: null }
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: exact(t.diary.loading) })).toBeDefined()
  state.values.diary = { notes: null, day: null, text: null, isTooBig: false, error: 'EACCES' }
  await pane.redraw()
  expect((await pane.find({ type: 'Text', text: exact(t.diary.readDiary('EACCES')) }))?.props.color).toBe('error')
  // A note that is still loading, one that is too big for the tab, and one that cannot be read.
  const notes = [{ day: '2026-10-07', path: `${D}/2026/10/2026-10-07.md` }, { day: '2026-10-08', path: N08 }]
  state.values.diary = { notes, day: '2026-10-08', text: null, isTooBig: false, error: null }
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: exact(t.diary.loading) })).toBeDefined()
  expect((await pane.findAll({ type: 'Svg' })).map(n => n.props.alt)).toContain('Thursday 8 October · yesterday')
  state.values.diary = { notes, day: '2026-10-08', text: null, isTooBig: true, error: null }
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: exact(t.diary.tooBig) })).toBeDefined()
  expect((await pane.find({ key: 'diary-read' }))?.props.label).toBe(t.diary.openInReading)
  state.values.diary = { notes, day: '2026-10-08', text: null, isTooBig: false, error: 'EIO' }
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: exact(t.diary.readNote(N08, 'EIO')) })).toBeDefined()
  // The note itself and the arrows keep keys of their own, in English too.
  state.values.diary = { notes, day: '2026-10-08', text: '# Thursday\n', isTooBig: false, error: null }
  await pane.redraw()
  expect(await pane.find({ key: 'diary-doc' })).toBeDefined()
  expect((await pane.find({ key: 'diary-prev' }))?.props.label).toBe('‹')
})
