import { test, expect, type Engine } from 'claude-code/testing'
import { COMMAND, PANE, PLUGIN } from '../hooks/state'
import { SLEEP_MS, TRANSIENT_MS, type Mascot } from '../hooks/mascot'
import { NO_TALK, greet, talkMs, type Talk } from '../hooks/bubble'
import { strings } from '../hooks/i18n'
import { stageSvg } from '../hooks/stage'
import { TERMINAL } from '../hooks/terminalFigure'
import type { Motion } from '../types'
import { AT, ROOT, fakeGit, fakeVault, liveState, paneProps } from './harness'

const CLAUDE_MD = "## Capacita' Jarvis\n\n| Capacita' | Fonte autorevole |\n|---|---|\n| Futuro operativo | `Da fare.md` |\n"
const mount = ($: Engine, columns?: number) =>
  $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps(columns) })
const stateOf = (s: { values: Record<string, unknown> }) => (s.values.mascot as Mascot).state

// The test answers turns like the engine: turn.start and turn.complete have no other implementation.
function turns(on: Parameters<typeof liveState>[0]) {
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  on('tool.call', () => ({ result: 'ok' }) as never)
}
// Lets the chain of steps in progress finish.
async function settleSteps(state: ReturnType<typeof liveState>): Promise<void> {
  for (let i = 0; i < 40 && (state.values.motion as Motion | undefined)?.isRunning === true; i++) {
    await state.clock.advance(160)
    await state.clock.settle()
  }
}
const complete = ($: Engine, agentId?: string) =>
  $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer', ...(agentId === undefined ? {} : { agentId }) } as never)

test('mascot: turn, read, write, then the end with a hop and back to idle after 3 s; reading, writing and thinking do not rewrite it', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': '# x\n' })
  turns(on)
  const pane = await mount($)
  await $.turn.start({ text: 'ciao', turnId: 't1' })
  expect(state.values.working).toBe(true)
  expect(stateOf(state)).toBe('thinking')
  expect(state.values.turnAt).toBe(AT)
  await pane.redraw()
  const [stage] = await pane.findAll({ type: 'Svg' })
  expect(stage?.props).toMatchObject({ alt: 'Jarvis al lavoro', source: stageSvg(TERMINAL, state.values.mascot as Mascot, AT, strings('it')) })
  expect(await pane.find({ type: 'Text', text: /^al lavoro · da \d\d:\d\d$/ })).toBeDefined()
  // Reading, writing and thinking are the same scene drawn: the mascot is not rewritten.
  const writes = state.sets.mascot
  await $.tool.call({ tool: 'Read', file_path: `${ROOT}/Da fare.md` })
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/Da fare.md`, old_string: 'x', new_string: 'y' })
  await $.tool.call({ tool: 'WebSearch', query: 'NOVA' } as never)
  expect(stateOf(state)).toBe('thinking')
  expect(state.sets.mascot).toBe(writes)
  await complete($)
  expect(state.values.working).toBe(false)
  expect(state.values.mascot).toEqual({ state: 'done', since: AT, back: 'idle', from: 100 })
  await state.clock.advance(TRANSIENT_MS - 1)
  expect(stateOf(state)).toBe('done')
  await state.clock.advance(1)
  expect(stateOf(state)).toBe('idle')
  await pane.redraw()
  expect(await pane.find({ type: 'Text', text: /^in attesa$/ })).toBeDefined()
  // A quarter of an hour later it sleeps.
  await state.clock.advance(SLEEP_MS)
  expect(stateOf(state)).toBe('sleep')
})

test('mascot: always an image; after a scene change the pane redraws in steps while it walks, then stops', async ($, on) => {
  const state = liveState(on, { paneOpen: true })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': '# x\n' })
  turns(on)
  const pane = await mount($)
  const robot = async () => (await pane.findAll({ type: 'Svg' }))[0]
  const motion = () => state.values.motion as Motion
  await $.turn.start({ text: 'ciao', turnId: 't1' })
  await state.until('motion', v => (v as Motion | undefined)?.isRunning === true)
  await pane.redraw()
  const first = String((await robot())?.props.source)
  expect((await robot())?.props.isInteractive).toBe(undefined)
  expect(first).toContain('.mv{transform:translateX(0px)}')
  // One step every 160 ms for the walk (1.2 s), then the chain stops on its own (8 steps).
  let middle = ''
  let steps = 0
  while (motion().isRunning && steps < 40) {
    const next = motion().at + 160
    await state.clock.advance(160)
    await state.until('motion', v => (v as Motion).at >= next)
    steps += 1
    if (steps === 4) { await pane.redraw(); middle = String((await robot())?.props.source) }
  }
  expect(steps).toBe(8)
  expect(middle).not.toBe(first)
  expect((await robot())?.props.isInteractive).toBe(undefined)
  await pane.redraw()
  const still = await robot()
  expect(String(still?.props.source)).toContain('.mv{transform:translateX(129.17px)}')
  // The activities of the same turn do not set it moving again.
  const writes = state.sets.motion
  await $.tool.call({ tool: 'Read', file_path: `${ROOT}/Da fare.md` })
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/Da fare.md`, old_string: 'x', new_string: 'y' })
  await state.clock.advance(1000)
  await pane.redraw()
  expect(state.sets.motion).toBe(writes)
  expect((await robot())?.props.source).toBe(still?.props.source)
})

