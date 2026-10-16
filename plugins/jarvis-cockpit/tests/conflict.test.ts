import { test, expect, type Engine } from 'claude-code/testing'
import { PANE, PLUGIN } from '../hooks/state'
import { EMPTY_READING } from '../hooks/reader'
import { TRANSIENT_MS, type Mascot } from '../hooks/mascot'
import type { Draft, Reading } from '../types'
import { AT, ROOT, cardTitles, fakeVault, liveState, paneProps, quiet } from './harness'

const A = 'note/a.md'
const B = 'note/b.md'
const DOC = '# Titolo\n\nprima riga\n'
const MTIME = AT - 3 * 86_400_000

const open = (over: Partial<Reading> = {}): Reading => ({ ...EMPTY_READING, path: A, text: DOC, mtimeMs: MTIME, ...over })
const draftOf = (s: { values: Record<string, unknown> }) => s.values.draft as Draft | null
const readingOf = (s: { values: Record<string, unknown> }) => s.values.reading as Reading
const dirtyB: Draft = { path: B, text: 'cambiato', base: 'orig', eol: '\n', baseMtimeMs: MTIME, baseSize: null, row: 0, col: 0, gen: 99, confirmDiscard: false, error: null, conflict: null, conflictDiff: null, conflictDiffCut: false, pendingOpen: null }

async function mount($: Engine) {
  return $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps() })
}

function toasts(on: Parameters<typeof liveState>[0]): string[] {
  const out: string[] = []
  on('ui.toast', (_$, e) => { out.push(e.text); return { value: undefined } as never })
  return out
}

// A dirty draft on A ("x" at the start), with the pane redrawn.
async function dirtyA($: Engine, state: ReturnType<typeof liveState>) {
  const pane = await mount($)
  await pane.press({ key: 'mode-edit' })
  await state.until('reading', r => (r as Reading).mode === 'edit')
  await pane.redraw()
  await pane.key({ key: 'x', in: 'editor' })
  await state.until('draft', d => (d as Draft | null)?.text === `x${DOC}`)
  await pane.redraw()
  return pane
}

// Lets the fire-and-forget handlers run: a few draws in a row, each one yielding to the engine.
async function settle(pane: Awaited<ReturnType<typeof mount>>) {
  for (let i = 0; i < 10; i++) await pane.redraw()
}

// The opening mtime (1 minute ago) is not the one on disk: the file changed under the draft.
const changed = () => open({ mtimeMs: AT - 60_000 })

test('conflict: a changed file is not overwritten, the card offers the choices', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: changed() })
  const files = fakeVault(on, { [A]: DOC })
  const seen = toasts(on)
  const pane = await dirtyA($, state)
  await pane.press({ key: 'edit-save' })
  await state.until('draft', d => (d as Draft | null)?.conflict === 'disk')
  await state.until('mascot', m => (m as Mascot).state === 'error')
  await pane.redraw()
  expect(files.get(`${ROOT}/${A}`)).toBe(DOC)
  expect(seen).toEqual([])
  expect(await cardTitles(pane)).toContain('Il file è cambiato mentre lo modificavi')
  expect((await pane.find({ key: 'conflict-overwrite' }))?.props.label).toBe('Sovrascrivi')
  expect((await pane.find({ key: 'conflict-reload' }))?.props.label).toBe('Ricarica e perdi la bozza')
  expect((await pane.find({ key: 'conflict-diff' }))?.props.label).toBe('Vedi il diff')
  expect(draftOf(state)?.text).toBe(`x${DOC}`)
})

test('conflict: the same date but a different size still counts as changed, no overwrite', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open({ size: DOC.length }) })
  const files = fakeVault(on, { [A]: DOC })
  const pane = await dirtyA($, state)
  expect(draftOf(state)?.baseSize).toBe(DOC.length)
  // Another write in the same instant: fakeVault does not change the date.
  files.set(`${ROOT}/${A}`, `${DOC}altro\n`)
  await pane.press({ key: 'edit-save' })
  await state.until('draft', d => (d as Draft | null)?.conflict === 'disk')
  expect(files.get(`${ROOT}/${A}`)).toBe(`${DOC}altro\n`)
})

