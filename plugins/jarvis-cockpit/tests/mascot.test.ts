import { test, expect } from 'claude-code/testing'
import { strings } from '../hooks/i18n'
import { IDLE, SLEEP_MS, TRANSIENT_MS, spot, stepMascot, type Mascot, type MascotState } from '../hooks/mascot'

const STATES: MascotState[] = ['idle', 'sleep', 'thinking', 'reading', 'writing', 'agent', 'done', 'error']
const T0 = 1_000_000
const quiet = { working: false, agents: 0 }
const busy = { working: true, agents: 0 }

test('mascot: turn, reads, writes and calls with no file; reading, writing and thinking are the same scene', () => {
  const m = stepMascot(IDLE, { kind: 'turnStart' }, busy, T0)
  expect(m).toEqual({ state: 'thinking', since: T0, back: 'idle', from: 0 })
  // Same pose drawn: the same object, so no atom write.
  for (const verb of ['read', 'search', 'edit', 'move', 'shell'] as const) expect(stepMascot(m, { kind: 'tool', verb }, busy, T0 + 1)).toBe(m)
  // Outside a turn a read is a new scene; writing right after stays in it.
  const r = stepMascot(IDLE, { kind: 'tool', verb: 'read' }, quiet, T0)
  expect(r).toEqual({ state: 'reading', since: T0, back: 'idle', from: 0 })
  expect(stepMascot(r, { kind: 'tool', verb: 'edit' }, quiet, T0 + 1)).toBe(r)
  // A subagent changes the pose but not the scene: same since, same starting point.
  expect(stepMascot(m, { kind: 'tool', verb: 'read' }, { working: true, agents: 1 }, T0 + 2)).toEqual({ state: 'agent', since: T0, back: 'idle', from: 0 })
})

test('mascot: turn end, hop, and back to rest after three seconds', () => {
  const done = stepMascot({ state: 'writing', since: T0, back: 'idle' }, { kind: 'turnEnd' }, quiet, T0 + 10)
  expect(done).toEqual({ state: 'done', since: T0 + 10, back: 'idle', from: 100 })
  expect(stepMascot(done, { kind: 'tick' }, quiet, T0 + 10 + TRANSIENT_MS - 1)).toBe(done)
  expect(stepMascot(done, { kind: 'tick' }, quiet, T0 + 10 + TRANSIENT_MS)).toEqual({ state: 'idle', since: T0 + 10 + TRANSIENT_MS, back: 'idle', from: 100 })
  const idle: Mascot = { ...IDLE, since: T0 }
  expect(stepMascot(idle, { kind: 'tick' }, quiet, T0 + 99_999)).toBe(idle)
})

test('mascot: an interrupted or failed turn shakes instead of hopping, then returns to rest', () => {
  const err = stepMascot({ state: 'writing', since: T0, back: 'idle' }, { kind: 'turnEnd', failed: true }, quiet, T0 + 10)
  expect(err).toEqual({ state: 'error', since: T0 + 10, back: 'idle', from: 100 })
  expect(stepMascot(err, { kind: 'tick' }, quiet, T0 + 10 + TRANSIENT_MS).state).toBe('idle')
  expect(stepMascot(IDLE, { kind: 'turnEnd', failed: false }, quiet, T0).state).toBe('done')
})

test('mascot: a subagent keeps the agent state while it works', () => {
  let m = stepMascot({ state: 'thinking', since: T0, back: 'idle' }, { kind: 'agentStart' }, { working: true, agents: 1 }, T0 + 1)
  expect(m.state).toBe('agent')
  expect(stepMascot(m, { kind: 'tool', verb: 'read' }, { working: true, agents: 1 }, T0 + 2)).toBe(m)
  expect(stepMascot(m, { kind: 'agentEnd' }, { working: true, agents: 1 }, T0 + 3)).toBe(m)
  m = stepMascot(m, { kind: 'agentEnd' }, { working: true, agents: 0 }, T0 + 4)
  expect(m).toMatchObject({ state: 'thinking', since: T0 })
  expect(stepMascot({ state: 'agent', since: T0, back: 'idle' }, { kind: 'agentEnd' }, quiet, T0 + 5).state).toBe('idle')
  // A turn that ends with a subagent in the background goes back to agent, not to rest.
  const done = stepMascot(m, { kind: 'turnEnd' }, { working: false, agents: 1 }, T0 + 6)
  expect(done).toMatchObject({ state: 'done', back: 'agent' })
  // The subagent ends during the hop: only where it returns to changes.
  expect(stepMascot(done, { kind: 'agentEnd' }, quiet, T0 + 7)).toEqual({ ...done, back: 'idle' })
  // A new turn with a subagent still at work.
  expect(stepMascot(IDLE, { kind: 'turnStart' }, { working: true, agents: 1 }, T0 + 8).state).toBe('agent')
})

