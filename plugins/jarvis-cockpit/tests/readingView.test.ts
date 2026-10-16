import { test, expect, type Engine } from 'claude-code/testing'
import { PANE, PLUGIN } from '../hooks/state'
import { EMPTY_READING, fileUrl } from '../hooks/reader'
import { emptyTree, withChildren } from '../hooks/tree'
import type { DiffView, Draft, Reading } from '../types'
import { AT, ITALIAN_HEADING, ROOT, cardTitles, fakeGit, fakeVault, liveState, paneProps, quiet } from './harness'

const A = '99 - Jarvis/roadmap/a.md'
const B = '99 - Jarvis/roadmap/b.md'
const DOC = '---\ntype: spec\nrelated:\n  - "[Spec v1](b.md)"\n---\n# Titolo\n\nVedi [B](b.md), [sito](https://example.test) e [rotto](manca.md).\n'
const CLAUDE_MD = "## Capacita' Jarvis\n\n| Capacita' | Fonte autorevole |\n|---|---|\n| Futuro operativo | `Da fare.md` |\n"

const open = (over: Partial<Reading>): Reading => ({ ...EMPTY_READING, path: A, text: DOC, mtimeMs: AT - 3 * 86_400_000, ...over })
const reading = (s: { values: Record<string, unknown> }) => s.values.reading as Reading

async function mount($: Engine) {
  return $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps() })
}

test(`reading: path, mode selector, frontmatter as pills, meta line, rewritten links`, async ($, on) => {
  liveState(on, { tab: 'reading', reading: open({}) })
  fakeVault(on, { [A]: DOC })
  const pane = await mount($)
  expect((await pane.find({ key: 'back' }))?.props.label).toBe('←')
  expect((await pane.find({ key: 'crumb-0' }))?.props.label).toBe('99 - Jarvis')
  expect((await pane.find({ key: 'crumb-1' }))?.props.label).toBe('roadmap')
  expect(await pane.find({ type: 'Text', text: /^a\.md$/ })).toBeDefined()
  // The active mode is an underlined accent-colored Text, the others are flat gray Buttons (like the tabs).
  expect((await pane.find({ type: 'Text', text: /^Testo$/ }))?.props).toMatchObject({ color: '#13918b', bold: true, underline: true })
  expect(await pane.find({ key: 'mode-text' })).toBe(undefined)
  expect((await pane.find({ key: 'mode-diff' }))?.props).toMatchObject({ label: 'Diff', plain: true, dimColor: true })
  expect((await pane.find({ key: 'mode-edit' }))?.props).toMatchObject({ label: 'Modifica', plain: true, dimColor: true })
  expect((await pane.find({ key: 'open-app' }))?.props.label).toBe('↗')
  expect(await pane.find({ text: /modificato 3g fa/ })).toBeDefined()
  expect((await pane.find({ type: 'Text', text: /^ type: spec $/ }))?.props.backgroundColor).toBe('#8080801f')
  expect(await pane.find({ type: 'Text', text: /^ related: Spec v1 $/ })).toBeDefined()
  const doc = (await pane.find({ key: 'doc' }))?.props as { text: string; pressableLinks: string[] }
  expect(doc.text).toContain(`[B](${fileUrl(ROOT, B)})`)
  expect(doc.text).toContain('[sito](https://example.test)')
  expect(doc.pressableLinks).toEqual([fileUrl(ROOT, B), fileUrl(ROOT, '99 - Jarvis/roadmap/manca.md')])
})

test('reading: written by Jarvis, and the declared source on the meta line', async ($, on) => {
  liveState(on, { tab: 'reading', reading: open({ path: 'Da fare.md' }), written: { 'Da fare.md': AT - 120_000 } })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': DOC })
  const pane = await mount($)
  expect(await pane.find({ text: /modificato da Jarvis alle 14:30 · futuro op\./ })).toBeDefined()
})

test('reading: a file that is too long, Edit is off with the reason', async ($, on) => {
  liveState(on, { tab: 'reading', reading: open({ text: null, isTooBig: true }) })
  fakeVault(on, { [A]: DOC })
  const pane = await mount($)
  expect(await pane.find({ text: /troppo lungo per il pannello/ })).toBeDefined()
  expect((await pane.find({ key: 'reader-open-app' }))?.props.label).toBe("Apri nell'app")
  expect(await pane.find({ key: 'mode-edit' })).toBe(undefined)
  expect(await pane.find({ text: /Modifica: troppo lungo, usa ↗/ })).toBeDefined()
})

test('reading: a protected file cannot be edited in the pane', async ($, on) => {
  liveState(on, { tab: 'reading', reading: open({ path: 'CLAUDE.md', text: CLAUDE_MD }) })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD })
  const pane = await mount($)
  expect(await pane.find({ key: 'mode-edit' })).toBe(undefined)
  expect(await pane.find({ text: /Modifica: file protetto, si modifica in chat/ })).toBeDefined()
})

