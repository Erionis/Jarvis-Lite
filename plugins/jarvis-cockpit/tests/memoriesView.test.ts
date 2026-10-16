import type { On } from 'claude-code'
import { test, expect, type Engine } from 'claude-code/testing'
import { PANE, PLUGIN } from '../hooks/state'
import type { MemoriesState, Reading } from '../types'
import { keyText } from '../hooks/format'
import { AT, ROOT, cardTitles, fakeGit, fakeVault, liveState, paneProps, quiet, settled } from './harness'

const M = '99 - Jarvis/memory'
const DAY = 86_400_000
const CLAUDE_MD = `## Capacita' Jarvis\n\n| Capacita' | Fonte autorevole |\n|---|---|\n| Identita' | \`${M}/soul.md\` |\n| Memoria durevole | \`${M}/MEMORY.md\` |\n`
const fm = (name: string, type: string, body = '') => `---\nname: ${name}\ndescription: Di ${name}\ntype: ${type}\n---\n\n${body}`
const FILES: Record<string, string> = {
  'MEMORY.md': '# Indice\n\n- [NOVA Chat](project_nova_chat.md)\n',
  'soul.md': fm('Soul', 'user'),
  'README.md': '# Memorie\n',
  'user_alex.md': fm('Alex', 'user', 'Lavora su [NOVA Chat](project_nova_chat.md).'),
  'project_nova_chat.md': fm('NOVA Chat', 'project', 'Vedi [[reference_cluster]], [tono](<feedback_tono.md>) e [x](reference_x.md).'),
  'project_a.md': fm('Alfa', 'project'),
  'project_b.md': fm('Beta', 'project'),
  'project_c.md': fm('Gamma', 'project'),
  'reference_cluster.md': fm('Stato cluster', 'reference', 'Usato da [NOVA Chat](project_nova_chat.md).'),
  'feedback_tono.md': fm('Tono mail', 'feedback'),
  'reference_x.md': fm('Rif X', 'reference'),
}
const CLAUDE_MD_EN = `## Capabilities\n\n| Capability | Authoritative source |\n|---|---|\n| Identity | \`${M}/soul.md\` |\n| Durable memory | \`${M}/MEMORY.md\` |\n`
const vaultFiles = (claude = CLAUDE_MD): Record<string, string> => ({ 'CLAUDE.md': claude, ...Object.fromEntries(Object.entries(FILES).map(([k, v]) => [`${M}/${k}`, v])) })
const listing = (mtime: (name: string) => number = () => AT - 30 * DAY) =>
  [...Object.keys(FILES).map(name => ({ name, kind: 'file' as const, size: FILES[name]?.length, mtimeMs: mtime(name) })), { name: 'archivio', kind: 'dir' as const }]
// All in git for 30 days; Alfa came in two days ago, Beta was changed yesterday; Tono has uncommitted changes.
const t = (days: number) => String(Math.floor((AT - days * DAY) / 1000))
const LOG = `${t(1)}\0\n${M}/project_b.md\0${t(2)}\0\n${M}/project_a.md\0${t(30)}\0\n${Object.keys(FILES).filter(f => f !== 'project_a.md').map(f => `${M}/${f}`).join('\0')}\0`

const mount = ($: Engine) => $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps() })
const mem = (s: { values: Record<string, unknown> }) => s.values.memories as MemoriesState
const tabLabels = async (pane: Awaited<ReturnType<typeof mount>>) => (await pane.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('tab-')).map(b => b.props.label)
const memButtons = async (pane: Awaited<ReturnType<typeof mount>>) => (await pane.findAll({ type: 'Button' })).map(b => b.key ?? '').filter(k => k.startsWith('mem-'))
const svgAlts = async (pane: Awaited<ReturnType<typeof mount>>) => (await pane.findAll({ type: 'Svg' })).map(s => String(s.props.alt ?? '')).filter(a => a !== '─')
const FOOTER = /^Per modificare le memorie chiedi a Jarvis$/

