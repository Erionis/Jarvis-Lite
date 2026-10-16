import { test, expect, type Engine } from 'claude-code/testing'
import { PANE, PLUGIN } from '../hooks/state'
import { CONFIRM_MS, EMPTY_TODO, parseTodo, type TodoItem } from '../hooks/todoModel'
import { EMPTY_READING, fileUrl } from '../hooks/reader'
import type { Draft, Reading, TodoState } from '../types'
import { AT, ROOT, cardTitles, fakeGit, fakeStore, fakeVault, liveState, paneProps, settled } from './harness'
import { LOOPS, itemAt } from './todoModel.test'

const CLAUDE_MD = "## Capacita' Jarvis\n\n| Capacita' | Fonte autorevole |\n|---|---|\n| Futuro operativo | `Da fare.md` |\n| Diario | `D` |\n"
const PATH = `${ROOT}/Da fare.md`
// The To Do tab's button keys are the text of the item or of the heading.
const K = (line: number, text = LOOPS) => itemAt(text, line).key
const JARVIS = { line: 26, raw: '### Jarvis' }

const mount = ($: Engine) => $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps() })
const todoOf = (s: { values: Record<string, unknown> }) => s.values.todo as TodoState
const loaded = (text: string): TodoState => ({ ...EMPTY_TODO, path: 'Da fare.md', text })
// The lines of the file that are no longer as they were.
const changedLines = (before: string, after: string | undefined) => {
  const a = before.split('\n')
  return (after ?? '').split('\n').flatMap((l, i) => (l === a[i] ? [] : [`${i}: ${l}`]))
}

test('tabs: Da fare comes after Diario when the source is declared', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD })
  const pane = await mount($)
  expect((await pane.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('tab-')).map(b => b.props.label)).toEqual(['Diario', 'Da fare', 'File', 'Lettura'])
  state.values.tab = 'todo'
  state.values.todo = loaded(LOOPS)
  await pane.redraw()
  expect((await pane.find({ type: 'Text', text: /^Da fare$/ }))?.props).toMatchObject({ bold: true, underline: true })
})

test('tabs: a todo.md file is called To Do', async ($, on) => {
  liveState(on, { tab: 'todo', todo: { ...EMPTY_TODO, path: 'todo.md', text: '- [ ] uno\n' } })
  fakeVault(on, { 'CLAUDE.md': "## Capabilities\n\n| Role | Authoritative source |\n|---|---|\n| Future work | `todo.md` |\n" })
  const pane = await mount($)
  expect((await pane.find({ type: 'Text', text: /^To Do$/ }))?.props.underline).toBe(true)
  expect((await pane.find({ key: 'todo-box-uno' }))?.props.label).toBe('☐')
})

test('tabs: a saved tab that is gone opens Recap; one that is still there loads', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': "## Capacita' Jarvis\n\n| Capacita' | Fonte autorevole |\n|---|---|\n| Diario | `D` |\n" })
  on('store.get', (_$, e) => ({ value: e.key === 'tab' ? 'todo' : undefined }) as never)
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('session.start', () => ({ cwd: ROOT }) as never)
  fakeGit(on, {})
  await $.session.start({ cwd: ROOT } as never)
  const pane = await mount($)
  expect(state.values.tab).toBe('recap')
  expect((await pane.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('tab-')).map(b => b.props.label)).toEqual(['Diario', 'File', 'Lettura'])
  // Even with the atom left on 'todo' the pane draws Recap.
  state.values.tab = 'todo'
  await pane.redraw()
  expect((await pane.find({ type: 'Text', text: /^Recap$/ }))?.props.underline).toBe(true)
})

