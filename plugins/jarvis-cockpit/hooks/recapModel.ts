import type { Color } from 'claude-code'
import type { Activity, AgentRun, Handoff, RecapFace, Snapshot, TurnEnd, TurnPrompt } from '../types'
import { basename, clip, copyKeys, daysBetween, dirname, duration, hhmm, isoDay, oneLine, shortDay, span, weekday } from './format'
import { shortTitle } from './snapshot'
import type { Strings } from './strings'
import { DIM, GLYPH, TEXT, WRITES } from './theme'

// Pure Recap view-model: what to show and in what order. recap.tsx, recapOpen.tsx and recapWork.tsx draw it,
// register.tsx keeps the atoms (agentRuns included) and uses the subagent helpers.

// How many Now items, how many other handoffs, how many rows of the Activity log (open and closed).
export const NOW_ROWS = 8
export const OTHER_HANDOFFS = 3
export const WAITING_ROWS = 5
export const ACTIVITY_ROWS = 60
export const LOG_SHORT = 12
// Files written in the session to open under the log: how many with the row closed and how many open.
export const WRITTEN_ROWS = 5
export const WRITTEN_ALL = 30
// From here a handoff is stale (age in yellow); beyond this a Waiting item is stale.
export const STALE_HANDOFF_DAYS = 14
export const STALE_COUNTER_DAYS = 10
const TITLE_CHARS = 90

// The label of the date column of Now: overdue ("yesterday" / "4d ago") and today in red, the weekday within six
// days, the short date beyond; without a date the column stays empty.
export function dueLabel(due: string | null, nowMs: number, t: Strings): { text: string; color: Color } {
  if (due === null) return { text: '', color: DIM }
  const today = isoDay(nowMs)
  const days = daysBetween(nowMs, new Date(`${due}T12:00:00`).getTime())
  if (due < today) return { text: days === -1 ? t.dates.yesterday : t.dates.daysAgo(-days), color: 'error' }
  if (due === today) return { text: t.dates.today, color: 'error' }
  return { text: days <= 6 ? weekday(due, t.dates) : shortDay(due, t.dates), color: DIM }
}

// The full title: in the Recap it wraps, the detail is read in the To Do tab. `key`: the title with the
// copy number, the key of the button.
export type NowRow = { index: number; key: string; title: string; due: { text: string; color: Color } }

// A Now item is "due today" if its explicit due date is today or already past.
const isDueBy = (due: string | null, nowMs: number): boolean => due !== null && due <= isoDay(nowMs)

// The Now items to show: first those with a due date (by date, in the Future work order on the same date),
// then the others in the Future work order; at most NOW_ROWS, `more` counts the ones left out.
export function nowRows(s: Snapshot, nowMs: number, t: Strings): { rows: NowRow[]; more: number } {
  const key = copyKeys()
  const all = (s.now ?? []).map((line, index) => {
    const title = s.nowTitles?.[index] ?? shortTitle(line)
    return { index, title, key: key(title), due: (s.nowDue ?? [])[index] ?? null }
  })
  const dated = all.filter(x => x.due !== null).sort((a, b) => (a.due! < b.due! ? -1 : a.due! > b.due! ? 1 : a.index - b.index))
  const ordered = [...dated, ...all.filter(x => x.due === null)]
  const rows = ordered.slice(0, NOW_ROWS).map(x => ({ index: x.index, key: x.key, title: x.title, due: dueLabel(x.due, nowMs, t) }))
  return { rows, more: Math.max(0, all.length - NOW_ROWS) }
}

// The age of a thing: "today", "yesterday", "12d".
export const ageText = (days: number, t: Strings): string => t.dates.age(days)

export type WaitingRow = { key: string; title: string; age: string; isStale: boolean }

const isStaleWait = (ageDays: number | null): boolean => ageDays !== null && ageDays > STALE_COUNTER_DAYS

// The Waiting items to show: at most WAITING_ROWS (snapshot.waitingItems already has the most stuck one
// first), `more` counts the ones left out. Stuck beyond STALE_COUNTER_DAYS days; unknown age → ''.
export function waitingRows(s: Snapshot, t: Strings): { rows: WaitingRow[]; more: number } {
  const key = copyKeys()
  const items = (s.waitingItems ?? []).map(w => ({ ...w, key: key(w.title) }))
  const rows = items.slice(0, WAITING_ROWS).map(w => ({
    key: w.key,
    title: clip(w.title, TITLE_CHARS),
    age: w.ageDays === null ? '' : ageText(w.ageDays, t),
    isStale: isStaleWait(w.ageDays),
  }))
  return { rows, more: Math.max(0, items.length - WAITING_ROWS) }
}

