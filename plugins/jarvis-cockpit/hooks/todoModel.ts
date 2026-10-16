import type { TodoState } from '../types'
import { basename, copyKeys } from './format'
import { clean, shortTitle } from './snapshot'
import type { Strings } from './strings'

// The To Do tab (the "Future work" source): pure functions, todo.tsx draws them. parseTodo reads the
// file into blocks to draw in the order it is written, each with its whole Markdown; toggleItem,
// addItem and deleteItem prepare checking, adding and deleting on the text reread just before
// writing. If the line is not found they return null: the file changed and the tab says so instead of writing.

export const EMPTY_TODO: TodoState = { path: null, text: null, mtimeMs: 0, size: null, isTooBig: false, error: null, confirm: null, adding: null, note: null }
// How long the delete confirmation stays after the first click on ✕, if the second does not come.
export const CONFIRM_MS = 5000

// An item: a line that starts with `- ` (or `* `) at the start of the line, with the indented lines under it.
// `line`/`raw`: where and how the line was when it was shown; `block`: the whole item as it was in the file (the line and
// the indented ones under it), which the deletion finds identical. `key`: the line's text without the marker and checkbox,
// with the copy number if repeated: the item's buttons keep it even if the file shifts under them. `md`: the
// whole item in Markdown, without the list marker and the checkbox, with the indented lines under it (without their
// common indent).
export type TodoItem = {
  kind: 'item'
  line: number
  raw: string
  block: string
  key: string
  box: 'open' | 'done' | 'none'
  title: string
  md: string
}
// A heading: `##` group, `###` (and deeper) subtitle; `key` is the line, with the copy number if repeated.
// `add`: the add button at the end of the section of the heading at that line. `prose`: a paragraph that is not an item,
// whole in Markdown.
export type TodoHead = { kind: 'group' | 'sub'; line: number; raw: string; title: string; key: string }
export type TodoBlock = TodoHead | TodoItem | { kind: 'prose'; line: number; md: string } | { kind: 'add'; line: number; raw: string; title: string; key: string }
// No backtracking parts: a heading line with thousands of spaces is matched at once (parseTodo runs at
// every draw). headingText removes the closing sequence. `s`: a lone \r stays in the heading.
const HEADING = /^(#{1,6})\s+(.*)$/s
const ITEM = /^[-*]\s+\S/
const INDENTED = /^\s+\S/

// The lines of a text (without the empty line after the final newline), each with its line ending (`\n` or `\r\n`, even
// mixed): a write puts every line back as it was and changes the bytes only of the touched lines. `trail`: the text
// ends with a newline. `eols[i]` is the line ending after `lines[i]` ('' for the last one with no newline).
type Lines = { lines: string[]; eols: string[]; trail: boolean }

function split(text: string): Lines {
  const parts = text.split(/(\r?\n)/)
  const lines = parts.filter((_, i) => i % 2 === 0)
  const eols = parts.filter((_, i) => i % 2 === 1)
  const trail = lines.length > 1 && lines[lines.length - 1] === ''
  if (trail) lines.pop()
  else eols.push('')
  return { lines, eols, trail }
}

// The text as it was: each line with its line ending; where one is missing (a new line after the last one with no newline)
// the first one of the file, or `\n`.
function join(d: Lines): string {
  const first = d.eols.find(e => e !== '') ?? '\n'
  const n = d.lines.length
  return d.lines.map((l, i) => l + (i < n - 1 || d.trail ? (d.eols[i] || first) : '')).join('')
}

// Removes `count` lines from `at`, with their line endings.
function cut(d: Lines, at: number, count: number): void {
  d.lines.splice(at, count)
  d.eols.splice(at, count)
}

// Puts `rows` at `at`: each with the line ending of the line above, or of the one below.
function put(d: Lines, at: number, rows: readonly string[]): void {
  const eol = d.eols[at - 1] || d.eols[at] || (d.eols.find(e => e !== '') ?? '\n')
  d.lines.splice(at, 0, ...rows)
  d.eols.splice(at, 0, ...rows.map(() => eol))
}

// After the frontmatter (`---` … `---` at the top), or 0.
function bodyStart(lines: readonly string[]): number {
  if (lines[0]?.trim() !== '---') return 0
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  return end < 0 ? 0 : end + 1
}

// The line after the last line of an item: the indented lines under it, even after empty lines.
function itemEnd(lines: readonly string[], at: number): number {
  let j = at + 1
  while (j < lines.length) {
    if (INDENTED.test(lines[j] ?? '')) { j++; continue }
    let k = j
    while (k < lines.length && (lines[k] ?? '').trim() === '') k++
    if (k > j && k < lines.length && INDENTED.test(lines[k] ?? '')) { j = k; continue }
    break
  }
  return j
}

// The text of a heading without the closing sequence, as in CommonMark: trailing `#` are removed only if
// preceded by a space (or if the heading is made only of `#`), then trailing spaces. `### C#` stays `C#`.
function headingText(rest: string): string {
  const text = rest.trimEnd()
  let i = text.length
  while (i > 0 && text[i - 1] === '#') i--
  return i < text.length && (i === 0 || /\s/.test(text[i - 1] ?? '')) ? text.slice(0, i).trimEnd() : text
}

// A paragraph that says nothing once cleaned: only `---`, `>`, the marker of a callout, separator lines of
// a table or an empty ``` fence.
function isBlank(para: readonly string[]): boolean {
  return para
    .map(l => l.replace(/^(>\s?)+/, '').replace(/^\[![^\]]*\][+-]?\s*/, '').trim())
    .filter(l => l !== '' && !/^\|?[\s:|-]+\|?$/.test(l))
    .every(l => clean(l) === '')
}