test('reading: AGENTS.md and Jarvis Lite\'s managed core cannot be edited in the pane', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open({}) })
  fakeVault(on, { [A]: DOC, 'AGENTS.md': DOC, '99 - Jarvis/system/x.md': DOC })
  const pane = await mount($)
  expect(await pane.find({ key: 'mode-edit' })).toBeDefined()
  for (const path of ['AGENTS.md', '99 - Jarvis/system/x.md']) {
    state.values.reading = open({ path })
    await pane.redraw()
    expect([path, await pane.find({ key: 'mode-edit' })]).toEqual([path, undefined])
    expect(await pane.find({ text: /Modifica: file protetto, si modifica in chat/ })).toBeDefined()
  }
})

test('reading: the Future work file can be edited in the pane, the diary and the memory cannot', async ($, on) => {
  const md = "## Capacita' Jarvis\n\n| Capacita' | Fonte autorevole |\n|---|---|\n| Futuro operativo | `Da fare.md` |\n| Diario | `01 - Diary` |\n| Memoria durevole | `99 - Jarvis/memory/MEMORY.md` |\n"
  const state = liveState(on, { tab: 'reading', reading: open({ path: 'Da fare.md' }) })
  fakeVault(on, { 'CLAUDE.md': md, 'Da fare.md': DOC })
  const pane = await mount($)
  expect(await pane.find({ key: 'mode-edit' })).toBeDefined()
  for (const path of ['01 - Diary/2026/10/2026-10-09.md', '99 - Jarvis/memory/user_alex.md']) {
    state.values.reading = open({ path })
    await pane.redraw()
    expect([path, await pane.find({ key: 'mode-edit' })]).toEqual([path, undefined])
    expect(await pane.find({ text: /Modifica: file protetto, si modifica in chat/ })).toBeDefined()
  }
})

test('reading: a folder in the path opens in the Files tab', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open({}) })
  fakeVault(on, { [A]: DOC }, { '': [{ name: '99 - Jarvis', kind: 'dir' }], '99 - Jarvis': [{ name: 'roadmap', kind: 'dir' }], '99 - Jarvis/roadmap': [{ name: 'a.md', kind: 'file' }] })
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'crumb-1' })
  await state.until('tab', t => t === 'files')
  const tree = state.values.tree as { cursor: string; expanded: string[] }
  expect(tree.cursor).toBe('99 - Jarvis/roadmap')
  expect(tree.expanded).toEqual(['99 - Jarvis', '99 - Jarvis/roadmap'])
})

test('hook: a .md over the size limit is not read and offers the Files pane', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: withChildren(emptyTree(), '', [{ name: 'big.md', kind: 'file', mtimeMs: 0, isLink: false }]) })
  fakeVault(on, { 'big.md': 'x'.repeat(80_001) })
  const pane = await mount($)
  await pane.press({ key: 'r:big.md' })
  await state.until('tab', t => t === 'reading')
  expect(reading(state)).toMatchObject({ path: 'big.md', text: null, isTooBig: true })
})

test('files tab: a click on a .md opens Reading', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: withChildren(emptyTree(), '', [{ name: 'n.md', kind: 'file', mtimeMs: 0, isLink: false }]) })
  fakeVault(on, { 'n.md': '# Nota\n' })
  const pane = await mount($)
  await pane.press({ key: 'r:n.md' })
  await state.until('tab', t => t === 'reading')
  expect(reading(state)).toMatchObject({ path: 'n.md', text: '# Nota\n', back: [], mode: 'text' })
})

test('internal links: followed on click, ← walks them back and then returns to the tree', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open({}) })
  fakeVault(on, { [A]: DOC, [B]: '# B\n' })
  const pane = await mount($)
  await pane.press({ key: 'doc', link: { href: fileUrl(ROOT, B) } })
  await state.until('reading', r => (r as Reading).path === B)
  expect(reading(state).back).toEqual([A])
  await pane.press({ key: 'back' })
  await state.until('reading', r => (r as Reading).path === A)
  expect(reading(state).back).toEqual([])
  await pane.press({ key: 'back' })
  await state.until('tab', t => t === 'files')
})

test('internal links: a broken link gives a notice, the open file stays', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open({}) })
  fakeVault(on, { [A]: DOC })
  let toasted: (t: string) => void = () => {}
  const toast = new Promise<string>(r => { toasted = r })
  on('ui.toast', (_$, e) => { toasted(e.text); return { value: undefined } as never })
  const pane = await mount($)
  await pane.press({ key: 'doc', link: { href: fileUrl(ROOT, '99 - Jarvis/roadmap/manca.md') } })
  expect(await toast).toBe('File non trovato: 99 - Jarvis/roadmap/manca.md')
  expect(reading(state).path).toBe(A)
})

