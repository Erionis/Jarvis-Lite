import { test, expect, type Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import { PANE, PLUGIN } from '../hooks/state'
import { emptyTree, withChildren } from '../hooks/tree'
import { EMPTY_READING } from '../hooks/reader'
import type { Reading, Tree } from '../types'
import { fakeVault, liveState, paneProps, quiet } from './harness'

const CLAUDE_MD = "## Capacita' Jarvis\n\n| Capacita' | Fonte autorevole |\n|---|---|\n| Futuro operativo | `Da fare.md` |\n"
const ent = (name: string, kind: 'file' | 'dir' = 'file') => ({ name, kind, mtimeMs: 0, size: 1, isLink: false })
const mount = ($: Engine) => $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps() })
const tree = (selected: string, names = ['x.md', 'archivio']) =>
  ({ ...withChildren(emptyTree(), '', names.map(n => ent(n, n.includes('.') ? 'file' : 'dir'))), selected, cursor: selected })

// The commands launched (trash, mv, cp, mkdir); git and du answer empty. `fail`: the command that
// starts this way exits with 1. With `files` (the fakeVault map) mv really moves the file.
function fakeProcess(on: On, fail?: string, files?: Map<string, string>): string[][] {
  const calls: string[][] = []
  on('process.run', (_$, e) => {
    const isOp = ['/usr/bin/trash', 'mv', 'cp', 'mkdir'].includes(e.argv[0] ?? '')
    if (isOp) calls.push([...e.argv])
    const [cmd, , src, dst] = e.argv
    if (files !== undefined && cmd === 'mv' && src !== undefined && dst !== undefined && files.has(src)) {
      files.set(dst, files.get(src) ?? '')
      files.delete(src)
    }
    const code = fail !== undefined && e.argv[0] === fail ? 1 : isOp ? 0 : 1
    return { value: { exitCode: code, stdout: '', stderr: code === 0 ? '' : 'negato', isStdoutTruncated: false } } as never
  })
  return calls
}

function toasts(on: On): string[] {
  const out: string[] = []
  on('ui.toast', (_$, e) => { out.push(e.text); return { value: undefined } as never })
  return out
}

test('file actions: a selected file gets move, duplicate and trash at the bottom; a protected file has none', async ($, on) => {
  liveState(on, { tab: 'files', tree: tree('x.md') })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'x.md': 'a' }, { '': [ent('x.md')] })
  const pane = await mount($)
  for (const key of ['op-move', 'op-copy', 'op-trash']) expect(await pane.find({ key })).toBeDefined()
  expect((await pane.find({ key: 'op-trash' }))?.props).toMatchObject({ label: '✕ cestino', plain: true })
})

test('file actions: a protected file has no actions at the bottom', async ($, on) => {
  liveState(on, { tab: 'files', tree: tree('CLAUDE.md', ['CLAUDE.md']) })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD }, { '': [ent('CLAUDE.md')] })
  const pane = await mount($)
  expect(await pane.find({ key: 'unselect' })).toBeDefined()
  expect(await pane.find({ key: 'op-trash' })).toBe(undefined)
})

// The Future work file (writable from its own tab) and every file in the memories folder stay protected: no
// move, duplicate or trash, not even from a stale draw that still has the actions of another file.
test('file actions: the Future work file and the memories folder get no move, duplicate or trash', async ($, on) => {
  const md = `${CLAUDE_MD}| Memoria durevole | \`99 - Jarvis/memory/MEMORY.md\` |\n`
  const state = liveState(on, { tab: 'files', tree: tree('99 - Jarvis/note.md') })
  fakeVault(on, { 'CLAUDE.md': md, 'Da fare.md': '- [ ] a\n', '99 - Jarvis/note.md': 'a', '99 - Jarvis/memory/MEMORY.md': '# Indice\n', '99 - Jarvis/memory/user_alex.md': 'Alex' })
  const calls = fakeProcess(on)
  const said = toasts(on)
  const pane = await mount($)
  // A file next to the memories folder, not inside it: the actions are there.
  for (const key of ['op-move', 'op-copy', 'op-trash']) expect(await pane.find({ key })).toBeDefined()
  for (const sel of ['Da fare.md', '99 - Jarvis/memory/MEMORY.md', '99 - Jarvis/memory/user_alex.md']) {
    state.values.tree = tree(sel)
    for (const key of ['op-move', 'op-copy', 'op-trash']) await pane.press({ key })
    await pane.redraw()
    for (const key of ['op-move', 'op-copy', 'op-trash']) expect(await pane.find({ key })).toBe(undefined)
    expect(await pane.find({ key: 'unselect' })).toBeDefined()
    state.values.tree = tree('99 - Jarvis/note.md')
    await pane.redraw()
  }
  expect(calls).toEqual([])
  expect(state.values.fileOp ?? null).toBe(null)
  expect(said).toEqual(['Da fare.md', 'MEMORY.md', 'user_alex.md'].flatMap(n => [`${n} è protetto`, `${n} è protetto`, `${n} è protetto`]))
})