// A paragraph in Markdown: without the `>` of quotes; the title of a callout (`[!info] Title`) in
// bold on its own line.
function proseMd(para: readonly string[]): string {
  return para.flatMap(l => {
    const line = l.replace(/^(>\s?)+/, '')
    const callout = /^\[![^\]]*\][+-]?\s*(.*)$/.exec(line)
    if (callout === null) return [line]
    const title = (callout[1] ?? '').trim()
    return title === '' ? [] : [`**${title}**`, '']
  }).join('\n').trim()
}

// The indented lines under an item without the indent they all have (empty lines stay).
function dedent(lines: readonly string[]): string[] {
  const cut = Math.min(...lines.filter(l => l.trim() !== '').map(l => (/^\s*/.exec(l)?.[0] ?? '').length))
  return lines.map(l => (l.trim() === '' ? '' : l.slice(cut).trimEnd()))
}

export function parseTodo(md: string): TodoBlock[] {
  const { lines } = split(md)
  const out: TodoBlock[] = []
  const itemKey = copyKeys()
  const headKey = copyKeys()
  let section: { head: TodoHead; items: number } | null = null
  let para: string[] = []
  let paraLine = 0
  // A paragraph that stays empty once cleaned (a lone `---` or `>`) makes no row.
  const flush = (): void => {
    if (para.length > 0 && !isBlank(para)) out.push({ kind: 'prose', line: paraLine, md: proseMd(para) })
    para = []
  }
  // The add button at the end of every subsection and of every group with items of its own.
  const close = (): void => {
    if (section !== null && (section.head.kind === 'sub' || section.items > 0)) {
      out.push({ kind: 'add', line: section.head.line, raw: section.head.raw, title: section.head.title, key: section.head.key })
    }
    section = null
  }
  let i = bodyStart(lines)
  while (i < lines.length) {
    const l = lines[i] ?? ''
    const m = HEADING.exec(l)
    if (m) {
      flush()
      close()
      const level = (m[1] ?? '').length
      const key = headKey(l)
      // The `#` heading is not shown: the tab itself is already there.
      if (level >= 2) {
        const head: TodoHead = { kind: level === 2 ? 'group' : 'sub', line: i, raw: l, title: clean(headingText(m[2] ?? '')), key }
        out.push(head)
        section = { head, items: 0 }
      }
      i++
      continue
    }
    if (ITEM.test(l)) {
      flush()
      const end = itemEnd(lines, i)
      const box = /^[-*]\s+\[([ xX])\]/.exec(l)
      const head = l.replace(/^[-*]\s+(\[[ xX]\]\s+)?/, '').trimEnd()
      out.push({
        kind: 'item', line: i, raw: l, block: lines.slice(i, end).join('\n'), key: itemKey(head),
        box: box === null ? 'none' : box[1] === ' ' ? 'open' : 'done',
        title: shortTitle(l),
        md: [head, ...dedent(lines.slice(i + 1, end))].join('\n'),
      })
      if (section !== null) section.items++
      i = end
      continue
    }
    if (l.trim() === '') flush()
    else {
      if (para.length === 0) paraLine = i
      para.push(l)
    }
    i++
  }
  flush()
  close()
  return out
}

