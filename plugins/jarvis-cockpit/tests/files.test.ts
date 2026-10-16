import { test, expect, type Engine } from 'claude-code/testing'
import { PANE, PLUGIN } from '../hooks/state'
import { MAX_ROWS, fileRows, type FileRow, type FilesView } from '../hooks/files'
import { strings } from '../hooks/i18n'
import { SEARCH_MS } from '../hooks/filesFlow'
import { EMPTY_READING } from '../hooks/reader'
import { keyText } from '../hooks/format'
import { emptyTree, withChildren } from '../hooks/tree'
import type { Tree } from '../types'
import { AT, ROOT, cardTitles, fakeGit, fakeVault, liveState, paneProps, quiet, settled } from './harness'

const ent = (name: string, kind: 'file' | 'dir' = 'file', mtimeMs = 0, size = 0) => ({ name, kind, mtimeMs, size, isLink: false })
const noop = () => {}

function view(tree: Tree, over: Partial<FilesView> = {}): FilesView {
  return {
    tree, t: strings('it'), query: tree.query, git: null, numstat: null, sizes: {}, written: {}, nowMs: AT,
    press: noop, copy: noop, openInApp: noop, typeQuery: noop, search: noop, toggleHidden: noop, toggleSizes: noop, collapseAll: noop, unselect: noop, op: null, moveText: '', ops: null,
    ...over,
  }
}
const pick = (r: FileRow) => [r.id, r.depth, r.icon, r.right]

// `find` returns the props without `hover`: in the tree of `drawn()` the kit keeps it next to the props.
type Node = { type: string; props: Record<string, unknown>; hover?: unknown; children?: unknown[] }
function walk(n: unknown, out: Node[] = []): Node[] {
  if (n === null || typeof n !== 'object') return out
  if (Array.isArray(n)) { for (const c of n) walk(c, out); return out }
  const node = n as Node
  if (typeof node.type === 'string') out.push(node)
  for (const c of node.children ?? []) walk(c, out)
  return out
}

test('file rows: folders first, depth, icon by type, age on the right', () => {
  let t = withChildren(emptyTree(), '', [ent('03 - Projects', 'dir'), ent('To Do.md', 'file', AT - 3 * 86_400_000), ent('deck.pdf')])
  t = withChildren({ ...t, expanded: ['03 - Projects'] }, '03 - Projects', [ent('x.md', 'file', AT - 60_000)])
  expect(fileRows(view(t)).rows.map(pick)).toEqual([
    ['03 - Projects', 0, 'dirOpen', ''],
    ['03 - Projects/x.md', 1, 'md', '14:31'],
    ['deck.pdf', 0, 'pdf', ''],
    ['To Do.md', 0, 'md', '3g'],
  ])
})

test('file rows: with Σ sizes, folders get theirs from du (… computing, — failed)', () => {
  const t = { ...withChildren(emptyTree(), '', [ent('A', 'dir'), ent('B', 'dir'), ent('C', 'dir'), ent('n.md', 'file', AT, 14_200)]), showSizes: true }
  expect(fileRows(view(t, { sizes: { A: 48_000_000, B: null } })).rows.map(r => r.right)).toEqual(['48 MB', '—', '…', '14 kB'])
})

test('file rows: written by Jarvis, uncommitted +N −N, closed folder with the totals', () => {
  const t = withChildren(emptyTree(), '', [ent('A', 'dir'), ent('n.md'), ent('r.md')])
  const v = view(t, {
    written: { 'n.md': AT - 120_000, 'A/deep/y.md': AT },
    git: { changed: { 'A/z.md': 'mod', 'A/deep/y.md': 'new', 'r.md': 'mod' }, ignored: [] },
    numstat: { 'r.md': { add: 12, del: 3 } },
  })
  expect(fileRows(v).rows.map(r => [r.id, r.written, r.changed, r.add, r.del])).toEqual([
    ['A', 1, 2, 0, 0],
    ['n.md', 1, 0, 0, 0],
    ['r.md', 0, 0, 12, 3],
  ])
})

test('file rows: hidden and ignored files stay out until shown; unreadable folder marked', () => {
  const t = { ...withChildren(emptyTree(), '', [ent('.claude', 'dir'), ent('lab', 'dir'), ent('n.md')]), broken: ['lab'] }
  const git = { changed: {}, ignored: ['lab'] }
  expect(fileRows(view(t, { git })).rows.map(r => r.id)).toEqual(['n.md'])
  expect(fileRows(view({ ...t, showHidden: true }, { git })).rows.map(r => [r.id, r.isBroken])).toEqual([['.claude', false], ['lab', true], ['n.md', false]])
})

test('file rows: while searching, the results with their folder; at most 200 rows', () => {
  const t = { ...emptyTree(), query: 'to do', hits: ['To Do.md', '99 - Jarvis/To Do vecchio.md'] }
  expect(fileRows(view(t)).rows.map(r => [r.dir, r.name])).toEqual([['', 'To Do.md'], ['99 - Jarvis', 'To Do vecchio.md']])
  const many = withChildren(emptyTree(), '', Array.from({ length: 210 }, (_, i) => ent(`n${i}.md`)))
  const out = fileRows(view(many))
  expect(out.rows.length).toBe(MAX_ROWS)
  expect(out.more).toBe(10)
})