// Today, at the top of the Recap: only attention with an explicit hook, as in the Jarvis Lite briefing (no
// guessed priorities): the Now items that are overdue or due today and the ones waiting for too long. The
// same items do not repeat below, in Now and Waiting. At most NOW_ROWS and WAITING_ROWS.
export function todayRows(s: Snapshot, nowMs: number, t: Strings): { due: NowRow[]; stale: WaitingRow[] } {
  const due = nowRows(s, nowMs, t).rows.filter(r => isDueBy((s.nowDue ?? [])[r.index] ?? null, nowMs))
  const stale = waitingRows(s, t).rows.filter(r => r.isStale)
  return { due, stale }
}

// The files written in the session (atom written: path → time), the most recent first: at most `limit`
// (WRITTEN_ROWS with the row closed, WRITTEN_ALL open), `more` counts the ones left out. During the turn
// (`isFrozen`) the list is not reordered: it follows the order of the keys, which at the start of a turn is most
// recent first (sortWritten) and in which addWritten leaves an already written file in place and puts a new one at the end.
export function writtenFiles(w: Readonly<Record<string, number>>, limit = WRITTEN_ROWS, isFrozen = false): { files: string[]; more: number } {
  // Outside the turn the exact order by time (not sortWritten: keys made only of digits would come first).
  const all = isFrozen ? Object.keys(w) : Object.entries(w).sort((a, b) => b[1] - a[1]).map(([p]) => p)
  return { files: all.slice(0, limit), more: Math.max(0, all.length - limit) }
}

// The written files with the keys ordered most recent first.
export const sortWritten = (w: Readonly<Record<string, number>>): Record<string, number> =>
  Object.fromEntries(Object.entries(w).sort((a, b) => b[1] - a[1]))

// The command that the resume button prepares in the prompt.
export const resumeCommand = (file: string): string => `/handoff resume ${file.replace(/\.md$/, '')}`

export type Resume = { main: Handoff | null; others: Handoff[]; more: number }

// Resume: the most recent active handoff (snapshot.handoffs is already most recent first), then the others.
export function resume(s: Snapshot): Resume {
  const [main = null, ...rest] = s.handoffs
  return { main, others: rest.slice(0, OTHER_HANDOFFS), more: Math.max(0, rest.length - OTHER_HANDOFFS) }
}

// The two moments of the Recap: "work" from the first prompt sent in the session (a user gesture, so a
// predictable change), unless the show-overview button was pressed (face 'open'), which holds until the next prompt.
export const recapMoment = (prompts: number, face: RecapFace): 'open' | 'work' => (prompts > 0 && face !== 'open' ? 'work' : 'open')

// The Activity log, as a terminal: what Jarvis wrote and ran in the vault (files by name), the reads and
// searches in a row gathered in one line, the subagents (⧗ at work, ✓ done, with the duration) and the end of
// every turn, in time order; the last ACTIVITY_ROWS, the most recent at the bottom like `tail -f`. The startup
// reads (profile, memory, Future work, handoff) are the same every session: they become "review the context"
// (to someone who does not know the vault the file names say nothing). The words come from the catalog.
// The verb column: the longest verb of either language (7 characters) and a space.
const VERB_W = 8
const WHAT_CHARS = 48

// The file name, not the path: cut to one line, the path lost both its start and its end.
// The vault alone is `vault`.
const name = (p: string): string => (p === '.' ? 'vault' : basename(p))

function what(a: Activity): string {
  if (a.verb === 'shell') return clip((a.detail ?? name(a.path)).replace(/\s+/g, ' '), WHAT_CHARS)
  if (a.verb === 'search') return a.detail !== undefined && a.detail !== '' ? `«${clip(a.detail, 24)}»${a.path === '.' ? '' : `  ${name(a.path)}`}` : name(a.path)
  // Moved without changing its name: the destination folder.
  if (a.verb === 'move' && a.from !== undefined) return `${basename(a.from)} → ${basename(a.from) === basename(a.path) ? `${name(dirname(a.path) || '.')}/` : basename(a.path)}`
  return name(a.path)
}

// "✓ done in 3m10 · 2 files": how the turn ended, how long it took (if known) and how many different files it wrote.
// The first word is the glyph: the log draws it apart.
export function endText(reason: string, files: number, t: Strings, ms?: number): string {
  const kind = reason === 'aborted' ? 'aborted' : reason === 'answer' ? 'answer' : 'error'
  return t.recap.activity.end(kind, ms === undefined ? null : span(ms), files)
}

// How many different files a turn wrote (its subagents too).
export const turnFiles = (feed: readonly Activity[], turn: number): number =>
  new Set(feed.filter(a => a.turn === turn && WRITES.has(a.verb)).map(a => a.path)).size