async function openTab($: Engine, on: On, git = true, claude = CLAUDE_MD) {
  const state = liveState(on, {})
  const files = fakeVault(on, vaultFiles(claude), { [M]: listing() })
  fakeGit(on, git ? { log: LOG, status: ` M ${M}/feedback_tono.md\0` } : {})
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'tab-memories' })
  await state.until('memories', m => (m as MemoriesState).list !== null)
  await pane.redraw()
  return { state, pane, files }
}

test('memories tab: shown when Durable memory is declared, and last in the bar', async ($, on) => {
  liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD })
  const pane = await mount($)
  expect(await tabLabels(pane)).toEqual(['File', 'Lettura', 'Memorie'])
})

test('memories tab: groups in order with their counts and new counts; index, Soul, README and subfolders left out; new and changed first', async ($, on) => {
  const { state, pane } = await openTab($, on)
  expect(mem(state).dir).toBe(M)
  expect(mem(state).list?.map(m => m.file).sort()).toEqual(['feedback_tono.md', 'project_a.md', 'project_b.md', 'project_c.md', 'project_nova_chat.md', 'reference_cluster.md', 'reference_x.md', 'user_alex.md'])
  expect(await cardTitles(pane)).toEqual(['Persone', 'Progetti', 'Preferenze', 'Riferimenti'])
  expect(await pane.find({ type: 'Text', text: /^4 · 1 nuova$/ })).toBeDefined()
  // Alfa new, Beta changed, NOVA Chat the most linked; Gamma beyond the first 3. With equal links, by name.
  const rows = (await pane.findAll({ type: 'Button' })).filter(b => /^mem-[a-z_]+\.md$/.test(b.key ?? '')).map(b => b.key)
  expect(rows).toEqual(['mem-user_alex.md', 'mem-project_a.md', 'mem-project_b.md', 'mem-project_nova_chat.md', 'mem-feedback_tono.md', 'mem-reference_x.md', 'mem-reference_cluster.md'])
  expect((await pane.find({ type: 'Text', text: /^ nuova $/ }))?.props.color).toBe('#13918b')
  expect(await pane.findAll({ type: 'Text', text: /^ cambiata $/ })).toHaveLength(2)
  expect((await pane.find({ type: 'Text', text: /^Di NOVA Chat$/ }))?.props).toMatchObject({ color: 'inactive', wrap: 'truncate-end' })
  // Light rows: the linked memories are not in the list, they show when the memory is opened.
  expect((await pane.findAll({ type: 'Button' })).some(b => /^mem-(chip|link)-/.test(b.key ?? ''))).toBe(false)
  expect(await pane.find({ type: 'Text', text: /^\+\d+$/ })).toBe(undefined)
  expect(await pane.find({ type: 'Text', text: FOOTER })).toBeDefined()
  await pane.press({ key: 'mem-more-projects' })
  await state.until('memories', m => (m as MemoriesState).expanded.includes('projects'))
  await pane.redraw()
  expect(await pane.find({ key: 'mem-project_c.md' })).toBeDefined()
  expect((await pane.find({ key: 'mem-more-projects' }))?.props.label).toBe('meno ‹')
})

