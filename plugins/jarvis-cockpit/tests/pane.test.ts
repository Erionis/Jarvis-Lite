import { test, expect, mock } from 'claude-code/testing'
import type { On } from 'claude-code'
import { COMMAND, PANE, PLUGIN } from '../hooks/state'
import type { Activity, Snapshot, Tab, Touched } from '../types'
import { fakeVault, liveState, paneProps, quiet, settled } from './harness'
import { strings } from '../hooks/i18n'
import { IDLE } from '../hooks/mascot'
import { migrateTab } from '../hooks/pane'
import { STAGE_W, robotSvg, stageSvg } from '../hooks/stage'
import { TERMINAL } from '../hooks/terminalFigure'

const AT = new Date(2026, 9, 9, 14, 32).getTime()
const SNAP: Snapshot = {
  takenAt: AT, hasTable: true, missing: [], now: ['NOVA 4.0 PRD', 'Helios offerta'], nowDue: [null, null], waiting: 2,
  waitingItems: [{ title: 'Docs review of the guide', ageDays: 21 }, { title: 'Registry v2', ageDays: 3 }],
  handoffs: [{ file: 'h1.md', topic: 'NOVA Chat discovery', ageDays: 8 }],
  inbox: { count: 4, oldestDays: 17 }, diary: { hasToday: false, last: '2026-10-07' },
}
const FEED: Activity[] = [
  { at: AT - 60_000, verb: 'read', path: '99 - Jarvis/memory/MEMORY.md', role: 'memoria', isProtected: true, isApprox: false, count: 1, turn: 2 },
  { at: AT, verb: 'edit', path: 'To Do.md', role: 'futuro op.', isProtected: true, isApprox: false, count: 1, turn: 2 },
  { at: AT, verb: 'read', path: 'x.md', isProtected: false, isApprox: true, count: 1, turn: 2, agent: 'Explore' },
]

const props = (bodyColumns: number) => ({ title: 'Jarvis', isFocused: false, bodyColumns, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} })

type Seed = { turn?: number; snapshot?: Snapshot | null; feed?: Activity[]; agentRuns?: Record<string, unknown>; tab?: Tab; written?: Record<string, number>; working?: boolean; turnAt?: number }

// The `$` test has no state: ui.render reads the atoms with state.get, so we simulate it here
// (the plugin's own hook really runs, there is no parallel drawing).
function seed(on: On, v: Seed) {
  mock.clock(on, { now: AT })
  const values: Record<string, unknown> = { turn: v.turn ?? 0, snapshot: v.snapshot ?? undefined, feed: v.feed ?? [], touched: [], agentRuns: v.agentRuns ?? {}, tab: v.tab, written: v.written ?? {}, working: v.working, turnAt: v.turnAt }
  on('state.get', { plugin: PLUGIN }, (_$, e) => ({ value: { value: values[e.key], version: 1 } }) as never)
}

test('pane: outside the desktop it is a single line', async ($, on) => {
  seed(on, { turn: 2, snapshot: SNAP, feed: FEED })
  fakeVault(on, {})
  for (const surface of ['terminal', 'mobile', 'vscode'] as const) {
    const pane = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PANE, props: props(46) })
    expect(await pane.find({ text: /Il cockpit è disegnato per l'app desktop/ })).toBeDefined()
    expect(await pane.find({ key: 'tab-recap' })).toBe(undefined)
    expect(await pane.find({ text: /NOVA 4\.0 PRD/ })).toBe(undefined)
  }
})

test('tabs: capitalized names with no numbers; the active tab is an underlined Text', async ($, on) => {
  const snapshot: Snapshot = { ...SNAP, now: ['a', 'b', 'c'], nowDue: ['2026-10-05', '2026-10-09', '2026-10-20'] }
  seed(on, { snapshot, written: { 'a.md': AT, 'b.md': AT } })
  fakeVault(on, {})
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: props(46) })
  // Recap is active: accent-color Text, bold, underlined, with no count of urgent items.
  expect((await pane.find({ type: 'Text', text: /^Recap$/ }))?.props).toMatchObject({ color: '#13918b', bold: true, underline: true })
  expect(await pane.find({ key: 'tab-recap' })).toBe(undefined)
  // The others are flat gray Buttons, with no count of written files.
  expect((await pane.find({ key: 'tab-files' }))?.props).toMatchObject({ label: 'File', plain: true, dimColor: true })
  expect((await pane.find({ key: 'tab-reading' }))?.props).toMatchObject({ label: 'Lettura', plain: true, dimColor: true })
})

