import type { Activity, Bubble, BubbleKind, Talk } from '../types'
import { typingMs } from './lettering'
import { same } from './ports'
import { WAVE_MS } from './stage'
import { roleLabel } from './sources'
import type { Strings } from './strings'
import { WRITES } from './theme'

// The mascot's speech bubble: Jarvis speaks only when something real happens. Pure functions; the `talk` atom
// and the timings live in register.tsx, the drawing in chrome.tsx.
//
// Two kinds of bubble: the ones that ask for an action (Save session, new memory, handoff, first start) stay
// until you answer, close them or send another message; the nice phrases (greeting, green tests, session
// saved) go away on their own after CHEER_MS.

export type { Bubble, BubbleKind, Talk }
export const NO_TALK: Talk = { bubble: null, pending: null, said: [], writes: [], turns: 0, seq: 0, isSaving: false }

export const CHEER_MS = 6000
// Substantial work since the last save: many files written or many turns. Never based on how full the context is.
export const SAVE_FILES = 8
export const SAVE_TURNS = 15

// In rotation: the same phrase does not come back twice in a row. The lists are in the catalog.
const pick = (list: readonly string[], seq: number): string => list[seq % list.length] ?? list[0] ?? ''

const isCheer = (k: BubbleKind): boolean => k === 'hello' || k === 'cheer'
// Only the nice phrases are typed out, with the arm wave; a bubble with a button appears whole.
export const isTyped = (b: Bubble): boolean => isCheer(b.kind)
// How long saying a nice phrase takes: the typing or the arm wave, whichever is longer.
export const talkMs = (text: string): number => Math.max(WAVE_MS, typingMs(text))

const say = (t: Talk, kind: BubbleKind, text: string, more: Partial<Bubble> = {}): Talk => ({
  ...t,
  seq: t.seq + 1,
  bubble: { id: t.seq + 1, kind, text, ...more },
  said: t.said.includes(kind) ? t.said : [...t.said, kind],
})

// The first name from the git name (`Jane Doe` → `Jane`); without a name, the catalog's bare greeting.
export function helloText(name: string | null, t: Strings): string {
  return t.bubble.hello((name ?? '').trim().split(/\s+/)[0] ?? '')
}

// At the start of the session: the greeting stays until the end of the first turn (the pane opens with the
// first request, nobody would see a timed greeting).
export function greet(talk: Talk, name: string | null, t: Strings): Talk {
  return talk.said.includes('hello') ? talk : say(talk, 'hello', helloText(name, t))
}

// The pane opens (with the first request): the greeting is said again from the start, typed out, and then goes away on its own.
export function replay(t: Talk, nowMs: number): Talk {
  const b = t.bubble
  if (b === null || b.kind !== 'hello') return t
  return { ...t, bubble: { ...b, at: nowMs, until: nowMs + CHEER_MS } }
}

// Without declared capabilities, or with the Jarvis Lite marker, Jarvis has to be set up.
export function setup(talk: Talk, t: Strings, name: string | null = null): Talk {
  if (talk.said.includes('setup')) return talk
  return say(talk, 'setup', t.bubble.setup(helloText(name, t)), { action: { label: t.bubble.setupAction, send: '/first-run' } })
}

// The writes of a turn: the files for the reminder and, for a memory or handoff write, the bubble to show at
// the end of the turn (memory wins over handoff). `t`: the catalog whose role names the activities carry.
export function noteWrites(talk: Talk, acts: readonly Activity[], t: Strings): Talk {
  const writes = acts.filter(a => WRITES.has(a.verb))
  if (writes.length === 0) return talk
  const files = [...talk.writes]
  for (const a of writes) if (!files.includes(a.path)) files.push(a.path)
  let pending = talk.pending
  const memory = writes.find(a => a.role === roleLabel('Durable memory', t) || a.role === roleLabel('Identity', t))
  const handoff = writes.find(a => a.role === roleLabel('Handoff', t) && a.verb === 'create')
  if (memory !== undefined) pending = { id: 0, kind: 'memory', text: t.bubble.memory, action: { label: t.bubble.memoryAction, open: memory.path } }
  else if (handoff !== undefined && pending?.kind !== 'memory') pending = { id: 0, kind: 'handoff', text: t.bubble.handoff, action: { label: t.bubble.handoffAction, open: handoff.path } }
  // Nothing new (a file already counted, the same pending bubble): the same object, so whoever writes the atom skips the write.
  if (files.length === talk.writes.length && same(pending, talk.pending)) return talk
  return { ...talk, writes: files, pending }
}

