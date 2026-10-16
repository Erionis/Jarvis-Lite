import type { DiaryDay, Handoff, SessionRecord, Snapshot, Sources, WaitingItem } from '../types'
import { diaryDay, previousDiary } from './diary'
import { basename, clip, daysBetween, isoDay } from './format'

function section(lines: string[], heading: RegExp): string[] | null {
  const i = lines.findIndex(l => heading.test(l))
  if (i < 0) return null
  const level = (/^#+/.exec(lines[i] ?? '') ?? ['#'])[0].length
  const out: string[] = []
  for (let j = i + 1; j < lines.length; j++) {
    const line = lines[j] ?? ''
    const head = line.match(/^(#+)\s/)
    if (head && (head[1] ?? '').length <= level) break
    out.push(line)
  }
  return out
}

// A line without Markdown: without the list marker and checkbox, links turned into text, without bold and code.
export const clean = (line: string): string =>
  line
    .replace(/^[-*]\s+(\[[ xX]\]\s+)?/, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\*\*|__|`/g, '')
    .trim()

const bullets = (lines: string[]): string[] => lines.filter(l => /^[-*]\s+\S/.test(l))
const topBullets = (lines: string[]): string[] => bullets(lines).map(clean)

const MAX_AHEAD_DAYS = 183

// Due date of an item: the first d/m(/yyyy) date in the short title (the bold text, or the text up to the
// first " — "). The body stays out: "audit of 25/09" and "E 2/3 PASS" are references, not deadlines.
// Without a year the current year applies, or the previous one if it would fall more than six months in the future.
export function dueDate(line: string, nowMs: number): string | null {
  const m = shortTitle(line).match(/(?<![\d/#])(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?(?![\d/])/)
  if (!m) return null
  const day = Number(m[1]); const month = Number(m[2])
  if (day < 1 || day > 31 || month < 1 || month > 12) return null
  const today = new Date(nowMs)
  let year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : today.getFullYear()
  if (!m[3] && daysBetween(nowMs, new Date(year, month - 1, day).getTime()) > MAX_AHEAD_DAYS) year -= 1
  const d = new Date(year, month - 1, day)
  if (d.getMonth() !== month - 1) return null
  return isoDay(d.getTime())
}

export type Focus = { now: string[] | null; label: string | null; titles: string[]; details: string[]; due: (string | null)[]; waiting: number; waitingLines: string[] }
const NO_FOCUS: Focus = { now: null, label: null, titles: [], details: [], due: [], waiting: 0, waitingLines: [] }

// Short title of a Now item: the bold text the item starts with (the Future work convention
// is "**Title** — description"); without a leading bold, the text up to the first " — " or " – ".
// Without Markdown.
export function shortTitle(line: string): string {
  const bold = /^\s*(?:[-*+]\s+)?(?:\[[ xX]\]\s+)?\*\*(.+?)\*\*/.exec(line)
  if (bold) return clean(bold[1] ?? '')
  return (clean(line).split(/ [—–] /)[0] ?? '').trim()
}

const DETAIL_CHARS = 120

// The detail of a Now item: the text after the short title, on one line, without Markdown or
// links, without the leading separator (" — ", " – ", ":") and cut to DETAIL_CHARS. '' if there is none.
export function shortDetail(line: string): string {
  const bold = /^\s*(?:[-*+]\s+)?(?:\[[ xX]\]\s+)?\*\*(.+?)\*\*(.*)$/.exec(line)
  let rest = ''
  if (bold) rest = bold[2] ?? ''
  else {
    const text = clean(line)
    const sep = / [—–] /.exec(text)
    rest = sep ? text.slice(sep.index + sep[0].length) : ''
  }
  return clip(clean(rest.replace(/^[\s—–:]+/, '')), DETAIL_CHARS)
}

export function parseFocus(md: string, nowMs: number): Focus {
  const lines = md.split('\n')
  // The Future work sections: Now or Active, and Waiting (Italian names too).
  const NOW = /^#{2,4}\s+(Now|Active|Attive|Attivi|In corso|Adesso)\b/i
  const now = section(lines, NOW)
  // The section name as the user writes it: the Recap uses it for the card and the counter.
  const label = lines.map(l => NOW.exec(l)?.[1]).find(x => x !== undefined) ?? null
  const waiting = section(lines, /^#{2,4}\s+(Waiting|In attesa)\b/i)
  const raw = now ? bullets(now) : []
  const waitingLines = waiting ? bullets(waiting) : []
  return {
    now: now ? raw.map(clean) : null,
    label,
    titles: raw.map(shortTitle),
    details: raw.map(shortDetail),
    due: raw.map(l => dueDate(l, nowMs)),
    waiting: waitingLines.length,
    waitingLines,
  }
}

// The title of an item: the bold text if there is one, otherwise the whole item.
export function itemTitle(line: string): string {
  const bold = line.match(/\*\*(.+?)\*\*/)
  return clean(bold ? (bold[1] ?? '') : line)
}

// `git blame --line-porcelain`: for each line of the file, when it was last touched.
export function parseBlame(porcelain: string): Map<string, number> {
  const out = new Map<string, number>()
  let time: number | null = null
  for (const line of porcelain.split('\n')) {
    if (line.startsWith('author-time ')) time = Number(line.slice(12)) * 1000
    else if (line.startsWith('\t')) {
      if (time !== null && Number.isFinite(time)) out.set(line.slice(1), time)
      time = null
    }
  }
  return out
}

export function waitingItems(lines: string[], touched: Map<string, number>, nowMs: number): WaitingItem[] {
  const items = lines.map(l => {
    const t = touched.get(l)
    return { title: itemTitle(l), ageDays: t === undefined ? null : daysBetween(t, nowMs) }
  })
  return items.sort((a, b) => (b.ageDays ?? -1) - (a.ageDays ?? -1))
}

function frontmatter(md: string): Record<string, string> {
  const m = md.match(/^---\n([\s\S]*?)\n---/)
  const out: Record<string, string> = {}
  if (!m) return out
  for (const line of (m[1] ?? '').split('\n')) {
    const kv = line.match(/^(\w+):\s*(.*)$/)
    if (kv && kv[1] !== undefined) out[kv[1]] = (kv[2] ?? '').trim()
  }
  return out
}

const STEP_CHARS = 140
const STATE_CHARS = 220

// The first paragraph (or the first list item) after line `at`, up to an empty line or a
// heading; cleaned of Markdown. '' if there is none.
function firstParagraph(lines: readonly string[], at: number): string {
  const out: string[] = []
  for (const line of lines.slice(at + 1)) {
    if (/^#{1,6}\s/.test(line)) break
    const isItem = /^\s*(?:[-*+]|\d+[.)])\s+/.test(line)
    if (line.trim() === '' || (isItem && out.length > 0)) {
      if (out.length > 0) break
      continue
    }
    out.push(line.trim())
  }
  return clean(out.join(' ').replace(/^\d+[.)]\s+/, '- '))
}

// The declared next step: the first paragraph or the first item under "## Prossima azione" or "## Next action"
// (also "Prossimi passi", "Prossimo step", "Next step", and with "###"), cleaned and cut to one Recap line.
export function nextStep(md: string): string | null {
  const lines = md.split(/\r?\n/)
  const at = lines.findIndex(l => /^#{2,3}\s+(Prossim[aoie]\s+(azion[ei]|pass[oi]|step)|Next\s+(action|step)s?)/i.test(l))
  if (at < 0) return null
  const text = firstParagraph(lines, at)
  return text === '' ? null : clip(text, STEP_CHARS)
}

// Where the handoff says how far the work is: the whole first paragraph under the first
// "## Stato corrente…" (or "## Current state"), cleaned and cut to STATE_CHARS.
export function stateStep(md: string): string | null {
  const lines = md.split(/\r?\n/)
  const at = lines.findIndex(l => /^##\s+(Stato corrente|Current state)/i.test(l))
  if (at < 0) return null
  const text = firstParagraph(lines, at)
  return text === '' ? null : clip(text, STATE_CHARS)
}

// The Recap's Next step shows the Next action (`next`), otherwise the Current state (`state`).
export function parseHandoff(md: string, file: string, nowMs: number): Handoff | null {
  const fm = frontmatter(md)
  if (!['active', 'open', 'pending'].includes(fm.status ?? '')) return null
  const stamp = Date.parse((fm.updated || fm.created || '').replace(' ', 'T'))
  const next = nextStep(md)
  const state = stateStep(md)
  return {
    file,
    topic: fm.topic || file.replace(/\.md$/, ''),
    ageDays: Number.isNaN(stamp) ? 0 : daysBetween(stamp, nowMs),
    ...(next === null ? {} : { next }),
    ...(state === null ? {} : { state }),
  }
}

// Topic and status of a handoff written in the session, whatever its state (completed too): the session
// registry reads them at the end of the turn. Without a topic, the file name.
export function handoffMeta(md: string, file: string): { topic: string; status: string } {
  const fm = frontmatter(md)
  return { topic: fm.topic || basename(file).replace(/\.md$/, ''), status: fm.status ?? '' }
}

export function latestDiary(names: string[]): string | null {
  const days = names.filter(n => /^\d{4}-\d{2}-\d{2}\.md$/.test(n)).map(n => n.slice(0, 10)).sort()
  return days[days.length - 1] ?? null
}

// The year/month diary folders to look in: the current month and the previous one.
function monthDirs(root: string, nowMs: number): string[] {
  const d = new Date(nowMs)
  return [0, 1].map(back => {
    const m = new Date(d.getFullYear(), d.getMonth() - back, 1)
    return `${root}/${m.getFullYear()}/${String(m.getMonth() + 1).padStart(2, '0')}`
  })
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn() } catch { return fallback }
}

// The validator does not follow `$` through an import: register.tsx builds these read-only
// accesses (closures over `$.fs`) and passes them here in place of `$`.
export type SnapshotFs = {
  exists: (path: string) => Promise<boolean>
  read: (path: string) => Promise<string>
  list: (path: string) => Promise<{ name: string; kind: 'file' | 'dir' | 'other'; size: number; mtimeMs: number }[]>
  stat: (path: string) => Promise<{ size: number }>
  // Optional: the text of `git blame --line-porcelain` for the file, '' if not available.
  blame?: (path: string) => Promise<string>
}

// Beyond this limit a file is not read: the section comes out as unavailable.
export const MAX_READ_BYTES = 512 * 1024

// What the session registry gives to the snapshot: the past sessions (most recent first) and the days
// of the diary notes they wrote, in the same order.
// `sessions` is most recent first: `pastSessions` orders it and `lastSession` relies on this order.
export type SessionsInput = { sessions: readonly SessionRecord[]; diaryDays: readonly string[] }
export const NO_SESSIONS: SessionsInput = { sessions: [], diaryDays: [] }
// How many notes of the registry's days are read: that of the last session and that of the session before.
const DIARY_DAYS = 2

// The last diary note up to and including today, in the folders of the two months and in the root, read: null
// if there is none, if it is too big, if it cannot be read or if it has no sections.
async function lastNote(fs: SnapshotFs, at: (rel: string) => string, root: string, nowMs: number): Promise<DiaryDay | null> {
  const today = isoDay(nowMs)
  return safe(async () => {
    let best: { day: string; path: string; size: number } | null = null
    for (const dir of [...monthDirs(root, nowMs), root]) {
      const files = (await safe(() => fs.list(at(dir)), [])).filter(x => x.kind === 'file')
      const day = previousDiary(files.map(x => x.name), today, true)
      if (day === null || (best !== null && day <= best.day)) continue
      best = { day, path: `${dir}/${day}.md`, size: files.find(x => x.name === `${day}.md`)?.size ?? 0 }
    }
    if (best === null || best.size > MAX_READ_BYTES) return null
    return diaryDay(best.day, best.path, await fs.read(at(best.path)))
  }, null)
}

// The note of a day in its month folder (`YYYY/MM/YYYY-MM-DD.md`, as the registry recognizes it).
async function noteOf(fs: SnapshotFs, at: (rel: string) => string, root: string, day: string): Promise<DiaryDay | null> {
  const path = `${root}/${day.slice(0, 4)}/${day.slice(5, 7)}/${day}.md`
  return safe(async () => ((await fs.stat(at(path))).size > MAX_READ_BYTES ? null : diaryDay(day, path, await fs.read(at(path)))), null)
}

export async function loadSnapshot(fs: SnapshotFs, s: Sources, nowMs: number, reg: SessionsInput = NO_SESSIONS): Promise<Snapshot> {
  const at = (rel: string): string => `${s.root}/${rel}`
  const role = (name: string): string | undefined => s.roles[name]

  const missing: string[] = []
  for (const [name, rel] of Object.entries(s.roles)) {
    if (!(await safe(() => fs.exists(at(rel)), false))) missing.push(name)
  }

  const loops = role('Future work')
  const focus = loops
    ? await safe(async () => {
        if ((await fs.stat(at(loops))).size > MAX_READ_BYTES) return NO_FOCUS
        return parseFocus(await fs.read(at(loops)), nowMs)
      }, NO_FOCUS)
    : NO_FOCUS
  const blame = fs.blame
  const lineTimes = loops && blame && focus.waitingLines.length > 0
    ? await safe(async () => parseBlame(await blame(at(loops))), new Map<string, number>())
    : new Map<string, number>()

  const hoDir = role('Handoff')
  const handoffs: Handoff[] = hoDir
    ? await safe(async () => {
        const list = await fs.list(at(hoDir))
        const found: Handoff[] = []
        for (const f of list.filter(x => x.kind === 'file' && x.name.endsWith('.md') && x.size <= MAX_READ_BYTES)) {
          try {
            const ho = parseHandoff(await fs.read(at(`${hoDir}/${f.name}`)), f.name, nowMs)
            if (ho) found.push(ho)
          } catch { /* unreadable file: skipped, the others stay */ }
        }
        return found.sort((a, b) => a.ageDays - b.ageDays)
      }, [])
    : []

  const inDir = role('Inbox')
  const inbox = inDir
    ? await safe(async () => {
        const list = (await fs.list(at(inDir))).filter(x => !x.name.startsWith('.') && x.kind !== 'dir')
        const oldest = list.length ? Math.min(...list.map(x => x.mtimeMs)) : null
        return { count: list.length, oldestDays: oldest === null ? null : daysBetween(oldest, nowMs) }
      }, null)
    : null

  const diaryRoot = role('Daily history')
  const today = isoDay(nowMs)
  const diary = diaryRoot
    ? await safe(async () => {
        let last: string | null = null
        for (const dir of monthDirs(diaryRoot, nowMs)) {
          if (!(await fs.exists(at(dir)))) continue
          last = latestDiary((await fs.list(at(dir))).map(x => x.name))
          if (last) break
        }
        return { hasToday: last === today, last }
      }, null)
    : null
  // The last note, up to and including today; then the notes of the registry's days (one already read is not read again).
  const lastDiary = diaryRoot ? await lastNote(fs, at, diaryRoot, nowMs) : null
  const diaryDays: DiaryDay[] = []
  for (const day of diaryRoot ? reg.diaryDays.slice(0, DIARY_DAYS) : []) {
    const note = lastDiary?.day === day ? lastDiary : await noteOf(fs, at, diaryRoot!, day)
    if (note !== null) diaryDays.push(note)
  }

  return {
    takenAt: nowMs,
    hasTable: s.hasTable,
    missing,
    now: focus.now,
    ...(focus.label === null ? {} : { nowLabel: focus.label }),
    nowTitles: focus.titles,
    nowDetails: focus.details,
    nowDue: focus.due,
    waiting: focus.waiting,
    waitingItems: waitingItems(focus.waitingLines, lineTimes, nowMs),
    handoffs,
    inbox,
    diary,
    lastDiary,
    diaryDays,
    sessions: [...reg.sessions],
  }
}