test('to do tab: read on entering; groups as cards, subtitles, checkboxes, every item in full, the prose in full in gray', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': LOOPS })
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'tab-todo' })
  await state.until('todo', t => (t as TodoState).text === LOOPS)
  await pane.redraw()
  expect(await cardTitles(pane)).toEqual(['This week', 'Backlog by area', 'Links'])
  expect((await pane.find({ type: 'Text', text: /^Now$/ }))?.props).toMatchObject({ bold: true, color: 'subtle' })
  expect((await pane.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('todo-box-')).map(b => `${b.key} ${b.props.label}`))
    .toEqual([[15, '☑'], [16, '☐'], [20, '☐'], [28, '☐'], [32, '☑']].map(([l, box]) => `todo-box-${K(l as number)} ${box}`))
  // Every item in full in the app's Markdown, which wraps; indented lines always underneath. Done: gray and struck through.
  const md = async (key: string) => (await pane.find({ key }))?.props
  expect(await md(`todo-md-${K(15)}`)).toMatchObject({ text: '~~NOVA KB workflow — applied to Selenia~~', dimColor: true })
  expect(await md(`todo-md-${K(32)}`)).toMatchObject({ text: '~~**Docs** — review the guide~~', dimColor: true })
  expect((await md(`todo-md-${K(28)}`))?.text).toBe('**Release 1.2** — ship the fix\n- indented detail\n\n- after a blank line')
  expect((await md(`todo-md-${K(28)}`))?.dimColor).not.toBe(true)
  expect(await md('todo-prose-6')).toMatchObject({ text: '**How this file works**\n\nThe **short list** of current work.\n\n- **1 task = 1 line**', dimColor: true })
  // No more click to open an item: the whole text is already there.
  expect((await pane.findAll({ type: 'Button' })).some(b => b.key?.startsWith('todo-item-'))).toBe(false)
  // ✕ to the right of every item.
  expect((await pane.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('todo-del-')).map(b => `${b.key} ${b.props.label}`))
    .toEqual([15, 16, 20, 28, 32].map(l => `todo-del-${K(l)} ✕`))
  expect((await pane.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('todo-add-')).map(b => b.key)).toEqual(['todo-add-### Now', 'todo-add-### Next', 'todo-add-### Jarvis', 'todo-add-### Empty'])
  expect((await pane.find({ key: 'todo-edit' }))?.props.label).toBe('Modifica il file ›')
})

test('to do tab: an internal link is pressable and opens Reading; an external one is left to the app', async ($, on) => {
  const state = liveState(on, { tab: 'todo', todo: loaded(LOOPS) })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': LOOPS, 'NOVA Hub.md': '# Hub\n' })
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  expect((await pane.find({ key: `todo-md-${K(16)}` }))?.props.pressableLinks).toEqual([])
  const table = (await pane.find({ key: 'todo-prose-38' }))?.props
  expect(table?.text).toContain(fileUrl(ROOT, 'NOVA Hub.md'))
  expect(table?.pressableLinks).toEqual([fileUrl(ROOT, 'NOVA Hub.md')])
  await pane.press({ key: 'todo-prose-38', link: { href: fileUrl(ROOT, 'NOVA Hub.md') } })
  await state.until('tab', t => t === 'reading')
  expect((state.values.reading as Reading).path).toBe('NOVA Hub.md')
})

test('delete: ✕ becomes «cancella?», the second click removes the item and its indented lines, once only', async ($, on) => {
  const state = liveState(on, { tab: 'todo', todo: loaded(LOOPS) })
  const writes: string[] = []
  const files = fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': LOOPS }, {}, {}, { writes })
  fakeGit(on, {})
  const pane = await mount($)
  await pane.press({ key: `todo-del-${K(28)}` })
  await state.until('todo', t => (t as TodoState).confirm === K(28))
  expect(writes).toEqual([])
  await pane.redraw()
  expect(await pane.find({ key: `todo-del-${K(28)}` })).toBe(undefined)
  expect((await pane.find({ key: `todo-del-yes-${K(28)}` }))?.props.label).toBe('cancella?')
  expect((await pane.find({ type: 'Text', text: /^cancella\?$/ }))?.props.color).toBe('warning')
  // ✕ on another item moves the question.
  await pane.press({ key: `todo-del-${K(16)}` })
  await state.until('todo', t => (t as TodoState).confirm === K(16))
  await pane.redraw()
  expect(await pane.find({ key: `todo-del-yes-${K(28)}` })).toBe(undefined)
  await pane.press({ key: `todo-del-${K(28)}` })
  await state.until('todo', t => (t as TodoState).confirm === K(28))
  await pane.redraw()
  // Two clicks before the redraw: the item is deleted only once.
  await Promise.all([pane.press({ key: `todo-del-yes-${K(28)}` }), pane.press({ key: `todo-del-yes-${K(28)}` })])
  await state.until('todo', t => (t as TodoState).text !== LOOPS)
  const lines = LOOPS.split('\n')
  expect(files.get(PATH)).toBe([...lines.slice(0, 28), ...lines.slice(32)].join('\n'))
  expect(writes).toEqual([PATH])
  expect(todoOf(state)).toMatchObject({ confirm: null, note: null, text: files.get(PATH) })
})