test('files tab: row with icon, clickable name, actions hidden until the mouse hovers', async ($, on) => {
  const tree = { ...withChildren(emptyTree(), '', [ent('A', 'dir'), ent('To Do.md', 'file', AT - 60_000, 4_000)]), selected: 'To Do.md', cursor: 'To Do.md' }
  liveState(on, { tab: 'files', tree, written: { 'To Do.md': AT } })
  fakeVault(on, {})
  const pane = await mount($)
  expect((await pane.find({ key: 'r:To Do.md' }))?.props.label).toBe('To Do.md')
  expect((await pane.find({ key: 'row:To Do.md' }))?.props.backgroundColor).toBe('#8080802e')
  const drawn = walk(await pane.drawn())
  expect(drawn.find(n => n.props.key === 'row:A')?.hover).toEqual({ backgroundColor: '#8080801a' })
  expect((await pane.findAll({ type: 'Svg' })).map(s => s.props.alt)).toEqual(['Jarvis in attesa', 'JARVIS', 'cartella', 'Markdown', '─', 'Markdown'])
  const app = await pane.find({ key: 'app:A' })
  expect(app?.props.label).toBe("Apri nell'app")
  expect((await pane.find({ key: 'cp:A' }))?.props.label).toBe('Copia path')
  const actions = drawn.filter(n => n.type === 'Box' && n.props.display === 'none')
  expect(actions.length).toBe(2)
  expect(actions.map(n => n.hover)).toEqual([{ display: 'flex' }, { display: 'flex' }])
  expect(await pane.find({ key: 'q' })).toBeDefined()
  expect(await pane.find({ text: /^4 kB · scritto da Jarvis alle 14:32$/ })).toBeDefined()
})

test('files tab: unreadable root in a card', async ($, on) => {
  liveState(on, { tab: 'files', tree: { ...emptyTree(), error: 'EACCES' } })
  fakeVault(on, {})
  const pane = await mount($)
  expect(await pane.find({ text: /Non riesco a leggere il vault: EACCES/ })).toBeDefined()
  expect(await cardTitles(pane)).toContain('Vault illeggibile')
})

test('files tab: filter with no results', async ($, on) => {
  liveState(on, { tab: 'files', tree: { ...emptyTree(), query: 'zzz', hits: [] } })
  fakeVault(on, {})
  const pane = await mount($)
  expect(await pane.find({ text: /Nessun file con «zzz»/ })).toBeDefined()
})

test('files tab: beyond 200 rows, a prompt to use the filter', async ($, on) => {
  liveState(on, { tab: 'files', tree: withChildren(emptyTree(), '', Array.from({ length: 205 }, (_, i) => ent(`n${i}.md`))) })
  fakeVault(on, {})
  const pane = await mount($)
  expect(await pane.find({ text: /altre 5 righe: usa il filtro/ })).toBeDefined()
  expect(await pane.find({ key: 'r:n204.md' })).toBe(undefined)
})

test('hook: session.start reads the root, the saved folders and switches and, with the Files tab saved, the git state', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, { 'A/a.md': '' }, { '': [{ name: 'A', kind: 'dir' }], A: [{ name: 'a.md', kind: 'file' }] })
  fakeGit(on, { status: ' M A/a.md\0' })
  on('store.get', (_$, e) => ({ value: e.key === 'expanded' ? ['A'] : e.key === 'sizes' ? true : e.key === 'tab' ? 'files' : undefined }) as never)
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('session.start', () => ({ cwd: ROOT }) as never)
  const gitDone = state.until('git', g => g !== null)
  await $.session.start({ cwd: ROOT } as never)
  await gitDone
  await state.until('tree', x => (x as Tree).nodes.some(n => n.id === 'A/a.md'))
  const t = state.values.tree as Tree
  expect(t.nodes.map(n => n.id).sort()).toEqual(['A', 'A/a.md'])
  expect(t.expanded).toEqual(['A'])
  expect([t.showSizes, t.showHidden]).toEqual([true, false])
  expect(state.values.git).toEqual({ changed: { 'A/a.md': 'mod' }, ignored: [] })
})

test('hook: entering the Files tab recomputes the git state', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, {}, { '': [] })
  fakeGit(on, { status: '?? nuova.md\0' })
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'tab-files' })
  await state.until('git', g => g !== null)
  expect(state.values.git).toEqual({ changed: { 'nuova.md': 'new' }, ignored: [] })
})

test('hook: a write by Jarvis lands among the written files, the Files tab stays without a badge', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, { 'To Do.md': 'x' }, { '': [] })
  fakeGit(on, {})
  on('agent.list', () => ({ value: [] }))
  on('ui.status', () => ({ value: undefined }) as never)
  on('tool.call', () => ({ result: 'ok' }) as never)
  await $.tool.call({ tool: 'Edit', file_path: '/v/To Do.md', old_string: 'a', new_string: 'b' })
  expect(state.values.written).toEqual({ 'To Do.md': AT })
  const pane = await mount($)
  // No number on the tab: a written file does not change the label.
  expect((await pane.find({ key: 'tab-files' }))?.props.label).toBe('File')
})

async function mount($: Engine) {
  return $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps() })
}

test('files tab: clicking a folder opens it, reads it and remembers the choice', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: withChildren(emptyTree(), '', [ent('A', 'dir')]) })
  fakeVault(on, {}, { '': [{ name: 'A', kind: 'dir' }], A: [{ name: 'a.md', kind: 'file' }] })
  const stored: unknown[] = []
  on('store.set', (_$, e) => { stored.push([e.key, e.value]); return { value: undefined } })
  const pane = await mount($)
  await pane.press({ key: 'r:A' })
  await state.until('tree', t => (t as Tree).loaded.includes('A'))
  const t = state.values.tree as Tree
  expect(t.expanded).toEqual(['A'])
  expect(t.nodes.map(n => n.id)).toContain('A/a.md')
  expect(stored).toContainEqual(['expanded', ['A']])
})

test('files tab: clicking a folder arrow opens it like the name', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: withChildren(emptyTree(), '', [ent('A', 'dir')]) })
  fakeVault(on, {}, { '': [{ name: 'A', kind: 'dir' }], A: [{ name: 'a.md', kind: 'file' }] })
  const pane = await mount($)
  await pane.press({ key: 't:A' })
  await state.until('tree', t => (t as Tree).loaded.includes('A'))
  expect((state.values.tree as Tree).expanded).toEqual(['A'])
})

