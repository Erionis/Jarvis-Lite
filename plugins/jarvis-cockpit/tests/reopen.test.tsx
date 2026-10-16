import { test, expect, type Engine } from 'claude-code/testing'
import type { On } from 'claude-code'
import { COMMAND, PANE, PLUGIN } from '../hooks/state'
import { strings } from '../hooks/i18n'
import { robotSvg } from '../hooks/stage'
import { TERMINAL } from '../hooks/terminalFigure'
import { AT, fakeVault, liveState } from './harness'

const BAND = { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 9 }, view: {} }

// The engine band: in the kit nobody draws AbovePrompt, so the test answers as the app would.
function engineBand(on: On) {
  on('ui.render', { component: 'AbovePrompt' }, ($e, e) => { const { Text } = $e.ui.resolve(e); return <Text>fascia del motore</Text> })
}
function opens(on: On): string[] {
  const out: string[] = []
  on('ui.open', (_$, e) => { out.push(e.id); return { value: { isPlaced: true } } as never })
  return out
}
// The pane as the engine lists it ($.ui.panes).
// `now.list` is changed once the test is running (on() cannot be called after using $); `null` throws.
type PaneRow = { id: string; isPlaced: boolean }
function panes(on: On, list: PaneRow[] | null) {
  const now = { list }
  on('ui.panes', () => {
    if (now.list === null) throw new Error('boom')
    return { value: now.list.map(p => ({ ...p, title: 'Jarvis', isShown: true, isFocused: false })) } as never
  })
  return now
}
let req = 0
const mountBand = ($: Engine, surface: 'desktop' | 'terminal' = 'desktop', props: Record<string, unknown> = {}) =>
  $.ui.mount({ plugin: PLUGIN, surface, component: 'AbovePrompt', requestId: `band-${++req}`, props: { ...BAND, ...props } as never })

test('band: with the pane closed, the small mascot and ✦ Jarvis above the prompt', async ($, on) => {
  liveState(on, { paneOpen: false, mascot: { state: 'writing', since: AT, back: 'idle' } })
  fakeVault(on, {})
  engineBand(on)
  panes(on, [])
  const band = await mountBand($)
  expect(await band.find({ text: /fascia del motore/ })).toBe(undefined)
  const [svg] = await band.findAll({ type: 'Svg' })
  expect(svg?.props).toMatchObject({ alt: 'Jarvis al lavoro', source: robotSvg(TERMINAL, { state: 'writing', since: AT, back: 'idle' }, AT, strings('it')), height: 18, width: 14 })
  expect(svg?.props.isInteractive).toBe(undefined)
  expect((await band.find({ key: 'reopen' }))?.props.label).toBe('✦ Jarvis')
})

test('band: during a turn the last activity row sits beside ✦ Jarvis, without the time; outside a turn it reopens the cockpit', async ($, on) => {
  const feed = [{ at: AT, verb: 'edit', path: 'To Do.md', isProtected: false, isApprox: false, count: 1, turn: 1 }]
  liveState(on, { paneOpen: false, working: true, feed })
  fakeVault(on, {})
  engineBand(on)
  panes(on, [])
  expect(await (await mountBand($)).find({ type: 'Text', text: /^✎ scrive  To Do\.md$/ })).toBeDefined()
})

test('band: the activity row with a control character in the name still draws, the control character becomes U+FFFD', async ($, on) => {
  const feed = [{ at: AT, verb: 'edit', path: 'To\x1bDo.md', isProtected: false, isApprox: false, count: 1, turn: 1 }]
  liveState(on, { paneOpen: false, working: true, feed })
  fakeVault(on, {})
  engineBand(on)
  panes(on, [])
  expect(await (await mountBand($)).find({ type: 'Text', text: /^✎ scrive  To�Do\.md$/ })).toBeDefined()
})

test('band: outside a turn the label beside ✦ Jarvis says the cockpit will reopen', async ($, on) => {
  const feed = [{ at: AT, verb: 'edit', path: 'To Do.md', isProtected: false, isApprox: false, count: 1, turn: 1 }]
  liveState(on, { paneOpen: false, working: false, feed })
  fakeVault(on, {})
  engineBand(on)
  panes(on, [])
  expect(await (await mountBand($)).find({ type: 'Text', text: /^riapre il cockpit$/ })).toBeDefined()
})

test('band: ✦ Jarvis reopens the pane and the band goes back to the engine\'s', async ($, on) => {
  const state = liveState(on, { paneOpen: false })
  engineBand(on)
  const opened = opens(on)
  const now = panes(on, [])
  const band = await mountBand($)
  await band.press({ key: 'reopen' })
  await state.until('paneOpen', v => v === true)
  expect(opened).toEqual([PANE])
  now.list = [{ id: PANE, isPlaced: true }]
  await band.redraw()
  expect(await band.find({ text: /fascia del motore/ })).toBeDefined()
  expect(await band.find({ key: 'reopen' })).toBe(undefined)
})

