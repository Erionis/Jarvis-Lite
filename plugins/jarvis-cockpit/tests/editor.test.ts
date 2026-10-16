import { test, expect, type Engine } from 'claude-code/testing'
import { PANE, PLUGIN } from '../hooks/state'
import { EMPTY_READING } from '../hooks/reader'
import { GUTTER } from '../hooks/edit'
import { DRAFT_MS } from '../hooks/readingFlow'
import type { Draft, Reading } from '../types'
import { AT, ROOT, fakeVault, liveState, paneProps, quiet } from './harness'

const A = 'note/a.md'
const B = 'note/b.md'
const DOC = '# Titolo\n\nprima riga\nseconda riga\n'
const MTIME = AT - 3 * 86_400_000

const open = (over: Partial<Reading> = {}): Reading => ({ ...EMPTY_READING, path: A, text: DOC, mtimeMs: MTIME, ...over })
const draftOf = (s: { values: Record<string, unknown> }) => s.values.draft as Draft | null
const readingOf = (s: { values: Record<string, unknown> }) => s.values.reading as Reading

async function mount($: Engine) {
  return $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps() })
}

function toasts(on: Parameters<typeof liveState>[0]): string[] {
  const out: string[] = []
  on('ui.toast', (_$, e) => { out.push(e.text); return { value: undefined } as never })
  return out
}

// Edit: the draft starts from the text that was read and the editor is a Client under the mode selector.
async function startEditing($: Engine, state: ReturnType<typeof liveState>) {
  const pane = await mount($)
  await pane.press({ key: 'mode-edit' })
  await state.until('reading', r => (r as Reading).mode === 'edit')
  // The test state is fake: the draw follows with an explicit redraw.
  await pane.redraw()
  return pane
}

test('editor: Edit opens the draft in the Client, and the drawing does not depend on the size', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open() })
  fakeVault(on, { [A]: DOC })
  const pane = await startEditing($, state)
  const d = draftOf(state)
  expect(d).toMatchObject({ path: A, text: DOC, base: DOC, baseMtimeMs: MTIME, row: 0, col: 0, confirmDiscard: false, error: null })
  const client = await pane.find({ key: 'editor' })
  expect(client?.type).toBe('Client')
  expect(client?.props).toMatchObject({ module: 'hooks/editor.tsx', width: '100%', height: 30, props: { text: DOC, row: 0, col: 0, gen: d?.gen } })
  await pane.resize({ columns: 50, rows: 30, in: 'editor' })
  const narrow = JSON.stringify(await pane.drawn({ in: 'editor' }))
  await pane.resize({ columns: 120, rows: 30, in: 'editor' })
  expect(JSON.stringify(await pane.drawn({ in: 'editor' }))).toBe(narrow)
  expect(await pane.find({ text: /^salvato$/ })).toBeDefined()
  expect((await pane.find({ key: 'edit-cancel' }))?.props.label).toBe('Annulla')
  expect((await pane.find({ key: 'edit-save' }))?.props.label).toBe('Salva')
})

test('editor: line numbers, headings in the accent color, inverted cursor', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open() })
  fakeVault(on, { [A]: DOC })
  const pane = await startEditing($, state)
  expect(await pane.find({ type: 'Text', text: /^ {3}1$/, in: 'editor' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^ {3}5$/, in: 'editor' })).toBeDefined()
  expect((await pane.find({ type: 'Text', text: /^# Titolo$/, in: 'editor' }))?.props).toMatchObject({ color: '#13918b', bold: true, wrap: 'wrap' })
  expect((await pane.find({ type: 'Text', text: /^prima riga$/, in: 'editor' }))?.props.wrap).toBe('truncate-end')
  expect((await pane.find({ type: 'Text', text: /^#$/, in: 'editor' }))?.props.inverse).toBe(true)
})

test('editor: an accented character enters the draft, the badge and the bar show it', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open() })
  fakeVault(on, { [A]: DOC })
  const pane = await startEditing($, state)
  await pane.key({ key: 'down', in: 'editor' })
  await pane.key({ key: 'down', in: 'editor' })
  await pane.key({ key: 'è', in: 'editor' })
  await state.until('draft', d => (d as Draft | null)?.text.includes('èprima riga') === true)
  await pane.redraw()
  expect(draftOf(state)).toMatchObject({ row: 2, col: 1 })
  // Reading is the active tab: an underlined Text, not a Button.
  expect((await pane.find({ type: 'Text', text: /^Lettura ●$/ }))?.props).toMatchObject({ color: '#13918b', bold: true, underline: true })
  expect(await pane.find({ text: /^● non salvato$/ })).toBeDefined()
  await pane.key({ key: 'z', meta: true, in: 'editor' })
  await state.until('draft', d => (d as Draft | null)?.text === DOC)
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^Lettura$/ })).toBeDefined()
})