test('conflict: Show the diff displays disk against draft, a second click hides it', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: changed() })
  fakeVault(on, { [A]: DOC })
  const pane = await dirtyA($, state)
  await pane.press({ key: 'edit-save' })
  await state.until('draft', d => (d as Draft | null)?.conflict === 'disk')
  await pane.redraw()
  await pane.press({ key: 'conflict-diff' })
  await state.until('draft', d => (d as Draft | null)?.conflictDiff !== null)
  await pane.redraw()
  // Code carries no key: in Edit mode it is the only Code drawn.
  const code = await pane.find({ type: 'Code' })
  expect(code?.props.format).toBe('diff')
  expect(code?.props.source).toBe(['--- a.md (su disco)', '+++ a.md (bozza)', '@@ -1,4 +1,4 @@', '-# Titolo', '+x# Titolo', ' ', ' prima riga', ' '].join('\n'))
  expect((await pane.find({ key: 'conflict-diff' }))?.props.label).toBe('Nascondi il diff')
  await pane.press({ key: 'conflict-diff' })
  await state.until('draft', d => (d as Draft | null)?.conflictDiff === null)
  await pane.redraw()
  expect(await pane.find({ type: 'Code' })).toBe(undefined)
})

test('conflict: Overwrite writes the draft and closes the card', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: changed() })
  const files = fakeVault(on, { [A]: DOC })
  const seen = toasts(on)
  const pane = await dirtyA($, state)
  await pane.press({ key: 'edit-save' })
  await state.until('draft', d => (d as Draft | null)?.conflict === 'disk')
  await pane.redraw()
  await pane.press({ key: 'conflict-overwrite' })
  await state.until('draft', d => (d as Draft | null)?.conflict === null)
  await pane.redraw()
  expect(files.get(`${ROOT}/${A}`)).toBe(`x${DOC}`)
  expect(seen).toEqual(['Salvato'])
  expect(draftOf(state)).toMatchObject({ base: `x${DOC}`, baseMtimeMs: MTIME, conflictDiff: null })
  expect(await pane.find({ key: 'conflict-overwrite' })).toBe(undefined)
  expect(await pane.find({ text: /^salvato$/ })).toBeDefined()
})

test('conflict: Reload restarts from the file on disk and loses the draft', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: changed() })
  const files = fakeVault(on, { [A]: DOC })
  const pane = await dirtyA($, state)
  files.set(`${ROOT}/${A}`, 'DISCO\n')
  await pane.press({ key: 'edit-save' })
  await state.until('draft', d => (d as Draft | null)?.conflict === 'disk')
  await pane.redraw()
  const before = draftOf(state)?.gen ?? 0
  await pane.press({ key: 'conflict-reload' })
  await state.until('draft', d => (d as Draft | null)?.text === 'DISCO\n')
  await pane.redraw()
  expect(draftOf(state)).toMatchObject({ base: 'DISCO\n', baseMtimeMs: MTIME, conflict: null, row: 0, col: 0 })
  expect(draftOf(state)?.gen).toBeGreaterThan(before)
  expect(readingOf(state)).toMatchObject({ text: 'DISCO\n', mode: 'edit' })
  expect((await pane.find({ key: 'editor' }))?.props.props).toMatchObject({ text: 'DISCO\n' })
  expect(files.get(`${ROOT}/${A}`)).toBe('DISCO\n')
})