test('reading: ↗ opens the file in the Files pane of the app', async ($, on) => {
  liveState(on, { tab: 'reading', reading: open({}) })
  fakeVault(on, { [A]: DOC })
  let called: (v: unknown) => void = () => {}
  const call = new Promise<unknown>(r => { called = r })
  on('mcp.call', (_$, e) => { called([e.server, e.tool, e.args]); return { value: { content: [] } } as never })
  const pane = await mount($)
  await pane.press({ key: 'open-app' })
  expect(await call).toEqual(['ccd_view', 'show_pane', { pane: 'file', path: `/v/${A}` }])
})

test('hook: when Jarvis writes the open file, Reading reloads and says so', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open({}) })
  fakeVault(on, { [A]: '# Nuovo\n' }, { '': [] })
  fakeGit(on, {})
  on('agent.list', () => ({ value: [] }))
  on('ui.status', () => ({ value: undefined }) as never)
  on('tool.call', () => ({ result: 'ok' }) as never)
  await $.tool.call({ tool: 'Edit', file_path: `/v/${A}`, old_string: 'a', new_string: 'b' })
  await state.until('reading', r => (r as Reading).updatedAt === AT)
  expect(reading(state).text).toBe('# Nuovo\n')
  const pane = await mount($)
  expect(await pane.find({ text: /aggiornato ora/ })).toBeDefined()
})

const HUNK = '@@ -1,1 +1,1 @@\n-a\n+b\n'

for (const [name, diff, expected] of [
  ['uncommitted', { kind: 'uncommitted', text: HUNK, isCut: false }, /modifiche non committate/],
  ['last commit', { kind: 'commit', text: HUNK, isCut: true, at: AT, subject: 'vault: 2026-10-09 14:32' }, /ultimo commit · .* 14:32 · vault: 2026-10-09 14:32/],
  ['new file', { kind: 'untracked' }, /file nuovo, non ancora in git/],
  ['no history', { kind: 'none' }, /nessuna storia in git per questo file/],
  ['git missing', { kind: 'error' }, /diff non disponibile/],
] as const) {
  test(`diff: ${name}`, async ($, on) => {
    liveState(on, { tab: 'reading', reading: open({ mode: 'diff', diff: diff as DiffView }) })
    fakeVault(on, {})
    const pane = await mount($)
    expect(await pane.find({ text: expected })).toBeDefined()
  })
}

test('diff: hunks drawn as a diff, the cut is flagged', async ($, on) => {
  liveState(on, { tab: 'reading', reading: open({ mode: 'diff', diff: { kind: 'uncommitted', text: HUNK, isCut: true } }) })
  fakeVault(on, {})
  const pane = await mount($)
  expect((await pane.find({ type: 'Code' }))?.props).toMatchObject({ source: HUNK, format: 'diff' })
  expect(await pane.find({ text: /diff troncato/ })).toBeDefined()
})

test('hook: Diff with uncommitted changes, then Text', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open({}) })
  fakeVault(on, { [A]: DOC })
  const calls = fakeGit(on, { status: ` M ${A}\0`, diff: HUNK })
  const pane = await mount($)
  await pane.press({ key: 'mode-diff' })
  await state.until('reading', r => (r as Reading).diff !== null)
  expect(reading(state)).toMatchObject({ mode: 'diff', diff: { kind: 'uncommitted', text: HUNK, isCut: false } })
  expect(calls.some(c => c.includes('diff') && c.includes('HEAD') && c.includes(A))).toBe(true)
  // The active mode is a Text: mode-text becomes a Button only after the redraw.
  await pane.redraw()
  await pane.press({ key: 'mode-text' })
  await state.until('reading', r => (r as Reading).mode === 'text')
})

test('diff: Text → Diff → Text → Diff, the previous diff stays until the new one arrives', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open({}) })
  fakeVault(on, { [A]: DOC })
  const late: Record<string, () => Promise<void>> = {}
  const calls = fakeGit(on, { status: ` M ${A}\0`, diff: HUNK }, [], late)
  const pane = await mount($)
  await pane.press({ key: 'mode-diff' })
  await state.until('reading', r => (r as Reading).diff !== null)
  await pane.redraw()
  await pane.press({ key: 'mode-text' })
  await state.until('reading', r => (r as Reading).mode === 'text')
  await pane.redraw()
  // The second diff arrives late: meanwhile the previous one stays.
  let release = (): void => {}
  late.diff = () => new Promise<void>(r => { release = r })
  await pane.press({ key: 'mode-diff' })
  await state.until('reading', r => (r as Reading).mode === 'diff')
  await pane.redraw()
  expect(await pane.find({ text: /Carico il diff/ })).toBe(undefined)
  expect((await pane.find({ type: 'Code' }))?.props.source).toBe(HUNK)
  const sets = state.sets.reading
  // The second `git diff` has started and waits at the gate: `quiet` lets what is in progress run, with no real time.
  await quiet(state.clock)
  expect(calls.filter(c => c.includes('diff')).length).toBe(2)
  release()
  await quiet(state.clock)
  // The same diff is not rewritten.
  expect(state.sets.reading).toBe(sets)
})