test('mascot: no steps with the pane closed; in a narrow pane the walk takes no steps', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': '# x\n' })
  turns(on)
  await $.turn.start({ text: 'ciao', turnId: 't1' })
  await state.clock.advance(2000)
  expect(stateOf(state)).toBe('thinking')
  expect(state.sets.motion).toBe(undefined)
  // Open but narrow: the robot does not walk (it stays still beside the lettering), only the hop takes steps.
  state.values.paneOpen = true
  await mount($, 30)
  await complete($)
  await settleSteps(state)
  const hop = state.sets.motion
  expect(hop).toBeGreaterThan(0)
  // The way back home and the next turn: two walks, no steps.
  await state.clock.advance(TRANSIENT_MS)
  expect(stateOf(state)).toBe('idle')
  await $.turn.start({ text: 'ancora', turnId: 't2' })
  await state.clock.advance(2000)
  expect(stateOf(state)).toBe('thinking')
  expect(state.sets.motion).toBe(hop)
})

test('mascot: the chain of steps stops if the pane closes while it walks, and reopening the pane resumes it', async ($, on) => {
  const state = liveState(on, { paneOpen: true, opened: true })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': '# x\n' })
  turns(on)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  const pane = await mount($)
  await $.turn.start({ text: 'ciao', turnId: 't1' })
  await state.until('motion', v => (v as Motion | undefined)?.isRunning === true)
  await state.clock.advance(160)
  await state.clock.settle()
  expect((state.values.motion as Motion).isRunning).toBe(true)
  // The pane closes: the step that fires notices, writes the last state at rest and the chain ends.
  state.values.paneOpen = false
  await state.clock.advance(160)
  await state.clock.settle()
  expect((state.values.motion as Motion).isRunning).toBe(false)
  const stopped = state.sets.motion
  // Three more clock steps inside the walk (1.2 s): with the pane closed it writes none.
  await state.clock.advance(480)
  await state.clock.settle()
  expect(state.sets.motion).toBe(stopped)
  // Reopening the pane resumes the walk that is left (resumeMotion): in steps again, then it stops.
  await pane.unmount()
  await $.command.run({ command: COMMAND } as never)
  expect((state.values.motion as Motion).isRunning).toBe(true)
  await settleSteps(state)
  expect((state.values.motion as Motion).isRunning).toBe(false)
  expect(state.sets.motion).toBeGreaterThan(stopped ?? 0)
})

test('mascot: opening the pane with the command during the walk of a turn started while it was closed resumes the walk in steps', async ($, on) => {
  const state = liveState(on, { opened: true })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': '# x\n' })
  turns(on)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  await $.turn.start({ text: 'ciao', turnId: 't1' })
  expect(state.sets.motion).toBe(undefined)
  await state.clock.advance(600)
  await $.command.run({ command: COMMAND } as never)
  expect(state.values.paneOpen).toBe(true)
  expect((state.values.motion as Motion).isRunning).toBe(true)
  // The walk resumes from where it is: it ends when it would have ended (1.2 s from the turn).
  expect((state.values.motion as Motion).until).toBe(AT + 1200)
})