test('conflict: Jarvis writes to the file being edited, the draft stays and Save is blocked by the conflict', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open() })
  const files = fakeVault(on, { [A]: DOC })
  on('tool.call', () => ({ result: 'ok' }) as never)
  const pane = await dirtyA($, state)
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/${A}`, old_string: 'prima', new_string: 'PRIMA' })
  await state.until('draft', d => (d as Draft | null)?.conflict === 'jarvis')
  await state.until('mascot', m => (m as Mascot).state === 'error')
  await pane.redraw()
  expect(draftOf(state)?.text).toBe(`x${DOC}`)
  expect(await cardTitles(pane)).toContain('Jarvis ha modificato questo file')
  await pane.press({ key: 'edit-save' })
  await pane.redraw()
  expect(files.get(`${ROOT}/${A}`)).toBe(DOC)
  expect(draftOf(state)?.conflict).toBe('jarvis')
})

test('save: a failed write keeps the draft and shows a red card with the reason', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open() })
  fakeVault(on, { [A]: DOC }, {}, {}, { writeError: 'EACCES' })
  const pane = await dirtyA($, state)
  await pane.press({ key: 'edit-save' })
  await state.until('draft', d => (d as Draft | null)?.error !== null)
  await pane.redraw()
  expect(draftOf(state)?.error).toMatch(/^Non riesco a scrivere il file: .*EACCES/)
  expect(draftOf(state)?.text).toBe(`x${DOC}`)
  expect(await cardTitles(pane)).toContain('Non salvato')
})

test('pending draft: Edit on another file asks Save, Discard or Back to the draft', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open(), draft: dirtyB })
  fakeVault(on, { [A]: DOC, [B]: 'orig' })
  const pane = await mount($)
  await pane.press({ key: 'mode-edit' })
  await state.until('draft', d => (d as Draft | null)?.pendingOpen === A)
  await pane.redraw()
  expect(readingOf(state).mode).toBe('text')
  expect(await cardTitles(pane)).toContain('Bozza non salvata su b.md')
  expect((await pane.find({ key: 'pending-save' }))?.props.label).toBe('Salva')
  expect((await pane.find({ key: 'pending-discard' }))?.props.label).toBe('Scarta')
  expect((await pane.find({ key: 'pending-back' }))?.props.label).toBe('Torna alla bozza')
})

test('pending draft: Discard drops the old draft and opens the new file', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open(), draft: { ...dirtyB, pendingOpen: A } })
  const files = fakeVault(on, { [A]: DOC, [B]: 'orig' })
  const pane = await mount($)
  await pane.press({ key: 'pending-discard' })
  await state.until('reading', r => (r as Reading).mode === 'edit')
  expect(draftOf(state)).toMatchObject({ path: A, text: DOC, pendingOpen: null })
  expect(files.get(`${ROOT}/${B}`)).toBe('orig')
})

test('pending draft: Save writes the old draft and opens the new file', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open(), draft: { ...dirtyB, pendingOpen: A } })
  const files = fakeVault(on, { [A]: DOC, [B]: 'orig' })
  const pane = await mount($)
  await pane.press({ key: 'pending-save' })
  await state.until('reading', r => (r as Reading).mode === 'edit')
  expect(files.get(`${ROOT}/${B}`)).toBe('cambiato')
  expect(draftOf(state)).toMatchObject({ path: A, text: DOC })
})

test('pending draft: Back to the draft reopens the other file in Edit', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open(), draft: { ...dirtyB, pendingOpen: A } })
  fakeVault(on, { [A]: DOC, [B]: 'orig' })
  const pane = await mount($)
  await pane.press({ key: 'pending-back' })
  await state.until('reading', r => (r as Reading).path === B && (r as Reading).mode === 'edit')
  await pane.redraw()
  expect(readingOf(state).back).toEqual([A])
  expect(draftOf(state)).toMatchObject({ path: B, text: 'cambiato', pendingOpen: null })
  expect((await pane.find({ key: 'editor' }))?.props.props).toMatchObject({ text: 'cambiato', gen: 99 })
})

// A text that is not a string makes the Client draw fail: the app stops it (ui.fault).
test('editor fault: the app stops the editor, Reading goes back to Text and the draft stays', async ($, on) => {
  const broken = { ...dirtyB, path: A, text: null as unknown as string, base: DOC }
  const state = liveState(on, { tab: 'reading', reading: open(), draft: broken })
  fakeVault(on, { [A]: DOC })
  const seen = toasts(on)
  const pane = await mount($)
  await pane.press({ key: 'mode-edit' })
  await state.until('reading', r => (r as Reading).mode === 'edit')
  await pane.redraw().catch(() => {})
  await state.until('reading', r => (r as Reading).mode === 'text')
  // The mascot shakes and after 3 s goes back to where it was.
  await state.until('mascot', m => (m as Mascot).state === 'error')
  await state.clock.advance(TRANSIENT_MS)
  expect((state.values.mascot as Mascot).state).toBe('idle')
  expect(seen).toEqual(["L'editor si è fermato: la bozza resta, riaprila da Modifica"])
  expect(draftOf(state)).toEqual(broken)
})

// The mascot and the editor stop independently. A stuck mascot write (slow or refused)
// does not keep the stopped editor in Edit: `ui.fault` used to wait for it before touching Reading.
test('editor fault with the mascot write stuck: Reading still goes back to Text', async ($, on) => {
  let gate: Promise<void> | undefined
  let release = (): void => {}
  const broken = { ...dirtyB, path: A, text: null as unknown as string, base: DOC }
  const state = liveState(on, { tab: 'reading', reading: open(), draft: broken }, key => (key === 'mascot' ? gate : undefined))
  fakeVault(on, { [A]: DOC })
  const seen = toasts(on)
  const pane = await mount($)
  await pane.press({ key: 'mode-edit' })
  await state.until('reading', r => (r as Reading).mode === 'edit')
  gate = new Promise<void>(r => { release = r })
  await pane.redraw().catch(() => {})
  await quiet(state.clock)
  expect(readingOf(state).mode).toBe('text')
  expect(seen).toEqual(["L'editor si è fermato: la bozza resta, riaprila da Modifica"])
  release()
  await state.until('mascot', m => (m as Mascot).state === 'error')
  expect(draftOf(state)).toEqual(broken)
})

// The diff and the editor share one draw (cap of 100,000 characters): the diff is the one that gets cut.
test('conflict: a diff over the budget is cut and ends with a notice line', async ($, on) => {
  const big = Array.from({ length: 3000 }, (_, i) => `riga ${String(i).padStart(4, '0')}...........`).join('\n')
  const draft: Draft = { ...dirtyB, path: A, text: big, base: DOC, conflict: 'disk' }
  const state = liveState(on, { tab: 'reading', reading: open({ mode: 'edit' }), draft })
  fakeVault(on, { [A]: DOC })
  const pane = await mount($)
  await pane.press({ key: 'conflict-diff' })
  await state.until('draft', d => (d as Draft | null)?.conflictDiff !== null)
  const budget = Math.max(2_000, 90_000 - JSON.stringify(big).length)
  const shown = draftOf(state)?.conflictDiff ?? ''
  // A cut diff stays a valid diff: no note inside the source, the flag says it.
  expect(draftOf(state)?.conflictDiffCut).toBe(true)
  expect(shown.includes('diff tagliato')).toBe(false)
  expect(shown.length).toBeLessThanOrEqual(budget)
  expect(shown.endsWith('\n')).toBe(false)
  expect(big.split('\n').some(l => shown.endsWith(`+${l}`))).toBe(true)
  expect(shown.startsWith('--- a.md (su disco)\n+++ a.md (bozza)')).toBe(true)
  await pane.redraw()
  expect((await pane.find({ type: 'Code' }))?.props.source).toBe(shown)
  expect(await pane.find({ type: 'Text', text: /^… diff tagliato$/ })).toBeDefined()
})

test('conflict: Jarvis moves the draft\'s file, the draft follows it and Overwrite writes to the destination', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open() })
  const files = fakeVault(on, { [A]: DOC })
  on('tool.call', () => {
    files.set(`${ROOT}/${B}`, files.get(`${ROOT}/${A}`) ?? '')
    files.delete(`${ROOT}/${A}`)
    return { result: 'ok' } as never
  })
  const pane = await dirtyA($, state)
  await $.tool.call({ tool: 'Bash', command: `mv ${ROOT}/${A} ${ROOT}/${B}` })
  await state.until('draft', d => (d as Draft | null)?.path === B)
  await state.until('reading', r => (r as Reading).path === B)
  expect(draftOf(state)).toMatchObject({ path: B, conflict: 'jarvis', text: `x${DOC}`, base: DOC })
  await pane.redraw()
  await pane.press({ key: 'mode-edit' })
  await state.until('reading', r => (r as Reading).mode === 'edit')
  await pane.redraw()
  expect(await cardTitles(pane)).toContain('Jarvis ha modificato questo file')
  expect((await pane.find({ key: 'editor' }))?.props.props).toMatchObject({ text: `x${DOC}` })
  await pane.press({ key: 'conflict-overwrite' })
  await state.until('draft', d => (d as Draft | null)?.conflict === null)
  expect(files.get(`${ROOT}/${B}`)).toBe(`x${DOC}`)
  expect(files.has(`${ROOT}/${A}`)).toBe(false)
})

test('conflict: Jarvis deletes the draft\'s file, Back to the draft shows it with the card and Overwrite recreates it', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open() })
  // The folder stays: Overwrite places the file in it (its real path) before writing.
  const files = fakeVault(on, { [A]: DOC, [B]: 'orig' }, { note: [{ name: 'b.md', kind: 'file' }] })
  on('tool.call', () => {
    files.delete(`${ROOT}/${A}`)
    return { result: 'ok' } as never
  })
  const pane = await dirtyA($, state)
  await $.tool.call({ tool: 'Bash', command: `rm ${ROOT}/${A}` })
  await state.until('draft', d => (d as Draft | null)?.conflict === 'jarvis')
  await state.until('tab', t => t === 'files')
  // The user opens another file and asks for Edit: the draft on a.md is pending.
  state.values.tab = 'reading'
  state.values.reading = open({ path: B, text: 'orig' })
  await pane.redraw()
  await pane.press({ key: 'mode-edit' })
  await state.until('draft', d => (d as Draft | null)?.pendingOpen === B)
  await pane.redraw()
  await pane.press({ key: 'pending-back' })
  await state.until('reading', r => (r as Reading).path === A && (r as Reading).mode === 'edit')
  await pane.redraw()
  expect(files.has(`${ROOT}/${A}`)).toBe(false)
  expect(draftOf(state)).toMatchObject({ path: A, conflict: 'jarvis', text: `x${DOC}`, pendingOpen: null })
  expect(await cardTitles(pane)).toContain('Jarvis ha modificato questo file')
  expect((await pane.find({ key: 'editor' }))?.props.props).toMatchObject({ text: `x${DOC}` })
  await pane.press({ key: 'conflict-overwrite' })
  await state.until('draft', d => (d as Draft | null)?.conflict === null)
  expect(files.get(`${ROOT}/${A}`)).toBe(`x${DOC}`)
})

const NEW_DOC = '# Titolo\n\nPRIMA riga\n'

test('conflict: Jarvis writes to a file with a clean draft, the draft restarts from disk with no conflict', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open() })
  const files = fakeVault(on, { [A]: DOC })
  on('tool.call', () => {
    files.set(`${ROOT}/${A}`, NEW_DOC)
    return { result: 'ok' } as never
  })
  const pane = await mount($)
  await pane.press({ key: 'mode-edit' })
  await state.until('reading', r => (r as Reading).mode === 'edit')
  await pane.redraw()
  const before = draftOf(state)?.gen ?? 0
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/${A}`, old_string: 'prima', new_string: 'PRIMA' })
  await state.until('draft', d => (d as Draft | null)?.text === NEW_DOC)
  await pane.redraw()
  expect(draftOf(state)).toMatchObject({ path: A, text: NEW_DOC, base: NEW_DOC, conflict: null })
  expect(draftOf(state)?.gen).toBeGreaterThan(before)
  expect(readingOf(state)).toMatchObject({ mode: 'edit', text: NEW_DOC })
  expect(await cardTitles(pane)).not.toContain('Jarvis ha modificato questo file')
  expect((await pane.find({ key: 'editor' }))?.props.props).toMatchObject({ text: NEW_DOC, gen: draftOf(state)?.gen })
  // Overwriting is neither possible nor needed: Save writes Jarvis's text instead of putting the old one back.
  expect(files.get(`${ROOT}/${A}`)).toBe(NEW_DOC)
})

