import type { Color } from 'claude-code'
import type { Activity, DiaryDay, Handoff, SessionRecord, Snapshot } from '../types'
import { diaryLine, firstLine } from './diary'
import { clip, dayMs, daysBetween, duration, hhmm, isoDay, oneLine, relDay } from './format'
import { STALE_HANDOFF_DAYS, ageText, resume, resumeCommand, writtenFiles } from './recapModel'
import { shortTitle } from './snapshot'
import type { Strings } from './strings'
import { DIM } from './theme'

// The session registry and the Recap to resume: the session record built from prompts, writes and turn ends;
// the topic; which session is the last; the next step; the texts the buttons prepare in the prompt; the cleanup
// of the store. Pure functions: register.tsx keeps the `session` atom and the store, recapOpen.tsx and
// recapWork.tsx draw.

// The key of a record in the store (`session:<id>`), how many sessions are kept, how many files a record holds.
export const SESSION_KEY = 'session:'
export const KEEP_SESSIONS = 30
export const RECORD_FILES = 20
const PROMPT_CHARS = 160
const TOPIC_CHARS = 80
const RESUME_CHARS = 300
const RESUME_FILES = 5

// A prompt on one line, whitespace collapsed to one space, cut.
export const promptLine = (text: string, n = PROMPT_CHARS): string => clip(oneLine(text).replace(/\s+/g, ' ').trim(), n)

// The topic resumed, if the first prompt is a resume text of the cockpit: the file of `/handoff resume <file>`,
// the title between «» of the Italian prompts ("Riprendiamo «X»…", "Riprendiamo la sessione di … «X»…") or
// between plain double quotes of the English ones ("Let's resume "X"…", "Let's resume the session from … "X"…");
// null otherwise. Keep it in step with session.resume* in strings.*.ts.
export function resumeOf(first: string): string | null {
  const ho = /^\/handoff\s+resume\s+(\S+)/.exec(first)
  if (ho) return ho[1] ?? null
  const it = /^Riprendiamo (?:la sessione di [^«]*)?«([^»]+)»/.exec(first)
  if (it) return it[1] ?? null
  // The title may hold quotes of its own: it ends at the first quote that is followed by ":", "." or the end.
  const en = /^Let's resume (?:the session from [^"]*)?"(.+?)"(?=[:.]|$)/.exec(first)
  return en?.[1] ?? null
}

// A submitted prompt: with the same id it counts it and reopens the record (a record closed by session.end continues),
// otherwise (first time, or after /clear with a new id) a new record.
export function onPromptRecord(cur: SessionRecord | null, id: string, at: number, text: string): SessionRecord {
  if (cur !== null && cur.id === id) return { ...cur, prompts: cur.prompts + 1, endAt: null }
  const firstPrompt = promptLine(text)
  return {
    v: 1, id, startAt: at, lastAt: at, endAt: null, prompts: 1, firstPrompt, resumeOf: resumeOf(firstPrompt),
    files: [], fileCount: 0, handoff: null, diaryDay: null, diaryAt: null, subagents: 0, errors: 0,
  }
}

// The files of a record as the atom `written` (path → time), the most recent first: for a resumed session.
export const recordWritten = (rec: SessionRecord): Record<string, number> =>
  Object.fromEntries(rec.files.map((f, i) => [f, rec.lastAt - i]))

export const addSubagent = (rec: SessionRecord): SessionRecord => ({ ...rec, subagents: rec.subagents + 1 })
export const closeRecord = (rec: SessionRecord, at: number): SessionRecord => ({ ...rec, endAt: at })

// The day of a diary note from its path relative to the root: `<root>/YYYY/MM/YYYY-MM-DD.md`, with the year and
// month of the folder equal to those of the name; null for any other file.
export function diaryDayOf(path: string, root: string): string | null {
  if (!path.startsWith(`${root}/`)) return null
  const m = /^(\d{4})\/(\d{2})\/((\d{4})-(\d{2})-\d{2})\.md$/.exec(path.slice(root.length + 1))
  return m !== null && m[1] === m[4] && m[2] === m[5] ? m[3] ?? null : null
}