// AGENTS.md (the profile, like CLAUDE.md) and Jarvis Lite's managed core stay protected too.
test('file actions: AGENTS.md and the managed core get no move, duplicate or trash', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: tree('x.md') })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'x.md': 'a', 'AGENTS.md': 'a', '99 - Jarvis/system/x.md': 'a' })
  const calls = fakeProcess(on)
  const said = toasts(on)
  const pane = await mount($)
  for (const key of ['op-move', 'op-copy', 'op-trash']) expect(await pane.find({ key })).toBeDefined()
  for (const sel of ['AGENTS.md', '99 - Jarvis/system/x.md']) {
    state.values.tree = tree(sel)
    for (const key of ['op-move', 'op-copy', 'op-trash']) await pane.press({ key })
    await pane.redraw()
    for (const key of ['op-move', 'op-copy', 'op-trash']) expect(await pane.find({ key })).toBe(undefined)
    expect(await pane.find({ key: 'unselect' })).toBeDefined()
    state.values.tree = tree('x.md')
    await pane.redraw()
  }
  expect(calls).toEqual([])
  expect(state.values.fileOp ?? null).toBe(null)
  expect(said).toEqual(['AGENTS.md', 'x.md'].flatMap(n => [`${n} è protetto`, `${n} è protetto`, `${n} è protetto`]))
})

test('file actions: trash asks for confirmation, «no» goes back, «yes» sends the file to the Trash and deselects it', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: tree('x.md') })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'x.md': 'a' }, { '': [ent('x.md')] })
  const calls = fakeProcess(on)
  const said = toasts(on)
  const pane = await mount($)
  await pane.press({ key: 'op-trash' })
  await state.until('fileOp', o => (o as { kind?: string } | null)?.kind === 'trash')
  await pane.redraw()
  expect(await pane.find({ text: /Mettere nel Cestino di macOS\?/ })).toBeDefined()
  await pane.press({ key: 'trash-no' })
  await state.until('fileOp', o => o === null)
  await pane.redraw()
  expect(calls).toEqual([])
  await pane.press({ key: 'op-trash' })
  await state.until('fileOp', o => o !== null)
  await pane.redraw()
  await pane.press({ key: 'trash-yes' })
  await state.until('tree', t => (t as Tree).selected === '')
  expect(calls).toEqual([['/usr/bin/trash', '-s', '/v/x.md']])
  expect(said).toContain('x.md nel cestino')
})

test('file actions: a failing trash gives a notice with the reason and the file stays selected', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: tree('x.md') })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'x.md': 'a' }, { '': [ent('x.md')] })
  fakeProcess(on, '/usr/bin/trash')
  const said = toasts(on)
  const pane = await mount($)
  await pane.press({ key: 'op-trash' })
  await state.until('fileOp', o => o !== null)
  await pane.redraw()
  await pane.press({ key: 'trash-yes' })
  await state.until('fileOp', o => o === null)
  await state.clock.settle()
  expect(said).toContain('Non riesco a spostarlo nel cestino: negato')
  expect((state.values.tree as Tree).selected).toBe('x.md')
})