test('conflict: Jarvis rewrites a file with a clean draft and mixed line endings, no draft is kept and Reading goes back to Text', async ($, on) => {
  const MIXED = '# Titolo\r\nPRIMA riga\nseconda\n'
  const state = liveState(on, { tab: 'reading', reading: open() })
  const files = fakeVault(on, { [A]: DOC })
  on('tool.call', () => {
    files.set(`${ROOT}/${A}`, MIXED)
    return { result: 'ok' } as never
  })
  const pane = await mount($)
  await pane.press({ key: 'mode-edit' })
  await state.until('reading', r => (r as Reading).mode === 'edit')
  await pane.redraw()
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/${A}`, old_string: 'prima', new_string: 'PRIMA' })
  await state.until('draft', d => d === null)
  await state.until('reading', r => (r as Reading).text === MIXED)
  await settle(pane)
  expect(readingOf(state).mode).toBe('text')
  expect(await pane.find({ key: 'editor' })).toBe(undefined)
  // Edit is blocked (mixed line endings) and the selector has Text chosen.
  expect(await pane.find({ key: 'mode-edit' })).toBe(undefined)
  expect((await pane.find({ type: 'Text', text: /^Testo$/ }))?.props).toMatchObject({ bold: true, underline: true })
})

test('conflict: Jarvis writes to a file with a clean draft outside Edit, the draft is dropped', async ($, on) => {
  const clean: Draft = { ...dirtyB, path: A, text: DOC, base: DOC }
  const state = liveState(on, { tab: 'reading', reading: open(), draft: clean })
  const files = fakeVault(on, { [A]: DOC })
  on('tool.call', () => {
    files.set(`${ROOT}/${A}`, NEW_DOC)
    return { result: 'ok' } as never
  })
  await mount($)
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/${A}`, old_string: 'prima', new_string: 'PRIMA' })
  await state.until('draft', d => d === null)
  await state.until('reading', r => (r as Reading).text === NEW_DOC)
  expect(readingOf(state).mode).toBe('text')
})