test('delete: without the second click «cancella?» goes back to ✕; an item changed in the file is not deleted', async ($, on) => {
  const moved = LOOPS.replace('ship the fix', 'shipped')
  const state = liveState(on, { tab: 'todo', todo: loaded(LOOPS) })
  const writes: string[] = []
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': moved }, {}, {}, { writes })
  const pane = await mount($)
  await pane.press({ key: `todo-del-${K(28)}` })
  await state.until('todo', t => (t as TodoState).confirm === K(28))
  await state.clock.advance(CONFIRM_MS)
  await state.until('todo', t => (t as TodoState).confirm === null)
  await pane.redraw()
  expect(await pane.find({ key: `todo-del-${K(28)}` })).toBeDefined()
  await pane.press({ key: `todo-del-${K(28)}` })
  await state.until('todo', t => (t as TodoState).confirm === K(28))
  await pane.redraw()
  await pane.press({ key: `todo-del-yes-${K(28)}` })
  await state.until('todo', t => (t as TodoState).note !== null)
  expect(writes).toEqual([])
  expect(todoOf(state)).toMatchObject({ text: moved, confirm: null, note: "Da fare è cambiato, l'ho ricaricato" })
})

test('delete: an indented line written by another chat under the item after the draw → no write, a note', async ($, on) => {
  const other = LOOPS.replace('  - after a blank line', '  - after a blank line\n  - written by another chat')
  const state = liveState(on, { tab: 'todo', todo: loaded(LOOPS) })
  const writes: string[] = []
  const files = fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': other }, {}, {}, { writes })
  const pane = await mount($)
  await pane.press({ key: `todo-del-${K(28)}` })
  await state.until('todo', t => (t as TodoState).confirm === K(28))
  await pane.redraw()
  await pane.press({ key: `todo-del-yes-${K(28)}` })
  await state.until('todo', t => (t as TodoState).note !== null)
  expect(writes).toEqual([])
  expect(files.get(PATH)).toBe(other)
  expect(todoOf(state)).toMatchObject({ text: other, note: "Da fare è cambiato, l'ho ricaricato" })
})

// The test answers like the engine: ui.focus and the turns have no other implementation.
function engineTurns(on: Parameters<typeof liveState>[0]) {
  on('ui.focus', () => ({}) as never)
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }) as never)
}
const focusPane = ($: Engine) => $.ui.focus({ component: 'Pane', requestId: PANE, plugin: PLUGIN, origin: { kind: 'person' } } as never)

test('to do tab: while in view, another chat writes the file; a click in the pane or a turn end makes the tab re-read', async ($, on) => {
  const MTIME = AT - 3 * 86_400_000
  const state = liveState(on, { tab: 'todo', paneOpen: true, todo: { ...loaded(LOOPS), mtimeMs: MTIME, size: LOOPS.length } })
  const files = fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': LOOPS })
  engineTurns(on)
  // Nothing changed: no write of the tab.
  await focusPane($)
  for (let i = 0; i < 10; i++) await Promise.resolve()
  expect(state.sets.todo ?? 0).toBe(0)
  // Another chat adds an item: same date (fakeVault does not change it), different bytes.
  files.set(PATH, `${LOOPS}- [ ] da un'altra chat\n`)
  await focusPane($)
  await state.until('todo', t => ((t as TodoState).text ?? '').includes("da un'altra chat"))
  files.set(PATH, `${LOOPS}- [ ] e un'altra ancora\n`)
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  await state.until('todo', t => ((t as TodoState).text ?? '').includes("e un'altra ancora"))
})

test('checkbox: ticking writes only that line to disk, Recap follows, git does not run while Files is hidden, no orange dot', async ($, on) => {
  const state = liveState(on, { tab: 'todo', todo: loaded(LOOPS) })
  const writes: string[] = []
  const files = fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': LOOPS }, {}, {}, { writes })
  const calls = fakeGit(on, { status: ' M Da fare.md\0' })
  const pane = await mount($)
  await pane.press({ key: `todo-box-${K(16)}` })
  await state.until('todo', t => (t as TodoState).text !== LOOPS)
  expect(writes).toEqual([PATH])
  expect(changedLines(LOOPS, files.get(PATH))).toEqual(['16: - [x] **NOVA Chat — files and images** — [#597](https://x/597) is with Robin'])
  await state.until('snapshot', s => s !== null)
  expect(state.values.written).toEqual({})
  expect(todoOf(state).note).toBe(null)
  // git runs only with the Files tab in view: going back in, it runs again.
  expect(calls.some(c => c.includes('status'))).toBe(false)
  expect(state.values.git).toBe(null)
  // Every write of an atom redraws: the tab is written once (the new text); Reading, draft and
  // sizes, which do not change, never.
  expect([state.sets.todo, state.sets.reading, state.sets.draft, state.sets.sizes]).toEqual([1, undefined, undefined, undefined])
})

