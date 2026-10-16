// Raw Markdown editor: pure operations on lines and cursor, a fixed window, undo and redo.
// Used by editor.tsx (the Client). No `$` and no measurement of the surface, except pointAt, which is only
// called from the click handler (never from the drawing).

export type KeyEv = { key: string; ctrl?: true; shift?: true; meta?: true }
export type Doc = { lines: string[]; row: number; col: number }
export type Ed = Doc & {
  // First logical line drawn.
  top: number
  undo: Doc[]
  redo: Doc[]
  // The last action was a typed character: the next one goes into the same step.
  typing: boolean
}
export type Act = 'none' | 'move' | 'edit' | 'save' | 'paste'
export type Out = { ed: Ed; act: Act }

// Logical lines drawn: always this many, whatever the size of the pane.
export const VIEW = 28
// Rows of margin between the cursor and the edge of the window.
export const SCROLLOFF = 3
export const MAX_UNDO = 200
// Columns of the numbering: four digits and a space.
export const GUTTER = 5
// Beyond this many characters a line is cut in the drawing; the cursor's line keeps more.
export const LINE_CLIP = 400
export const CURSOR_CLIP = 4000

const SPECIAL: ReadonlySet<string> = new Set([
  'up', 'down', 'left', 'right', 'return', 'enter', 'tab', 'backspace', 'delete', 'pageup', 'pagedown', 'home', 'end', 'escape',
])

const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n))
const snap = (ed: Doc): Doc => ({ lines: ed.lines, row: ed.row, col: ed.col })

// A character outside the BMP (e.g. an emoji) is a surrogate pair: two code units.
const isHigh = (c: number): boolean => c >= 0xd800 && c <= 0xdbff
const isLow = (c: number): boolean => c >= 0xdc00 && c <= 0xdfff
// Code units taken by the character before `col`.
const widthBefore = (s: string, col: number): number =>
  col >= 2 && isLow(s.charCodeAt(col - 1)) && isHigh(s.charCodeAt(col - 2)) ? 2 : 1
// Code units taken by the character that starts at `col`.
const widthAt = (s: string, col: number): number =>
  col + 1 < s.length && isHigh(s.charCodeAt(col)) && isLow(s.charCodeAt(col + 1)) ? 2 : 1
// A column between the two halves of a surrogate pair: moves it to the start of the pair.
const snapCol = (s: string, col: number): number =>
  col > 0 && col < s.length && isHigh(s.charCodeAt(col - 1)) && isLow(s.charCodeAt(col)) ? col - 1 : col

export function fromText(text: string, row = 0, col = 0): Ed {
  const lines = text.split('\n')
  const r = clamp(row, 0, lines.length - 1)
  const c = clamp(col, 0, (lines[r] ?? '').length)
  return { lines, row: r, col: c, top: follow(0, r, lines.length), undo: [], redo: [], typing: false }
}

export const toText = (ed: Doc): string => ed.lines.join('\n')

// First line of the window so that the cursor stays SCROLLOFF lines from the edges.
export function follow(top: number, row: number, total: number): number {
  const maxTop = Math.max(0, total - VIEW)
  let t = top
  if (row < t + SCROLLOFF) t = row - SCROLLOFF
  if (row > t + VIEW - 1 - SCROLLOFF) t = row - (VIEW - 1 - SCROLLOFF)
  return clamp(t, 0, maxTop)
}

function moveTo(ed: Ed, row: number, col: number): Out {
  const r = clamp(row, 0, ed.lines.length - 1)
  const text = ed.lines[r] ?? ''
  const c = snapCol(text, clamp(col, 0, text.length))
  if (r === ed.row && c === ed.col) return { ed: { ...ed, typing: false }, act: 'none' }
  return { ed: { ...ed, row: r, col: c, top: follow(ed.top, r, ed.lines.length), typing: false }, act: 'move' }
}

// A change: it goes into the history, except characters typed in a row, which stay a single step.
function change(ed: Ed, next: Doc, typing: boolean): Out {
  const undo = typing && ed.typing ? ed.undo : [...ed.undo, snap(ed)].slice(-MAX_UNDO)
  return { ed: { ...ed, ...next, top: follow(ed.top, next.row, next.lines.length), undo, redo: [], typing }, act: 'edit' }
}