test('hook: Diff of a clean file shows its last commit', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open({}) })
  fakeVault(on, { [A]: DOC })
  fakeGit(on, { status: '', log: 'abc1234\x001759999999\x00vault: autocommit\n', show: HUNK })
  const pane = await mount($)
  await pane.press({ key: 'mode-diff' })
  await state.until('reading', r => (r as Reading).diff !== null)
  expect(reading(state).diff).toEqual({ kind: 'commit', text: HUNK, isCut: false, at: 1759999999000, subject: 'vault: autocommit' })
})

function writeHooks(on: Parameters<typeof liveState>[0]) {
  on('agent.list', () => ({ value: [] }))
  on('ui.status', () => ({ value: undefined }) as never)
  on('tool.call', () => ({ result: 'ok' }) as never)
}

function toasts(on: Parameters<typeof liveState>[0]) {
  let toasted: (t: string) => void = () => {}
  const first = new Promise<string>(r => { toasted = r })
  on('ui.toast', (_$, e) => { toasted(e.text); return { value: undefined } as never })
  return first
}

test('hook: when Jarvis deletes the open file, a notice and back to the tree', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open({}) })
  fakeVault(on, {}, { '': [] })
  fakeGit(on, {})
  writeHooks(on)
  on('store.set', () => ({ value: undefined }))
  const toast = toasts(on)
  await $.tool.call({ tool: 'Bash', command: `rm "/v/${A}"` })
  expect(await toast).toBe('File non più nel vault')
  await state.until('tab', t => t === 'files')
  expect(reading(state)).toEqual(EMPTY_READING)
})

test('hook: when Jarvis moves the open file, Reading follows it', async ($, on) => {
  const C = '07 - Archive/a.md'
  const state = liveState(on, { tab: 'reading', reading: open({ back: [B] }) })
  fakeVault(on, { [C]: '# Spostato\n' }, { '': [] })
  fakeGit(on, {})
  writeHooks(on)
  await $.tool.call({ tool: 'Bash', command: `mv "/v/${A}" "/v/${C}"` })
  await state.until('reading', r => (r as Reading).path === C)
  expect(reading(state)).toMatchObject({ path: C, back: [B], text: '# Spostato\n' })
  expect(state.values.tab).toBe('reading')
})

test('hook: when Jarvis moves the open file into a folder, Reading follows it', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open({}) })
  fakeVault(on, { 'Archivio/a.md': '# Spostato\n' }, { '': [], Archivio: [{ name: 'a.md', kind: 'file' }] })
  fakeGit(on, {})
  writeHooks(on)
  await $.tool.call({ tool: 'Bash', command: `mv "/v/${A}" /v/Archivio/` })
  await state.until('reading', r => (r as Reading).path === 'Archivio/a.md')
})

test('hook: a reload that fails does not say "updated just now"', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open({}) })
  on('session.root', () => ({ value: ROOT }))
  on('session.cwd', () => ({ value: ROOT }))
  on('fs.exists', (_$, e) => ({ value: e.path === `/v/${A}` || e.path === '/v/CLAUDE.md' }) as never)
  on('fs.read', (_$, e) => { if (e.path === '/v/CLAUDE.md') return { value: ITALIAN_HEADING } as never; throw new Error('ENOENT') })
  on('fs.stat', () => { throw new Error('EACCES') })
  on('fs.list', () => ({ value: [] }) as never)
  on('store.set', () => ({ value: undefined }))
  fakeGit(on, {})
  writeHooks(on)
  const toast = toasts(on)
  await $.tool.call({ tool: 'Edit', file_path: `/v/${A}`, old_string: 'a', new_string: 'b' })
  expect(await toast).toBe('File non più nel vault')
  await state.until('tab', t => t === 'files')
  expect(reading(state).updatedAt).toBe(null)
})

test('reading: a file that vanishes between the check and the read gives a notice, and Reading stays on the tree', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: withChildren(emptyTree(), '', [{ name: 'n.md', kind: 'file', mtimeMs: 0, isLink: false }]) })
  on('session.root', () => ({ value: ROOT }))
  on('fs.exists', (_$, e) => ({ value: e.path === '/v/n.md' || e.path === '/v/CLAUDE.md' }) as never)
  on('fs.read', (_$, e) => { if (e.path === '/v/CLAUDE.md') return { value: ITALIAN_HEADING } as never; throw new Error('ENOENT') })
  on('fs.stat', () => { throw new Error('ENOENT') })
  const toast = toasts(on)
  const pane = await mount($)
  await pane.press({ key: 'r:n.md' })
  expect(await toast).toBe('File non trovato: n.md')
  expect(state.values.tab).toBe('files')
  expect(reading(state).path).toBe(null)
})

test('hook: a Diff that throws shows "Diff unavailable"', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open({}) })
  on('session.root', () => { throw new Error('no root') })
  const pane = await mount($)
  await pane.press({ key: 'mode-diff' })
  await state.until('reading', r => (r as Reading).diff !== null)
  expect(reading(state)).toMatchObject({ mode: 'diff', diff: { kind: 'error' } })
})