test('band: ✦ Jarvis with the pane still in the engine closes it and reopens it', async ($, on) => {
  liveState(on, { paneOpen: false })
  engineBand(on)
  const calls: string[] = []
  let reopened = () => {}
  const done = new Promise<void>(r => { reopened = r })
  on('ui.close', (_$, e) => { calls.push(`close:${e.id}`); return { value: undefined } as never })
  on('ui.open', (_$, e) => { calls.push(`open:${e.id}`); reopened(); return { value: { isPlaced: true } } as never })
  panes(on, [{ id: PANE, isPlaced: true }])
  const band = await mountBand($)
  await band.press({ key: 'reopen' })
  await done
  expect(calls).toEqual([`close:${PANE}`, `open:${PANE}`])
})

test('band: with the pane open, a survey or another surface, the band stays the engine\'s', async ($, on) => {
  liveState(on, { paneOpen: true })
  engineBand(on)
  panes(on, [{ id: PANE, isPlaced: true }])
  const open = await mountBand($)
  expect(await open.find({ text: /fascia del motore/ })).toBeDefined()
  expect(await open.find({ key: 'reopen' })).toBe(undefined)
  const survey = await mountBand($, 'desktop', { hasSurvey: true })
  expect(await survey.find({ key: 'reopen' })).toBe(undefined)
  const term = await mountBand($, 'terminal')
  expect(await term.find({ text: /fascia del motore/ })).toBeDefined()
  expect(await term.find({ key: 'reopen' })).toBe(undefined)
})

test('band: with the pane open it reads only whether it is open and the turn state, then hands over to the engine', async ($, on) => {
  const state = liveState(on, { paneOpen: true })
  engineBand(on)
  panes(on, [{ id: PANE, isPlaced: true }])
  const band = await mountBand($)
  expect(await band.find({ text: /fascia del motore/ })).toBeDefined()
  // The turn state changes twice per turn: enough to notice a pane removed by the app.
  expect(state.gets).toEqual({ paneOpen: 1, working: 1 })
})

test('band: paneOpen true but the engine no longer has the pane (closed on unload): ✦ Jarvis comes back', async ($, on) => {
  liveState(on, { paneOpen: true })
  engineBand(on)
  const now = panes(on, [])
  const gone = await mountBand($)
  expect((await gone.find({ key: 'reopen' }))?.props.label).toBe('✦ Jarvis')
  now.list = [{ id: PANE, isPlaced: false }]
  const waiting = await mountBand($)
  expect((await waiting.find({ key: 'reopen' }))?.props.label).toBe('✦ Jarvis')
  now.list = null
  const broken = await mountBand($)
  expect((await broken.find({ key: 'reopen' }))?.props.label).toBe('✦ Jarvis')
})

test('band: flag false (closed with the X, ui.close) even if the engine still lists the pane: ✦ Jarvis comes back', async ($, on) => {
  liveState(on, { paneOpen: false })
  engineBand(on)
  panes(on, [{ id: PANE, isPlaced: true }])
  const band = await mountBand($)
  expect((await band.find({ key: 'reopen' }))?.props.label).toBe('✦ Jarvis')
})

test('band: a pane that is not placed does not count as open', async ($, on) => {
  const state = liveState(on, { paneOpen: false })
  engineBand(on)
  panes(on, [])
  on('ui.open', () => ({ value: { isPlaced: false, reason: 'no room' } }) as never)
  const band = await mountBand($)
  await band.press({ key: 'reopen' })
  expect(state.values.paneOpen).toBe(false)
  expect(await band.find({ key: 'reopen' })).toBeDefined()
})

test('hook: /jarvis and the first prompt mark the pane open', async ($, on) => {
  const state = liveState(on, { paneOpen: false })
  on('session.root', () => ({ value: '/v' }))
  on('fs.exists', () => ({ value: false }))
  opens(on)
  on('prompt.submit', (_$, e) => ({ text: e.text }) as never)
  await $.command.run({ command: COMMAND } as never)
  expect(state.values.paneOpen).toBe(true)
  state.values.paneOpen = false
  await $.prompt.submit({ text: 'ciao' } as never)
  await state.until('paneOpen', v => v === true)
})

// The band in English: a vault with the English capability table. The label and the activity row come from the catalog.
const CAPABILITIES_EN = '## Capabilities\n\n| Capability | Authoritative source |\n|---|---|\n| Future work | `To Do.md` |\n'

test('band in English: out of a turn it says what the button does, during a turn the last activity row', async ($, on) => {
  const t = strings('en')
  const feed = [{ at: AT, verb: 'edit', path: 'To Do.md', isProtected: false, isApprox: false, count: 1, turn: 1 }]
  const state = liveState(on, { paneOpen: false, working: false, feed })
  fakeVault(on, { 'CLAUDE.md': CAPABILITIES_EN })
  engineBand(on)
  panes(on, [])
  const band = await mountBand($)
  expect(t.header.reopen).toBe('reopens the cockpit')
  expect(await band.find({ type: 'Text', text: /^reopens the cockpit$/ })).toBeDefined()
  expect(await band.find({ type: 'Text', text: /^riapre il cockpit$/ })).toBe(undefined)
  state.values.working = true
  await band.redraw()
  expect(await band.find({ type: 'Text', text: /^✎ edit {4}To Do\.md$/ })).toBeDefined()
})