test('checkbox: with the Future work file in Edit and a clean draft, the draft restarts from the new text', async ($, on) => {
  const clean: Draft = { path: 'Da fare.md', text: LOOPS, base: LOOPS, eol: '\n', baseMtimeMs: AT, baseSize: null, row: 3, col: 2, gen: 7, confirmDiscard: false, error: null, conflict: null, conflictDiff: null, conflictDiffCut: false, pendingOpen: null }
  const state = liveState(on, { tab: 'todo', todo: loaded(LOOPS), reading: { ...EMPTY_READING, path: 'Da fare.md', mode: 'edit', text: LOOPS, mtimeMs: AT }, draft: clean })
  const files = fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': LOOPS })
  fakeGit(on, {})
  const pane = await mount($)
  await pane.press({ key: `todo-box-${K(16)}` })
  const text = files.get(PATH)
  expect(text).not.toBe(LOOPS)
  expect(state.values.reading as Reading).toMatchObject({ path: 'Da fare.md', mode: 'edit', text })
  const draft = state.values.draft as Draft | null
  expect(draft).toMatchObject({ path: 'Da fare.md', text, base: text, conflict: null })
  expect(draft?.gen).toBeGreaterThan(7)
})

test('add: «+ aggiungi» opens the field, Enter writes the line under the last item; empty writes nothing; «annulla» closes', async ($, on) => {
  const state = liveState(on, { tab: 'todo', todo: loaded(LOOPS) })
  const writes: string[] = []
  const files = fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': LOOPS }, {}, {}, { writes })
  fakeGit(on, {})
  const pane = await mount($)
  await pane.press({ key: 'todo-add-### Jarvis' })
  await state.until('todo', t => (t as TodoState).adding?.raw === '### Jarvis')
  await pane.redraw()
  expect((await pane.find({ key: 'todo-input-### Jarvis' }))?.props).toMatchObject({ placeholder: 'Nuova voce in Jarvis', autoFocus: true })
  expect((await pane.find({ key: 'todo-cancel' }))?.props.label).toBe('annulla')
  await pane.input({ key: 'todo-input-### Jarvis', text: '   ', kind: 'submit' })
  expect(writes).toEqual([])
  await pane.input({ key: 'todo-input-### Jarvis', text: ' provare la scheda ', kind: 'submit' })
  await state.until('todo', t => (t as TodoState).adding === null && (t as TodoState).text !== LOOPS)
  expect(writes).toEqual([PATH])
  const after = (files.get(PATH) ?? '').split('\n')
  expect(after.slice(32, 34)).toEqual(['- [X] **Docs** — review the guide', '- [ ] provare la scheda'])
  expect(after).toHaveLength(LOOPS.split('\n').length + 1)
  await pane.redraw()
  // The Empty section moved down one line.
  await pane.press({ key: 'todo-add-### Empty' })
  await state.until('todo', t => (t as TodoState).adding?.raw === '### Empty')
  await pane.redraw()
  await pane.press({ key: 'todo-cancel' })
  await state.until('todo', t => (t as TodoState).adding === null)
  expect(writes).toEqual([PATH])
})

test('conflict: a write by Jarvis between the read and the click → no write, a warning, the tab reloaded', async ($, on) => {
  const state = liveState(on, { tab: 'todo', todo: loaded(LOOPS) })
  const writes: string[] = []
  const moved = LOOPS.replace('- [ ] **Release 1.2** — ship the fix', '- [ ] **Release 1.3** — ship the fix')
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': moved }, {}, {}, { writes })
  fakeGit(on, {})
  const pane = await mount($)
  await pane.press({ key: `todo-box-${K(28)}` })
  await state.until('todo', t => (t as TodoState).note !== null)
  expect(writes).toEqual([])
  expect(todoOf(state)).toMatchObject({ text: moved, note: "Da fare è cambiato, l'ho ricaricato" })
  await pane.redraw()
  expect((await pane.find({ type: 'Text', text: /è cambiato/ }))?.props.color).toBe('warning')
})

test('write error: the tab says why and the file stays as it was', async ($, on) => {
  const state = liveState(on, { tab: 'todo', todo: loaded(LOOPS) })
  const files = fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': LOOPS }, {}, {}, { writeError: 'disco pieno' })
  const pane = await mount($)
  await pane.press({ key: `todo-box-${K(28)}` })
  await state.until('todo', t => (t as TodoState).note !== null)
  expect(todoOf(state).note).toMatch(/^Non riesco a scrivere il file: .*disco pieno/)
  expect(files.get(PATH)).toBe(LOOPS)
})