test('save: concurrent saves make a single write and no false conflict', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open() })
  const writes: string[] = []
  fakeVault(on, { [A]: DOC }, {}, {}, { writes, bumpMtime: true })
  const seen = toasts(on)
  const pane = await dirtyA($, state)
  await Promise.all([pane.press({ key: 'edit-save' }), pane.press({ key: 'edit-save' })])
  await state.until('draft', d => (d as Draft | null)?.base === `x${DOC}`)
  await settle(pane)
  expect(writes).toEqual([`${ROOT}/${A}`])
  expect(draftOf(state)?.conflict).toBe(null)
  expect(seen).toEqual(['Salvato'])
})

test('save: even Overwrite does not write a protected file, the draft says why', async ($, on) => {
  const protectedDraft: Draft = { ...dirtyB, path: 'CLAUDE.md', text: 'x', base: 'orig', conflict: 'jarvis' }
  const state = liveState(on, { tab: 'reading', reading: open({ path: 'CLAUDE.md', text: 'orig', mode: 'edit' }), draft: protectedDraft })
  const writes: string[] = []
  fakeVault(on, {}, {}, {}, { writes })
  const pane = await mount($)
  await pane.press({ key: 'conflict-overwrite' })
  await state.until('draft', d => (d as Draft | null)?.error !== null)
  expect(writes).toEqual([])
  expect(draftOf(state)).toMatchObject({ error: 'File protetto: non si salva dal cockpit', text: 'x', conflict: 'jarvis' })
})

