import type { Mascot, MascotState, Verb } from '../types'
import { WRITES } from './theme'

// The Jarvis mascot: its state, how it changes with the session events and where it stands on the stage.
// Pure functions; the drawing (the figure on the stage) lives in stage.ts, the atom in register.tsx.

// The types live in types/index.d.ts (the state contract); here they are re-exported for convenience.
export type { Mascot, MascotState }
export type MascotEvent =
  | { kind: 'turnStart' }
  | { kind: 'tool'; verb: Verb }
  | { kind: 'agentStart' }
  | { kind: 'agentEnd' }
  // failed: the turn was interrupted (Esc) or ended in an error or a refusal: a shake instead of the hop.
  | { kind: 'turnEnd'; failed?: boolean }
  | { kind: 'fault' }
  // A passing test or commit: at the end of the turn it celebrates.
  | { kind: 'win' }
  | { kind: 'tick' }
// The context after the event: whether a turn is running, and how many subagents started in the session are still working.
export type MascotCtx = { working: boolean; agents: number }

// How long `done` (hop) and `error` (shake) last before going back.
export const TRANSIENT_MS = 3000
// How long it waits before falling asleep.
export const SLEEP_MS = 15 * 60_000
export const IDLE: Mascot = { state: 'idle', since: 0, back: 'idle' }

// The teal of the Jarvis logo inside the Svgs, in light and dark: the class `ac` with its media query
// (outside the Svgs, where the theme applies, it is ACCENT in theme.ts).
export const TEAL_STYLE = '.ac{fill:#007373}@media (prefers-color-scheme: dark){.ac{fill:#3fb7b0}}'

const isTransient = (s: MascotState): boolean => s === 'done' || s === 'error'
const rest = (c: MascotCtx): MascotState => (c.agents > 0 ? 'agent' : c.working ? 'thinking' : 'idle')

// Where it stands on the stage, as a percentage of the run: waiting on the left, at work against the JARVIS
// lettering. It moves only at the start and end of a turn (a separate spot for each activity made it jump on
// every call). `done` and `error` stay where they were.
const WORK = 100
const SPOT: Record<MascotState, number> = { idle: 0, sleep: 0, thinking: WORK, reading: WORK, agent: WORK, writing: WORK, done: 0, error: 0 }
export const spot = (m: Mascot): number => (isTransient(m.state) ? (m.from ?? 0) : SPOT[m.state])

const keepWin = (m: Mascot, keep = true): { win?: true } => (keep && m.win === true ? { win: true } : {})
// The working states are one single scene: the mascot has the same pose and stands in the same spot.
const WORKING: ReadonlySet<MascotState> = new Set<MascotState>(['thinking', 'reading', 'writing', 'agent'])
export const isWorking = (s: MascotState): boolean => WORKING.has(s)
// Reading, writing and thinking have the same pose (stage.ts): for the drawing they are the same state.
const LOOK: Partial<Record<MascotState, MascotState>> = { reading: 'thinking', writing: 'thinking' }
const look = (s: MascotState): MascotState => LOOK[s] ?? s
// Same drawn scene: the same object, so whoever writes the atom skips the write and the pane does not
// redraw. From one kind of work to another with another pose (the subagent) only the state changes: `since`
// and `from` stay those of the start of the scene (the drawing walks and moves only when the scene changes).
const to = (m: Mascot, state: MascotState, now: number): Mascot =>
  look(m.state) === look(state)
    ? m
    : isWorking(m.state) && isWorking(state)
      ? { ...m, state }
      : { state, since: now, back: m.back, from: spot(m), ...keepWin(m) }

const READS: ReadonlySet<Verb> = new Set<Verb>(['read', 'search'])

export function stepMascot(m: Mascot, ev: MascotEvent, ctx: MascotCtx, now: number): Mascot {
  switch (ev.kind) {
    case 'turnStart': {
      // New turn: the party of the previous turn no longer counts.
      const n = to(m, rest({ ...ctx, working: true }), now)
      return n.win === true ? { state: n.state, since: n.since, back: n.back, from: n.from ?? spot(m) } : n
    }
    case 'tool': {
      if (ctx.agents > 0) return to(m, 'agent', now)
      return to(m, READS.has(ev.verb) ? 'reading' : WRITES.has(ev.verb) ? 'writing' : 'thinking', now)
    }
    case 'agentStart':
      // If the subagent has already finished (the end arrived before the link) or has no id, nobody is working.
      return ctx.agents > 0 ? to(m, 'agent', now) : m
    case 'agentEnd':
      // During a hop or a shake only the state it goes back to changes.
      return isTransient(m.state) ? { ...m, back: rest(ctx) } : to(m, rest(ctx), now)
    case 'turnEnd':
      return { state: ev.failed === true ? 'error' : 'done', since: now, back: rest({ ...ctx, working: false }), from: spot(m), ...keepWin(m, ev.failed !== true) }
    case 'fault':
      return { state: 'error', since: now, back: isTransient(m.state) ? m.back : m.state, from: spot(m), ...keepWin(m) }
    case 'win':
      return m.win === true ? m : { ...m, win: true }
    case 'tick':
      if (isTransient(m.state) && now - m.since >= TRANSIENT_MS) return { state: m.back, since: now, back: m.back, from: spot(m), ...keepWin(m, ctx.working) }
      if (m.state === 'idle' && now - m.since >= SLEEP_MS) return { state: 'sleep', since: now, back: m.back, from: spot(m) }
      return m
  }
}