test('mascot: when the pane widens enough for the walk mid-turn, the walk restarts in steps', async ($, on) => {
  const state = liveState(on, { paneOpen: true })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': '# x\n' })
  turns(on)
  const narrow = await mount($, 30)
  await $.turn.start({ text: 'ciao', turnId: 't1' })
  await state.clock.advance(600)
  expect(state.sets.motion).toBe(undefined)
  await narrow.unmount()
  await mount($, 46)
  await state.clock.advance(0)
  await state.clock.settle()
  expect(state.sets.motion).toBeGreaterThan(0)
  expect((state.values.motion as Motion).isRunning).toBe(true)
})

test('mascot: walking and typing never overlap, even if the pane widens: the phrase starts when the robot arrives', async ($, on) => {
  const state = liveState(on, { opened: true, paneOpen: true, talk: greet(NO_TALK, 'Alex', strings('it')) })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': '# x\n' })
  turns(on)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  // Narrow, the robot does not walk: the greeting said again is typed at once and the turn takes no steps.
  const narrow = await mount($, 30)
  await $.command.run({ command: COMMAND } as never)
  await $.turn.start({ text: 'ciao', turnId: 't1' })
  expect((state.values.talk as Talk).bubble).toMatchObject({ kind: 'hello', at: AT })
  // The pane widens while the phrase is being typed: now the robot walks, and the phrase waits for it to arrive.
  await narrow.unmount()
  await mount($, 46)
  await state.clock.advance(0)
  await state.clock.settle()
  const walked = AT + 1200
  expect((state.values.talk as Talk).bubble).toMatchObject({ kind: 'hello', at: walked, until: walked + 6000 })
  expect((state.values.motion as Motion).until).toBe(walked + talkMs('Hello, Alex!'))
})

test('mascot: a bubble with a button starts no animation steps', async ($, on) => {
  const state = liveState(on, { paneOpen: true })
  fakeVault(on, { 'CLAUDE.md': '<!-- jarvis:onboarding-required -->\n# Jarvis\n\n- Nome: Alex Rivera\n' })
  fakeGit(on, {})
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('session.start', () => ({ cwd: ROOT }) as never)
  const said = state.until('talk', v => (v as Talk | undefined)?.bubble?.kind === 'setup')
  await $.session.start({ cwd: ROOT } as never)
  await said
  await state.clock.settle()
  expect((state.values.talk as Talk).bubble?.at).toBe(undefined)
  expect(state.sets.motion).toBe(undefined)
})

test('mascot: walking and typing never overlap: the greeting said again waits for the robot to arrive', async ($, on) => {
  const state = liveState(on, { opened: true, talk: greet(NO_TALK, 'Alex', strings('it')) })
  fakeVault(on, { 'CLAUDE.md': CLAUDE_MD, 'Da fare.md': '# x\n' })
  turns(on)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  // The pane opens: the greeting is said again at once, then the turn makes the robot walk.
  await $.command.run({ command: COMMAND } as never)
  expect((state.values.talk as Talk).bubble).toMatchObject({ kind: 'hello', at: AT })
  await $.turn.start({ text: 'ciao', turnId: 't1' })
  const walked = AT + 1200
  expect((state.values.talk as Talk).bubble).toMatchObject({ kind: 'hello', at: walked, until: walked + 6000 })
  // A single chain: the walk, then the greeting.
  expect((state.values.motion as Motion).until).toBe(walked + talkMs('Hello, Alex!'))
  const pane = await mount($)
  await state.clock.advance(600)
  await pane.redraw()
  expect((await pane.findAll({ type: 'Svg' })).some(n => n.props.alt === 'Hello, Alex!')).toBe(false)
  await state.clock.advance(600)
  await pane.redraw()
  expect((await pane.findAll({ type: 'Svg' })).some(n => n.props.alt === 'Hello, Alex!')).toBe(true)
})

test('mascot: a successful test or commit Bash makes it celebrate; a failed one or any other command does not', async ($, on) => {
  const state = liveState(on, {})
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  on('tool.call', (_$, e) => ({ result: { stdout: '', stderr: '', interrupted: false }, ...((e as { command?: string }).command?.includes('fail') ? { isError: true } : {}) }) as never)
  await $.turn.start({ text: 'ciao', turnId: 't1' })
  await $.tool.call({ tool: 'Bash', command: 'ls -la' } as never)
  await $.tool.call({ tool: 'Bash', command: 'npm test -- fail' } as never)
  expect((state.values.mascot as Mascot).win).toBe(undefined)
  await $.tool.call({ tool: 'Bash', command: 'cd x && git commit -m "y"' } as never)
  expect((state.values.mascot as Mascot).win).toBe(true)
  await complete($)
  expect(state.values.mascot).toMatchObject({ state: 'done', win: true })
})