test('save: the Future work file is protected but writable and Save writes it; the diary is not', async ($, on) => {
  const md = "## Capacita' Jarvis\n\n| Capacita' | Fonte autorevole |\n|---|---|\n| Futuro operativo | `Da fare.md` |\n| Diario | `D` |\n"
  const loops: Draft = { ...dirtyB, path: 'Da fare.md', text: 'x', base: 'orig' }
  const state = liveState(on, { tab: 'reading', reading: open({ path: 'Da fare.md', text: 'orig', mode: 'edit' }), draft: loops })
  const writes: string[] = []
  const files = fakeVault(on, { 'CLAUDE.md': md, 'Da fare.md': 'orig', 'D/a.md': 'orig' }, {}, {}, { writes })
  const pane = await mount($)
  await pane.press({ key: 'edit-save' })
  await state.until('draft', d => (d as Draft | null)?.base === 'x')
  expect(writes).toEqual([`${ROOT}/Da fare.md`])
  expect(files.get(`${ROOT}/Da fare.md`)).toBe('x')
  state.values.draft = { ...dirtyB, path: 'D/a.md', text: 'x', base: 'orig' }
  state.values.reading = open({ path: 'D/a.md', text: 'orig', mode: 'edit' })
  await pane.redraw()
  await pane.press({ key: 'edit-save' })
  await state.until('draft', d => (d as Draft | null)?.error !== null)
  expect(draftOf(state)?.error).toBe('File protetto: non si salva dal cockpit')
  expect(writes).toEqual([`${ROOT}/Da fare.md`])
})