test('add error: the field stays open with its text and the tab says why', async ($, on) => {
  const state = liveState(on, { tab: 'todo', todo: { ...loaded(LOOPS), adding: JARVIS } })
  const files = fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': LOOPS }, {}, {}, { writeError: 'disco pieno' })
  const pane = await mount($)
  await pane.input({ key: 'todo-input-### Jarvis', text: 'non scritta', kind: 'change' })
  await pane.input({ key: 'todo-input-### Jarvis', text: 'non scritta', kind: 'submit' })
  expect(todoOf(state).adding).toEqual(JARVIS)
  await pane.redraw()
  expect((await pane.find({ key: 'todo-input-### Jarvis' }))?.props.value).toBe('non scritta')
  expect(todoOf(state).note).toMatch(/^Non riesco a scrivere il file: .*disco pieno/)
  expect(files.get(PATH)).toBe(LOOPS)
})

test('add field: keystrokes do not write the atom; a heading moved down one line → the field stays on its heading with the text', async ($, on) => {
  const state = liveState(on, { tab: 'todo', todo: { ...loaded(LOOPS), adding: JARVIS } })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': LOOPS })
  const pane = await mount($)
  await pane.input({ key: 'todo-input-### Jarvis', text: 'a metà', kind: 'change' })
  await pane.input({ key: 'todo-input-### Jarvis', text: 'a metà strada', kind: 'change' })
  expect(state.sets.todo ?? 0).toBe(0)
  // Another chat adds an item above: the heading moves down, the field follows it and keeps the current text.
  state.values.todo = { ...todoOf(state), text: LOOPS.replace('- [x] NOVA KB', '- [ ] nuova\n- [x] NOVA KB') }
  await pane.redraw()
  expect((await pane.find({ key: 'todo-input-### Jarvis' }))?.props.value).toBe('a metà strada')
  expect(await pane.find({ key: 'todo-add-### Jarvis' })).toBe(undefined)
  await pane.press({ key: 'todo-cancel' })
})

test('add field: heading gone → the card for an item that was not added; «+ aggiungi» restarts with the text; discard removes it', async ($, on) => {
  const state = liveState(on, { tab: 'todo', todo: { ...loaded(LOOPS), adding: JARVIS } })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': LOOPS })
  const pane = await mount($)
  await pane.input({ key: 'todo-input-### Jarvis', text: 'da non perdere', kind: 'change' })
  state.values.todo = { ...todoOf(state), text: LOOPS.replace('### Jarvis', '### Altro') }
  await pane.redraw()
  expect(await cardTitles(pane)).toContain('Voce non aggiunta')
  expect(await pane.find({ type: 'Text', text: 'da non perdere' })).toBeDefined()
  expect((await pane.findAll({ type: 'Input' })).length).toBe(0)
  // "+ aggiungi" in another section: the field opens with that text, and the card is no longer needed.
  await pane.press({ key: 'todo-add-### Next' })
  await state.until('todo', t => (t as TodoState).adding?.raw === '### Next')
  await pane.redraw()
  expect((await pane.find({ key: 'todo-input-### Next' }))?.props.value).toBe('da non perdere')
  expect(await cardTitles(pane)).not.toContain('Voce non aggiunta')
  // The heading disappears again: "scarta" removes the text and the card.
  state.values.todo = { ...todoOf(state), text: LOOPS.replace('### Next', '### Dopo') }
  await pane.redraw()
  await pane.press({ key: 'todo-lost-discard' })
  await state.until('todo', t => (t as TodoState).adding === null)
  await pane.redraw()
  expect(await cardTitles(pane)).not.toContain('Voce non aggiunta')
  await pane.press({ key: 'todo-add-### Now' })
  await state.until('todo', t => (t as TodoState).adding?.raw === '### Now')
  await pane.redraw()
  expect((await pane.find({ key: 'todo-input-### Now' }))?.props.value).toBe('')
  await pane.press({ key: 'todo-cancel' })
})

test('keys: a line added above in the Future work file → the item key still presses the same item; ✕ in a fixed column', async ($, on) => {
  const moved = LOOPS.replace('- [x] NOVA KB', '- [ ] nuova\n- [x] NOVA KB')
  const state = liveState(on, { tab: 'todo', todo: loaded(LOOPS) })
  const files = fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': moved })
  fakeGit(on, {})
  const pane = await mount($)
  const key = `todo-box-${K(28)}`
  state.values.todo = loaded(moved)
  await pane.redraw()
  await pane.press({ key })
  await state.until('todo', t => (t as TodoState).text !== moved)
  expect(changedLines(moved, files.get(PATH))).toEqual(['29: - [x] **Release 1.2** — ship the fix'])
  // ✕ and "cancella?" sit in a column as wide as "cancella?".
  await pane.press({ key: `todo-del-${K(28)}` })
  await state.until('todo', t => (t as TodoState).confirm === K(28))
  await pane.redraw()
  const cols = (await pane.findAll({ type: 'Box' })).filter(b => b.props.width === 'cancella?'.length)
  expect(cols).toHaveLength(6)
})