// A handoff: a `.md` directly in the Handoff folder.
const isHandoff = (path: string, dir: string): boolean =>
  path.startsWith(`${dir}/`) && path.endsWith('.md') && !path.slice(dir.length + 1).includes('/')

// The writes of a tool.call (main session and subagents): a written handoff becomes the handoff of the
// session (topic and status are read at the end of the turn; the same file holds them), the diary note of the
// day records its day and time. Deletions do not count. Nothing to record: the same object.
export function noteRecordWrites(rec: SessionRecord, writes: readonly Activity[], at: number, roles: Readonly<Record<string, string>>): SessionRecord {
  let out = rec
  for (const a of writes) {
    if (a.verb === 'delete' || a.verb === 'read' || a.verb === 'search' || a.verb === 'shell') continue
    if (roles.Handoff !== undefined && isHandoff(a.path, roles.Handoff) && out.handoff?.file !== a.path) {
      out = { ...out, handoff: { file: a.path, topic: '', status: '' } }
    }
    const day = roles['Daily history'] === undefined ? null : diaryDayOf(a.path, roles['Daily history'])
    if (day !== null && (out.diaryDay !== day || out.diaryAt !== at)) out = { ...out, diaryDay: day, diaryAt: at }
  }
  return out
}

// At the end of a turn of the main loop: the last activity, the files written from the atom `written` (the most
// recent first, at most RECORD_FILES, and how many in all), the handoff's topic and status read now (`meta`,
// null if not read) and an error if the turn did not end with an answer or an interruption by the user.
export function endRecordTurn(rec: SessionRecord, at: number, written: Readonly<Record<string, number>>, reason: string, meta: { topic: string; status: string } | null): SessionRecord {
  const { files, more } = writtenFiles(written, RECORD_FILES)
  const handoff = rec.handoff === null || meta === null ? rec.handoff : { ...rec.handoff, ...meta }
  const isError = reason !== 'answer' && reason !== 'aborted'
  return { ...rec, lastAt: at, files, fileCount: files.length + more, handoff, errors: rec.errors + (isError ? 1 : 0) }
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null)

// A store value as a record: the fields needed to choose (v, id, startAt, lastAt, prompts, files)
// must be there, the others are normalized. null for anything else (a store file written by
// hand, a future version).
export function asRecord(x: unknown): SessionRecord | null {
  if (typeof x !== 'object' || x === null || Array.isArray(x)) return null
  const r = x as Record<string, unknown>
  if (r.v !== 1 || typeof r.id !== 'string' || !isNum(r.startAt) || !isNum(r.lastAt) || !isNum(r.prompts) || !Array.isArray(r.files)) return null
  const files = r.files.filter((f): f is string => typeof f === 'string').slice(0, RECORD_FILES)
  const ho = typeof r.handoff === 'object' && r.handoff !== null ? r.handoff as Record<string, unknown> : null
  const day = str(r.diaryDay)
  return {
    v: 1, id: r.id, startAt: r.startAt, lastAt: r.lastAt, endAt: isNum(r.endAt) ? r.endAt : null, prompts: r.prompts,
    firstPrompt: str(r.firstPrompt) ?? '', resumeOf: str(r.resumeOf), files, fileCount: isNum(r.fileCount) ? r.fileCount : files.length,
    handoff: ho !== null && typeof ho.file === 'string' ? { file: ho.file, topic: str(ho.topic) ?? '', status: str(ho.status) ?? '' } : null,
    diaryDay: day !== null && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null, diaryAt: isNum(r.diaryAt) ? r.diaryAt : null,
    subagents: isNum(r.subagents) ? r.subagents : 0, errors: isNum(r.errors) ? r.errors : 0,
  }
}

// The past sessions: without the current one and without those with zero prompts, most recent first, at most `n`.
export function pastSessions(records: readonly SessionRecord[], currentId: string | null, n = 2): SessionRecord[] {
  return records.filter(r => r.id !== currentId && r.prompts > 0).sort((a, b) => b.lastAt - a.lastAt).slice(0, n)
}