test('save: Save does not write a file outside the vault', async ($, on) => {
  const outside: Draft = { ...dirtyB, path: '../fuori/a.md', text: 'x', base: 'orig' }
  const state = liveState(on, { tab: 'reading', reading: open({ path: '../fuori/a.md', text: 'orig', mode: 'edit' }), draft: outside })
  const writes: string[] = []
  fakeVault(on, { '../fuori/a.md': 'orig' }, {}, {}, { writes })
  const pane = await mount($)
  await pane.press({ key: 'edit-save' })
  await state.until('draft', d => (d as Draft | null)?.error !== null)
  expect(writes).toEqual([])
})

test('save: Save does not write through a link that lands outside the vault, not even with Overwrite', async ($, on) => {
  const linked: Draft = { ...dirtyB, path: 'ext.md', text: 'x', base: 'orig' }
  const state = liveState(on, { tab: 'reading', reading: open({ path: 'ext.md', text: 'orig', mode: 'edit' }), draft: linked })
  const writes: string[] = []
  const files = fakeVault(on, { '/fuori/a.md': 'orig' }, {}, { 'ext.md': '/fuori/a.md' }, { writes })
  const pane = await mount($)
  await pane.press({ key: 'edit-save' })
  await state.until('draft', d => (d as Draft | null)?.error !== null)
  expect(draftOf(state)).toMatchObject({ error: 'File fuori dal vault: non si salva dal cockpit', text: 'x' })
  state.values.draft = { ...linked, conflict: 'disk' }
  await pane.redraw()
  await pane.press({ key: 'conflict-overwrite' })
  await state.until('draft', d => (d as Draft | null)?.error !== null)
  expect(writes).toEqual([])
  expect(files.get('/fuori/a.md')).toBe('orig')
})