test('reading: code is shown highlighted, with line numbers and without Edit; Diff stays', async ($, on) => {
  const TSX = '---\nnon: frontmatter\n---\nconst a = 1\n'
  liveState(on, { tab: 'reading', reading: open({ path: 'hooks/a.tsx', text: TSX }) })
  fakeVault(on, { 'hooks/a.tsx': TSX })
  const pane = await mount($)
  expect((await pane.find({ type: 'Code' }))?.props).toMatchObject({ source: TSX, path: 'hooks/a.tsx', startLine: 1 })
  expect(await pane.find({ key: 'doc' })).toBe(undefined)
  // The frontmatter pills are for Markdown only.
  expect(await pane.find({ type: 'Text', text: /non: frontmatter/ })).toBe(undefined)
  expect(await pane.find({ key: 'mode-edit' })).toBe(undefined)
  expect(await pane.find({ text: /Modifica: solo per i Markdown/ })).toBeDefined()
  expect(await pane.find({ key: 'mode-diff' })).toBeDefined()
})

test('reading: a file that is not text says so and offers the Files pane', async ($, on) => {
  liveState(on, { tab: 'reading', reading: open({ path: 'dati/blob', text: 'ab\u0000cd' }) })
  fakeVault(on, { 'dati/blob': 'ab\u0000cd' })
  const pane = await mount($)
  expect(await pane.find({ text: /Non è un file di testo/ })).toBeDefined()
  expect(await pane.find({ type: 'Code' })).toBe(undefined)
  expect((await pane.find({ key: 'reader-open-app' }))?.props.label).toBe("Apri nell'app")
})

test('internal links: a code file opens in Reading with its back history, an image opens in the Files pane', async ($, on) => {
  const TS = '99 - Jarvis/roadmap/x.ts'
  const PNG = '99 - Jarvis/roadmap/logo.png'
  const NOTE = 'Vedi [il codice](x.ts) e [il logo](logo.png).\n'
  const state = liveState(on, { tab: 'reading', reading: open({ text: NOTE }) })
  fakeVault(on, { [A]: NOTE, [TS]: 'export const x = 1\n', [PNG]: 'png' })
  let called: (v: unknown) => void = () => {}
  const call = new Promise<unknown>(r => { called = r })
  on('mcp.call', (_$, e) => { called([e.server, e.tool, e.args]); return { value: { content: [] } } as never })
  const pane = await mount($)
  await pane.press({ key: 'doc', link: { href: fileUrl(ROOT, PNG) } })
  expect(await call).toEqual(['ccd_view', 'show_pane', { pane: 'file', path: `/v/${PNG}` }])
  expect(reading(state).path).toBe(A)
  state.clock.advance(1000)
  await pane.press({ key: 'doc', link: { href: fileUrl(ROOT, TS) } })
  await state.until('reading', r => (r as Reading).path === TS)
  expect(reading(state)).toMatchObject({ text: 'export const x = 1\n', back: [A] })
})

test('reading: a file written on Windows (\\r\\n) is drawn, Markdown or code', async ($, on) => {
  const MD = '---\r\ntype: x\r\n---\r\n# T\r\n\r\nriga\r\n'
  const state = liveState(on, { tab: 'reading', reading: open({ text: MD }) })
  fakeVault(on, { [A]: MD, 'run.bat': 'echo a\r\n' })
  const pane = await mount($)
  expect((await pane.find({ key: 'doc' }))?.props.text).toBe('# T\n\nriga\n')
  expect(await pane.find({ type: 'Text', text: /^ type: x $/ })).toBeDefined()
  state.values.reading = open({ path: 'run.bat', text: 'echo a\r\n' })
  await pane.redraw()
  expect((await pane.find({ type: 'Code' }))?.props.source).toBe('echo a\n')
})

test('fault card: a drawing error shows the minimal card; Reload returns to Recap, resets Reading and the file operation, keeps the draft', async ($, on) => {
  const draft: Draft = { path: B, text: 'x', base: '', eol: '\n', baseMtimeMs: 0, baseSize: null, row: 0, col: 0, gen: 1, confirmDiscard: false, error: null, conflict: null, conflictDiff: null, conflictDiffCut: false, pendingOpen: null }
  // A text that is not a string: drawing Reading throws.
  const state = liveState(on, { tab: 'reading', reading: open({ text: 42 as unknown as string }), fileOp: { kind: 'move', path: A, text: A }, draft })
  fakeVault(on, { [A]: DOC })
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBeDefined()
  await pane.press({ key: 'fault-reload' })
  await state.until('reading', r => (r as Reading).path === null)
  // The four writes of Reload (tab, Reading, operation, bubble) do not arrive in a fixed order: wait for them before reading.
  await state.until('fileOp', v => v === null)
  await state.until('tab', t => t === 'recap')
  expect([state.values.tab, state.values.fileOp]).toEqual(['recap', null])
  expect(state.values.draft).toEqual(draft)
  await pane.redraw()
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
})