test('files tab: clicking a code file opens it in Reading', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: withChildren(emptyTree(), '', [ent('run.py')]) })
  fakeVault(on, { 'run.py': 'print(1)\n' })
  const pane = await mount($)
  await pane.press({ key: 'r:run.py' })
  await state.until('tab', t => t === 'reading')
  expect((state.values.reading as { path: string; text: string })).toMatchObject({ path: 'run.py', text: 'print(1)\n' })
})

test('files tab: clicking a PDF or an image selects it', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: withChildren(emptyTree(), '', [ent('deck.pdf')]) })
  fakeVault(on, { 'deck.pdf': '' })
  const pane = await mount($)
  await pane.press({ key: 'r:deck.pdf' })
  await state.until('tree', t => (t as Tree).selected === 'deck.pdf')
  expect((state.values.tree as Tree).cursor).toBe('deck.pdf')
})

test('files tab: the hover action «Copia path» copies the relative path', async ($, on) => {
  liveState(on, { tab: 'files', tree: withChildren(emptyTree(), '', [ent('A', 'dir'), ent('b.md')]) })
  fakeVault(on, {})
  const copied: string[] = []
  let toasted: (t: string) => void = () => {}
  const toast = new Promise<string>(r => { toasted = r })
  on('ui.copy', (_$, e) => { copied.push(e.text); return { value: { isCopied: true } } as never })
  on('ui.toast', (_$, e) => { toasted(e.text); return { value: undefined } as never })
  const pane = await mount($)
  await pane.press({ key: 'cp:b.md' })
  expect(await toast).toBe('Copiato b.md')
  expect(copied).toEqual(['b.md'])
})

test('files tab: the open-in-app action opens the file in the Files pane', async ($, on) => {
  liveState(on, { tab: 'files', tree: withChildren(emptyTree(), '', [ent('deck.pdf')]) })
  fakeVault(on, { 'deck.pdf': '' })
  let called: (v: unknown) => void = () => {}
  const call = new Promise<unknown>(r => { called = r })
  on('mcp.call', (_$, e) => { called([e.server, e.tool, e.args]); return { value: { content: [] } } as never })
  const pane = await mount($)
  await pane.press({ key: 'app:deck.pdf' })
  expect(await call).toEqual(['ccd_view', 'show_pane', { pane: 'file', path: '/v/deck.pdf' }])
})

test('files tab: a Files pane that answers with an error gives a warning', async ($, on) => {
  liveState(on, { tab: 'files', tree: withChildren(emptyTree(), '', [ent('deck.pdf')]) })
  fakeVault(on, { 'deck.pdf': '' })
  let toasted: (t: string) => void = () => {}
  const toast = new Promise<string>(r => { toasted = r })
  on('ui.toast', (_$, e) => { toasted(e.text); return { value: undefined } as never })
  on('mcp.call', () => ({ value: { content: [{ type: 'text', text: 'no pane' }], isError: true } }) as never)
  const pane = await mount($)
  await pane.press({ key: 'app:deck.pdf' })
  expect(await toast).toBe('Non riesco ad aprire il pannello Files')
})

test('files tab: . and Σ switch on and are remembered, ⊟ closes everything', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: { ...emptyTree(), expanded: ['A', 'B'] } })
  const stored: unknown[] = []
  on('store.set', (_$, e) => { stored.push([e.key, e.value]); return { value: undefined } })
  const pane = await mount($)
  await pane.press({ key: 'hidden' })
  await state.until('tree', t => (t as Tree).showHidden)
  await pane.press({ key: 'sizes' })
  await state.until('tree', t => (t as Tree).showSizes)
  await pane.press({ key: 'collapse' })
  await state.until('tree', t => (t as Tree).expanded.length === 0)
  expect(stored).toEqual([['hidden', true], ['sizes', true], ['expanded', []]])
})

test('files tab: × in the footer unselects', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: { ...emptyTree(), selected: 'x.md' } })
  const pane = await mount($)
  await pane.press({ key: 'unselect' })
  await state.until('tree', t => (t as Tree).selected === '')
})

test('files tab: a symlink to a folder inside the vault is followed, one outside the vault warns', async ($, on) => {
  const tree = withChildren(emptyTree(), '', [{ name: 'repos', kind: 'other', mtimeMs: 0, isLink: true }, { name: 'ext', kind: 'other', mtimeMs: 0, isLink: true }, ent('99 - Jarvis', 'dir')])
  const state = liveState(on, { tab: 'files', tree })
  fakeVault(on, {}, { '': [], '99 - Jarvis': [{ name: 'lab', kind: 'dir' }], '99 - Jarvis/lab': [], '/elsewhere': [] } as never, { repos: `${ROOT}/99 - Jarvis/lab`, ext: '/elsewhere' })
  on('store.set', () => ({ value: undefined }))
  let toasted: (t: string) => void = () => {}
  const toast = new Promise<string>(r => { toasted = r })
  on('ui.toast', (_$, e) => { toasted(e.text); return { value: undefined } as never })
  const pane = await mount($)
  expect((await pane.findAll({ type: 'Svg' })).filter(s => s.props.alt === 'link').length).toBe(2)
  await pane.press({ key: 'r:repos' })
  await state.until('tree', t => (t as Tree).cursor === '99 - Jarvis/lab')
  expect((state.values.tree as Tree).expanded).toEqual(['99 - Jarvis', '99 - Jarvis/lab'])
  await pane.press({ key: 'r:ext' })
  expect(await toast).toBe('Il link punta fuori dal vault')
})

