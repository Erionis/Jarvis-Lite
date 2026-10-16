import type { DiaryDay, DiaryLine, DiaryNote, DiaryPart, DiaryState } from '../types'
import { clip, daysBetween, longDay } from './format'
import type { Strings } from './strings'

// The diary notes of the Recap and the Diary tab: the latest note up to and including today, reduced to its
// sections. Pure functions: register.tsx (through loadSnapshot) reads the files, here we pick the note and
// extract Focus, Done, Decisions and Closing state (how the day ended, for the Recap's Last session).
// Then the Diary tab: the notes up to today, which one to show and the title; register.tsx reads the folders.

// The sections shown, in this order: the accepted `##` headings (the Jarvis Lite ones too) and which end the
// lines are taken from. The first ones for Focus and Closing state, the last ones for Done and Decisions:
// how the day ended.
const PARTS: readonly { part: DiaryPart['part']; head: RegExp; from: 'start' | 'end' }[] = [
  { part: 'focus', head: /^focus\b/i, from: 'start' },
  { part: 'done', head: /^(fatto|done)\b/i, from: 'end' },
  { part: 'decisions', head: /^(decisioni|decisions)\b/i, from: 'end' },
  { part: 'closing', head: /^(stato di chiusura|closing state)\b/i, from: 'start' },
]
export const DIARY_SHOWN = 3
// A line is cut anyway in the drawing; this limit keeps the drawn text short.
const LINE_CHARS = 200
const NOTE = /^(\d{4}-\d{2}-\d{2})\.md$/

// The day of the most recent note before `today` (ISO) among these file names, or up to and including today
// with `inclusive`; null if there is none.
export function previousDiary(names: readonly string[], today: string, inclusive = false): string | null {
  const days = names.map(n => NOTE.exec(n)?.[1]).filter((d): d is string => d !== undefined && (d < today || (inclusive && d === today))).sort()
  return days[days.length - 1] ?? null
}

// A top-level entry on one line: links become their text, the leading bold stays bold (`lead`), the other
// markdown marks are removed.
export function diaryLine(raw: string): DiaryLine {
  const text = raw
    .replace(/^[-*]\s+(\[[ xX]\]\s+)?/, '')
    .replace(/!?\[([^\]]*)\]\((?:<[^>]*>|(?:[^()]|\([^()]*\))*)\)/g, '$1')
    .replace(/\[\[[^\]|]*\|([^\]]+)\]\]/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/`/g, '')
    .trim()
  const bold = /^\*\*(.+?)\*\*/.exec(text)
  const rest = (bold ? text.slice(bold[0].length) : text).replace(/\*\*|__/g, '')
  return { lead: clip(bold?.[1] ?? '', LINE_CHARS), rest: clip(rest, LINE_CHARS) }
}

// Focus, Done, Decisions and Closing state of the note, only those with entries. A section runs from its `##`
// to the next level-1 or level-2 heading; only entries at the start of a line count (indented ones do not).
export function parseDiary(md: string): DiaryPart[] {
  const found = new Map<DiaryPart['part'], string[]>()
  let current: string[] | null = null
  for (const line of md.split(/\r?\n/)) {
    const head = /^(#+)\s+(.*?)\s*$/.exec(line)
    if (head && (head[1] ?? '').length <= 2) {
      const part = head[1] === '##' ? PARTS.find(p => p.head.test(head[2] ?? '')) : undefined
      current = part !== undefined && !found.has(part.part) ? [] : null
      if (part !== undefined && current !== null) found.set(part.part, current)
      continue
    }
    if (current !== null && /^[-*]\s+\S/.test(line)) current.push(line)
  }
  return PARTS.flatMap(p => {
    const items = found.get(p.part) ?? []
    if (items.length === 0) return []
    const shown = p.from === 'start' ? items.slice(0, DIARY_SHOWN) : items.slice(-DIARY_SHOWN)
    return [{ part: p.part, lines: shown.map(diaryLine), more: Math.max(0, items.length - DIARY_SHOWN) }]
  })
}

// The Diary tab before it looks for the notes.
export const EMPTY_DIARY: DiaryState = { notes: null, day: null, text: null, isTooBig: false, error: null }

// The notes up to today among the file names of these folders, oldest first. A day in two folders counts once,
// in the first folder given (register.tsx gives the months first, then the root).
export function diaryNotes(dirs: readonly { dir: string; names: readonly string[] }[], today: string): DiaryNote[] {
  const found = new Map<string, string>()
  for (const d of dirs) {
    for (const name of d.names) {
      const day = NOTE.exec(name)?.[1]
      if (day !== undefined && day <= today && !found.has(day)) found.set(day, `${d.dir}/${name}`)
    }
  }
  return [...found].sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, path]) => ({ day, path }))
}

// The note the tab opens by itself: the last one before today, or today's if it is the only one.
export function defaultDay(notes: readonly DiaryNote[], today: string): string | null {
  return previousDiary(notes.map(n => `${n.day}.md`), today) ?? notes[notes.length - 1]?.day ?? null
}

// The note before (-1) or after (1) the one of the given day; null if there is none.
export function stepDay(notes: readonly DiaryNote[], day: string, by: -1 | 1): string | null {
  const i = notes.findIndex(n => n.day === day)
  return i < 0 ? null : notes[i + by]?.day ?? null
}

// The title of the note in the tab: the full date, with "today" or "yesterday" when it is.
export function diaryTitle(day: string, nowMs: number, t: Strings): string {
  const [y = 0, m = 1, d = 1] = day.split('-').map(Number)
  const at = new Date(y, m - 1, d).getTime()
  const days = daysBetween(at, nowMs)
  return `${longDay(at, t.dates)}${days === 0 ? ` · ${t.dates.today}` : days === 1 ? ` · ${t.dates.yesterday}` : ''}`
}

// The first entry of a part of the note on one line (leading bold included); null if the part is missing.
export function firstLine(note: DiaryDay, part: DiaryPart['part']): string | null {
  const l = note.parts.find(p => p.part === part)?.lines[0]
  return l === undefined ? null : `${l.lead}${l.rest}`.trim() || null
}

// A note already read: null if it has none of the sections.
export function diaryDay(day: string, path: string, md: string): DiaryDay | null {
  const parts = parseDiary(md)
  return parts.length === 0 ? null : { day, path, parts }
}