test('tabs: the active tab follows the tab atom, and an active Lettura is still a Text', async ($, on) => {
  seed(on, { snapshot: SNAP, tab: 'reading' })
  fakeVault(on, {})
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: props(46) })
  expect((await pane.find({ type: 'Text', text: /^Lettura$/ }))?.props).toMatchObject({ color: '#13918b', bold: true, underline: true })
  expect(await pane.find({ key: 'tab-reading' })).toBe(undefined)
  expect((await pane.find({ key: 'tab-recap' }))?.props.label).toBe('Recap')
  expect((await pane.find({ key: 'tab-files' }))?.props.label).toBe('File')
})

test('header: the robot stage spans the row, JARVIS sits on the right, the status is beside the tabs; no turn count', async ($, on) => {
  seed(on, { turn: 14, snapshot: SNAP })
  fakeVault(on, {})
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: props(46) })
  const [stage, name] = await pane.findAll({ type: 'Svg' })
  // Still: one image (a frame would blink at every redraw).
  expect(stage?.props).toMatchObject({ alt: 'Jarvis in attesa', height: 96, source: stageSvg(TERMINAL, IDLE, AT, strings('it')) })
  expect(stage?.props.isInteractive).toBe(undefined)
  expect(stage?.props.width).toBe(STAGE_W)
  expect(name?.props).toMatchObject({ alt: 'JARVIS', width: 101, height: 28 })
  expect(name?.props.isInteractive).toBe(undefined)
  expect(await pane.find({ type: 'Text', text: /^in attesa$/ })).toBeDefined()
  expect(await pane.find({ text: /turni/ })).toBe(undefined)
  expect(await pane.find({ text: /◷|⏱/ })).toBe(undefined)
})

test('header: below 44 columns the robot stands still (no stage) and the JARVIS lettering stays', async ($, on) => {
  seed(on, { snapshot: SNAP })
  fakeVault(on, {})
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: props(43) })
  const [robot, name] = await pane.findAll({ type: 'Svg' })
  expect(robot?.props).toMatchObject({ alt: 'Jarvis in attesa', source: robotSvg(TERMINAL, IDLE, AT, strings('it')), width: 71, height: 88 })
  expect(robot?.props.isInteractive).toBe(undefined)
  expect(robot?.props.source).not.toContain('walk')
  expect(name?.props).toMatchObject({ alt: 'JARVIS', width: 101, height: 28 })
})

test('header: during a turn the status reads «al lavoro» with the start time', async ($, on) => {
  seed(on, { snapshot: SNAP, working: true, turnAt: AT - 60_000 })
  fakeVault(on, {})
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: props(46) })
  expect(await pane.find({ type: 'Text', text: /^al lavoro · da 14:31$/ })).toBeDefined()
})

test('reading tab: when empty, the header stays and the Recap does not', async ($, on) => {
  seed(on, { snapshot: SNAP, tab: 'reading' })
  fakeVault(on, {})
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: props(46) })
  expect(await pane.find({ text: /Scegli un file/ })).toBeDefined()
  expect((await pane.findAll({ type: 'Svg' })).map(s => s.props.alt)).toContain('JARVIS')
  expect(await pane.find({ text: /NOVA 4\.0 PRD/ })).toBe(undefined)
})

test('buttons: with a draft in the prompt they leave it alone and warn', async ($, on) => {
  seed(on, { turn: 2, snapshot: SNAP, feed: FEED })
  fakeVault(on, {})
  const filled: string[] = []
  const toasts: string[] = []
  on('prompt.read', () => ({ value: { text: 'bozza a metà', cursor: 4 } }) as never)
  on('prompt.fill', (_$, e) => { filled.push(e.text); return { isFilled: true } })
  let didToast: () => void = () => {}
  const toasted = new Promise<void>(r => { didToast = r })
  on('ui.toast', (_$, e) => { toasts.push(e.text); didToast(); return { value: undefined } as never })
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: props(46) })
  await pane.press({ key: 'briefing' })
  await toasted
  expect(filled).toEqual([])
  expect(toasts).toEqual(['Prompt non vuoto: svuotalo e riprova'])
})