test('file actions: move shows a field with the path; Enter creates a missing folder, moves, and selects the new path', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: tree('x.md') })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'x.md': 'a' }, { '': [ent('x.md'), ent('archivio', 'dir')], archivio: [] })
  const calls = fakeProcess(on)
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'op-move' })
  await state.until('fileOp', o => (o as { kind?: string } | null)?.kind === 'move')
  await pane.redraw()
  expect((await pane.find({ key: 'move' }))?.props).toMatchObject({ value: 'x.md' })
  await pane.input({ key: 'move', text: 'nuova/x.md', kind: 'submit' })
  await state.until('tree', t => (t as Tree).selected === 'nuova/x.md')
  expect(calls).toEqual([['mkdir', '-p', '/v/nuova'], ['mv', '-n', '/v/x.md', '/v/nuova/x.md']])
  expect(state.values.fileOp).toBe(null)
})

test('file actions: typing in the move field does not write the operation, a redraw keeps the text, cancel restarts from the path', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: tree('x.md') })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'x.md': 'a' }, { '': [ent('x.md'), ent('archivio', 'dir')], archivio: [] })
  fakeProcess(on)
  const pane = await mount($)
  await pane.press({ key: 'op-move' })
  await state.until('fileOp', o => (o as { kind?: string } | null)?.kind === 'move')
  await pane.redraw()
  const sets = state.sets.fileOp
  await pane.input({ key: 'move', text: 'arch', kind: 'change' })
  await pane.redraw()
  expect((await pane.find({ key: 'move' }))?.props.value).toBe('arch')
  expect(state.sets.fileOp).toBe(sets)
  await pane.press({ key: 'op-cancel' })
  await state.until('fileOp', o => o === null)
  await pane.redraw()
  await pane.press({ key: 'op-move' })
  await state.until('fileOp', o => o !== null)
  await pane.redraw()
  expect((await pane.find({ key: 'move' }))?.props.value).toBe('x.md')
})

test('file actions: a move target that exists, is outside the vault or is protected gives a notice and no mv, and the field stays', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: tree('x.md') })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'x.md': 'a', 'archivio/x.md': 'b' }, { '': [ent('x.md'), ent('archivio', 'dir')], archivio: [ent('x.md')] })
  const calls = fakeProcess(on)
  const said = toasts(on)
  const pane = await mount($)
  await pane.press({ key: 'op-move' })
  await state.until('fileOp', o => o !== null)
  await pane.redraw()
  await pane.input({ key: 'move', text: 'archivio/', kind: 'submit' })
  await pane.input({ key: 'move', text: '../fuori.md', kind: 'submit' })
  await pane.input({ key: 'move', text: 'CLAUDE.md', kind: 'submit' })
  await state.clock.settle()
  expect(said).toEqual(['Esiste già archivio/x.md', 'Solo percorsi dentro il vault', 'Non lì: CLAUDE.md è protetto'])
  expect(calls).toEqual([])
  expect((state.values.fileOp as { kind: string }).kind).toBe('move')
  await pane.press({ key: 'op-cancel' })
  await state.until('fileOp', o => o === null)
})

test('file actions: duplicate numbers the copy when one already exists, puts it next to the original, then selects it', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: tree('note/x.md', ['note']) })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'note/x.md': 'a', 'note/x copia.md': 'a' }, { '': [ent('note', 'dir')], note: [ent('x.md'), ent('x copia.md')] })
  const calls = fakeProcess(on)
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'op-copy' })
  await state.until('tree', t => (t as Tree).selected === 'note/x copia 2.md')
  expect(calls).toEqual([['cp', '-n', '/v/note/x.md', '/v/note/x copia 2.md']])
})

test('file actions: the file open in Reading is reopened at its new path when moved, and closed when trashed', async ($, on) => {
  const reading: Reading = { ...EMPTY_READING, path: 'x.md', text: 'a' }
  const state = liveState(on, { tab: 'files', tree: tree('x.md'), reading })
  const files = fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'x.md': 'a' }, { '': [ent('x.md'), ent('archivio', 'dir')], archivio: [] })
  fakeProcess(on, undefined, files)
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'op-move' })
  await state.until('fileOp', o => o !== null)
  await pane.redraw()
  await pane.input({ key: 'move', text: 'archivio/', kind: 'submit' })
  await state.until('reading', r => (r as Reading).path === 'archivio/x.md')
  await pane.redraw()
  await pane.press({ key: 'op-trash' })
  await state.until('fileOp', o => o !== null)
  await pane.redraw()
  await pane.press({ key: 'trash-yes' })
  await state.until('reading', r => (r as Reading).path === null)
})