// The `session:` keys to delete: those beyond the `keep` with the highest lastAt (an unreadable value is the
// oldest). The other keys of the store are not touched.
export function staleKeys(entries: readonly { key: string; value: unknown }[], keep = KEEP_SESSIONS): string[] {
  return entries
    .filter(e => e.key.startsWith(SESSION_KEY))
    .map(e => ({ key: e.key, at: asRecord(e.value)?.lastAt ?? -1 }))
    .sort((a, b) => b.at - a.at)
    .slice(keep)
    .map(e => e.key)
}

// The days of the diary notes written by these sessions, once each, in the order of the sessions.
export const diaryDaysOf = (sessions: readonly SessionRecord[]): string[] =>
  [...new Set(sessions.map(r => r.diaryDay).filter((d): d is string => d !== null))]

// The topic of a session: the topic of the handoff it wrote, then the one it resumed (the topic of the handoff
// resumed, if it is among the active ones), then the first prompt, then "untitled session".
export function topicOf(rec: SessionRecord, t: Strings, handoffs: readonly Handoff[] = []): string {
  if (rec.handoff !== null && rec.handoff.topic !== '') return rec.handoff.topic
  if (rec.resumeOf !== null) return handoffs.find(ho => ho.file.replace(/\.md$/, '') === rec.resumeOf)?.topic ?? rec.resumeOf
  if (rec.firstPrompt !== '') return clip(rec.firstPrompt, TOPIC_CHARS)
  return t.session.untitled
}

const endOf = (rec: SessionRecord): number => rec.endAt ?? rec.lastAt

// "yesterday · 09:40–14:28": the relative day of the start and the times; the end is endAt, else the last activity.
export const sessionWhen = (rec: SessionRecord, nowMs: number, t: Strings): string =>
  `${relDay(rec.startAt, nowMs, t.dates)} · ${hhmm(rec.startAt)}–${hhmm(endOf(rec))}`

// "4h48 · 12 files written · handoff completed": duration, files written (if any) and the state of the handoff (if any).
export function sessionFacts(rec: SessionRecord, t: Strings): string {
  const ho = t.session.handoff
  const status = rec.handoff === null ? null : rec.handoff.status === 'completed' ? ho.completed : rec.handoff.status === 'superseded' ? ho.superseded : ho.open
  return [
    duration(endOf(rec) - rec.startAt),
    rec.fileCount > 0 ? t.session.filesWritten(rec.fileCount) : null,
    status,
  ].filter((x): x is string => x !== null).join(' · ')
}

// The facts of This session: "3 turns · 2 files written · 1 subagent" (files and subagents only if there are
// any) and, apart, the errors (null if none).
export function liveFacts(turns: number, files: number, subagents: number, errors: number, t: Strings): { text: string; errors: string | null } {
  const text = [
    t.session.turns(turns),
    files > 0 ? t.session.filesWritten(files) : null,
    subagents > 0 ? t.session.subagents(subagents) : null,
  ].filter((x): x is string => x !== null).join(' · ')
  return { text, errors: errors > 0 ? t.session.errors(errors) : null }
}

// How a session ended: saved in the diary of the day D with the first Closing state entry of the note D (else
// of the Focus; if the note is not among the ones read, "saved in the diary"), or not saved.
export type Closing = { isSaved: false } | { isSaved: true; day: string; line: string }

export function closingOf(rec: SessionRecord, notes: readonly DiaryDay[], t: Strings): Closing {
  if (rec.diaryDay === null) return { isSaved: false }
  const note = notes.find(n => n.day === rec.diaryDay)
  const line = note === undefined ? null : firstLine(note, 'closing') ?? firstLine(note, 'focus')
  return { isSaved: true, day: rec.diaryDay, line: line ?? t.session.savedInDiary }
}

// The time when this session saved today's note; null if it did not save it.
export const savedAt = (rec: SessionRecord | null, nowMs: number): number | null =>
  rec !== null && rec.diaryDay === isoDay(nowMs) ? rec.diaryAt : null

// The Last session of the Recap: the most recent record (without the current session), with the one before it if
// it started the same day; or the last diary note, if it is of a day more recent than the last activity of the
// record or if the registry is empty (a note written by this session does not count). null: nothing.
export type LastSession =
  | { kind: 'record'; rec: SessionRecord; closing: Closing; before: { rec: SessionRecord; closing: Closing } | null }
  | { kind: 'diary'; note: DiaryDay }