test('search: by name over the whole vault, index read once', async ($, on) => {
  const state = liveState(on, { tab: 'files' })
  fakeVault(on, {}, { '': [] })
  const calls = fakeGit(on, { 'ls-files': 'To Do.md\x0003 - Projects/NOVA/NOVA.md\x00.claude/x/to do.md\x00' })
  const pane = await mount($)
  await pane.input({ key: 'q', text: 'to do', kind: 'change' })
  await state.clock.advance(SEARCH_MS)
  await state.until('tree', t => (t as Tree).hits.length > 0)
  expect((state.values.tree as Tree).hits).toEqual(['To Do.md'])
  await pane.input({ key: 'q', text: 'nova', kind: 'change' })
  await state.clock.advance(SEARCH_MS)
  await state.until('tree', t => (t as Tree).hits[0] === '03 - Projects/NOVA/NOVA.md')
  expect(calls.filter(c => c.includes('ls-files')).length).toBe(1)
})

test('files tab: the selected file goes into the prompt context', async ($, on) => {
  liveState(on, { opened: true, tree: { ...emptyTree(), selected: 'To Do.md' } })
  fakeVault(on, { 'To Do.md': 'x' })
  let context: readonly string[] | undefined
  on('prompt.submit', (_$, e) => { context = e.context; return { text: e.text } as never })
  await $.prompt.submit({ text: 'aggiungi qui una voce' } as never)
  expect(context).toEqual(['The user has this file selected in the file tree; "this" or "it" in the prompt likely refers to it: /v/To Do.md'])
})

function writeHooks(on: Parameters<typeof liveState>[0]) {
  on('agent.list', () => ({ value: [] }))
  on('ui.status', () => ({ value: undefined }) as never)
  on('tool.call', () => ({ result: 'ok' }) as never)
}

test('hook: five Edits by Jarvis in a row, git and the tree once, when things settle', async ($, on) => {
  // x.md as the fake vault lists it (size 1): the re-read folder is the same.
  const t = withChildren({ ...withChildren(emptyTree(), '', [ent('A', 'dir')]), expanded: ['A'] }, 'A', [ent('x.md', 'file', 0, 1)])
  const state = liveState(on, { tab: 'files', tree: t })
  fakeVault(on, { 'A/x.md': 'x' }, { '': [{ name: 'A', kind: 'dir' }], A: [{ name: 'x.md', kind: 'file' }] })
  const calls = fakeGit(on, { status: '', diff: '' })
  writeHooks(on)
  for (let i = 0; i < 5; i++) await $.tool.call({ tool: 'Edit', file_path: '/v/A/x.md', old_string: 'a', new_string: 'b' })
  await state.clock.settle()
  expect(calls.filter(c => c.includes('status')).length).toBe(0)
  await settled(state.clock)
  await state.clock.settle()
  expect(calls.filter(c => c.includes('status')).length).toBe(1)
  // The re-read folder has the same files: the tree is not rewritten.
  expect(state.sets.tree ?? 0).toBe(0)
})

test('hook: when the touched write fails, the settle step (git) still runs', async ($, on) => {
  // A rejected write makes `update` fail: every attempt on `touched` fails.
  const state = liveState(on, { tab: 'files' }, key => (key === 'touched' ? Promise.reject(new Error('atom rifiutato')) : undefined))
  fakeVault(on, { 'CLAUDE.md': "## Capacita' Jarvis\n\n| Capacita' | Fonte autorevole |\n|---|---|\n| Futuro operativo | `Da fare.md` |\n", 'Da fare.md': 'x' }, { '': [{ name: 'Da fare.md', kind: 'file' }] })
  const calls = fakeGit(on, { status: '', diff: '' })
  writeHooks(on)
  await $.tool.call({ tool: 'Edit', file_path: '/v/Da fare.md', old_string: 'a', new_string: 'b' })
  await settled(state.clock)
  await state.clock.settle()
  expect(state.sets.touched ?? 0).toBe(0)
  expect(calls.filter(c => c.includes('status')).length).toBe(1)
})

test('hook: mv with absolute paths updates the tree and the written files', async ($, on) => {
  let t = withChildren(emptyTree(), '', [ent('A', 'dir'), ent('B', 'dir')])
  t = withChildren(t, 'A', [ent('x.md')])
  t = withChildren({ ...t, expanded: ['A', 'B'] }, 'B', [])
  const state = liveState(on, { tab: 'files', tree: t, written: { 'A/x.md': AT - 60_000 } })
  fakeVault(on, { 'B/x.md': 'x' }, { '': [{ name: 'A', kind: 'dir' }, { name: 'B', kind: 'dir' }], A: [], B: [{ name: 'x.md', kind: 'file' }] })
  fakeGit(on, {})
  writeHooks(on)
  await $.tool.call({ tool: 'Bash', command: 'mv /v/A/x.md /v/B/x.md' })
  expect(state.values.written).toEqual({ 'B/x.md': AT })
  await settled(state.clock)
  await state.until('tree', x => (x as Tree).nodes.some(n => n.id === 'B/x.md') && !(x as Tree).nodes.some(n => n.id === 'A/x.md'))
  const pane = await mount($)
  // Files is the active tab (a Text) with no number: a written file does not change the label.
  expect(await pane.find({ type: 'Text', text: /^File$/ })).toBeDefined()
})

test('hook: a Write into a new folder under an open one makes it appear', async ($, on) => {
  let t = withChildren(emptyTree(), '', [ent('C', 'dir')])
  t = withChildren({ ...t, expanded: ['C'] }, 'C', [ent('old.md')])
  const state = liveState(on, { tab: 'files', tree: t })
  fakeVault(on, { 'C/NewCo/NewCo.md': '' }, { '': [{ name: 'C', kind: 'dir' }], C: [{ name: 'NewCo', kind: 'dir' }, { name: 'old.md', kind: 'file' }] })
  fakeGit(on, {})
  writeHooks(on)
  await $.tool.call({ tool: 'Write', file_path: '/v/C/NewCo/NewCo.md', content: '# NewCo' })
  await settled(state.clock)
  await state.until('tree', x => (x as Tree).nodes.some(n => n.id === 'C/NewCo'))
})

