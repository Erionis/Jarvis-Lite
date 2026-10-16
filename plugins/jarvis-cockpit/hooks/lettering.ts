import { oneLine } from './format'
import { TEAL_STYLE } from './mascot'

// Fixed-width lettering drawn as Svg: Text and Button use the app's font, a fixed-width font exists only inside
// an Svg (or a Code). Pure functions: the same text always gives the same string.

export const MONO = 'ui-monospace, Menlo, monospace'
// Card title: 11 px body; a fixed-width character is about 0.6 em wide.
const TITLE_PX = 11
const TITLE_H = 16
const CHAR_W = 6.6
export const TITLE_CHARS = 32

// Neutral gray for times, labels and verbs (readable in light and dark). The ink of the main text follows the
// system theme with a media query inside the Svg; without the query, it stays the light one.
export const GRAY = '#8a8a86'
const INK_STYLE = `<style>.ink{fill:#1f1e1d}@media (prefers-color-scheme: dark){.ink{fill:#ecebe6}}${TEAL_STYLE}</style>`

// On one line and without control characters, which do not fit in XML, then the escapes.
const esc = (s: string): string => oneLine(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export type Lettering = { source: string; width: number; height: number }

// Section title in capitals, teal: `▌TITLE`. `class="card-title"` tells it apart from the other Svgs.
// textLength keeps the width even if the fixed-width font is missing and the system uses a proportional one.
export function titleSvg(title: string): Lettering {
  // On code points (an emoji is not split and counts one); control characters do not fit in XML.
  const upper = [...title.toUpperCase().replace(/[\u0000-\u001f\u007f]/g, '')]
  const name = upper.length > TITLE_CHARS ? `${upper.slice(0, TITLE_CHARS - 1).join('')}…` : upper.join('')
  const width = Math.ceil([...`▌${name}`].length * CHAR_W)
  const font = `font-family="${MONO}" font-size="${TITLE_PX}" font-weight="700"`
  const head = `<text x="0" y="12" ${font} class="ac" textLength="${width}" lengthAdjust="spacingAndGlyphs">${esc(`▌${name}`)}</text>`
  return { source: `<svg xmlns="http://www.w3.org/2000/svg" class="card-title" viewBox="0 0 ${width} ${TITLE_H}"><style>${TEAL_STYLE}</style>${head}</svg>`, width, height: TITLE_H }
}

// Terminal-style horizontal rule after a section title: a very long thin line that the container cuts at the
// pane width. Neutral translucent gray (readable in light and dark); the tone of the section, if there is one,
// colors it.
export const RULE_W = 2000
export const RULE_GRAY = '#80808080'
export function ruleSvg(color: string = RULE_GRAY): Lettering {
  const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${RULE_W} ${TITLE_H}">`
    + `<line x1="0" y1="8.5" x2="${RULE_W}" y2="8.5" stroke="${color}" stroke-width="1"/></svg>`
  return { source, width: RULE_W, height: TITLE_H }
}

// The Activity log as a phosphor terminal: 13 px fixed-width in columns (time, symbol, verb, what), old rows
// fade, at the bottom the teal block cursor, which blinks during a turn (SMIL: the Svg must be drawn
// isInteractive) and stays still outside the turn.
export type LogCell = { time: string; glyph: string; verb: string; what: string; isHead?: boolean }
const LOG_PX = 13
const LOG_CW = 7.8
const LOG_LH = 20
const COL_GLYPH = 6
const COL_VERB = 8
const COL_WHAT = 16
// Fading: each row older than the last one loses a little light, down to a minimum.
const FADE_STEP = 0.06
const FADE_MIN = 0.4
// Wrapped lines: beyond this number the last one ends with `…`.
const WRAP_LINES = 3
// Below this space for the what text (in characters) the verb column disappears: the verb opens the text.
const WRAP_MIN = 18

// Whole words while they fit in `room` characters; a longer word is split. At most WRAP_LINES lines, the last
// closed by `…` if the text goes on. On a single line it fills the whole line, even in the middle of a word.
export function wrapText(text: string, room: number, max = WRAP_LINES): string[] {
  room = Math.max(room, 4)
  if (max === 1) {
    const chars = [...text]
    return [chars.length <= room ? text : `${chars.slice(0, room - 1).join('')}…`]
  }
  const out: string[][] = []
  let line: string[] = []
  for (const word of text.split(' ')) {
    let w = [...word]
    if (line.length + (line.length === 0 ? 0 : 1) + w.length <= room) {
      line = line.length === 0 ? w : [...line, ' ', ...w]
      continue
    }
    if (line.length > 0) out.push(line)
    while (w.length > room) { out.push(w.slice(0, room)); w = w.slice(room) }
    line = w
  }
  out.push(line)
  if (out.length > max) {
    const last = out[max - 1] ?? []
    out.length = max
    out[max - 1] = [...last.slice(0, room - 1), '…']
  }
  return out.map(l => l.join(''))
}

// `maxChars`: the text wraps below the what column instead of widening the Svg (beyond the pane it would be
// shrunk) or losing pieces. If space is short, the verb goes into the text, in gray.
// `maxLines`: how many lines at most for each entry (1: every entry on one line, closed by `…` if it continues).
export function logSvg(rows: readonly LogCell[], blink: boolean, maxChars = Infinity, maxLines = WRAP_LINES): Lettering {
  const isNarrow = maxChars - COL_WHAT - 2 < WRAP_MIN
  const at = (col: number): string => (col * LOG_CW).toFixed(1)
  let n = 0
  let widest = 1
  let cursorCol = 0
  const lines = rows.map((r, i) => {
    const isInline = r.verb === '' || isNarrow
    const col = isInline ? COL_VERB : COL_WHAT
    const lead = r.verb !== '' && isNarrow ? `${r.verb} ` : ''
    const parts = wrapText(`${lead}${r.what}`, maxChars - col - 2, maxLines)
    // The start of a turn does not fade: it separates the turns.
    const op = r.isHead === true ? 1 : Math.max(FADE_MIN, 1 - (rows.length - 1 - i) * FADE_STEP)
    const y0 = 14 + n * LOG_LH
    const texts = parts.map((part, k) => {
      const y = y0 + k * LOG_LH
      const hasLead = k === 0 && lead !== '' && part.startsWith(lead)
      const body = hasLead ? `<tspan fill="${GRAY}">${esc(r.verb)}</tspan> ${esc(part.slice(lead.length))}` : esc(part)
      return `<text x="${at(col)}" y="${y}" class="ink">${body}</text>`
    }).join('')
    const verb = isInline ? '' : `<text x="${at(COL_VERB)}" y="${y0}" fill="${GRAY}">${esc(r.verb)}</text>`
    for (const part of parts) widest = Math.max(widest, col + [...part].length)
    cursorCol = col + [...(parts[parts.length - 1] ?? '')].length + 1
    n += parts.length
    return `<g opacity="${op.toFixed(2)}"><text x="0" y="${y0}" fill="${GRAY}">${esc(r.time)}</text>`
      + `<text x="${at(COL_GLYPH)}" y="${y0}" class="ac">${esc(r.glyph)}</text>${verb}${texts}</g>`
  }).join('')
  const width = Math.ceil((widest + 2) * LOG_CW)
  const height = n * LOG_LH + 4
  const cy = (n - 1) * LOG_LH + 3
  const anim = blink ? '<animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.5;0.5;1" dur="1.1s" repeatCount="indefinite"/>' : ''
  const cursor = rows.length === 0 ? '' : `<rect x="${(cursorCol * LOG_CW).toFixed(1)}" y="${cy}" width="${LOG_CW.toFixed(1)}" height="15" class="ac">${anim}</rect>`
  const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" xml:space="preserve">${INK_STYLE}`
    + `<g font-family="${MONO}" font-size="${LOG_PX}">${lines}</g>${cursor}</svg>`
  return { source, width, height }
}

// The preview of the prompt in the Recap's Next step: the exact text that the resume button puts in the prompt,
// in 12 px gray fixed-width, wrapped by words within `maxChars` columns, at most three lines closed by `…`.
const PREVIEW_PX = 12
const PREVIEW_CW = 7.2
const PREVIEW_LH = 17
export function previewSvg(text: string, maxChars: number): Lettering {
  const lines = wrapText(oneLine(text), Math.max(8, maxChars), WRAP_LINES)
  const width = Math.ceil((Math.max(...lines.map(l => [...l].length), 1) + 1) * PREVIEW_CW)
  const height = lines.length * PREVIEW_LH + 4
  const rows = lines.map((l, i) => `<text x="0" y="${13 + i * PREVIEW_LH}">${esc(l)}</text>`).join('')
  const source = `<svg xmlns="http://www.w3.org/2000/svg" class="prompt-preview" viewBox="0 0 ${width} ${height}" xml:space="preserve">`
    + `<g font-family="${MONO}" font-size="${PREVIEW_PX}" fill="${GRAY}">${rows}</g></svg>`
  return { source, width, height }
}

// What the mascot says, as text typed on a terminal next to it: 13 px fixed-width, wrapped by words (at most
// three lines), the teal block cursor at the end. `typedMs`: how long it has been writing (null: already fully
// written). Each step is a still image with the letters written so far (register.tsx redraws in steps for
// `typingMs`; an interactive frame would flicker on every redraw); width and height are already the final
// ones, so nothing moves. Reduce motion shows the whole text at once.
const TYPE_CPS = 28
// First the mascot appears with the arm raised, then it starts to write.
export const TYPE_DELAY_MS = 300
export const typingMs = (text: string): number => TYPE_DELAY_MS + Math.ceil(([...text].length * 1000) / TYPE_CPS)

// `maxHeight`: the lines fit in those px (the bubble and buttons within the mascot's height), at most three.
export function speechSvg(text: string, room: number, typedMs: number | null = null, maxHeight = Infinity): Lettering {
  const lines = wrapText(text, room, Math.max(1, Math.min(WRAP_LINES, Math.floor((maxHeight - 4) / LOG_LH))))
  const lens = lines.map(l => [...l].length)
  const width = Math.ceil((Math.max(...lens, 1) + 2) * LOG_CW)
  const height = lines.length * LOG_LH + 4
  const total = lens.reduce((a, n) => a + n, 0)
  const typed = typedMs === null ? total : Math.min(total, Math.max(0, Math.floor(((typedMs - TYPE_DELAY_MS) * TYPE_CPS) / 1000)))
  const isTyping = typed < total
  // Each line is always whole and as wide as its columns (textLength, whatever fixed-width font the system uses),
  // so between one step and the next the letters do not move: a clipPath shows only the ones already written.
  // The cursor sits on the cell after the last one written; once the text is finished, one space after.
  const cell = (row: number, col: number, cls: string): string =>
    `<rect x="${(col * LOG_CW).toFixed(1)}" y="${row * LOG_LH + 3}" width="${LOG_CW.toFixed(1)}" height="15" class="${cls}"/>`
  const end = cell(lines.length - 1, (lens[lens.length - 1] ?? 0) + 1, 'ac end')
  let left = typed
  let cursor = end
  let clips = ''
  let rows = ''
  for (const [i, line] of lines.entries()) {
    const len = lens[i] ?? 0
    const n = Math.min(len, left)
    left -= n
    if (cursor === end && n < len) cursor = cell(i, n, 'ac cur')
    if (len === 0) continue
    const clip = n < len ? ` clip-path="url(#l${i})"` : ''
    if (n < len) clips += `<clipPath id="l${i}"><rect x="0" y="${i * LOG_LH}" width="${(n * LOG_CW).toFixed(1)}" height="${LOG_LH}"/></clipPath>`
    rows += `<text x="0" y="${14 + i * LOG_LH}" class="ink"${clip} textLength="${(len * LOG_CW).toFixed(1)}" lengthAdjust="spacingAndGlyphs">${esc(line)}</text>`
  }
  // Reduce motion: the whole text at once, with the cursor at the end.
  const css = isTyping ? '.end{display:none}@media (prefers-reduced-motion: reduce){text{clip-path:none}.cur{display:none}.end{display:inline}}' : ''
  const style = `<style>.ink{fill:#1f1e1d}@media (prefers-color-scheme: dark){.ink{fill:#ecebe6}}${TEAL_STYLE}${css}</style>`
  const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" xml:space="preserve">${style}`
    + `${clips === '' ? '' : `<defs>${clips}</defs>`}<g font-family="${MONO}" font-size="${LOG_PX}">${rows}</g>${isTyping ? cursor + end : end}</svg>`
  return { source, width, height }
}