test('hook: /jarvis opens the pane and recomputes the snapshot', async ($, on) => {
  mock.clock(on, { now: AT })
  on('session.root', () => ({ value: '/v' }))
  on('fs.exists', () => ({ value: false }))
  const opened: string[] = []
  on('ui.open', (_$, e) => { opened.push(e.id); return { value: { isPlaced: true } } as never })
  const snaps = onSet(on, 'snapshot')
  await $.command.run({ command: COMMAND } as never)
  expect(opened).toEqual([PANE])
  expect(snaps.count()).toBe(1)
})

// refresh() is fire-and-forget: the positive tests wait for the state.set event, not for a time.
function onSet(on: On, key: 'snapshot'): { count: () => number; next: () => Promise<void> } {
  let n = 0
  const waiting: (() => void)[] = []
  on('state.set', { plugin: PLUGIN, key }, (_$, e, next) => {
    n++
    waiting.splice(0).forEach(r => r())
    return next(e)
  })
  return { count: () => n, next: () => new Promise<void>(r => { waiting.push(r) }) }
}

const CLAUDE_MD = "## Capacita' Jarvis\n\n| Capacita' | Fonte autorevole |\n|---|---|\n| Futuro operativo | `Da fare.md` |\n"

test('hook: a write to a declared source refreshes the snapshot, a read does not', async ($, on) => {
  const clock = mock.clock(on, { now: AT })
  on('session.root', () => ({ value: '/v' }))
  on('session.cwd', () => ({ value: '/v' }))
  on('fs.exists', () => ({ value: true }))
  on('fs.read', () => ({ value: CLAUDE_MD }) as never)
  on('fs.list', () => ({ value: [] }))
  on('fs.stat', () => ({ value: { size: 10 } }) as never)
  on('agent.list', () => ({ value: [] }))
  on('ui.status', () => ({ value: undefined }) as never)
  on('tool.call', () => ({ result: 'ok' }) as never)
  const snaps = onSet(on, 'snapshot')
  await $.tool.call({ tool: 'Read', file_path: '/v/Da fare.md' })
  await $.tool.call({ tool: 'Edit', file_path: '/v/altro.md', old_string: 'a', new_string: 'b' })
  await settled(clock)
  await quiet(clock)
  expect(snaps.count()).toBe(0)
  const refreshed = snaps.next()
  await $.tool.call({ tool: 'Edit', file_path: '/v/Da fare.md', old_string: 'a', new_string: 'b' })
  await settled(clock)
  await refreshed
  expect(snaps.count()).toBe(1)
})

const CLAUDE_MD_INBOX = CLAUDE_MD + '| Inbox | `00 - Inbox` |\n'

function toolEnv(on: On, md: string, reads?: string[]) {
  const clock = mock.clock(on, { now: AT })
  on('session.root', () => ({ value: '/v' }))
  on('session.cwd', () => ({ value: '/v' }))
  on('fs.exists', () => ({ value: true }))
  on('fs.read', (_$, e) => { reads?.push(e.path); return { value: md } as never })
  on('fs.list', () => ({ value: [] }))
  on('fs.stat', () => ({ value: { size: 10 } }) as never)
  on('agent.list', () => ({ value: [] }))
  on('ui.status', () => ({ value: undefined }) as never)
  return clock
}

test('hook: moving a file out of a declared source refreshes the snapshot', async ($, on) => {
  const clock = toolEnv(on, CLAUDE_MD_INBOX)
  on('tool.call', () => ({ result: 'ok' }) as never)
  const snaps = onSet(on, 'snapshot')
  const refreshed = snaps.next()
  await $.tool.call({ tool: 'Bash', command: 'mv "00 - Inbox/a.md" Archivio/a.md' })
  await settled(clock)
  await refreshed
  expect(snaps.count()).toBe(1)
})

test('hook: a Bash error keeps the activities, for other tools it drops them; deny always drops them', async ($, on) => {
  toolEnv(on, CLAUDE_MD)
  let outcome: Record<string, unknown> = { result: 'ok', isError: true }
  on('tool.call', () => outcome as never)
  let sets = 0
  on('state.set', { plugin: PLUGIN, key: 'feed' }, (_$, e, next) => { sets++; return next(e) })
  await $.tool.call({ tool: 'Bash', command: 'cat nota.md' })
  expect(sets).toBe(1)
  await $.tool.call({ tool: 'Read', file_path: '/v/nota.md' })
  expect(sets).toBe(1)
  outcome = { deny: 'no' }
  await $.tool.call({ tool: 'Bash', command: 'cat nota.md' })
  expect(sets).toBe(1)
})