// The tab's writes are queued: every click re-reads the file after the previous write.
test('queue: two Enters before the redraw write the item only once', async ($, on) => {
  const state = liveState(on, { tab: 'todo', todo: { ...loaded(LOOPS), adding: JARVIS } })
  const writes: string[] = []
  const files = fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': LOOPS }, {}, {}, { writes })
  fakeGit(on, {})
  const pane = await mount($)
  // Without a redraw the field is still the same: the second Enter lands on the same field.
  await pane.input({ key: 'todo-input-### Jarvis', text: 'una volta', kind: 'submit' })
  await pane.input({ key: 'todo-input-### Jarvis', text: 'una volta', kind: 'submit' })
  const after = (files.get(PATH) ?? '').split('\n')
  expect(after.filter(l => l === '- [ ] una volta')).toHaveLength(1)
  expect(after).toHaveLength(LOOPS.split('\n').length + 1)
  expect(writes).toEqual([PATH])
  expect(todoOf(state)).toMatchObject({ adding: null, text: files.get(PATH) })
})

test('queue: two ticks in quick succession on different items both reach the disk', async ($, on) => {
  const state = liveState(on, { tab: 'todo', todo: loaded(LOOPS) })
  const writes: string[] = []
  const files = fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': LOOPS }, {}, {}, { writes })
  fakeGit(on, {})
  const pane = await mount($)
  await Promise.all([pane.press({ key: `todo-box-${K(16)}` }), pane.press({ key: `todo-box-${K(20)}` })])
  expect(changedLines(LOOPS, files.get(PATH))).toEqual([
    '16: - [x] **NOVA Chat — files and images** — [#597](https://x/597) is with Robin',
    '20: - [x] **Registry** — rotate token',
  ])
  expect(writes).toEqual([PATH, PATH])
  expect(todoOf(state).text).toBe(files.get(PATH))
})

test('queue: adding an item and ticking a box in quick succession both reach the disk', async ($, on) => {
  const state = liveState(on, { tab: 'todo', todo: { ...loaded(LOOPS), adding: JARVIS } })
  const files = fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': LOOPS })
  fakeGit(on, {})
  const pane = await mount($)
  await Promise.all([pane.input({ key: 'todo-input-### Jarvis', text: 'provare la fila', kind: 'submit' }), pane.press({ key: `todo-box-${K(16)}` })])
  const after = (files.get(PATH) ?? '').split('\n')
  expect(after[16]).toBe('- [x] **NOVA Chat — files and images** — [#597](https://x/597) is with Robin')
  expect(after.slice(32, 34)).toEqual(['- [X] **Docs** — review the guide', '- [ ] provare la fila'])
  expect(after).toHaveLength(LOOPS.split('\n').length + 1)
  expect(todoOf(state).text).toBe(files.get(PATH))
})

test('to do tab: when Jarvis writes the Future work file the tab reloads', async ($, on) => {
  const state = liveState(on, { tab: 'todo', todo: loaded(LOOPS) })
  const files = fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': LOOPS })
  fakeGit(on, {})
  on('agent.list', () => ({ value: [] }))
  on('ui.status', () => ({ value: undefined }) as never)
  on('tool.call', () => { files.set(PATH, `${LOOPS}- nuova\n`); return { result: 'ok' } as never })
  await mount($)
  await $.tool.call({ tool: 'Edit', file_path: PATH, old_string: 'a', new_string: 'b' })
  await settled(state.clock)
  await state.until('todo', t => (t as TodoState).text === `${LOOPS}- nuova\n`)
})

test('to do tab: the edit button opens the Future work file in the Reading editor; when too big, only the open-in-Reading button', async ($, on) => {
  const state = liveState(on, { tab: 'todo', todo: loaded(LOOPS) })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': LOOPS })
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'todo-edit' })
  await state.until('reading', r => (r as Reading).mode === 'edit')
  expect(state.values.tab).toBe('reading')
  expect((state.values.draft as Draft | null)?.path).toBe('Da fare.md')
  state.values.tab = 'todo'
  state.values.todo = { ...EMPTY_TODO, path: 'Da fare.md', isTooBig: true, mtimeMs: AT }
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^Da fare è troppo grande per la scheda$/ })).toBeDefined()
  expect((await pane.find({ key: 'todo-read' }))?.props.label).toBe('Apri in Lettura ›')
  expect(await pane.find({ key: 'todo-edit' })).toBe(undefined)
})