test('save: Save does not write through a link that lands on a protected file', async ($, on) => {
  const linked: Draft = { ...dirtyB, path: 'profile.md', text: 'x', base: 'orig' }
  const state = liveState(on, { tab: 'reading', reading: open({ path: 'profile.md', text: 'orig', mode: 'edit' }), draft: linked })
  const writes: string[] = []
  fakeVault(on, {}, {}, { 'profile.md': `${ROOT}/CLAUDE.md` }, { writes })
  const pane = await mount($)
  await pane.press({ key: 'edit-save' })
  await state.until('draft', d => (d as Draft | null)?.error !== null)
  expect(draftOf(state)?.error).toBe('File protetto: non si salva dal cockpit')
  expect(writes).toEqual([])
})

test('save: a link that lands on a writable file in the vault is saved', async ($, on) => {
  const linked: Draft = { ...dirtyB, path: 'alias.md', text: 'x', base: DOC }
  const state = liveState(on, { tab: 'reading', reading: open({ path: 'alias.md', mode: 'edit' }), draft: linked })
  const writes: string[] = []
  fakeVault(on, { [A]: DOC }, {}, { 'alias.md': `${ROOT}/${A}` }, { writes })
  const pane = await mount($)
  await pane.press({ key: 'edit-save' })
  await state.until('draft', d => (d as Draft | null)?.base === 'x')
  expect(writes).toEqual([`${ROOT}/alias.md`])
  expect(draftOf(state)?.error).toBe(null)
})

test('editor: a malformed post does not change the draft', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open() })
  fakeVault(on, { [A]: DOC })
  const pane = await dirtyA($, state)
  const d = draftOf(state)
  const msg = (data: Record<string, string | number>) => pane.post(data, { in: 'editor' })
  const gen = d?.gen ?? 0
  await msg({ gen, text: 42, row: 0, col: 0 })
  await msg({ gen: 'x', text: 'y', row: 0, col: 0 })
  await msg({ gen, text: 'y', row: 'a', col: 0 })
  await msg({ gen, text: 'y', col: 0 })
  await pane.redraw()
  expect(draftOf(state)).toEqual(d)
})

test('pendingAct: Save or Discard with no choice pending do nothing', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open(), draft: { ...dirtyB, pendingOpen: A } })
  const writes: string[] = []
  fakeVault(on, { [A]: DOC, [B]: 'orig' }, {}, {}, { writes })
  const pane = await mount($)
  // The draw is the one with the card; the state has changed meanwhile (double click).
  state.values.draft = dirtyB
  await pane.press({ key: 'pending-discard' })
  await pane.press({ key: 'pending-save' })
  await settle(pane)
  expect(draftOf(state)).toEqual(dirtyB)
  expect(writes).toEqual([])
  expect(readingOf(state).mode).toBe('text')
})

test('reading: with nothing open and a dirty draft, Back to the draft reopens it in Edit', async ($, on) => {
  const draft: Draft = { ...dirtyB, path: A, text: 'cambiato', base: DOC, conflict: 'jarvis' }
  const state = liveState(on, { tab: 'reading', reading: EMPTY_READING, draft })
  const files = fakeVault(on, { [B]: 'orig' })
  const pane = await mount($)
  expect(await cardTitles(pane)).toContain('Nessun file aperto')
  expect((await pane.find({ key: 'reader-to-draft' }))?.props.label).toBe('Torna alla bozza')
  await pane.press({ key: 'reader-to-draft' })
  await state.until('reading', r => (r as Reading).path === A && (r as Reading).mode === 'edit')
  await pane.redraw()
  expect(draftOf(state)).toMatchObject({ path: A, text: 'cambiato', conflict: 'jarvis' })
  expect(files.has(`${ROOT}/${A}`)).toBe(false)
  expect(await cardTitles(pane)).toContain('Jarvis ha modificato questo file')
})

test('reading: with nothing open and no dirty draft, there is no Back to the draft', async ($, on) => {
  liveState(on, { tab: 'reading', reading: EMPTY_READING, draft: { ...dirtyB, text: 'orig' } })
  fakeVault(on, { [B]: 'orig' })
  const pane = await mount($)
  expect(await pane.find({ key: 'reader-to-draft' })).toBe(undefined)
})