test('hook: mv into an open folder (destination with a trailing /) re-reads it', async ($, on) => {
  let t = withChildren(emptyTree(), '', [ent('07 - Archive', 'dir'), ent('x.md')])
  t = withChildren({ ...t, expanded: ['07 - Archive'] }, '07 - Archive', [])
  const state = liveState(on, { tab: 'files', tree: t })
  fakeVault(on, { '07 - Archive/x.md': '' }, { '': [{ name: '07 - Archive', kind: 'dir' }], '07 - Archive': [{ name: 'x.md', kind: 'file' }] })
  fakeGit(on, {})
  writeHooks(on)
  await $.tool.call({ tool: 'Bash', command: 'mv x.md "07 - Archive/"' })
  await settled(state.clock)
  await state.until('tree', x => (x as Tree).nodes.some(n => n.id === '07 - Archive/x.md') && !(x as Tree).nodes.some(n => n.id === 'x.md'))
})

// The only real-time wait left, and only inside `fakeDu`: it runs in a `process.run` hook, where there is no fake clock to advance
// (`settle` does not pass time, and there a real turn of the event loop is needed for the `du` calls to overlap).
declare const setTimeout: (fn: () => void, ms: number) => unknown
const realTurn = (): Promise<void> => new Promise(r => { setTimeout(r, 10) })

test('search: a failed ls-files is not kept in the cache', async ($, on) => {
  const state = liveState(on, { tab: 'files' })
  fakeVault(on, {}, { '': [] })
  let lsCalls = 0
  on('process.run', (_$, e) => {
    const isLs = e.argv.includes('ls-files')
    if (isLs) lsCalls += 1
    const ok = isLs && lsCalls > 1
    return { value: { exitCode: ok ? 0 : 1, stdout: ok ? 'To Do.md\0' : '', stderr: '', isStdoutTruncated: false } } as never
  })
  const pane = await mount($)
  await pane.input({ key: 'q', text: 'to d', kind: 'change' })
  await state.clock.advance(SEARCH_MS)
  await quiet(state.clock)
  expect(lsCalls).toBe(1)
  expect((state.values.tree as Tree).hits).toEqual([])
  await pane.input({ key: 'q', text: 'to do', kind: 'change' })
  await state.clock.advance(SEARCH_MS)
  await state.until('tree', x => (x as Tree).hits.length > 0)
  expect((state.values.tree as Tree).hits).toEqual(['To Do.md'])
})

test('search: starting again from empty re-reads the index', async ($, on) => {
  const state = liveState(on, { tab: 'files' })
  fakeVault(on, {}, { '': [] })
  const calls = fakeGit(on, { 'ls-files': 'To Do.md\0' })
  const pane = await mount($)
  await pane.input({ key: 'q', text: 'to do', kind: 'change' })
  await state.clock.advance(SEARCH_MS)
  await state.until('tree', x => (x as Tree).hits.length > 0)
  await pane.input({ key: 'q', text: '', kind: 'change' })
  await state.clock.advance(SEARCH_MS)
  await state.until('tree', x => (x as Tree).query === '')
  await pane.input({ key: 'q', text: 'do', kind: 'change' })
  await state.clock.advance(SEARCH_MS)
  await state.until('tree', x => (x as Tree).query === 'do' && (x as Tree).hits.length > 0)
  expect(calls.filter(c => c.includes('ls-files')).length).toBe(2)
})

test('filter: keystrokes do not write the tree, the search starts SEARCH_MS after the last and a redraw keeps the text', async ($, on) => {
  const state = liveState(on, { tab: 'files' })
  fakeVault(on, {}, { '': [] })
  const calls = fakeGit(on, { 'ls-files': 'To Do.md\0' })
  const pane = await mount($)
  await quiet(state.clock)
  const sets = state.sets.tree ?? 0
  for (const text of ['t', 'to', 'to d']) await pane.input({ key: 'q', text, kind: 'change' })
  await pane.redraw()
  expect((await pane.find({ key: 'q' }))?.props.value).toBe('to d')
  expect(state.sets.tree ?? 0).toBe(sets)
  await state.clock.advance(SEARCH_MS)
  await state.until('tree', t => (t as Tree).hits.length > 0)
  expect((state.values.tree as Tree).query).toBe('to d')
  expect(state.sets.tree).toBe(sets + 1)
  expect(calls.filter(c => c.includes('ls-files')).length).toBe(1)
})

test('filter: Enter searches at once; a path shown in Reading clears the field', async ($, on) => {
  const state = liveState(on, { tab: 'files', reading: { ...EMPTY_READING, path: 'A/a.md', text: 'x', mtimeMs: AT } })
  fakeVault(on, { 'A/a.md': 'x' }, { '': [{ name: 'A', kind: 'dir' }], A: [{ name: 'a.md', kind: 'file' }] })
  fakeGit(on, { 'ls-files': 'A/a.md\0' })
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.input({ key: 'q', text: 'a.md', kind: 'submit' })
  await state.until('tree', t => (t as Tree).hits.length > 0)
  await pane.press({ key: 'tab-reading' })
  await state.until('tab', t => t === 'reading')
  await pane.redraw()
  await pane.press({ key: 'crumb-0' })
  await state.until('tab', t => t === 'files')
  await pane.redraw()
  expect((state.values.tree as Tree).query).toBe('')
  expect((await pane.find({ key: 'q' }))?.props.value).toBe('')
})