test('hook: editing CLAUDE.md invalidates the sources cache', async ($, on) => {
  const reads: string[] = []
  const clock = toolEnv(on, CLAUDE_MD, reads)
  on('tool.call', () => ({ result: 'ok' }) as never)
  const snaps = onSet(on, 'snapshot')
  const first = snaps.next()
  await $.tool.call({ tool: 'Edit', file_path: '/v/Da fare.md', old_string: 'a', new_string: 'b' })
  await settled(clock)
  await first
  const before = reads.filter(p => p === '/v/CLAUDE.md').length
  await $.tool.call({ tool: 'Edit', file_path: '/v/CLAUDE.md', old_string: 'a', new_string: 'b' })
  await settled(clock)
  // The recomputed snapshot is the same and is not written again: there is no event to wait for, so we let the CLAUDE.md re-read run.
  await quiet(clock)
  expect(reads.filter(p => p === '/v/CLAUDE.md').length).toBe(before + 1)
  expect(snaps.count()).toBe(1)
})

test('hook: writes to declared sources land among the touched sources, reads do not', async ($, on) => {
  toolEnv(on, CLAUDE_MD)
  on('tool.call', () => ({ result: 'ok' }) as never)
  let touched: Touched[] = []
  on('state.set', { plugin: PLUGIN, key: 'touched' }, (_$, e, next) => { touched = e.value; return next(e) })
  await $.tool.call({ tool: 'Read', file_path: '/v/Da fare.md' })
  expect(touched).toEqual([])
  await $.tool.call({ tool: 'Edit', file_path: '/v/Da fare.md', old_string: 'a', new_string: 'b' })
  await $.tool.call({ tool: 'Edit', file_path: '/v/altro.md', old_string: 'a', new_string: 'b' })
  expect(touched).toEqual([{ role: 'futuro op.', count: 1, isProtected: true }])
})

test('hook: session.start registers /jarvis and does not open the pane by itself', async ($, on) => {
  const clock = mock.clock(on, { now: AT })
  on('session.root', () => ({ value: '/v' }))
  on('fs.exists', () => ({ value: false }))
  on('session.start', () => ({ cwd: '/v' }) as never)
  const registered: string[] = []
  on('command.register', (_$, e) => { registered.push(e.name); return { value: { isRegistered: true } } as never })
  const opened: string[] = []
  on('ui.open', (_$, e) => { opened.push(e.id); return { value: { isPlaced: true } } as never })
  await $.session.start({ cwd: '/v' } as never)
  await quiet(clock)
  expect(registered).toEqual([COMMAND])
  expect(opened).toEqual([])
})

test('hook: pressing a tab activates it and remembers it', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP })
  const stored: unknown[] = []
  on('store.set', (_$, e) => { stored.push([e.key, e.value]); return { value: undefined } })
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps() })
  await pane.press({ key: 'tab-files' })
  await state.until('tab', v => v === 'files')
  expect(stored).toContainEqual(['tab', 'files'])
})

test('hook: the first prompt opens the pane, later ones do not', async ($, on) => {
  const state = liveState(on, {})
  const opens: string[] = []
  on('ui.open', (_$, e) => { opens.push(e.id); return { value: { isPlaced: true } } as never })
  on('prompt.submit', (_$, e) => ({ text: e.text }) as never)
  await $.prompt.submit({ text: 'ciao Jarvis' } as never)
  await $.prompt.submit({ text: 'altro' } as never)
  expect(opens).toEqual([PANE])
  expect(state.values.opened).toBe(true)
})

test('hook: a tab saved under the old id "stato" reopens on the Recap', async ($, on) => {
  const state = liveState(on, { snapshot: SNAP, tab: 'files' })
  on('store.get', (_$, e) => ({ value: e.key === 'tab' ? 'stato' : undefined }) as never)
  on('session.root', () => ({ value: '/v' }))
  on('fs.exists', () => ({ value: false }))
  on('session.start', () => ({ cwd: '/v' }) as never)
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  await $.session.start({ cwd: '/v' } as never)
  await state.until('tab', v => v === 'recap')
  expect(state.values.tab).toBe('recap')
})