export function lastSession(s: Snapshot, current: SessionRecord | null, t: Strings): LastSession | null {
  const recs = (s.sessions ?? []).filter(r => r.id !== current?.id && r.prompts > 0)
  const diary = s.lastDiary ?? null
  const [last, prev] = recs
  if (diary !== null && diary.day !== current?.diaryDay && (last === undefined || diary.day > isoDay(last.lastAt))) return { kind: 'diary', note: diary }
  if (last === undefined) return null
  const notes = [...(s.diaryDays ?? []), ...(diary === null ? [] : [diary])]
  const before = prev !== undefined && isoDay(prev.startAt) === isoDay(last.startAt) ? { rec: prev, closing: closingOf(prev, notes, t) } : null
  return { kind: 'record', rec: last, closing: closingOf(last, notes, t), before }
}

// The text that `Resume this ›` prepares: when, on what and up to RESUME_FILES files written.
export function sessionResume(rec: SessionRecord, nowMs: number, t: Strings, handoffs: readonly Handoff[] = []): string {
  const files = rec.files.slice(0, RESUME_FILES)
  const when = `${relDay(rec.startAt, nowMs, t.dates)} ${hhmm(rec.startAt)}–${hhmm(endOf(rec))}`
  return oneLine(t.session.resumeSession(when, topicOf(rec, t, handoffs), files, rec.fileCount - files.length))
}

// The resume text of a Now item: `Let's resume "title": detail` in English, with the detail cleaned like a diary entry
// (links become their text), all cut to RESUME_CHARS.
export function nowResume(title: string, detail: string, t: Strings): string {
  const d = diaryLine(detail)
  return clip(oneLine(t.session.resumeNow(title, `${d.lead}${d.rest}`.trim())), RESUME_CHARS)
}

// The resume text of the Now item at the given index.
export const nowPrompt = (s: Snapshot, index: number, t: Strings): string =>
  nowResume(s.nowTitles?.[index] ?? shortTitle(s.now?.[index] ?? ''), s.nowDetails?.[index] ?? '', t)

// The deadline of a Now item that is overdue or due today, for the source of the Next step.
const lateText = (due: string, nowMs: number, t: Strings): string => t.session.late(daysBetween(dayMs(due), nowMs))

// The Next step: one thing only, in the first case that holds. The most recent active handoff (detail: the Next
// action, else the Current state), then the Now item that is overdue or due today with the oldest deadline (same
// date: the Future work order), then the first Now item; null: nothing planned. `prompt` is the exact text that
// `Resume ›` puts in the prompt; `others` and `more` are the other open handoffs.
export type NextStep = { title: string; detail: string; prompt: string; source: string; sourceColor: Color; others: Handoff[]; more: number }

export function pickNext(s: Snapshot, nowMs: number, t: Strings): NextStep | null {
  const r = resume(s)
  if (r.main !== null) {
    const ho = r.main
    return {
      title: ho.topic, detail: ho.next ?? ho.state ?? '', prompt: resumeCommand(ho.file), source: t.session.sourceHandoff(ageText(ho.ageDays, t)),
      sourceColor: ho.ageDays >= STALE_HANDOFF_DAYS ? 'warning' : DIM, others: r.others, more: r.more,
    }
  }
  const today = isoDay(nowMs)
  const items = (s.now ?? []).map((_, index) => ({ index, due: s.nowDue?.[index] ?? null }))
  const late = items
    .filter((x): x is { index: number; due: string } => x.due !== null && x.due <= today)
    .sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.index - b.index))[0]
  const pick = late ?? items[0]
  if (pick === undefined) return null
  const title = s.nowTitles?.[pick.index] ?? shortTitle(s.now?.[pick.index] ?? '')
  const label = s.nowLabel ?? 'Now'
  return {
    title, detail: s.nowDetails?.[pick.index] ?? '', prompt: nowPrompt(s, pick.index, t),
    source: late === undefined ? t.session.sourceSection(label) : t.session.sourceLate(label, lateText(late.due, nowMs, t)),
    sourceColor: late === undefined ? DIM : 'error', others: [], more: 0,
  }
}