function history(ed: Ed, isRedo: boolean): Out {
  const from = isRedo ? ed.redo : ed.undo
  const prev = from[from.length - 1]
  if (prev === undefined) return { ed, act: 'none' }
  const rest = from.slice(0, -1)
  const other = [...(isRedo ? ed.undo : ed.redo), snap(ed)]
  const top = follow(ed.top, prev.row, prev.lines.length)
  return { ed: { ...ed, ...prev, top, typing: false, undo: isRedo ? other : rest, redo: isRedo ? rest : other }, act: 'edit' }
}

export function reduce(ed: Ed, ev: KeyEv): Out {
  const k = ev.key
  const line = ed.lines[ed.row] ?? ''
  const { row, col } = ed
  if (ev.meta || ev.ctrl) {
    const lower = k.toLowerCase()
    if (lower === 's') return { ed, act: 'save' }
    if (lower === 'v') return { ed, act: 'paste' }
    if (lower === 'z') return history(ed, ev.shift === true)
    return { ed, act: 'none' }
  }
  switch (k) {
    case 'left': return col > 0 ? moveTo(ed, row, col - widthBefore(line, col)) : row > 0 ? moveTo(ed, row - 1, (ed.lines[row - 1] ?? '').length) : moveTo(ed, row, col)
    case 'right': return col < line.length ? moveTo(ed, row, col + widthAt(line, col)) : row < ed.lines.length - 1 ? moveTo(ed, row + 1, 0) : moveTo(ed, row, col)
    case 'up': return moveTo(ed, row - 1, col)
    case 'down': return moveTo(ed, row + 1, col)
    case 'pageup': return moveTo(ed, row - VIEW, col)
    case 'pagedown': return moveTo(ed, row + VIEW, col)
    case 'home': return moveTo(ed, row, 0)
    case 'end': return moveTo(ed, row, line.length)
    case 'return':
    case 'enter': {
      const lines = [...ed.lines]
      lines.splice(row, 1, line.slice(0, col), line.slice(col))
      return change(ed, { lines, row: row + 1, col: 0 }, false)
    }
    case 'tab': {
      const lines = [...ed.lines]
      lines[row] = `${line.slice(0, col)}  ${line.slice(col)}`
      return change(ed, { lines, row, col: col + 2 }, false)
    }
    case 'backspace': {
      if (col > 0) {
        const w = widthBefore(line, col)
        const lines = [...ed.lines]
        lines[row] = line.slice(0, col - w) + line.slice(col)
        return change(ed, { lines, row, col: col - w }, false)
      }
      if (row === 0) return { ed, act: 'none' }
      const prev = ed.lines[row - 1] ?? ''
      const lines = [...ed.lines]
      lines.splice(row - 1, 2, prev + line)
      return change(ed, { lines, row: row - 1, col: prev.length }, false)
    }
    case 'delete': {
      if (col < line.length) {
        const w = widthAt(line, col)
        const lines = [...ed.lines]
        lines[row] = line.slice(0, col) + line.slice(col + w)
        return change(ed, { lines, row, col }, false)
      }
      if (row >= ed.lines.length - 1) return { ed, act: 'none' }
      const lines = [...ed.lines]
      lines.splice(row, 2, line + (ed.lines[row + 1] ?? ''))
      return change(ed, { lines, row, col }, false)
    }
  }
  const ch = k === 'space' ? ' ' : k
  if (SPECIAL.has(k) || [...ch].length !== 1 || /[\u0000-\u001f\u007f]/.test(ch)) return { ed, act: 'none' }
  const lines = [...ed.lines]
  lines[row] = line.slice(0, col) + ch + line.slice(col)
  return change(ed, { lines, row, col: col + ch.length }, true)
}

// Screen rows of the cursor's line, which wraps in full; the others take one.
const screenRows = (len: number, columns: number): number =>
  Math.max(1, Math.ceil(Math.min(len, CURSOR_CLIP) / Math.max(1, columns - GUTTER)))

// From the click (cells of the region) to the row and column of the text. The column is approximate:
// the desktop draws proportional text; the arrow keys give the precision.
export function pointAt(ed: Ed, x: number, y: number, columns: number): Ed {
  const last = Math.min(ed.lines.length, ed.top + VIEW) - 1
  let at = 0
  let row = ed.top
  let offset = 0
  for (let i = ed.top; i <= last; i++) {
    const rows = i === ed.row ? screenRows((ed.lines[i] ?? '').length, columns) : 1
    row = i
    offset = clamp(y - at, 0, rows - 1)
    if (y < at + rows) break
    at += rows
  }
  const width = Math.max(1, columns - GUTTER)
  const col = (row === ed.row ? offset * width : 0) + x - GUTTER
  return moveTo(ed, Math.max(ed.top, row), col).ed
}