test('file actions: a Reading saved by an older version (no history) is reopened after a move with an empty history', async ($, on) => {
  const old = { path: 'x.md', mode: 'text', text: 'a' } as unknown as Reading
  const state = liveState(on, { tab: 'files', tree: tree('x.md'), reading: old })
  const files = fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'x.md': 'a' }, { '': [ent('x.md'), ent('archivio', 'dir')], archivio: [] })
  fakeProcess(on, undefined, files)
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'op-move' })
  await state.until('fileOp', o => o !== null)
  await pane.redraw()
  await pane.input({ key: 'move', text: 'archivio/', kind: 'submit' })
  await state.until('reading', r => (r as Reading).path === 'archivio/x.md')
  expect((state.values.reading as Reading).back).toEqual([])
})

test('file actions: an unsaved draft on the file blocks the actions with a notice', async ($, on) => {
  const draft = { path: 'x.md', text: 'nuovo', base: 'a', baseMtimeMs: 0, row: 0, col: 0 }
  const state = liveState(on, { tab: 'files', tree: tree('x.md'), draft })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'x.md': 'a' }, { '': [ent('x.md')] })
  const calls = fakeProcess(on)
  const said = toasts(on)
  const pane = await mount($)
  await pane.press({ key: 'op-copy' })
  await state.clock.settle()
  expect(said).toContain('Prima salva o scarta la bozza')
  expect(calls).toEqual([])
  expect((state.values.tree as Tree).selected).toBe('x.md')
})

// Whoever reads the draft goes through the flow. A key from the user is in the editor module but the write
// to the atom has not landed yet: the atom is clean, the draft is not.
test('file actions: a draft typed but not yet in the atom is still seen by duplicate: no action, and a notice', async ($, on) => {
  let gate: Promise<void> | undefined
  let release = (): void => {}
  const reading: Reading = { ...EMPTY_READING, path: 'x.md', text: 'a', mtimeMs: 0 }
  const state = liveState(on, { tab: 'reading', reading, tree: tree('x.md') }, key => (key === 'draft' ? gate : undefined))
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'x.md': 'a' }, { '': [ent('x.md')] })
  const calls = fakeProcess(on)
  const said = toasts(on)
  const pane = await mount($)
  await pane.press({ key: 'mode-edit' })
  await state.until('reading', r => (r as Reading).mode === 'edit')
  await pane.redraw()
  gate = new Promise<void>(r => { release = r })
  await pane.key({ key: 'z', in: 'editor' })
  await quiet(state.clock)
  // The atom is still the clean one; the user switches to Files and asks for "duplicate".
  expect((state.values.draft as { text: string }).text).toBe('a')
  state.values.tab = 'files'
  await pane.redraw()
  await pane.press({ key: 'op-copy' })
  await quiet(state.clock)
  release()
  await state.until('draft', d => (d as { text: string } | null)?.text === 'za')
  await quiet(state.clock)
  expect(said).toContain('Prima salva o scarta la bozza')
  expect(calls).toEqual([])
})

// The actions on the selected file in English: a vault whose capability table is in English.
const CLAUDE_MD_EN = '## Capabilities\n\n| Capability | Authoritative source |\n|---|---|\n| Future work | `To Do.md` |\n'