test('pane: a tab saved with an old Italian id comes back under its English id', () => {
  expect(migrateTab('diario')).toBe('diary')
  expect(migrateTab('memorie')).toBe('memories')
  expect(migrateTab('lettura')).toBe('reading')
  expect(migrateTab('file')).toBe('files')
  expect(migrateTab('stato')).toBe('recap')
  expect(migrateTab('todo')).toBe('todo')
  expect(migrateTab('nope')).toBe(null)
  expect(migrateTab(3)).toBe(null)
})

// The header in English: a vault with the English capability table. The status comes from the catalog.
const CAPABILITIES_EN = '## Capabilities\n\n| Capability | Authoritative source |\n|---|---|\n| Future work | `To Do.md` |\n'

test('header in English: waiting, under the lettering', async ($, on) => {
  const t = strings('en')
  seed(on, { snapshot: SNAP })
  fakeVault(on, { 'CLAUDE.md': CAPABILITIES_EN })
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: props(46) })
  expect(t.header.waiting).toBe('waiting')
  expect(await pane.find({ type: 'Text', text: new RegExp(`^${t.header.waiting}$`) })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^in attesa$/ })).toBe(undefined)
})

test('header in English: during a turn, at work with the start time', async ($, on) => {
  const t = strings('en')
  seed(on, { snapshot: SNAP, working: true, turnAt: AT - 60_000 })
  fakeVault(on, { 'CLAUDE.md': CAPABILITIES_EN })
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: props(46) })
  expect(t.header.workingSince('14:31')).toBe('at work · since 14:31')
  expect(await pane.find({ type: 'Text', text: /^at work · since 14:31$/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /^al lavoro/ })).toBe(undefined)
})

// A tab id saved by an older version (an atom that outlives a plugin reload) draws the tab it names; an unknown id the Recap.
for (const [saved, shown] of [['lettura', 'Lettura'], ['file', 'File'], ['stato', 'Recap'], ['nowhere', 'Recap']] as const) {
  test(`pane: the saved tab id "${saved}" draws ${shown}`, async ($, on) => {
    seed(on, { snapshot: SNAP, tab: saved as unknown as Tab })
    fakeVault(on, {})
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: props(46) })
    expect((await pane.find({ type: 'Text', text: new RegExp(`^${shown}$`) }))?.props.underline).toBe(true)
  })
}

test('pane in English: outside the desktop the one line is English', async ($, on) => {
  seed(on, { snapshot: SNAP })
  fakeVault(on, { 'CLAUDE.md': CAPABILITIES_EN })
  for (const surface of ['terminal', 'mobile', 'vscode'] as const) {
    const pane = await $.ui.mount({ plugin: PLUGIN, surface, component: 'Pane', requestId: PANE, props: props(46) })
    expect(await pane.find({ text: /^The cockpit is designed for the desktop app$/ })).toBeDefined()
    expect(await pane.find({ text: /Il cockpit/ })).toBe(undefined)
  }
})

test('pane: when the vault language cannot be known, the one line is English', async ($, on) => {
  seed(on, { snapshot: SNAP })
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'terminal', component: 'Pane', requestId: PANE, props: props(46) })
  expect(await pane.find({ text: /^The cockpit is designed for the desktop app$/ })).toBeDefined()
})

test('hook in English: /jarvis answers in English', async ($, on) => {
  mock.clock(on, { now: AT })
  fakeVault(on, { 'CLAUDE.md': CAPABILITIES_EN })
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  expect((await $.command.run({ command: COMMAND } as never)).text).toBe('Cockpit opened.')
})

test('buttons in English: with a draft in the prompt they do not touch it and say so in English', async ($, on) => {
  seed(on, { turn: 2, snapshot: SNAP, feed: FEED })
  fakeVault(on, { 'CLAUDE.md': CAPABILITIES_EN })
  const toasts: string[] = []
  on('prompt.read', () => ({ value: { text: 'half a draft', cursor: 4 } }) as never)
  on('prompt.fill', () => ({ isFilled: true }))
  let didToast: () => void = () => {}
  const toasted = new Promise<void>(r => { didToast = r })
  on('ui.toast', (_$, e) => { toasts.push(e.text); didToast(); return { value: undefined } as never })
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: props(46) })
  await pane.press({ key: 'briefing' })
  await toasted
  expect(toasts).toEqual(['The prompt is not empty: clear it and try again'])
})