test('editor: cmd+v warns that pasting is not available here', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open() })
  fakeVault(on, { [A]: DOC })
  const seen = toasts(on)
  const pane = await startEditing($, state)
  await pane.key({ key: 'v', meta: true, in: 'editor' })
  expect(seen).toEqual(["Incolla non disponibile qui: usa ↗ per aprire il file nell'app"])
  expect(draftOf(state)?.text).toBe(DOC)
})

test('editor: Save writes the file, raises a toast and the bar goes clean again', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open() })
  const files = fakeVault(on, { [A]: DOC })
  const seen = toasts(on)
  const pane = await startEditing($, state)
  await pane.key({ key: 'x', in: 'editor' })
  await state.until('draft', d => (d as Draft | null)?.text.startsWith('x#') === true)
  await pane.redraw()
  await pane.press({ key: 'edit-save' })
  await state.until('draft', d => (d as Draft | null)?.base.startsWith('x#') === true)
  await pane.redraw()
  expect(files.get(`${ROOT}/${A}`)).toBe(`x${DOC}`)
  expect(seen).toContain('Salvato')
  await state.until('reading', r => (r as Reading).text === `x${DOC}`)
  await pane.redraw()
  expect(readingOf(state).mode).toBe('edit')
  expect(await pane.find({ text: /^salvato$/ })).toBeDefined()
  expect(state.values.written).toEqual({})
})

test('editor: cmd+s saves like the button', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open() })
  const files = fakeVault(on, { [A]: DOC })
  const pane = await startEditing($, state)
  await pane.key({ key: 'end', in: 'editor' })
  await pane.key({ key: '!', in: 'editor' })
  await pane.key({ key: 's', meta: true, in: 'editor' })
  await state.until('draft', d => (d as Draft | null)?.base.startsWith('# Titolo!') === true)
  await pane.redraw()
  expect(files.get(`${ROOT}/${A}`)).toBe(DOC.replace('# Titolo', '# Titolo!'))
})

test('editor: Cancel on a dirty draft asks for a second click, then goes back to Text', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open() })
  fakeVault(on, { [A]: DOC })
  const pane = await startEditing($, state)
  await pane.key({ key: 'x', in: 'editor' })
  await state.until('draft', d => (d as Draft | null)?.text.startsWith('x') === true)
  await pane.redraw()
  await pane.press({ key: 'edit-cancel' })
  await state.until('draft', d => (d as Draft | null)?.confirmDiscard === true)
  await pane.redraw()
  expect((await pane.find({ key: 'edit-cancel' }))?.props.label).toBe('Premi di nuovo per scartare')
  await pane.press({ key: 'edit-cancel' })
  await state.until('draft', d => d === null)
  await pane.redraw()
  expect(readingOf(state).mode).toBe('text')
  expect(await pane.find({ key: 'editor' })).toBe(undefined)
  expect(await pane.find({ key: 'doc' })).toBeDefined()
})