test('memory view: layout from the back link to the Map; following a link gives ‹ name, and back walks up to the list', async ($, on) => {
  const { state, pane } = await openTab($, on)
  await pane.press({ key: 'mem-project_nova_chat.md' })
  await state.until('memories', m => (m as MemoriesState).open === 'project_nova_chat.md')
  await pane.redraw()
  // On top the way back, in teal; then the two buttons; then one row per linked memory, by group and name.
  expect(await memButtons(pane)).toEqual(['mem-back', 'mem-open', 'mem-ask', 'mem-link-user_alex.md', 'mem-link-feedback_tono.md', 'mem-link-reference_x.md', 'mem-link-reference_cluster.md'])
  expect((await pane.find({ key: 'mem-back' }))?.props.label).toBe('‹ Memorie')
  expect((await pane.find({ type: 'Text', text: /^‹ Memorie$/ }))?.props.color).toBe('#13918b')
  expect((await pane.find({ key: 'mem-open' }))?.props.label).toBe('Apri in Lettura ›')
  expect((await pane.find({ key: 'mem-ask' }))?.props.label).toBe('Chiedi una modifica')
  expect((await pane.findAll({ type: 'Button' })).filter(b => b.key?.startsWith('mem-link-')).map(b => b.props.label)).toEqual(['alex', 'tono', 'x', 'cluster'])
  expect((await pane.findAll({ type: 'Text', text: /^(Persone|Preferenze|Riferimenti)$/ })).map(t => t.props.color)).toEqual(['inactive', 'inactive', 'inactive', 'inactive'])
  expect(await pane.find({ type: 'Text', text: /^Di NOVA Chat$/ })).toBeDefined()
  // The graph at the bottom, in the Map card, after the linked ones; the footer row of the list is not here.
  expect((await svgAlts(pane)).slice(-3)).toEqual(['Collegate', 'Mappa', 'NOVA Chat e 4 memorie collegate'])
  expect(await pane.find({ type: 'Text', text: FOOTER })).toBe(undefined)
  await pane.press({ key: 'mem-link-reference_cluster.md' })
  await state.until('memories', m => (m as MemoriesState).open === 'reference_cluster.md')
  expect(mem(state).back).toEqual(['project_nova_chat.md'])
  await pane.redraw()
  expect((await pane.find({ key: 'mem-back' }))?.props.label).toBe('‹ NOVA Chat')
  expect((await svgAlts(pane)).slice(-1)).toEqual(['Stato cluster e 1 memoria collegata'])
  await pane.press({ key: 'mem-back' })
  await state.until('memories', m => (m as MemoriesState).open === 'project_nova_chat.md' && (m as MemoriesState).back.length === 0)
  await pane.redraw()
  expect((await pane.find({ key: 'mem-back' }))?.props.label).toBe('‹ Memorie')
  await pane.press({ key: 'mem-back' })
  await state.until('memories', m => (m as MemoriesState).open === null)
  await pane.redraw()
  expect(await pane.find({ key: 'mem-more-projects' })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: FOOTER })).toBeDefined()
})

test('memory view: with no links, no Linked card and no Map', async ($, on) => {
  const { state, pane } = await openTab($, on)
  await pane.press({ key: 'mem-project_a.md' })
  await state.until('memories', m => (m as MemoriesState).open === 'project_a.md')
  await pane.redraw()
  expect(await memButtons(pane)).toEqual(['mem-back', 'mem-open', 'mem-ask'])
  expect(await cardTitles(pane)).toEqual([])
  expect(await pane.find({ type: 'Text', text: /^Di Alfa$/ })).toBeDefined()
})

test('memory view: Ask for a change prepares the prompt; Open in Reading opens the memory without Edit', async ($, on) => {
  const filled: string[] = []
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }) as never)
  on('prompt.fill', (_$, e) => { filled.push(e.text); return { isFilled: true } })
  const { state, pane } = await openTab($, on)
  await pane.press({ key: 'mem-project_nova_chat.md' })
  await state.until('memories', m => (m as MemoriesState).open !== null)
  await pane.redraw()
  await pane.press({ key: 'mem-ask' })
  await quiet(state.clock)
  expect(filled).toEqual(['Modifica la memoria «NOVA Chat»: '])
  await pane.press({ key: 'mem-open' })
  await state.until('tab', x => x === 'reading')
  expect((state.values.reading as Reading).path).toBe(`${M}/project_nova_chat.md`)
  await pane.redraw()
  expect(await pane.find({ key: 'mode-edit' })).toBe(undefined)
})