// The line as it was when shown: at the same number, or the only identical line in the file. null if it is no
// longer there or if there is more than one.
export function findLine(lines: readonly string[], at: number, raw: string): number | null {
  if (lines[at] === raw) return at
  const same = lines.flatMap((l, i) => (l === raw ? [i] : []))
  return same.length === 1 ? (same[0] ?? null) : null
}

// The heading of the add field in the current text, like findLine: the line, or null if it is gone or duplicated.
export const findHead = (text: string, head: { line: number; raw: string }): number | null => findLine(split(text).lines, head.line, head.raw)

// The check: `[ ]` → `[x]`, `[x]`/`[X]` → `[ ]`, no checkbox → `[x]` in front of the text. Only that line.
export function toggleItem(text: string, item: { line: number; raw: string }): string | null {
  const d = split(text)
  const i = findLine(d.lines, item.line, item.raw)
  if (i === null) return null
  const l = d.lines[i] ?? ''
  const box = /^([-*]\s+)\[([ xX])\]/.exec(l)
  d.lines[i] = box ? `${box[1]}[${box[2] === ' ' ? 'x' : ' '}]${l.slice(box[0].length)}` : l.replace(/^([-*]\s+)/, '$1[x] ')
  return join(d)
}

// The deletion: the item and its indented lines leave the file, only if they are still what the user saw
// (`block`). A line added, removed or changed under the item by another chat: null. If two empty lines
// are left above and below, one stays.
export function deleteItem(text: string, item: { line: number; raw: string; block: string }): string | null {
  const d = split(text)
  const { lines } = d
  const i = findLine(lines, item.line, item.raw)
  if (i === null) return null
  const end = itemEnd(lines, i)
  if (lines.slice(i, end).join('\n') !== item.block) return null
  cut(d, i, end - i)
  if (i > 0 && (lines[i - 1] ?? '').trim() === '' && (lines[i] ?? '').trim() === '' && i < lines.length) cut(d, i, 1)
  return join(d)
}

// The text of a new item: a single line, without extra spaces. '' is not written.
export const cleanEntry = (entry: string): string => entry.replace(/\s+/g, ' ').trim()

// The add: `- [ ] text` right after the last item of the section of the heading (up to the next heading,
// of any level); if the section has no items, after the heading and an empty line.
export function addItem(text: string, head: { line: number; raw: string }, entry: string): string | null {
  const value = cleanEntry(entry)
  if (value === '') return null
  const d = split(text)
  const { lines } = d
  const at = findLine(lines, head.line, head.raw)
  if (at === null) return null
  let end = at + 1
  while (end < lines.length && !HEADING.test(lines[end] ?? '')) end++
  let last: number | null = null
  for (let i = at + 1; i < end; i++) if (ITEM.test(lines[i] ?? '')) last = i
  const row = `- [ ] ${value}`
  if (last !== null) {
    put(d, itemEnd(lines, last), [row])
    return join(d)
  }
  let pos = at + 1
  const add = (lines[pos] ?? '').trim() === '' && pos < lines.length ? (pos++, [row]) : ['', row]
  if (pos < lines.length && (lines[pos] ?? '').trim() !== '') add.push('')
  put(d, pos, add)
  return join(d)
}

// The tab's label: the file name without .md; technical names take the catalog's To Do name.
export function todoLabel(path: string, t: Strings): string {
  const name = basename(path).replace(/\.md$/i, '')
  return /^(todo|to-do|to_do|tasks)$/i.test(name) ? t.todo.name : name
}
