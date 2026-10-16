import type { Activity, Touched } from '../types'
import { basename, hhmm } from './format'
import { GLYPH, WRITES } from './theme'
import { PROTECTED_ROLES, roleLabel } from './sources'
import type { Strings } from './strings'

export const MAX_FEED = 200

const coalesces = (x: Activity, y: Activity): boolean =>
  (y.verb === 'read' || y.verb === 'search') &&
  x.verb === y.verb && x.path === y.path && x.turn === y.turn &&
  x.agent === y.agent && x.detail === y.detail

export function pushActivity(feed: readonly Activity[], a: Activity): Activity[] {
  const last = feed[feed.length - 1]
  if (last && coalesces(last, a)) {
    return [...feed.slice(0, -1), { ...last, at: a.at, count: last.count + a.count }]
  }
  return [...feed, a].slice(-MAX_FEED)
}

export function statusText(feed: readonly Activity[], turn: number): string | undefined {
  const lastWrite = [...feed].reverse().find(x => x.turn === turn && WRITES.has(x.verb))
  const pick = lastWrite ?? feed[feed.length - 1]
  if (!pick) return undefined
  const d = pick.detail ?? ''
  // At the root the basename would be `.`: for shell and search we show what was run or searched.
  const what = pick.verb === 'shell' ? (d.length > 30 ? `${d.slice(0, 29)}…` : d)
    : pick.verb === 'search' && pick.path === '.' && d ? `"${d}"`
    : basename(pick.path)
  return `◆ Jarvis · ${GLYPH[pick.verb]} ${what} · ${hhmm(pick.at)}`
}

// Labels of the protected sources, as the feed writes them (in the catalog's language); the profile and the core included.
const protectedLabels = (t: Strings): ReadonlySet<string> => new Set([t.log.profile, t.log.core, ...PROTECTED_ROLES.map(r => roleLabel(r, t))])

// The second-brain sources written in this session: a move counts for the source it came from too.
export function addTouched(list: readonly Touched[], acts: readonly Activity[], t: Strings): Touched[] {
  const out = list.map(x => ({ ...x }))
  const isProtectedLabel = protectedLabels(t)
  for (const a of acts) {
    if (!WRITES.has(a.verb)) continue
    for (const role of [a.role, a.fromRole]) {
      if (role === undefined) continue
      const hit = out.find(x => x.role === role)
      if (hit) hit.count += 1
      else out.push({ role, count: 1, isProtected: isProtectedLabel.has(role) })
    }
  }
  return out
}

// Files written by Jarvis in this session with the time of the last write: a deleted file drops out, a moved
// one changes name.
export function addWritten(w: Readonly<Record<string, number>>, acts: readonly Activity[]): Record<string, number> {
  const out: Record<string, number> = { ...w }
  for (const a of acts) {
    if (!WRITES.has(a.verb) || a.path === '.') continue
    if (a.verb === 'delete') {
      delete out[a.path]
      continue
    }
    if (a.verb === 'move' && a.from !== undefined) delete out[a.from]
    out[a.path] = a.at
  }
  return out
}