test('reading: a frontmatter value with a control character still draws as a pill, the control character becomes U+FFFD', async ($, on) => {
  const text = '---\ntitle: a\x1bb\n---\n# x\n'
  liveState(on, { tab: 'reading', reading: open({ text }) })
  fakeVault(on, { [A]: text })
  const pane = await mount($)
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect(await pane.find({ type: 'Text', text: /^ title: a�b $/ })).toBeDefined()
})

test('reading: a role with a control character in the CLAUDE.md table still draws on the meta line, the control character becomes U+FFFD', async ($, on) => {
  const md = "## Capacita' Jarvis\n\n| Capacita' | Fonte autorevole |\n|---|---|\n| Appunti\x1bX | `Notes` |\n"
  liveState(on, { tab: 'reading', reading: open({ path: 'Notes/a.md' }) })
  fakeVault(on, { 'CLAUDE.md': md, 'Notes/a.md': DOC })
  const pane = await mount($)
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect(await pane.find({ type: 'Text', text: /^modificato 3g fa · appunti�x$/ })).toBeDefined()
})

test('reading: a commit subject with a control character still draws in Diff, the control character becomes U+FFFD', async ($, on) => {
  const diff: DiffView = { kind: 'commit', text: HUNK, isCut: false, at: AT, subject: 'vault:\x1b autocommit' }
  liveState(on, { tab: 'reading', reading: open({ mode: 'diff', diff }) })
  fakeVault(on, {})
  const pane = await mount($)
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect(await pane.find({ type: 'Text', text: /^ultimo commit · .* 14:32 · vault:� autocommit$/ })).toBeDefined()
})

test('reading: a read error with a control character still draws, the control character becomes U+FFFD', async ($, on) => {
  liveState(on, { tab: 'reading', reading: open({ text: null, error: 'EA\x1bCCES' }) })
  fakeVault(on, { [A]: DOC })
  const pane = await mount($)
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect((await pane.find({ type: 'Text', text: /^Non riesco a leggere il file: EA�CCES$/ }))?.props.color).toBe('error')
})

test('reading: a draft error with a control character still draws in the Not saved card', async ($, on) => {
  const draft: Draft = { path: A, text: 'x', base: 'y', eol: '\n', baseMtimeMs: 0, baseSize: null, row: 0, col: 0, gen: 1, confirmDiscard: false, error: 'No\x1bpe', conflict: null, conflictDiff: null, conflictDiffCut: false, pendingOpen: null }
  liveState(on, { tab: 'reading', reading: open({ mode: 'edit' }), draft })
  fakeVault(on, { [A]: DOC })
  const pane = await mount($)
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect(await cardTitles(pane)).toContain('Non salvato')
  expect((await pane.find({ type: 'Text', text: /^No�pe$/ }))?.props.color).toBe('error')
})

test('reading: the file of an unsaved draft with a control character still draws, in the empty Reading row and in the card', async ($, on) => {
  const BAD = '99 - Jarvis/roadmap/b\x1bb.md'
  const draft: Draft = { path: BAD, text: 'cambiato', base: 'orig', eol: '\n', baseMtimeMs: 0, baseSize: null, row: 0, col: 0, gen: 1, confirmDiscard: false, error: null, conflict: null, conflictDiff: null, conflictDiffCut: false, pendingOpen: null }
  const state = liveState(on, { tab: 'reading', reading: EMPTY_READING, draft })
  fakeVault(on, { [A]: DOC, [BAD]: 'orig' })
  const pane = await mount($)
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect(await pane.find({ type: 'Text', text: /^Bozza non salvata su b�b\.md$/ })).toBeDefined()
  state.values.reading = open({})
  state.values.draft = { ...draft, pendingOpen: A }
  await pane.redraw()
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect(await cardTitles(pane)).toContain('Bozza non salvata su b�b.md')
})

// Reading in English: a vault whose capability table is in English draws the tab in English.
const CLAUDE_MD_EN = '## Capabilities\n\n| Capability | Authoritative source |\n|---|---|\n| Future work | `To Do.md` |\n'
const ITALIAN_READING = [/^Testo$/, /^Modifica$/, /modificato/, /troppo lungo/, /Nessun file aperto/, /Apri nell'app/, /Sovrascrivi/, /Bozza non salvata/]

test('Reading in English: the mode picker, the meta line and the edit button', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open({}) })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN, [A]: DOC, 'To Do.md': DOC }, {}, {}, {})
  const pane = await mount($)
  expect(await pane.find({ type: 'Text', text: /^Text$/ })).toBeDefined()
  expect((await pane.find({ key: 'mode-diff' }))?.props.label).toBe('Diff')
  expect((await pane.find({ key: 'mode-edit' }))?.props.label).toBe('Edit')
  expect(await pane.find({ type: 'Text', text: /^modified 3d ago$/ })).toBeDefined()
  state.values.reading = open({ updatedAt: AT })
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^updated just now$/ })).toBeDefined()
  state.values.reading = open({ path: 'To Do.md' })
  state.values.written = { 'To Do.md': AT - 120_000 }
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^modified by Jarvis at 14:30 · to do$/ })).toBeDefined()
  for (const italian of ITALIAN_READING) expect(await pane.find({ text: italian })).toBe(undefined)
})