test('mascot: a subagent keeps it in agent until it finishes, then it goes back to thinking', async ($, on) => {
  const state = liveState(on, {})
  turns(on)
  on('agent.spawn', () => ({ model: 'haiku', agentId: 'a1' }) as never)
  await $.turn.start({ text: 'cerca', turnId: 't1' })
  await $.agent.spawn({ tool_use_id: 'tu1', prompt: 'x', description: 'cerca', subagentType: 'Explore' } as never)
  expect(stateOf(state)).toBe('agent')
  await complete($, 'a1')
  expect(stateOf(state)).toBe('thinking')
})

for (const reason of ['aborted', 'error', 'refusal'] as const) {
  test(`mascot: a turn ending with ${reason} makes it shake`, async ($, on) => {
    const state = liveState(on, { working: true, mascot: { state: 'writing', since: AT, back: 'idle' } })
    turns(on)
    await $.turn.complete({ answer: '', durationMs: 1, isAborted: reason === 'aborted', turnId: 't1', reason, ...(reason === 'refusal' ? { refusal: { category: null, explanation: null } } : {}) } as never)
    expect(state.values.working).toBe(false)
    expect(stateOf(state)).toBe('error')
  })
}

test('turn end: one row in ends with the reason, how many distinct files were written in the turn, the turn number and how long it took', async ($, on) => {
  const W = (path: string, turn: number) => ({ at: AT, verb: 'edit' as const, path, isProtected: false, isApprox: false, count: 1, turn })
  const state = liveState(on, { working: true, turn: 2, turnAt: AT - 45_000, feed: [W('a.md', 2), W('a.md', 2), W('b.md', 2), W('c.md', 1)] })
  turns(on)
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: true, turnId: 't1', reason: 'aborted' } as never)
  expect(state.values.ends).toEqual([{ at: AT, reason: 'aborted', files: 2, turn: 2, ms: 45_000 }])
})

test('turn end: without the start time of the turn the row in ends has no duration', async ($, on) => {
  const state = liveState(on, { working: true, turn: 3 })
  turns(on)
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  expect(state.values.ends).toEqual([{ at: AT, reason: 'answer', files: 0, turn: 3 }])
})

test('mascot: if agent.list throws at turn end the mascot still reaches done', async ($, on) => {
  const state = liveState(on, { working: true, mascot: { state: 'writing', since: AT, back: 'idle' }, agentRuns: { a1: { type: 'Explore', at: AT, endAt: null } } })
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => { throw new Error('boom') })
  await complete($)
  expect(state.values.working).toBe(false)
  expect(stateOf(state)).toBe('done')
})

test('mascot: an agent.spawn that is denied or throws does not take it to agent', async ($, on) => {
  const state = liveState(on, {})
  turns(on)
  let denied = true
  on('agent.spawn', () => { if (!denied) throw new Error('boom'); return { deny: 'no' } as never })
  await $.turn.start({ text: 'cerca', turnId: 't1' })
  expect(stateOf(state)).toBe('thinking')
  await $.agent.spawn({ tool_use_id: 'tu1', prompt: 'x', description: 'cerca', subagentType: 'Explore' } as never).catch(() => {})
  expect(stateOf(state)).toBe('thinking')
  denied = false
  await $.agent.spawn({ tool_use_id: 'tu2', prompt: 'x', description: 'cerca', subagentType: 'Explore' } as never).catch(() => {})
  expect(stateOf(state)).toBe('thinking')
  expect(state.values.agentRuns).toEqual({})
})

test('mascot: a spawn without an agentId does not take it to agent', async ($, on) => {
  const state = liveState(on, {})
  turns(on)
  on('agent.spawn', () => ({ model: 'haiku' }) as never)
  await $.turn.start({ text: 'cerca', turnId: 't1' })
  await $.agent.spawn({ tool_use_id: 'tu1', prompt: 'x', description: 'cerca', subagentType: 'Explore' } as never)
  expect(stateOf(state)).toBe('thinking')
})