// A log row in columns, for drawing: time, symbol, verb and what (path, command). The subagent and turn-end
// rows have no verb: all the text is in `what`. `isHead`: the start of a turn (the prompt's time, › and its
// first words), drawn in full ink.
export type LogRow = { time: string; glyph: string; verb: string; what: string; isHead?: boolean }
// How many letters of the prompt on the turn-start row.
const HEAD_CHARS = 40

const isLook = (a: Activity): boolean => a.verb === 'read' || a.verb === 'search'
// Jarvis's sources: a declared role (the CLAUDE.md profile too), or the Jarvis system.
const isContext = (a: Activity): boolean =>
  a.role !== undefined || a.path === 'AGENTS.md' || /^(99 - Jarvis|\.jarvis-core)(\/|$)/.test(a.path)

// Reads and searches in a row (same turn, same subagent) in groups; the rest alone.
function lookGroups(feed: readonly Activity[]): Activity[][] {
  const out: Activity[][] = []
  for (const a of feed) {
    const last = out[out.length - 1]
    const prev = last?.[last.length - 1]
    if (last !== undefined && prev !== undefined && isLook(a) && isLook(prev) && a.turn === prev.turn && a.agent === prev.agent) last.push(a)
    else out.push([a])
  }
  return out
}

// One row for a group of reads and searches: how many files and searches, and the last file read.
function lookRow(g: readonly Activity[], t: Strings): { glyph: string; verb: string; what: string } {
  const a = t.recap.activity
  const files = new Set(g.filter(x => x.verb === 'read').map(x => x.path)).size
  const searches = g.filter(x => x.verb === 'search').reduce((n, x) => n + x.count, 0)
  const counts = [files > 0 ? a.files(files) : '', searches > 0 ? a.searches(searches) : ''].filter(x => x !== '').join(', ')
  const agent = g[0]?.agent === undefined ? '' : `  · ${g[0].agent}`
  if (g.every(isContext)) return { glyph: '◦', verb: a.review, what: `${a.context(counts)}${agent}` }
  const lastRead = [...g].reverse().find(x => x.verb === 'read')
  return { glyph: files > 0 ? GLYPH.read : GLYPH.search, verb: files > 0 ? a.verbs.read : a.verbs.search, what: `${counts}${lastRead === undefined ? '' : ` · ${basename(lastRead.path)}`}${agent}` }
}

export const logText = (r: LogRow): string => `${r.time} ${r.glyph} ${r.verb === '' ? r.what : `${r.verb.padEnd(VERB_W)}${r.what}`}`

// The log rows with their time, in time order: the activities, the subagents, the ends of the turns and (with
// `prompts`) the start of every turn, just before its activities.
function timedRows(feed: readonly Activity[], runs: Readonly<Record<string, AgentRun>>, ends: readonly TurnEnd[], prompts: readonly TurnPrompt[], t: Strings): { at: number; row: LogRow }[] {
  const acts = lookGroups(feed).map(g => {
    const a = g[0]!
    return {
      at: a.at,
      row: g.length === 1
        ? { time: hhmm(a.at), glyph: GLYPH[a.verb], verb: t.recap.activity.verbs[a.verb], what: `${what(a)}${a.count > 1 ? `  ×${a.count}` : ''}${a.agent !== undefined ? `  · ${a.agent}` : ''}` }
        : { time: hhmm(a.at), ...lookRow(g, t) },
    }
  })
  const agents = Object.values(runs)
    .filter(r => r.type !== '')
    // Running without a duration: it only changed on redraws and jumped.
    .map(r => ({ at: r.at, row: { time: hhmm(r.at), glyph: r.endAt === null ? '⧗' : '✓', verb: '', what: `${r.type}  ${r.endAt === null ? t.recap.activity.running : duration(r.endAt - r.at)}` } }))
  const done = ends.map(e => {
    const [glyph = '', ...rest] = endText(e.reason, e.files, t, e.ms).split(' ')
    // At the same time the end of the turn goes last.
    return { at: e.at + 0.5, row: { time: hhmm(e.at), glyph, verb: '', what: rest.join(' ') } }
  })
  // At the same time the start of the turn goes before its activities.
  const heads = prompts.map(p => ({ at: p.at - 0.5, row: { time: hhmm(p.at), glyph: '›', verb: '', what: `«${clip(oneLine(p.text), HEAD_CHARS)}»`, isHead: true } }))
  return [...heads, ...acts, ...agents, ...done].sort((a, b) => a.at - b.at)
}

// The last ACTIVITY_ROWS rows, the most recent at the bottom.
export const activityRows = (feed: readonly Activity[], runs: Readonly<Record<string, AgentRun>>, ends: readonly TurnEnd[], t: Strings, prompts: readonly TurnPrompt[] = []): LogRow[] =>
  timedRows(feed, runs, ends, prompts, t).slice(-ACTIVITY_ROWS).map(x => x.row)