test('Reading in English: why the file cannot be edited, or drawn', async ($, on) => {
  const TSX = 'const a = 1\n'
  const state = liveState(on, { tab: 'reading', reading: open({ text: null, isTooBig: true }) })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN, [A]: DOC, 'hooks/a.tsx': TSX })
  const pane = await mount($)
  expect(await pane.find({ type: 'Text', text: /^File too long for the panel\.$/ })).toBeDefined()
  expect((await pane.find({ key: 'reader-open-app' }))?.props.label).toBe('Open in app')
  expect(await pane.find({ key: 'mode-edit' })).toBe(undefined)
  expect(await pane.find({ type: 'Text', text: /^Edit: too long, use ↗$/ })).toBeDefined()
  state.values.reading = open({ path: 'CLAUDE.md', text: CLAUDE_MD_EN })
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^Edit: protected file, edit in chat$/ })).toBeDefined()
  state.values.reading = open({ path: 'hooks/a.tsx', text: TSX })
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^Edit: Markdown only$/ })).toBeDefined()
  state.values.reading = open({ text: 'ab\u0000cd' })
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^Not a text file\.$/ })).toBeDefined()
  state.values.reading = open({ text: null, error: 'EACCES' })
  await pane.redraw()
  expect((await pane.find({ type: 'Text', text: /^Cannot read the file: EACCES$/ }))?.props.color).toBe('error')
  state.values.reading = open({ text: null })
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^Loading the file…$/ })).toBeDefined()
  for (const italian of [/Non è un file di testo/, /Non riesco a leggere/, /Carico il file/, /Modifica:/]) expect(await pane.find({ text: italian })).toBe(undefined)
})

for (const [name, diff, expected] of [
  ['uncommitted', { kind: 'uncommitted', text: HUNK, isCut: false }, /^Uncommitted changes$/],
  ['last commit', { kind: 'commit', text: HUNK, isCut: true, at: AT, subject: 'vault: 2026-10-09 14:32' }, /^Last commit · .* 14:32 · vault: 2026-10-09 14:32$/],
  ['new file', { kind: 'untracked' }, /^New file, not in git yet$/],
  ['no history', { kind: 'none' }, /^No history in git for this file$/],
  ['git missing', { kind: 'error' }, /^Diff unavailable$/],
  ['same text', { kind: 'uncommitted', text: '  \n', isCut: false }, /^No differences$/],
  ['cut', { kind: 'uncommitted', text: HUNK, isCut: true }, /^Diff truncated$/],
  ['loading', null, /^Loading the diff…$/],
] as const) {
  test(`Reading in English, diff: ${name}`, async ($, on) => {
    liveState(on, { tab: 'reading', reading: open({ mode: 'diff', diff: diff as DiffView | null }) })
    fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN, [A]: DOC })
    const pane = await mount($)
    expect(await pane.find({ type: 'Text', text: expected })).toBeDefined()
  })
}

test('Reading in English: the empty tab and the draft saved elsewhere', async ($, on) => {
  const draft: Draft = { path: B, text: 'changed', base: 'orig', eol: '\n', baseMtimeMs: 0, baseSize: null, row: 0, col: 0, gen: 1, confirmDiscard: false, error: null, conflict: null, conflictDiff: null, conflictDiffCut: false, pendingOpen: null }
  const state = liveState(on, { tab: 'reading', reading: EMPTY_READING })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN, [A]: DOC, [B]: 'orig' })
  const pane = await mount($)
  expect(await cardTitles(pane)).toContain('No file open')
  expect(await pane.find({ type: 'Text', text: /^Pick a file from the Files tab$/ })).toBeDefined()
  state.values.draft = draft
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^Unsaved draft on b\.md$/ })).toBeDefined()
  expect((await pane.find({ key: 'reader-to-draft' }))?.props.label).toBe('Back to the draft')
  for (const italian of [/Nessun file aperto/, /Scegli un file/, /Bozza non salvata/, /Torna alla bozza/]) expect(await pane.find({ text: italian })).toBe(undefined)
})