// A new request: action bubbles close (the nice phrases end on their own). A /save-session resets the work
// count and, at the end of the turn, says thanks. If nothing changes, the same object: whoever writes the
// atom skips the write.
export function onPrompt(t: Talk, text: string): Talk {
  const keep = t.bubble !== null && isCheer(t.bubble.kind) ? t.bubble : null
  if (/^\s*\/save-session\b/.test(text)) return { ...t, bubble: keep, writes: [], turns: 0, isSaving: true, said: t.said.filter(k => k !== 'save') }
  return keep === t.bubble ? t : { ...t, bubble: keep }
}

// End of the main turn: what it says, in order of value. First memory or handoff, then the thanks for the
// save, then the reminder (once until the next save), then the party for green tests.
export function onTurnEnd(talk: Talk, end: { win: boolean; failed: boolean; nowMs: number }, t: Strings): Talk {
  const base: Talk = { ...talk, turns: talk.turns + 1, pending: null, isSaving: false, bubble: talk.bubble?.kind === 'hello' ? null : talk.bubble }
  const cheer = (text: string): Talk => say(base, 'cheer', text, { until: end.nowMs + CHEER_MS })
  if (talk.pending !== null) return say(base, talk.pending.kind, talk.pending.text, talk.pending.action === undefined ? {} : { action: talk.pending.action })
  if (talk.isSaving && !end.failed) return cheer(pick(t.bubble.saved, talk.seq))
  const isLong = base.writes.length >= SAVE_FILES || base.turns >= SAVE_TURNS
  if (isLong && !end.failed && !talk.said.includes('save')) {
    return say(base, 'save', t.bubble.save, { action: { label: t.bubble.saveAction, send: '/save-session' } })
  }
  if (end.win && !end.failed) return cheer(pick(t.bubble.wins, talk.seq))
  return base
}

// The bubble visible right now: an expired nice phrase is not drawn (the tick also removes it from the atom),
// and neither is one waiting for a walk to end (holdTyping).
export const visible = (t: Talk | null | undefined, nowMs: number): Bubble | null => {
  const b = t?.bubble ?? null
  if (b === null) return null
  return (b.until !== undefined && nowMs >= b.until) || (b.at !== undefined && nowMs < b.at) ? null : b
}

// Walking and typing never at the same time: a nice phrase the mascot has not finished saying (or not yet started)
// when a walk begins starts again on arrival, `walkEnd`, and keeps its whole time. Until then it is not
// shown. With no walk (null), or for a bubble with a button, the same object.
export function holdTyping(t: Talk, nowMs: number, walkEnd: number | null): Talk {
  const b = t.bubble
  if (walkEnd === null || b === null || b.at === undefined || !isTyped(b) || b.at >= walkEnd || b.at + talkMs(b.text) <= nowMs) return t
  const shift = walkEnd - b.at
  return { ...t, bubble: { ...b, at: walkEnd, ...(b.until === undefined ? {} : { until: b.until + shift }) } }
}

// Removes the expired nice phrase (its time is up); one said again later stays.
export const expire = (t: Talk, nowMs: number): Talk =>
  (t.bubble?.until !== undefined && nowMs >= t.bubble.until ? { ...t, bubble: null } : t)

// Closes bubble `id` (the ×, the action, the timeout); if another one has arrived in the meantime, it stays.
export const dismiss = (t: Talk, id: number): Talk => (t.bubble?.id === id ? { ...t, bubble: null } : t)