test('file actions in English: the chips, the trash question, the move hint and the notices of a bad target', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: tree('x.md') })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN, 'x.md': 'a', 'archivio/x.md': 'b' }, { '': [ent('x.md'), ent('archivio', 'dir')], archivio: [ent('x.md')] })
  const calls = fakeProcess(on)
  const said = toasts(on)
  const pane = await mount($)
  expect((await pane.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('op-')).map(b => b.props.label)).toEqual(['→ Move', '+ Duplicate', '✕ Trash'])
  await pane.press({ key: 'op-trash' })
  await state.until('fileOp', o => (o as { kind?: string } | null)?.kind === 'trash')
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^Move to the macOS Trash\?$/ })).toBeDefined()
  expect((await pane.find({ key: 'trash-yes' }))?.props.label).toBe('✕ Yes, trash it')
  expect((await pane.find({ key: 'trash-no' }))?.props.label).toBe('Cancel')
  await pane.press({ key: 'trash-no' })
  await state.until('fileOp', o => o === null)
  await pane.redraw()
  await pane.press({ key: 'op-move' })
  await state.until('fileOp', o => (o as { kind?: string } | null)?.kind === 'move')
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^Enter to move · a trailing \/ means into the folder$/ })).toBeDefined()
  expect((await pane.find({ key: 'op-cancel' }))?.props.label).toBe('Cancel')
  for (const text of ['', 'x.md', 'archivio/', '../fuori.md', 'CLAUDE.md']) await pane.input({ key: 'move', text, kind: 'submit' })
  await state.clock.settle()
  expect(said).toEqual(['Type where to move it', 'It is already there', 'archivio/x.md already exists', 'Only paths inside the workspace', 'CLAUDE.md is protected'])
  expect(calls).toEqual([])
  await pane.press({ key: 'op-cancel' })
  await state.until('fileOp', o => o === null)
})

test('file actions in English: moved, trashed and duplicated, and the notice when a command fails', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: tree('note/x.md', ['note']) })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN, 'note/x.md': 'a', 'note/x copy.md': 'a' }, { '': [ent('note', 'dir')], note: [ent('x.md'), ent('x copy.md')] })
  const calls = fakeProcess(on)
  const said = toasts(on)
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'op-copy' })
  await state.until('tree', t => (t as Tree).selected === 'note/x copy 2.md')
  expect(calls).toEqual([['cp', '-n', '/v/note/x.md', '/v/note/x copy 2.md']])
  expect(said).toEqual(['Created x copy 2.md'])
  state.values.tree = tree('note/x.md', ['note'])
  await pane.redraw()
  await pane.press({ key: 'op-trash' })
  await state.until('fileOp', o => o !== null)
  await pane.redraw()
  await pane.press({ key: 'trash-yes' })
  await state.until('tree', t => (t as Tree).selected === '')
  expect(said.slice(1)).toEqual(['x.md moved to the Trash'])
})

test('file actions in English: a notice is on one line, whatever the error holds', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: tree('x.md') })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN, 'x.md': 'a' }, { '': [ent('x.md')] })
  on('process.run', () => ({ value: { exitCode: 1, stdout: '', stderr: 'denied\nsecond line\tand a tab', isStdoutTruncated: false } }) as never)
  const said = toasts(on)
  const pane = await mount($)
  await pane.press({ key: 'op-trash' })
  await state.until('fileOp', o => o !== null)
  await pane.redraw()
  await pane.press({ key: 'trash-yes' })
  await state.until('fileOp', o => o === null)
  expect(said).toEqual(['Cannot move it to the Trash: denied second line and a tab'])
})

test('file actions in English: a failing command says why, and a draft or a protected file blocks the action', async ($, on) => {
  const draft = { path: 'x.md', text: 'new', base: 'a', baseMtimeMs: 0, row: 0, col: 0 }
  const state = liveState(on, { tab: 'files', tree: tree('x.md'), draft })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN, 'x.md': 'a', 'To Do.md': '- [ ] a\n' }, { '': [ent('x.md')] })
  fakeProcess(on, '/usr/bin/trash')
  const said = toasts(on)
  const pane = await mount($)
  await pane.press({ key: 'op-copy' })
  await state.clock.settle()
  expect(said).toEqual(['Save or discard the draft first'])
  state.values.draft = null
  await pane.press({ key: 'op-trash' })
  await state.until('fileOp', o => o !== null)
  await pane.redraw()
  await pane.press({ key: 'trash-yes' })
  await state.until('fileOp', o => o === null)
  await state.clock.settle()
  expect(said.slice(1)).toEqual(['Cannot move it to the Trash: negato'])
  // A stale button on a protected file: the action does not run, the notice names the file.
  await pane.redraw()
  state.values.tree = tree('To Do.md')
  await pane.press({ key: 'op-copy' })
  await state.clock.settle()
  expect(said.slice(2)).toEqual(['To Do.md is protected'])
})