export const activityLog = (feed: readonly Activity[], runs: Readonly<Record<string, AgentRun>>, ends: readonly TurnEnd[], t: Strings, prompts: readonly TurnPrompt[] = []): string[] =>
  activityRows(feed, runs, ends, t, prompts).map(logText)

// Now, in the session Recap: one line of text, not an Svg (it changes at every activity). With a turn running,
// "at work since HH:MM" and the most recent row of the turn (a running subagent, the most recent, takes
// precedence); idle, "waiting" and how the last turn ended, with the time and the duration. `line` null: nothing to say.
export function doing(feed: readonly Activity[], runs: Readonly<Record<string, AgentRun>>, ends: readonly TurnEnd[], working: boolean, turnAt: number | null, t: Strings): { label: string; line: string | null; color: Color } {
  const n = t.recap.now
  if (working) {
    const label = turnAt === null ? n.working : n.workingSince(hhmm(turnAt))
    const agent = Object.values(runs).filter(r => r.endAt === null && r.type !== '').sort((a, b) => b.at - a.at)[0]
    if (agent !== undefined) return { label, line: n.agentRunning(agent.type, hhmm(agent.at)), color: TEXT }
    const last = timedRows(feed, {}, [], [], t).filter(x => turnAt === null || x.at >= turnAt).pop()?.row
    if (last === undefined) return { label, line: n.thinking, color: DIM }
    return { label, line: [last.glyph, last.verb, last.what].filter(x => x !== '').join(' '), color: TEXT }
  }
  const end = ends[ends.length - 1]
  if (end === undefined) return { label: n.waiting, line: null, color: DIM }
  const at = hhmm(end.at)
  if (end.reason === 'answer') return { label: n.waiting, line: n.lastDone(at, end.ms === undefined ? null : span(end.ms)), color: 'success' }
  if (end.reason === 'aborted') return { label: n.waiting, line: n.lastStopped(at), color: DIM }
  return { label: n.waiting, line: n.lastFailed(at), color: 'error' }
}

// Subagents of the session, by id. At agent.spawn the id is not known yet: they are written under a
// provisional key (`t:<tool_use_id>:<n>`) and moved to the id when the engine gives it.
type Runs = Readonly<Record<string, AgentRun>>

export const startRun = (runs: Runs, key: string, type: string, at: number): Record<string, AgentRun> =>
  ({ ...runs, [key]: { type, at, endAt: null } })

// Moves the provisional key to the id; if the end has already arrived (under the id) it keeps it.
export function bindRun(runs: Runs, key: string, id: string): Record<string, AgentRun> {
  const started = runs[key]
  if (started === undefined) return { ...runs }
  const { [key]: _, ...rest } = runs
  const ended = runs[id]
  return { ...rest, [id]: { ...started, endAt: ended?.endAt ?? started.endAt } }
}

export function dropRun(runs: Runs, key: string): Record<string, AgentRun> {
  const { [key]: _, ...rest } = runs
  return rest
}

// The end of a subagent (turn.complete with agentId). If the start is not yet bound to the id, the end is
// remembered under the id with an empty type: bindRun merges it, liveRuns does not show it on its own.
export function endRun(runs: Runs, id: string, at: number): Record<string, AgentRun> {
  const run = runs[id]
  if (run !== undefined && run.endAt !== null) return { ...runs }
  return { ...runs, [id]: run === undefined ? { type: '', at, endAt: at } : { ...run, endAt: at } }
}

// At the end of a turn: the bound subagents that the engine no longer lists as working have finished just now.
export function reconcileRuns(runs: Runs, live: ReadonlySet<string>, at: number): Record<string, AgentRun> {
  const out: Record<string, AgentRun> = {}
  for (const [id, r] of Object.entries(runs)) out[id] = r.endAt === null && !id.startsWith('t:') && !live.has(id) ? { ...r, endAt: at } : r
  return out
}

// Finished runs beyond what the log can show are removed: the running ones and the most recent
// ACTIVITY_ROWS finished ones stay. Nothing to remove: the same object.
export function pruneRuns(runs: Runs, keep = ACTIVITY_ROWS): Runs {
  const done = Object.entries(runs).filter(([, r]) => r.endAt !== null).sort((a, b) => b[1].at - a[1].at)
  if (done.length <= keep) return runs
  const gone = new Set(done.slice(keep).map(([id]) => id))
  return Object.fromEntries(Object.entries(runs).filter(([id]) => !gone.has(id)))
}

// How many subagents started in the session are still at work (for the mascot).
export const liveRuns = (runs: Runs): number => Object.values(runs).filter(r => r.endAt === null && r.type !== '').length