test('editor: a click moves the cursor', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open() })
  fakeVault(on, { [A]: DOC })
  const pane = await startEditing($, state)
  await pane.resize({ columns: 60, rows: 30, in: 'editor' })
  await pane.pointer({ type: 'down', x: GUTTER + 3, y: 3, button: 'left', in: 'editor' })
  await quiet(state.clock)
  // The cursor alone does not change the drawing: the draft takes it DRAFT_MS later.
  expect(draftOf(state)).toMatchObject({ row: 0, col: 0 })
  await state.clock.advance(DRAFT_MS)
  await state.until('draft', d => (d as Draft | null)?.row === 3)
  expect(draftOf(state)).toMatchObject({ row: 3, col: 3, text: DOC })
})

test('editor: switching tab keeps the draft', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open() })
  const files = fakeVault(on, { [A]: DOC }, { '': [] })
  on('store.set', () => ({ value: undefined }))
  const pane = await startEditing($, state)
  await pane.key({ key: 'x', in: 'editor' })
  await state.until('draft', d => (d as Draft | null)?.text.startsWith('x') === true)
  await pane.redraw()
  await pane.press({ key: 'tab-recap' })
  await state.until('tab', t => t === 'recap')
  await pane.redraw()
  expect(await pane.find({ key: 'editor' })).toBe(undefined)
  expect((await pane.find({ key: 'tab-reading' }))?.props.label).toBe('Lettura ●')
  await pane.press({ key: 'tab-reading' })
  await state.until('tab', t => t === 'reading')
  await pane.redraw()
  expect((await pane.find({ key: 'editor' }))?.props.props).toMatchObject({ text: `x${DOC}` })
  // No write without Save: the file on disk is still the old one.
  expect(files.get(`${ROOT}/${A}`)).toBe(DOC)
})

test('editor: ten more keys after the first cause a single draft write, DRAFT_MS later, while the drawing already has the text', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open() })
  fakeVault(on, { [A]: DOC })
  const pane = await startEditing($, state)
  // The first key lights the "unsaved" dot: the draft is written at once.
  await pane.key({ key: 'x', in: 'editor' })
  await state.until('draft', d => (d as Draft | null)?.text === `x${DOC}`)
  const sets = state.sets.draft
  for (const key of '0123456789') await pane.key({ key, in: 'editor' })
  await quiet(state.clock)
  expect(state.sets.draft).toBe(sets)
  await pane.redraw()
  expect((await pane.find({ key: 'editor' }))?.props.props).toMatchObject({ text: `x0123456789${DOC}` })
  await state.clock.advance(DRAFT_MS)
  await state.until('draft', d => (d as Draft | null)?.text === `x0123456789${DOC}`)
  expect(state.sets.draft).toBe(sets + 1)
})

test('editor: Save before DRAFT_MS writes the text of the last key', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open() })
  const files = fakeVault(on, { [A]: DOC })
  const pane = await startEditing($, state)
  await pane.key({ key: 'x', in: 'editor' })
  await state.until('draft', d => (d as Draft | null)?.text === `x${DOC}`)
  await pane.key({ key: 'y', in: 'editor' })
  await pane.key({ key: 'z', in: 'editor' })
  await quiet(state.clock)
  await pane.press({ key: 'edit-save' })
  await state.until('draft', d => (d as Draft | null)?.base === `xyz${DOC}`)
  expect(files.get(`${ROOT}/${A}`)).toBe(`xyz${DOC}`)
})

test('editor: a CRLF file is edited with plain newlines and saved with CRLF', async ($, on) => {
  const CRLF = DOC.replace(/\n/g, '\r\n')
  const state = liveState(on, { tab: 'reading', reading: open({ text: CRLF }) })
  const files = fakeVault(on, { [A]: CRLF })
  const pane = await startEditing($, state)
  expect(draftOf(state)).toMatchObject({ text: DOC, base: DOC, eol: '\r\n' })
  await pane.key({ key: 'x', in: 'editor' })
  await state.until('draft', d => (d as Draft | null)?.text === `x${DOC}`)
  await pane.press({ key: 'edit-save' })
  await state.until('draft', d => (d as Draft | null)?.base === `x${DOC}`)
  expect(files.get(`${ROOT}/${A}`)).toBe(`x${CRLF}`)
})