// Fake `du`: answers after one turn of the event loop, so we can see how many run together.
function fakeDu(on: Parameters<typeof liveState>[0], kb: Record<string, number | null>) {
  const seen = { max: 0, now: 0, calls: [] as string[] }
  on('process.run', async (_$, e) => {
    if (e.argv[0] !== 'du') return { value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false } } as never
    const path = e.argv[2] ?? ''
    seen.calls.push(path)
    seen.now += 1
    seen.max = Math.max(seen.max, seen.now)
    await realTurn()
    seen.now -= 1
    const n = kb[path]
    return { value: n === null || n === undefined
      ? { exitCode: 1, stdout: '', stderr: 'du: denied', isStdoutTruncated: false }
      : { exitCode: 0, stdout: `${n}\t${path}\n`, stderr: '', isStdoutTruncated: false } } as never
  })
  return seen
}

test('sizes: visible folders are measured with du, at most 4 at a time; a failed du counts as —', async ($, on) => {
  const dirs = ['A', 'B', 'C', 'D', 'E', 'F']
  const state = liveState(on, { tab: 'files', tree: withChildren(emptyTree(), '', dirs.map(d => ent(d, 'dir'))) })
  fakeVault(on, {}, { '': dirs.map(d => ({ name: d, kind: 'dir' as const })) })
  on('store.set', () => ({ value: undefined }))
  const du = fakeDu(on, { '/v/A': 47_000, '/v/B': 1, '/v/C': 2, '/v/D': 3, '/v/E': 4, '/v/F': null })
  const pane = await mount($)
  await pane.press({ key: 'sizes' })
  await state.until('sizes', s => Object.keys(s as object).length === 6)
  expect(du.max).toBe(4)
  // A single write for all the folders: fewer redraws while clicking.
  expect(state.sets.sizes).toBe(1)
  expect((state.values.sizes as Record<string, number | null>).A).toBe(47_000 * 1024)
  expect((state.values.sizes as Record<string, number | null>).F).toBe(null)
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^48 MB$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^—$/ })).toBeDefined()
})

test('sizes: with Σ off, no du', async ($, on) => {
  const state = liveState(on, { tab: 'recap', tree: withChildren(emptyTree(), '', [ent('A', 'dir')]) })
  on('store.set', () => ({ value: undefined }))
  fakeVault(on, {}, { '': [{ name: 'A', kind: 'dir' }] })
  const du = fakeDu(on, { '/v/A': 1 })
  const pane = await mount($)
  await pane.press({ key: 'tab-files' })
  await quiet(state.clock)
  expect(du.calls).toEqual([])
})

test('sizes: a write inside a folder measures it again at the end of the turn, the others stay cached', async ($, on) => {
  const tree = { ...withChildren(emptyTree(), '', [ent('A', 'dir'), ent('B', 'dir')]), showSizes: true }
  const state = liveState(on, { tab: 'files', tree, sizes: { A: 1024, B: 2048 } })
  fakeVault(on, { 'A/x.md': 'x' }, { '': [{ name: 'A', kind: 'dir' }, { name: 'B', kind: 'dir' }], A: [{ name: 'x.md', kind: 'file' }] })
  writeHooks(on)
  on('turn.complete', () => ({ text: '' }))
  const du = fakeDu(on, { '/v/A': 9 })
  await $.tool.call({ tool: 'Edit', file_path: '/v/A/x.md', old_string: 'a', new_string: 'b' })
  // During the turn the old size stays and du does not run.
  await quiet(state.clock)
  expect(du.calls).toEqual([])
  expect((state.values.sizes as Record<string, number>).A).toBe(1024)
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  await state.until('sizes', s => (s as Record<string, number>).A === 9 * 1024)
  expect(du.calls).toEqual(['/v/A'])
  expect((state.values.sizes as Record<string, number>).B).toBe(2048)
})

test('hook: the git state also carries the uncommitted changed lines', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, {}, { '': [] })
  fakeGit(on, { status: ' M r.md\0', diff: '12\t3\tr.md\0' })
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'tab-files' })
  await state.until('numstat', n => n !== null)
  expect(state.values.numstat).toEqual({ 'r.md': { add: 12, del: 3 } })
})

test('git: an unchanged state is not rewritten; returning to the Files tab leaves git and numstat alone', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, {}, { '': [] })
  fakeGit(on, { status: ' M r.md\0', diff: '12\t3\tr.md\0' })
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'tab-files' })
  await state.until('numstat', n => n !== null)
  await quiet(state.clock)
  await pane.redraw()
  const before = { git: state.sets.git, numstat: state.sets.numstat }
  await pane.press({ key: 'tab-recap' })
  await pane.redraw()
  await pane.press({ key: 'tab-files' })
  await quiet(state.clock)
  expect(state.sets.tab).toBe(3)
  expect({ git: state.sets.git, numstat: state.sets.numstat }).toEqual(before)
})

// Fake `du` behind a gate: it waits until `release()` is called.
function gatedDu(on: Parameters<typeof liveState>[0]) {
  const seen = { calls: [] as string[], release: () => {} }
  const gate = new Promise<void>(r => { seen.release = r })
  on('process.run', async (_$, e) => {
    if (e.argv[0] !== 'du') return { value: { exitCode: 1, stdout: '', stderr: '', isStdoutTruncated: false } } as never
    const path = e.argv[2] ?? ''
    seen.calls.push(path)
    await gate
    return { value: { exitCode: 0, stdout: `1\t${path}\n`, stderr: '', isStdoutTruncated: false } } as never
  })
  return seen
}

const SIX = ['A', 'B', 'C', 'D', 'E', 'F']

