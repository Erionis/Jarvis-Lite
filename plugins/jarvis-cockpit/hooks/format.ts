import type { DateWords } from './strings'

const pad = (n: number): string => String(n).padStart(2, '0')

// Cut with an ellipsis at the n-th position, on code points (an emoji is not split).
export function clip(s: string, n: number): string {
  const chars = [...s]
  return chars.length > n ? `${chars.slice(0, n - 1).join('')}…` : s
}

// Among the control characters the engine draws only tab and newline: a Markdown or Code with a \r (a file
// written on Windows) made the whole pane get rejected. The \r becomes a line break, the others become �.
export const drawable = (s: string): string => s.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '\uFFFD')
// A string from a file or a file name that goes into a Text, a Button or an Svg: on one line, with no control
// characters. A name like macOS's `Icon\r` made the whole pane get rejected.
export const oneLine = (s: string): string => drawable(s).replace(/[\n\t]/g, ' ')

// A text from a file that goes into a button or block key: the engine rejects control characters in a key (a
// Markdown with `\x1b` in the text of an entry made the whole pane get rejected), but `oneLine` merges them
// into a single � and two different texts would get the same key: a click would go to the wrong row. Here
// every control (tab and newline included) becomes the visible escape `\u001b` and the backslash is doubled:
// no control in the result and two different texts never give the same key.
export const keyText = (s: string): string =>
  s.replace(/[\\\u0000-\u001f\u007f-\u009f]/g, c => (c === '\\' ? '\\\\' : `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`))

// The key of a text in a list: the text (`keyText`), and from the second copy on the number after the two
// characters `\n` (backslash and n). After `keyText` a backslash is always followed by another backslash or by
// `u`, so that mark never appears in a text key and two text-copy pairs are never confused. A click presses
// the entry that was seen, even if another one is added above it.
export function copyKeys(): (text: string) => string {
  const seen = new Map<string, number>()
  return text => {
    const base = keyText(text)
    const n = (seen.get(base) ?? 0) + 1
    seen.set(base, n)
    return n === 1 ? base : `${base}\\n${n}`
  }
}

// The message of an error, whatever was thrown.
export const errText = (err: unknown): string => (err instanceof Error ? err.message : String(err))
export const basename = (p: string): string => p.slice(p.lastIndexOf('/') + 1)
export const dirname = (p: string): string => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '')
export const hhmm = (ms: number): string => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}` }
// The day and month words come from the language's catalog (strings.*.ts), never from Intl: the result is the same on every machine.
export const dayLabel = (ms: number, w: DateWords): string => { const d = new Date(ms); return `${w.days[d.getDay()]} ${d.getDate()} ${w.months[d.getMonth()]}` }
// "Sunday 11 October" or "Domenica 11 ottobre": the weekday and the full date.
export const longDay = (ms: number, w: DateWords): string => { const d = new Date(ms); return `${w.daysLong[d.getDay()]} ${d.getDate()} ${w.monthsLong[d.getMonth()]}` }
export const isoDay = (ms: number): string => { const d = new Date(ms); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` }
export const shortDay = (iso: string, w: DateWords): string => { const [, m = 0, d] = iso.split('-').map(Number); return `${d} ${w.months[m - 1]}` }

export function daysBetween(fromMs: number, toMs: number): number {
  const a = new Date(fromMs); const b = new Date(toMs)
  const start = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  const end = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime()
  return Math.round((end - start) / 86_400_000)
}

// How long something lasts: "45s", "3m", "2h10".
export function duration(ms: number): string {
  if (ms < 60_000) return `${Math.max(0, Math.floor(ms / 1000))}s`
  const min = Math.floor(ms / 60_000)
  return min < 60 ? `${min}m` : `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
}

export const weekday = (iso: string, w: DateWords): string => { const [y = 0, m = 1, d = 1] = iso.split('-').map(Number); return w.days[new Date(y, m - 1, d).getDay()] ?? '' }

// How long a turn lasted, with the seconds: "45s", "3m10", "4h48".
export function span(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const min = Math.floor(s / 60)
  return min < 60 ? `${min}m${pad(s % 60)}` : `${Math.floor(min / 60)}h${pad(min % 60)}`
}

// The day of a time relative to today: "today", "yesterday", the weekday within six days ("Mon 12"),
// then the short date ("8 Oct"); in Italian "oggi", "ieri", "lun 12", "8 ott".
export function relDay(ms: number, nowMs: number, w: DateWords): string {
  const days = daysBetween(ms, nowMs)
  if (days <= 0) return w.today
  if (days === 1) return w.yesterday
  const iso = isoDay(ms)
  return days <= 6 ? `${weekday(iso, w)} ${new Date(ms).getDate()}` : shortDay(iso, w)
}

// The local midnight of an ISO day.
export const dayMs = (iso: string): number => { const [y = 0, m = 1, d = 1] = iso.split('-').map(Number); return new Date(y, m - 1, d).getTime() }