test('control characters: the To Do note and error with a control character are drawn, the control character becomes U+FFFD', async ($, on) => {
  const state = liveState(on, { tab: 'todo', todo: { ...loaded(LOOPS), note: 'Nota\x1bdi prova' } })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD })
  const pane = await mount($)
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect((await pane.find({ type: 'Text', text: /^Nota�di prova$/ }))?.props.color).toBe('warning')
  state.values.todo = { ...EMPTY_TODO, path: 'Da\x1bfare.md', error: 'EA\x1bCCES' }
  await pane.redraw()
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect((await pane.find({ type: 'Text', text: /^Non riesco a leggere Da�fare\.md: EA�CCES$/ }))?.props.color).toBe('error')
})

test('control characters: a Future work file name with a control character is drawn in the tab and in the message', async ($, on) => {
  liveState(on, { tab: 'todo', todo: { ...EMPTY_TODO, path: 'D\x1ba fare.md', isTooBig: true } })
  fakeVault(on, { 'CLAUDE.md': "## Capacita' Jarvis\n\n| Capacita' | Fonte autorevole |\n|---|---|\n| Futuro operativo | `D\x1ba fare.md` |\n" })
  const pane = await mount($)
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect((await pane.find({ type: 'Text', text: /^D�a fare$/ }))?.props.underline).toBe(true)
  expect(await pane.find({ type: 'Text', text: /^D�a fare è troppo grande per la scheda$/ })).toBeDefined()
})

// The keys come from the file text, which may have control characters: the engine must still
// draw it, and a click must press the item that was seen, even the second copy (`text\n2`).
const CTRL_LOOPS = ['## Gruppo', '', '### Sub\x1bA', '- [ ] sale\x1b su\x1b giù', '- [ ] sale\x1b su\x1b giù', '- [ ] sale\x07 su', '', '### Sub\x1bA', '- [ ] altra', ''].join('\n')

test('control characters: items and headings with ESC and two copies in the same block draw with no fault card, and each key presses the right copy', async ($, on) => {
  const state = liveState(on, { tab: 'todo', todo: loaded(CTRL_LOOPS) })
  const writes: string[] = []
  const files = fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': CTRL_LOOPS }, {}, {}, { writes })
  fakeGit(on, {})
  const pane = await mount($)
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  const blocks = parseTodo(CTRL_LOOPS)
  const items = blocks.filter((b): b is TodoItem => b.kind === 'item')
  const adds = blocks.filter(b => b.kind === 'add')
  // Four items, four different keys; the two equal ones have the copy after the characters `\\n` (a backslash and an n, not a newline).
  expect(items.map(i => i.key)).toEqual(['sale\\u001b su\\u001b gi\u00f9', 'sale\\u001b su\\u001b gi\u00f9\\n2', 'sale\\u0007 su', 'altra'])
  expect(adds.map(a => a.key)).toEqual(['### Sub\\u001bA', '### Sub\\u001bA\\n2'])
  // No drawn key has a control character: the item's Markdown does not accept them.
  const control = /[\u0000-\u001f\u007f-\u009f]/
  expect((await pane.findAll({ type: 'Markdown' })).filter(m => control.test(m.key ?? ''))).toEqual([])
  expect((await pane.findAll({ type: 'Button' })).filter(b => control.test(b.key ?? ''))).toEqual([])
  const boxes = (await pane.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('todo-box-')).map(b => b.key)
  expect(boxes).toEqual(items.map(i => `todo-box-${i.key}`))
  const addKeys = (await pane.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('todo-add-')).map(b => b.key)
  expect(addKeys).toEqual(adds.map(a => `todo-add-${a.key}`))
  // The second copy: the tick writes its own line (the fourth), not the first copy's.
  await pane.press({ key: `todo-box-${items[1]!.key}` })
  await state.until('todo', t => (t as TodoState).text !== CTRL_LOOPS)
  expect(writes).toEqual([PATH])
  expect(changedLines(CTRL_LOOPS, files.get(PATH))).toEqual(['4: - [x] sale\x1b su\x1b giù'])
  // The second identical "+ aggiungi" opens the field on its own heading (line 7), not on the first.
  await pane.redraw()
  await pane.press({ key: `todo-add-${adds[1]!.key}` })
  await state.until('todo', t => (t as TodoState).adding !== null)
  expect((todoOf(state).adding as { line: number }).line).toBe(7)
  await pane.redraw()
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect(await pane.find({ key: `todo-input-${adds[1]!.key}` })).toBeDefined()
})