test('sizes: the du queue stops when Σ is turned off, so after the 4 in flight no other starts', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: withChildren(emptyTree(), '', SIX.map(d => ent(d, 'dir'))) })
  fakeVault(on, {}, { '': SIX.map(d => ({ name: d, kind: 'dir' as const })) })
  on('store.set', () => ({ value: undefined }))
  const du = gatedDu(on)
  const pane = await mount($)
  await pane.press({ key: 'sizes' })
  // The 4 `du` calls start and wait at the gate: `quiet` lets what is in progress run, with no real time.
  await quiet(state.clock)
  expect(du.calls.length).toBe(4)
  await pane.press({ key: 'sizes' })
  expect((state.values.tree as Tree).showSizes).toBe(false)
  du.release()
  await state.until('sizes', s => Object.keys(s as object).length === 4)
  await quiet(state.clock)
  expect(du.calls.length).toBe(4)
})

test('sizes: the du queue stops when a filter is active, so after the 4 in flight no other starts', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: withChildren(emptyTree(), '', SIX.map(d => ent(d, 'dir'))) })
  fakeVault(on, {}, { '': SIX.map(d => ({ name: d, kind: 'dir' as const })) })
  on('store.set', () => ({ value: undefined }))
  const du = gatedDu(on)
  const pane = await mount($)
  await pane.press({ key: 'sizes' })
  await quiet(state.clock)
  expect(du.calls.length).toBe(4)
  state.values.tree = { ...(state.values.tree as Tree), query: 'x' }
  du.release()
  await state.until('sizes', s => Object.keys(s as object).length === 4)
  await quiet(state.clock)
  expect(du.calls.length).toBe(4)
})

test('file names: a file named Icon\\r draws in the tree and in the selection bar, the carriage return as a space', async ($, on) => {
  liveState(on, { tab: 'files', tree: { ...withChildren(emptyTree(), '', [ent('Icon\r'), ent('a.md')]), selected: 'Icon\r' } })
  fakeVault(on, {}, { '': [{ name: 'Icon\r', kind: 'file' }, { name: 'a.md', kind: 'file' }] })
  const pane = await mount($)
  expect((await pane.findAll({ type: 'Button' })).some(b => b.props.label === 'Icon ')).toBe(true)
  expect(await pane.find({ type: 'Text', text: /^Icon $/ })).toBeDefined()
})

test('file names: a folder with a \\r in its name draws in search and in the selection bar, shown as Icon /', async ($, on) => {
  const t = withChildren(withChildren(emptyTree(), '', [ent('Icon\r', 'dir')]), 'Icon\r', [ent('a.md')])
  liveState(on, { tab: 'files', tree: { ...t, query: 'a', hits: ['Icon\r/a.md'], selected: 'Icon\r/a.md' } })
  fakeVault(on, {}, { '': [{ name: 'Icon\r', kind: 'dir' }], 'Icon\r': [{ name: 'a.md', kind: 'file' }] })
  const pane = await mount($)
  expect(await pane.find({ type: 'Text', text: /^Icon \/$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^Icon  · / })).toBeDefined()
})

test('tree: a tree saved by an older version, without the new fields, still draws', async ($, on) => {
  const { broken: _b, hits: _h, ...old } = withChildren(emptyTree(), '', [ent('a.md')])
  liveState(on, { tab: 'files', tree: old })
  fakeVault(on, {}, { '': [{ name: 'a.md', kind: 'file' }] })
  const pane = await mount($)
  expect(await pane.find({ key: 'r:a.md' })).toBeDefined()
})

test('files tab: a root error with a control character still draws, the control character becomes U+FFFD', async ($, on) => {
  liveState(on, { tab: 'files', tree: { ...emptyTree(), error: 'EA\x1bCCES' } })
  fakeVault(on, {})
  const pane = await mount($)
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect(await pane.find({ type: 'Text', text: /^Non riesco a leggere il vault: EA�CCES$/ })).toBeDefined()
})

// File paths become button keys (`r:`, `t:`, `cp:`, `app:`): a name with a control character
// (`\x1b`, `\r`) must still draw and its button must press exactly that row.
test('file names: files and folders with \\x1b and \\r in the name draw in an open tree with no fault card, and each key presses its own row', async ($, on) => {
  const dirName = 'D\x1bir'
  const names = ['x\x1by.pdf', 'z\rw.pdf', 'x\x07y.pdf']
  const ids = names.map(n => `${dirName}/${n}`)
  const t = withChildren(withChildren(emptyTree(), '', [ent(dirName, 'dir')]), dirName, names.map(n => ent(n)))
  const state = liveState(on, { tab: 'files', tree: { ...t, expanded: [dirName] } })
  fakeVault(on, {}, { '': [{ name: dirName, kind: 'dir' }], [dirName]: names.map(name => ({ name, kind: 'file' as const })) })
  const copied: string[] = []
  on('ui.copy', (_$, e) => { copied.push(e.text); return { value: { isCopied: true } } as never })
  let toasted: (t: string) => void = () => {}
  const toast = new Promise<string>(r => { toasted = r })
  on('ui.toast', (_$, e) => { toasted(e.text); return { value: undefined } as never })
  const pane = await mount($)
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  const keys = (await pane.findAll({ type: 'Button' })).map(b => b.key)
  // Names that differ by a single control stay three distinct keys, written with visible escapes.
  expect(ids.map(id => `r:${keyText(id)}`)).toEqual(['r:D\\u001bir/x\\u001by.pdf', 'r:D\\u001bir/z\\u000dw.pdf', 'r:D\\u001bir/x\\u0007y.pdf'])
  for (const id of ids) expect(keys).toContain(`r:${keyText(id)}`)
  expect(keys).toContain(`r:${keyText(dirName)}`)
  // The arrow of the open folder has the `t:` key.
  expect(keys).toContain(`t:${keyText(dirName)}`)
  // No key, of button or of row, carries a control character.
  const control = /[\u0000-\u001f\u007f-\u009f]/
  expect((await pane.findAll({ type: 'Button' })).filter(b => control.test(b.key ?? ''))).toEqual([])
  expect((await pane.findAll({ type: 'Box' })).filter(b => control.test(b.key ?? ''))).toEqual([])
  // Each name presses its own file: the choice goes to the path of that row.
  for (const id of ids) {
    await pane.press({ key: `r:${keyText(id)}` })
    await state.until('tree', tr => (tr as Tree).selected === id)
    await pane.redraw()
  }
  // "Copia path" (on hover) copies the path of that row.
  await pane.press({ key: `cp:${keyText(ids[1]!)}` })
  await toast
  expect(copied).toEqual([ids[1]])
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
})