test('Reading in English: the conflict card, the pending card and the edit bar', async ($, on) => {
  const base: Draft = { path: A, text: 'x', base: 'y', eol: '\n', baseMtimeMs: 0, baseSize: null, row: 0, col: 0, gen: 1, confirmDiscard: false, error: null, conflict: null, conflictDiff: null, conflictDiffCut: false, pendingOpen: null }
  const state = liveState(on, { tab: 'reading', reading: open({ mode: 'edit' }), draft: { ...base, error: 'EACCES' } })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN, [A]: DOC })
  const pane = await mount($)
  // The edit bar: the error card, the state, the buttons.
  expect(await cardTitles(pane)).toContain('Not saved')
  expect(await pane.find({ type: 'Text', text: /Unsaved$/ })).toBeDefined()
  expect((await pane.find({ key: 'edit-cancel' }))?.props.label).toBe('Cancel')
  expect((await pane.find({ key: 'edit-save' }))?.props.label).toBe('Save')
  state.values.draft = { ...base, confirmDiscard: true }
  await pane.redraw()
  expect((await pane.find({ key: 'edit-cancel' }))?.props.label).toBe('Press again to discard')
  state.values.draft = { ...base, text: 'y' }
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^Saved$/ })).toBeDefined()
  // The conflict card: who changed the file, the choices, the diff toggle.
  state.values.draft = { ...base, conflict: 'jarvis' }
  await pane.redraw()
  expect(await cardTitles(pane)).toContain('Jarvis changed this file')
  expect(await pane.find({ type: 'Text', text: /^Your draft stays until you choose\.$/ })).toBeDefined()
  expect((await pane.find({ key: 'conflict-overwrite' }))?.props.label).toBe('Overwrite')
  expect((await pane.find({ key: 'conflict-reload' }))?.props.label).toBe('Reload and lose the draft')
  expect((await pane.find({ key: 'conflict-diff' }))?.props.label).toBe('Show the diff')
  state.values.draft = { ...base, conflict: 'disk', conflictDiff: '', conflictDiffCut: true }
  await pane.redraw()
  expect(await cardTitles(pane)).toContain('The file changed while you were editing')
  expect((await pane.find({ key: 'conflict-diff' }))?.props.label).toBe('Hide the diff')
  expect(await pane.find({ type: 'Text', text: /^No differences$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^… diff cut$/ })).toBeDefined()
  // The pending card: Edit asked on a file while another one has an unsaved draft.
  state.values.reading = open({ path: B, mode: 'text' })
  state.values.draft = { ...base, pendingOpen: B }
  await pane.redraw()
  expect(await cardTitles(pane)).toContain('Unsaved draft on a.md')
  expect(await pane.find({ type: 'Text', text: /^One draft at a time: decide what to do with it first\.$/ })).toBeDefined()
  expect((await pane.find({ key: 'pending-save' }))?.props.label).toBe('Save')
  expect((await pane.find({ key: 'pending-discard' }))?.props.label).toBe('Discard')
  expect((await pane.find({ key: 'pending-back' }))?.props.label).toBe('Back to the draft')
  for (const italian of [/Sovrascrivi/, /Ricarica e perdi/, /Una bozza per volta/, /Annulla/, /Salva/, /Scarta/]) expect(await pane.find({ text: italian })).toBe(undefined)
})

test('Reading in English: the toast for a broken link', async ($, on) => {
  liveState(on, { tab: 'reading', reading: open({}) })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN, [A]: DOC })
  const toast = toasts(on)
  const pane = await mount($)
  await pane.press({ key: 'doc', link: { href: fileUrl(ROOT, '99 - Jarvis/roadmap/manca.md') } })
  expect(await toast).toBe('File not found: 99 - Jarvis/roadmap/manca.md')
})

test('Reading in English: a toast sent through the reading port is on one line', async ($, on) => {
  const doc = `${DOC}\n[odd](manca%0Aun%09file.md)\n`
  liveState(on, { tab: 'reading', reading: open({ text: doc }) })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN, [A]: doc })
  const toast = toasts(on)
  const pane = await mount($)
  // A link whose target has a newline and a tab in its name.
  await pane.press({ key: 'doc', link: { href: fileUrl(ROOT, '99 - Jarvis/roadmap/manca\nun\tfile.md') } })
  expect(await toast).toBe('File not found: 99 - Jarvis/roadmap/manca un file.md')
})

test('Reading in English: the toast for a file that Jarvis deleted', async ($, on) => {
  const state = liveState(on, { tab: 'reading', reading: open({}) })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN }, { '': [] })
  fakeGit(on, {})
  writeHooks(on)
  on('store.set', () => ({ value: undefined }))
  const seen: string[] = []
  on('ui.toast', (_$, e) => { seen.push(e.text); return { value: undefined } as never })
  await $.tool.call({ tool: 'Bash', command: `rm "/v/${A}"` })
  await quiet(state.clock)
  expect(seen).toEqual(['File no longer in the workspace'])
})

test('Reading with a tab id from an older version: Jarvis deleting the open file still returns to Files', async ($, on) => {
  // The saved tab says 'lettura', the id before the English ids: it is the Reading tab all the same.
  const state = liveState(on, { tab: 'lettura', reading: open({}) })
  fakeVault(on, {}, { '': [] })
  fakeGit(on, {})
  writeHooks(on)
  on('store.set', () => ({ value: undefined }))
  on('ui.toast', () => ({ value: undefined }) as never)
  await $.tool.call({ tool: 'Bash', command: `rm "/v/${A}"` })
  await quiet(state.clock)
  expect(state.values.tab).toBe('files')
  expect(reading(state)).toEqual(EMPTY_READING)
})
