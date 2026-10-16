import { test, expect, type Engine } from 'claude-code/testing'
import { COMMAND, PANE, PLUGIN } from '../hooks/state'
import { strings } from '../hooks/i18n'
import { EMPTY_READING } from '../hooks/reader'
import { ROOT, fakeVault, liveState, paneProps, settled } from './harness'

// The language of the interface is deduced from the vault: the Identity source first, then the heading of the
// capability table. These tests run the whole plugin on small vaults and read what it draws.
const LITE = '## Capabilities\n\n| Capability | Authoritative source |\n|---|---|\n| Identity | `99 - Jarvis/memory/soul.md` |\n| Durable memory | `99 - Jarvis/memory/MEMORY.md` |\n| Future work | `To Do.md` |\n| Daily history | `01 - Diary` |\n'
const ITALIAN = "## Capacita' Jarvis\n\n| Capacita' | Fonte autorevole |\n|---|---|\n| Identita' | `99 - Jarvis/memory/soul.md` |\n| Memoria durevole | `99 - Jarvis/memory/MEMORY.md` |\n| Futuro operativo | `Da fare.md` |\n| Diario | `01 - Diary` |\n"
const SOUL = '99 - Jarvis/memory/soul.md'

const mount = ($: Engine) => $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps() })
type Pane = Awaited<ReturnType<typeof mount>>
const labels = async (pane: Pane) => ({
  files: (await pane.find({ key: 'tab-files' }))?.props.label,
  diary: (await pane.find({ key: 'tab-diary' }))?.props.label,
  reading: (await pane.find({ key: 'tab-reading' }))?.props.label,
  todo: (await pane.find({ key: 'tab-todo' }))?.props.label,
  memories: (await pane.find({ key: 'tab-memories' }))?.props.label,
})
const mascotAlt = async (pane: Pane) => (await pane.findAll({ type: 'Svg' }))[0]?.props.alt

test('language: a vault with the English table and no language line draws English tabs and mascot', async ($, on) => {
  liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': LITE, 'To Do.md': '# x\n' })
  const pane = await mount($)
  expect(await labels(pane)).toEqual({ files: 'Files', diary: 'Diary', reading: 'Reading', todo: 'To Do', memories: 'Memories' })
  expect(await mascotAlt(pane)).toBe('Jarvis waiting')
})

test('language: the Italian table gives Italian tabs and mascot', async ($, on) => {
  liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': ITALIAN, 'Da fare.md': '# x\n' })
  const pane = await mount($)
  expect(await labels(pane)).toEqual({ files: 'File', diary: 'Diario', reading: 'Lettura', todo: 'Da fare', memories: 'Memorie' })
  expect(await mascotAlt(pane)).toBe('Jarvis in attesa')
})

test('language: the Identity source wins over the table heading, both ways', async ($, on) => {
  liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': LITE, [SOUL]: "- L'italiano è la lingua di base.\n" })
  expect(await labels(await mount($))).toEqual({ files: 'File', diary: 'Diario', reading: 'Lettura', todo: 'To Do', memories: 'Memorie' })
})

test('language: an English identity line turns an Italian table into English', async ($, on) => {
  liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': ITALIAN, [SOUL]: '- My default language is **English**.\n' })
  expect(await labels(await mount($))).toEqual({ files: 'Files', diary: 'Diary', reading: 'Reading', todo: 'Da fare', memories: 'Memories' })
})

test('language: a missing or unreadable Identity file leaves the table heading in charge', async ($, on) => {
  liveState(on, {})
  // The table names an Identity file that is not there.
  fakeVault(on, { 'CLAUDE.md': ITALIAN })
  expect(await labels(await mount($))).toEqual({ files: 'File', diary: 'Diario', reading: 'Lettura', todo: 'Da fare', memories: 'Memorie' })
})

test('language: the /jarvis command is registered with the description of the vault language', async ($, on) => {
  liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': LITE })
  on('session.start', () => ({ cwd: ROOT }) as never)
  const described: Array<[string, string | undefined]> = []
  on('command.register', (_$, e) => { described.push([e.name, e.description]); return { value: { isRegistered: true } } as never })
  await $.session.start({ cwd: ROOT } as never)
  expect(described).toEqual([[COMMAND, strings('en').command.description]])
})

test('language: the /jarvis command description is Italian for an Italian vault', async ($, on) => {
  liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': ITALIAN })
  on('session.start', () => ({ cwd: ROOT }) as never)
  const described: Array<string | undefined> = []
  on('command.register', (_$, e) => { described.push(e.description); return { value: { isRegistered: true } } as never })
  await $.session.start({ cwd: ROOT } as never)
  expect(described).toEqual([strings('it').command.description])
})

test('language: the /jarvis command is still registered, in English, when the vault cannot be read', async ($, on) => {
  liveState(on, {})
  on('session.root', () => { throw new Error('no root') })
  on('session.start', () => ({ cwd: ROOT }) as never)
  const described: Array<string | undefined> = []
  on('command.register', (_$, e) => { described.push(e.description); return { value: { isRegistered: true } } as never })
  await $.session.start({ cwd: ROOT } as never)
  expect(described).toEqual([strings('en').command.description])
})

// A text that is not a string: the Reading draw throws, and the minimal fault card takes its words from the catalog.
const FAULTY = { ...EMPTY_READING, path: 'a.md', text: 42 as unknown as string }

test('language: a draw that throws in an English vault shows the fault card in English', async ($, on) => {
  liveState(on, { tab: 'reading', reading: FAULTY })
  fakeVault(on, { 'CLAUDE.md': LITE, 'a.md': '# x\n' })
  const pane = await mount($)
  expect(await pane.find({ text: /^The cockpit ran into a problem$/ })).toBeDefined()
  expect((await pane.find({ key: 'fault-reload' }))?.props.label).toBe('Reload')
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
})

test('language: a draw that throws with the vault unreadable shows the fault card in English', async ($, on) => {
  liveState(on, { tab: 'reading', reading: FAULTY })
  // CLAUDE.md is there but cannot be read, so the sources fail and `catalog` falls back to English.
  on('session.root', () => ({ value: ROOT }))
  on('fs.exists', () => ({ value: true }) as never)
  on('fs.read', () => { throw new Error('EACCES') })
  const pane = await mount($)
  expect(await pane.find({ text: /^The cockpit ran into a problem$/ })).toBeDefined()
  expect((await pane.find({ key: 'fault-reload' }))?.props.label).toBe('Reload')
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
})

test('language: writing the Identity source or CLAUDE.md makes the language be read again', async ($, on) => {
  const state = liveState(on, {})
  const files = fakeVault(on, { 'CLAUDE.md': ITALIAN, [SOUL]: '- Lingua: italiano.\n' })
  on('tool.call', () => ({ result: 'ok' }) as never)
  on('agent.list', () => ({ value: [] }))
  const pane = await mount($)
  expect((await labels(pane)).files).toBe('File')
  // The user changes the language in the Identity source: the next draw speaks English.
  files.set(`${ROOT}/${SOUL}`, '- My default language is English.\n')
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/${SOUL}`, old_string: 'a', new_string: 'b' })
  await settled(state.clock)
  await pane.redraw()
  expect((await labels(pane)).files).toBe('Files')
  // Back to the table heading: a write to CLAUDE.md drops the cache too.
  files.set(`${ROOT}/${SOUL}`, '')
  files.set(`${ROOT}/CLAUDE.md`, ITALIAN)
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/CLAUDE.md`, old_string: 'a', new_string: 'b' })
  await settled(state.clock)
  await pane.redraw()
  expect((await labels(pane)).files).toBe('File')
})