test('memories tab: when Jarvis writes a memory, the tab reloads', async ($, on) => {
  let files: Map<string, string> | null = null
  on('agent.list', () => ({ value: [] }))
  on('ui.status', () => ({ value: undefined }) as never)
  on('tool.call', () => { files?.set(`${ROOT}/${M}/project_nova_chat.md`, fm('NOVA Chat 2', 'project')); return { result: 'ok' } as never })
  const opened = await openTab($, on)
  files = opened.files
  const state = opened.state
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/${M}/project_nova_chat.md`, old_string: 'a', new_string: 'b' })
  await settled(state.clock)
  await state.until('memories', m => (m as MemoriesState).list?.some(x => x.name === 'NOVA Chat 2') === true)
})

test('memories tab: simultaneous reloads run one git log at a time, then a single extra one that reads the files after the last request', async ($, on) => {
  const state = liveState(on, {})
  const files = fakeVault(on, vaultFiles(), { [M]: listing() })
  // The git log answers after one second of the fake clock: meanwhile the running ones are counted.
  let running = 0
  let most = 0
  const calls = fakeGit(on, { log: LOG, status: '' }, [], {
    log: async () => {
      running++
      most = Math.max(most, running)
      await state.clock.sleep(1000)
      running--
    },
  })
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'tab-memories' })
  // The first reload waits for the git log; Jarvis changes a memory and two more requests arrive.
  files.set(`${ROOT}/${M}/project_nova_chat.md`, fm('NOVA Chat 2', 'project'))
  await pane.press({ key: 'tab-memories' })
  await pane.press({ key: 'tab-memories' })
  await state.clock.advance(1000)
  await state.clock.advance(1000)
  expect(most).toBe(1)
  expect(calls.filter(c => c.includes('log'))).toHaveLength(2)
  expect(mem(state).list?.find(m => m.file === 'project_nova_chat.md')?.name).toBe('NOVA Chat 2')
})

test('memories tab: without git, a file counts as changed if it is from the last 7 days', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, vaultFiles(), { [M]: listing(name => (name === 'reference_x.md' ? AT - DAY : AT - 30 * DAY)) })
  fakeGit(on, {})
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'tab-memories' })
  await state.until('memories', m => (m as MemoriesState).list !== null)
  expect(mem(state).list?.filter(m => m.fresh !== null).map(m => [m.file, m.fresh])).toEqual([['reference_x.md', 'changed']])
})

test('memories tab: an unreadable memories folder shows one row with the path, and the footer row', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD })
  fakeGit(on, {})
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'tab-memories' })
  await state.until('memories', m => (m as MemoriesState).error !== null)
  await pane.redraw()
  expect((await pane.find({ type: 'Text', text: /^Non riesco a leggere 99 - Jarvis\/memory: ./ }))?.props.color).toBe('error')
  expect(await pane.find({ type: 'Text', text: /^Per modificare le memorie chiedi a Jarvis$/ })).toBeDefined()
})

test('memories tab: a name and description with a control character still draw in the list, view, back link and map, the control character becomes U+FFFD', async ($, on) => {
  const FILE = 'project_esc.md'
  const text = '---\nname: Es\x1bc\ndescription: De\x1bsc\ntype: project\n---\n\nVedi [NOVA Chat](project_nova_chat.md).'
  const state = liveState(on, {})
  fakeVault(on, { ...vaultFiles(), [`${M}/${FILE}`]: text }, { [M]: [...listing(), { name: FILE, kind: 'file' as const, size: text.length, mtimeMs: AT - 30 * DAY }] })
  fakeGit(on, { log: LOG, status: ` M ${M}/feedback_tono.md\0` })
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'tab-memories' })
  await state.until('memories', m => (m as MemoriesState).list !== null)
  await pane.redraw()
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect((await pane.find({ key: `mem-${FILE}` }))?.props.label).toBe('Es�c')
  expect(await pane.find({ type: 'Text', text: /^De�sc$/ })).toBeDefined()
  await pane.press({ key: `mem-${FILE}` })
  await state.until('memories', m => (m as MemoriesState).open === FILE)
  await pane.redraw()
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect(await pane.find({ type: 'Text', text: /^Es�c$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^De�sc$/ })).toBeDefined()
  // The map: the alt and the source (title and names) with no control characters.
  const map = (await pane.findAll({ type: 'Svg' })).find(n => String(n.props.alt).startsWith('Es'))
  expect(map?.props.alt).toBe('Es�c e 1 memoria collegata')
  expect(String(map?.props.source)).not.toMatch(/[\u0000-\u0008\u000b-\u001f]/)
  expect(String(map?.props.source)).toContain('<title>Es�c e 1 memoria collegata</title>')
  // From the linked memory the back link carries the earlier name.
  await pane.press({ key: 'mem-link-project_nova_chat.md' })
  await state.until('memories', m => (m as MemoriesState).open === 'project_nova_chat.md')
  await pane.redraw()
  expect((await pane.find({ key: 'mem-back' }))?.props.label).toBe('‹ Es�c')
  expect(await pane.find({ type: 'Text', text: /^‹ Es�c$/ })).toBeDefined()
})

test('memories tab: two memories whose files differ by a control character get different keys, free of controls, and each opens its own', async ($, on) => {
  const A = 'feedback_x\x1by.md'
  const B = 'feedback_x\x07y.md'
  const state = liveState(on, {})
  fakeVault(on, { ...vaultFiles(), [`${M}/${A}`]: fm('Ex', 'feedback', 'Vedi [[feedback_x\x07y]].'), [`${M}/${B}`]: fm('Bi', 'feedback') },
    { [M]: [...listing(), ...[A, B].map(name => ({ name, kind: 'file' as const, size: 40, mtimeMs: AT - 30 * DAY }))] })
  fakeGit(on, { log: LOG, status: '' })
  on('store.set', () => ({ value: undefined }))
  const pane = await mount($)
  await pane.press({ key: 'tab-memories' })
  await state.until('memories', m => (m as MemoriesState).list !== null)
  await pane.redraw()
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  const keys = await memButtons(pane)
  expect(keys).toContain('mem-feedback_x\\u001by.md')
  expect(keys).toContain('mem-feedback_x\\u0007y.md')
  expect(keys.filter(k => /[\u0000-\u001f\u007f-\u009f]/.test(k))).toEqual([])
  await pane.press({ key: `mem-${keyText(A)}` })
  await state.until('memories', m => (m as MemoriesState).open === A)
  await pane.redraw()
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect(await memButtons(pane)).toContain('mem-link-feedback_x\\u0007y.md')
  await pane.press({ key: `mem-link-${keyText(B)}` })
  await state.until('memories', m => (m as MemoriesState).open === B)
})

test('Memories in English: group cards, counts, the new and changed pills, more and less', async ($, on) => {
  const { state, pane } = await openTab($, on, true, CLAUDE_MD_EN)
  // The Memories tab is the active one (a Text, not a Button).
  expect(await tabLabels(pane)).toEqual(['Recap', 'Files', 'Reading'])
  expect(await cardTitles(pane)).toEqual(['People', 'Projects', 'Preferences', 'References'])
  expect(await pane.find({ type: 'Text', text: /^4 · 1 new$/ })).toBeDefined()
  expect((await pane.find({ type: 'Text', text: /^ New $/ }))?.props.color).toBe('#13918b')
  expect(await pane.findAll({ type: 'Text', text: /^ Changed $/ })).toHaveLength(2)
  expect((await pane.find({ key: 'mem-more-projects' }))?.props.label).toBe('1 more ›')
  expect(await pane.find({ type: 'Text', text: /^To change the memories, ask Jarvis$/ })).toBeDefined()
  await pane.press({ key: 'mem-more-projects' })
  await state.until('memories', m => (m as MemoriesState).expanded.includes('projects'))
  await pane.redraw()
  expect((await pane.find({ key: 'mem-more-projects' }))?.props.label).toBe('Less ‹')
  for (const italian of [/Persone/, /nuova/, /cambiata/, /Per modificare/]) expect(await pane.find({ text: italian })).toBe(undefined)
})

test('Memories in English: the view, the linked memories, the map and the prompt to ask for a change', async ($, on) => {
  const filled: string[] = []
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }) as never)
  on('prompt.fill', (_$, e) => { filled.push(e.text); return { isFilled: true } })
  const { state, pane } = await openTab($, on, true, CLAUDE_MD_EN)
  await pane.press({ key: 'mem-project_nova_chat.md' })
  await state.until('memories', m => (m as MemoriesState).open === 'project_nova_chat.md')
  await pane.redraw()
  expect((await pane.find({ key: 'mem-back' }))?.props.label).toBe('‹ Memories')
  expect((await pane.find({ key: 'mem-open' }))?.props.label).toBe('Open in Reading ›')
  expect((await pane.find({ key: 'mem-ask' }))?.props.label).toBe('Ask for a change')
  expect((await pane.findAll({ type: 'Text', text: /^(People|Preferences|References)$/ })).length).toBe(4)
  expect((await svgAlts(pane)).slice(-3)).toEqual(['Linked', 'Map', 'NOVA Chat and 4 linked memories'])
  await pane.press({ key: 'mem-link-reference_cluster.md' })
  await state.until('memories', m => (m as MemoriesState).open === 'reference_cluster.md')
  await pane.redraw()
  expect((await pane.find({ key: 'mem-back' }))?.props.label).toBe('‹ NOVA Chat')
  expect((await svgAlts(pane)).slice(-1)[0]).toMatch(/ and 1 linked memory$/)
  await pane.press({ key: 'mem-ask' })
  await quiet(state.clock)
  expect(filled).toHaveLength(1)
  expect(filled[0]).toMatch(/^Edit the memory ".+": $/)
})

test('Memories in English: loading, an unreadable folder and an empty one', async ($, on) => {
  const state = liveState(on, { tab: 'memories' })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN })
  const pane = await mount($)
  expect(await pane.find({ type: 'Text', text: /^Loading…$/ })).toBeDefined()
  state.values.memories = { dir: M, list: null, error: 'EACCES', open: null, back: [], expanded: [] }
  await pane.redraw()
  expect((await pane.find({ type: 'Text', text: /^Cannot read 99 - Jarvis\/memory: EACCES$/ }))?.props.color).toBe('error')
  state.values.memories = { dir: M, list: [], error: null, open: null, back: [], expanded: [] }
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^No memories in 99 - Jarvis\/memory$/ })).toBeDefined()
  state.values.memories = { dir: null, list: null, error: 'EACCES', open: null, back: [], expanded: [] }
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^Cannot read the memories folder: EACCES$/ })).toBeDefined()
})

// The atom outlives a plugin reload: an older version may have left names the panel no longer knows.
const aged = (file: string, group: string, fresh: string | null) => ({ file, name: file.replace('.md', ''), description: 'd', group, links: [], fresh })

test('a memories atom from an older version: an item with an unknown group or none at all is dropped, an unknown freshness draws no pill, nothing reads undefined', async ($, on) => {
  const old = { dir: M, list: [aged('a.md', 'projects', null), null, aged('b.md', 'Persone', null), aged('c.md', 'projects', 'nuova')], error: null, open: null, back: [], expanded: ['Persone'] }
  const state = liveState(on, { tab: 'memories', memories: old })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN })
  const pane = await mount($)
  expect(await cardTitles(pane)).toEqual(['Projects'])
  expect(await memButtons(pane)).toEqual(['mem-a.md', 'mem-c.md'])
  expect(await pane.find({ text: /undefined/ })).toBe(undefined)
  expect(await pane.find({ text: /^ nuova $/ })).toBe(undefined)
  // Opened, the item with the unknown group is not there: the list is drawn, not an empty view.
  state.values.memories = { ...old, open: 'b.md' }
  await pane.redraw()
  expect(await pane.find({ key: 'mem-back' })).toBe(undefined)
  expect(await cardTitles(pane)).toEqual(['Projects'])
  // The one with the unknown freshness opens without a pill and without "undefined".
  state.values.memories = { ...old, open: 'c.md' }
  await pane.redraw()
  expect(await pane.find({ key: 'mem-back' })).toBeDefined()
  expect(await pane.find({ text: /undefined/ })).toBe(undefined)
  expect(await pane.find({ text: /^ nuova $/ })).toBe(undefined)
})

test('a tab id saved by an older version: "memorie" draws the Memories tab', async ($, on) => {
  liveState(on, { tab: 'memorie', memories: { dir: M, list: [aged('a.md', 'projects', null)], error: null, open: null, back: [], expanded: [] } })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD_EN })
  const pane = await mount($)
  expect(await cardTitles(pane)).toEqual(['Projects'])
  expect((await pane.find({ type: 'Text', text: /^Memories$/ }))?.props.underline).toBe(true)
})