// The tab in English: a vault whose capability table is in English.
const CLAUDE_MD_EN = '## Capabilities\n\n| Capability | Authoritative source |\n|---|---|\n| Future work | `To Do.md` |\n'
const DAY_MS = 86_400_000

test('Files in English: the filter, the hover actions, the icons, the ages and the footer', async ($, on) => {
  const tree = { ...withChildren(emptyTree(), '', [ent('A', 'dir'), ent('today.md', 'file', AT - 60_000, 4_000), ent('old.md', 'file', AT - 3 * DAY_MS, 1_500_000), ent('older.md', 'file', AT - 90 * DAY_MS)]), selected: 'old.md', cursor: 'old.md' }
  const state = liveState(on, { tab: 'files', tree })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN })
  const pane = await mount($)
  expect((await pane.find({ key: 'q' }))?.props.placeholder).toBe('Filter…')
  expect((await pane.find({ key: 'app:A' }))?.props.label).toBe('Open in app')
  expect((await pane.find({ key: 'cp:A' }))?.props.label).toBe('Copy path')
  expect((await pane.findAll({ type: 'Svg' })).map(s => s.props.alt)).toEqual(['Jarvis waiting', 'JARVIS', 'folder', 'Markdown', 'Markdown', 'Markdown', '─', 'Markdown'])
  // The age beside each file: the time today, then days, then months.
  expect(await pane.find({ type: 'Text', text: /^14:31$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^3d$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^3mo$/ })).toBeDefined()
  expect(await pane.find({ text: /^1\.5 MB · modified 3d ago$/ })).toBeDefined()
  for (const key of ['op-move', 'op-copy', 'op-trash']) expect((await pane.find({ key }))?.props.label).toBe({ 'op-move': '→ Move', 'op-copy': '+ Duplicate', 'op-trash': '✕ Trash' }[key])
  state.values.tree = { ...tree, selected: 'today.md', cursor: 'today.md' }
  await pane.redraw()
  expect(await pane.find({ text: /^4 kB · modified at 14:31$/ })).toBeDefined()
  state.values.written = { 'today.md': AT }
  await pane.redraw()
  expect(await pane.find({ text: /^4 kB · written by Jarvis at 14:32$/ })).toBeDefined()
  state.values.tree = { ...tree, selected: '', cursor: '', showSizes: true }
  state.values.sizes = { A: 6_100_000 }
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^6\.1 MB$/ })).toBeDefined()
  expect(await pane.find({ text: /^No file selected$/ })).toBeDefined()
  expect(await pane.find({ text: /(Filtra|Apri nell|Copia path|nessun file|modificato|scritto da)/ })).toBe(undefined)
})

test('Files in English: the unreadable vault, a filter with no results, the long list', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: { ...emptyTree(), error: 'EACCES' } })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN })
  const pane = await mount($)
  expect(await pane.find({ text: /^Cannot read the workspace: EACCES$/ })).toBeDefined()
  expect(await cardTitles(pane)).toContain('Workspace unreadable')
  state.values.tree = { ...emptyTree(), query: 'zzz', hits: [] }
  await pane.redraw()
  expect(await pane.find({ text: /^No file matches "zzz"$/ })).toBeDefined()
  state.values.tree = withChildren(emptyTree(), '', Array.from({ length: 205 }, (_, i) => ent(`n${i}.md`)))
  await pane.redraw()
  expect(await pane.find({ text: /^5 more rows: use the filter$/ })).toBeDefined()
})

test('Files in English: the notices of the copy and open actions', async ($, on) => {
  const state = liveState(on, { tab: 'files', tree: withChildren(emptyTree(), '', [ent('A', 'dir'), ent('b.md')]) })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN })
  const said: string[] = []
  on('ui.copy', () => ({ value: { isCopied: true } }) as never)
  on('mcp.call', () => ({ value: { content: [{ type: 'text', text: 'no pane' }], isError: true } }) as never)
  on('ui.toast', (_$, e) => { said.push(e.text); return { value: undefined } as never })
  const pane = await mount($)
  await pane.press({ key: 'cp:b.md' })
  await quiet(state.clock)
  await pane.press({ key: 'app:b.md' })
  await quiet(state.clock)
  expect(said).toEqual(['Copied b.md', 'Cannot open the Files pane'])
})

// A tab saved by an older version ("file"): the Files tab is in view, so a write by Jarvis still refreshes git.
test('hook: the tab saved under its old id still counts as the Files tab for the git refresh', async ($, on) => {
  const t = withChildren({ ...withChildren(emptyTree(), '', [ent('A', 'dir')]), expanded: ['A'] }, 'A', [ent('x.md', 'file', 0, 1)])
  const state = liveState(on, { tab: 'file', tree: t })
  fakeVault(on, { 'A/x.md': 'x' }, { '': [{ name: 'A', kind: 'dir' }], A: [{ name: 'x.md', kind: 'file' }] })
  const calls = fakeGit(on, { status: '', diff: '' })
  writeHooks(on)
  await $.tool.call({ tool: 'Edit', file_path: '/v/A/x.md', old_string: 'a', new_string: 'b' })
  await settled(state.clock)
  await state.clock.settle()
  expect(calls.filter(c => c.includes('status')).length).toBe(1)
})