// The tab in English: a vault whose capability table is in English.
const CLAUDE_MD_EN = '## Capabilities\n\n| Capability | Authoritative source |\n|---|---|\n| Future work | `To Do.md` |\n'
const SMALL_EN = '## Focus\n\n### Now\n- [ ] ship the cockpit\n\n### Empty\n'

test('To Do in English: the buttons, the add field and the delete question', async ($, on) => {
  const state = liveState(on, { tab: 'todo', todo: loaded(SMALL_EN) })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN, 'To Do.md': SMALL_EN })
  fakeGit(on, {})
  const pane = await mount($)
  expect((await pane.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('todo-add-')).map(b => b.props.label)).toEqual(['+ Add', '+ Add'])
  expect((await pane.find({ key: 'todo-edit' }))?.props.label).toBe('Edit the file ›')
  await pane.press({ key: 'todo-add-### Empty' })
  await state.until('todo', t => (t as TodoState).adding?.raw === '### Empty')
  await pane.redraw()
  expect((await pane.find({ key: 'todo-input-### Empty' }))?.props.placeholder).toBe('New item in Empty')
  expect((await pane.find({ key: 'todo-cancel' }))?.props.label).toBe('Cancel')
  expect(await pane.find({ type: 'Text', text: /^Enter to add$/ })).toBeDefined()
  await pane.press({ key: 'todo-cancel' })
  await state.until('todo', t => (t as TodoState).adding === null)
  await pane.press({ key: 'todo-del-ship the cockpit' })
  await state.until('todo', t => (t as TodoState).confirm === 'ship the cockpit')
  await pane.redraw()
  expect((await pane.find({ key: 'todo-del-yes-ship the cockpit' }))?.props.label).toBe('Delete?')
  expect((await pane.find({ type: 'Text', text: /^Delete\?$/ }))?.props.color).toBe('warning')
  // The column of ✕ and the question is as wide as the question.
  expect((await pane.findAll({ type: 'Box' })).some(b => b.props.width === 'Delete?'.length)).toBe(true)
  for (const italian of [/^\+ aggiungi$/, /^annulla$/, /^cancella\?$/, /^Modifica il file/]) expect(await pane.find({ text: italian })).toBe(undefined)
})

// The saved tab is a convenience: a store that refuses the write does not stop the tab from loading.
test('To Do in English: a store that refuses to save the tab still loads its items', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN, 'To Do.md': SMALL_EN })
  const store = fakeStore(on, {}, { failSet: true })
  const pane = await mount($)
  await pane.press({ key: 'tab-todo' })
  await state.until('todo', t => (t as TodoState).text === SMALL_EN)
  expect(store.sets).toEqual(['tab'])
  expect(store.data.tab).toBe(undefined)
  expect(state.values.tab).toBe('todo')
  await pane.redraw()
  expect((await pane.find({ key: 'todo-box-ship the cockpit' }))?.props.label).toBe('☐')
})

test('To Do in English: the read error, the too-big card and the loading line', async ($, on) => {
  const state = liveState(on, { tab: 'todo', todo: { ...EMPTY_TODO, path: 'To Do.md', error: 'EACCES' } })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN })
  const pane = await mount($)
  expect((await pane.find({ type: 'Text', text: /^Cannot read To Do\.md: EACCES$/ }))?.props.color).toBe('error')
  state.values.todo = { ...EMPTY_TODO, path: 'To Do.md', isTooBig: true, mtimeMs: AT }
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^To Do is too big for the tab$/ })).toBeDefined()
  expect((await pane.find({ key: 'todo-read' }))?.props.label).toBe('Open in Reading ›')
  state.values.todo = { ...EMPTY_TODO, path: 'To Do.md' }
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^Loading…$/ })).toBeDefined()
  expect(await pane.find({ text: /^Carico…$/ })).toBe(undefined)
})

test('To Do in English: the card for an item that was not added and its discard button', async ($, on) => {
  const state = liveState(on, { tab: 'todo', todo: { ...loaded(SMALL_EN), adding: { line: 2, raw: '### Now' } } })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN, 'To Do.md': SMALL_EN })
  const pane = await mount($)
  await pane.input({ key: 'todo-input-### Now', text: 'keep this', kind: 'change' })
  state.values.todo = { ...todoOf(state), text: SMALL_EN.replace('### Now', '### Later') }
  await pane.redraw()
  expect(await cardTitles(pane)).toContain('Item not added')
  expect((await pane.find({ key: 'todo-lost-discard' }))?.props.label).toBe('Discard')
  await pane.press({ key: 'todo-lost-discard' })
  await state.until('todo', t => (t as TodoState).adding === null)
})
