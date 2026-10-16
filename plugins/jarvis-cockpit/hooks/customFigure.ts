import type { Figure, FigureArt, Pose } from '../types'
import { TERMINAL } from './terminalFigure'

// The user's own mascot: one SVG for each pose in a folder of the vault, checked here before the stage draws
// it. The engine already draws every Svg isolated and script-less; this is a second barrier, and it keeps
// the stage under the element's size limit. Pure functions: register.tsx reads the files.

export const FIGURE_DIR = '99 - Jarvis/mascot'
const POSES: readonly Pose[] = ['idle', 'work', 'agent', 'done', 'party', 'sleep', 'error']
export type FigureFile = Pose | 'talk'
export const FIGURE_FILES: readonly FigureFile[] = [...POSES, 'talk']
export const fileOf = (f: FigureFile): string => `${f}.svg`
export const MAX_FIGURE_CHARS = 16_384

export type Refusal = 'tooBig' | 'notSvg' | 'noViewBox' | 'entity' | 'script' | 'external' | 'animation'
export type ArtCheck = { art: FigureArt } | { refused: Refusal }

// The root tag, after an optional BOM, XML declaration and comments.
const START = /^\uFEFF?\s*(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg\b[^>]*>/i
const CLOSE = /<\/svg\s*>/gi
const VIEWBOX = /\bviewBox\s*=\s*["']\s*(-?[\d.]+)[\s,]+(-?[\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*["']/i
// In this order: the first rule that matches names the refusal. A reference is local only when it starts
// with `#`; the alternatives keep a quote from being read as the start of the value. The script rule also
// reads an element under any prefix (`<svg:script>`, `<a.b:script>`) and a handler glued to the previous
// attribute or to a slash; the external rules cover `<image>` and the HTML media elements under any prefix
// (`<h:img>`), a `src` that is not a fragment, `image-set(`, a backslash in any attribute value, and any CSS
// escape (`\75rl(`, `@im\70ort`) or character reference (`&#117;rl(`) in a `<style>` or a `style` attribute,
// which would hide a reference from the patterns. The external rules (the third item is `true`) also run on the text
// with its numeric character references decoded once, as the XML parser reads attribute values: `fill="&#117;rl(...)"`
// is a `url(`. The other rules read the text as written: a decoded `&#60;script` is text, not an element.
const RULES: readonly (readonly [Refusal, RegExp, boolean?])[] = [
  ['entity', /<!(?:DOCTYPE|ENTITY)/i],
  ['script', /<(?:[^\s<>/:]+:)?(?:script|foreignObject|iframe)\b|[\s"'/]on[a-z]+\s*=|javascript:/i],
  ['external', /<(?:[^\s<>/:]+:)?(?:image|img|embed|video|audio|object|link|source)\b|\bhref\s*=\s*(?:"(?!#)|'(?!#)|(?![\s"'#]))|\bsrc\s*=\s*(?:"(?!#)|'(?!#)|(?![\s"'#]))|=\s*(?:"[^"]*\\|'[^']*\\)|@import\b|image-set\(|url\(\s*(?:"(?!#)|'(?!#)|(?![\s"'#]))/i, true],
  ['external', /<(?:[^\s<>/:]+:)?style\b[^>]*>(?:(?!<\/(?:[^\s<>/:]+:)?style)[\s\S])*?(?:\\|&#)|\bstyle\s*=\s*(?:"[^"]*(?:\\|&#)|'[^']*(?:\\|&#))/i, true],
  // The panel redraws the mascot step by step; an animation inside the file would restart at every redraw.
  ['animation', /<animate|<set\b|@keyframes\b|\banimation(?:-[a-z]+)?\s*:/i],
]

// Numeric character references, decoded once like the XML parser does (`&amp;#117;` stays `&#117;`, a named
// reference stays as written). The `;` is optional the way browsers take it; a code point that is not a
// character is left as written.
const NUMERIC_REF = /&#(?:x([\da-f]+)|(\d+));?/gi
function decodeRefs(text: string): string {
  return text.replace(NUMERIC_REF, (all, hex: string | undefined, dec: string | undefined) => {
    const cp = hex !== undefined ? parseInt(hex, 16) : Number(dec)
    return Number.isInteger(cp) && cp > 0 && cp <= 0x10ffff && (cp < 0xd800 || cp > 0xdfff) ? String.fromCodePoint(cp) : all
  })
}

export function checkArt(text: string): ArtCheck {
  if (text.length > MAX_FIGURE_CHARS) return { refused: 'tooBig' }
  const open = START.exec(text)
  let close = -1
  for (const m of text.matchAll(CLOSE)) close = m.index
  if (open === null || close < open[0].length) return { refused: 'notSvg' }
  const decoded = decodeRefs(text)
  for (const [reason, re, alsoDecoded] of RULES) if (re.test(text) || (alsoDecoded === true && decoded !== text && re.test(decoded))) return { refused: reason }
  const vb = VIEWBOX.exec(open[0])
  if (vb === null) return { refused: 'noViewBox' }
  const [x, y, w, hgt] = [vb[1], vb[2], vb[3], vb[4]].map(Number)
  if (![x, y].every(Number.isFinite) || !(w! > 0) || !(hgt! > 0)) return { refused: 'noViewBox' }
  return { art: { viewBox: `${vb[1]} ${vb[2]} ${vb[3]} ${vb[4]}`, body: text.slice(open[0].length, close) } }
}

export type FigureLoad = { figure: Figure; refused: { file: string; reason: Refusal }[] }

// `texts`: the folder's files by pose, `null` for a file too big to read; an absent key is a missing file.
// Without a usable idle the Terminal comes back whole; any other missing or refused pose uses idle, so the
// figure never changes character halfway and the stage's moves still say what is happening.
export function buildFigure(texts: Readonly<Partial<Record<FigureFile, string | null>>>): FigureLoad {
  const refused: { file: string; reason: Refusal }[] = []
  const arts: Partial<Record<FigureFile, FigureArt>> = {}
  for (const f of FIGURE_FILES) {
    const text = texts[f]
    if (text === undefined) continue
    const c: ArtCheck = text === null ? { refused: 'tooBig' } : checkArt(text)
    if ('art' in c) arts[f] = c.art
    else refused.push({ file: fileOf(f), reason: c.refused })
  }
  const idle = arts.idle
  if (idle === undefined) return { figure: TERMINAL, refused }
  const poses = Object.fromEntries(POSES.map(p => [p, arts[p] ?? idle])) as Record<Pose, FigureArt>
  return { figure: { kind: 'custom', css: '', poses, talk: arts.talk ?? null }, refused }
}