test('editor: with mixed line endings, Edit is blocked and says why', async ($, on) => {
  const MIXED = '# Titolo\r\nprima riga\nseconda riga\n'
  liveState(on, { tab: 'reading', reading: open({ text: MIXED }) })
  fakeVault(on, { [A]: MIXED })
  const pane = await mount($)
  expect(await pane.find({ key: 'mode-edit' })).toBe(undefined)
  expect(await pane.find({ text: /Modifica: fine riga misti, modificalo fuori dal pannello/ })).toBeDefined()
})

test('editor: a .md with control characters opens in Edit, the editor draws them as U+FFFD, and Save writes back the original bytes', async ($, on) => {
  const RAW = '# Tit\x1bolo\n\nprima\x1b riga\n'
  const state = liveState(on, { tab: 'reading', reading: open({ text: RAW }) })
  const files = fakeVault(on, { [A]: RAW })
  const pane = await startEditing($, state)
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect(draftOf(state)?.text).toBe(RAW)
  expect(await pane.find({ type: 'Text', text: /^# Tit�olo$/, in: 'editor' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^prima� riga$/, in: 'editor' })).toBeDefined()
  await pane.key({ key: 'x', in: 'editor' })
  await state.until('draft', d => (d as Draft | null)?.text === `x${RAW}`)
  await pane.redraw()
  await pane.press({ key: 'edit-save' })
  await state.until('draft', d => (d as Draft | null)?.base === `x${RAW}`)
  expect(files.get(`${ROOT}/${A}`)).toBe(`x${RAW}`)
})

test('editor: Save at the moment the draft write starts (DRAFT_MS) writes the latest text, not the stale one', async ($, on) => {
  let gate: Promise<void> | undefined
  let release = (): void => {}
  const state = liveState(on, { tab: 'reading', reading: open() }, key => (key === 'draft' ? gate : undefined))
  const files = fakeVault(on, { [A]: DOC })
  const seen = toasts(on)
  const pane = await startEditing($, state)
  await pane.key({ key: 'x', in: 'editor' })
  await state.until('draft', d => (d as Draft | null)?.text === `x${DOC}`)
  // The second key does not change the dot: the draft takes it DRAFT_MS later.
  await pane.key({ key: 'y', in: 'editor' })
  await quiet(state.clock)
  expect(draftOf(state)?.text).toBe(`x${DOC}`)
  // The timer starts the write, which has not landed yet when Save is pressed.
  gate = new Promise<void>(r => { release = r })
  await state.clock.advance(DRAFT_MS)
  await pane.press({ key: 'edit-save' })
  await quiet(state.clock)
  release()
  await state.until('draft', d => (d as Draft | null)?.base !== DOC)
  await quiet(state.clock)
  expect(files.get(`${ROOT}/${A}`)).toBe(`xy${DOC}`)
  expect(seen).toEqual(['Salvato'])
})

test('editor: the atom write of the draft is rejected, Save still writes the latest text and says Saved', async ($, on) => {
  // A rejected write makes `update` fail: while `reject` is true every attempt fails.
  let reject = false
  const state = liveState(on, { tab: 'reading', reading: open() }, key => (key === 'draft' && reject ? Promise.reject(new Error('atom rifiutato')) : undefined))
  const files = fakeVault(on, { [A]: DOC })
  const seen = toasts(on)
  const pane = await startEditing($, state)
  reject = true
  // The first key changes the "unsaved" dot: the atom is written at once, and the write fails.
  await pane.key({ key: 'x', in: 'editor' })
  await quiet(state.clock)
  expect(draftOf(state)?.text).toBe(DOC)
  reject = false
  await pane.press({ key: 'edit-save' })
  await quiet(state.clock)
  expect(files.get(`${ROOT}/${A}`)).toBe(`x${DOC}`)
  expect(seen).toEqual(['Salvato'])
})