test('mascot: an error shakes and goes back to the previous state', () => {
  const reading: Mascot = { state: 'reading', since: T0, back: 'idle' }
  const err = stepMascot(reading, { kind: 'fault' }, busy, T0 + 1)
  expect(err).toEqual({ state: 'error', since: T0 + 1, back: 'reading', from: 100 })
  // A second error does not lose the previous state.
  const again = stepMascot(err, { kind: 'fault' }, busy, T0 + 2)
  expect(again).toEqual({ state: 'error', since: T0 + 2, back: 'reading', from: 100 })
  expect(stepMascot(again, { kind: 'tick' }, busy, T0 + 2 + TRANSIENT_MS).state).toBe('reading')
  // A real event during the shake replaces it at once.
  expect(stepMascot(err, { kind: 'tool', verb: 'edit' }, busy, T0 + 3).state).toBe('writing')
})

test('mascot: an agentStart with no subagent at work (the end came first) does not take it to agent', () => {
  const thinking: Mascot = { state: 'thinking', since: T0, back: 'idle' }
  expect(stepMascot(thinking, { kind: 'agentStart' }, { working: true, agents: 0 }, T0 + 1)).toBe(thinking)
  expect(stepMascot(thinking, { kind: 'agentStart' }, { working: true, agents: 1 }, T0 + 1).state).toBe('agent')
})

test('mascot: waiting on the left, at work against the lettering; done and error stay where they were', () => {
  for (const lang of ['it', 'en'] as const) for (const s of STATES) expect(strings(lang).mascot.alt[s].length).toBeGreaterThan(0)
  const at = (state: MascotState): number => spot({ state, since: T0, back: 'idle' })
  expect([at('idle'), at('sleep'), at('thinking'), at('reading'), at('agent'), at('writing')]).toEqual([0, 0, 100, 100, 100, 100])
  expect(spot({ state: 'done', since: T0, back: 'idle', from: 55 })).toBe(55)
  expect(spot({ state: 'error', since: T0, back: 'idle' })).toBe(0)
})

test('mascot: a passed test or commit celebrates at the end of that turn, not the next one', () => {
  let m = stepMascot(IDLE, { kind: 'turnStart' }, busy, T0)
  m = stepMascot(m, { kind: 'win' }, busy, T0 + 1)
  expect(m.win).toBe(true)
  expect(stepMascot(m, { kind: 'win' }, busy, T0 + 2)).toBe(m)
  // It stays across calls and an error mid-turn.
  m = stepMascot(m, { kind: 'tool', verb: 'edit' }, busy, T0 + 3)
  m = stepMascot(m, { kind: 'fault' }, busy, T0 + 4)
  m = stepMascot(m, { kind: 'tick' }, busy, T0 + 4 + TRANSIENT_MS)
  expect(m).toMatchObject({ state: 'thinking', win: true })
  const party = stepMascot(m, { kind: 'turnEnd' }, quiet, T0 + 9_000)
  expect(party).toMatchObject({ state: 'done', win: true })
  // Back at rest, the party is over; a new turn restarts without it.
  expect(stepMascot(party, { kind: 'tick' }, quiet, T0 + 9_000 + TRANSIENT_MS).win).toBe(undefined)
  expect(stepMascot(m, { kind: 'turnStart' }, busy, T0 + 10_000).win).toBe(undefined)
  // An interrupted turn does not celebrate.
  expect(stepMascot(m, { kind: 'turnEnd', failed: true }, quiet, T0 + 9_000)).toMatchObject({ state: 'error' })
  expect(stepMascot(m, { kind: 'turnEnd', failed: true }, quiet, T0 + 9_000).win).toBe(undefined)
})

test('mascot: after a quarter of an hour of waiting it sleeps, and a turn wakes it', () => {
  const idle: Mascot = { state: 'idle', since: T0, back: 'idle' }
  expect(stepMascot(idle, { kind: 'tick' }, quiet, T0 + SLEEP_MS - 1)).toBe(idle)
  const sleep = stepMascot(idle, { kind: 'tick' }, quiet, T0 + SLEEP_MS)
  expect(sleep).toEqual({ state: 'sleep', since: T0 + SLEEP_MS, back: 'idle', from: 0 })
  expect(stepMascot(sleep, { kind: 'tick' }, quiet, T0 + 2 * SLEEP_MS)).toBe(sleep)
  expect(stepMascot(sleep, { kind: 'turnStart' }, busy, T0 + 2 * SLEEP_MS).state).toBe('thinking')
})
