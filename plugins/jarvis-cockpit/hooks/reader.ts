import type { Draft, Reading } from '../types'
import { drawable } from './format'
import type { Strings } from './strings'
import { isMarkdown } from './tree'

export { drawable }

// U+FFFD in the text read: the file is not UTF-8 and rewriting it would lose the bytes that cannot be read.
export const isNotUtf8 = (text: string): boolean => text.includes('\uFFFD')

export const EMPTY_READING: Reading = { path: null, back: [], mode: 'text', text: null, mtimeMs: 0, size: null, isTooBig: false, error: null, updatedAt: null, diff: null }

// Beyond this length a file is not rendered: a drawing carries at most 100 000 characters.
export const MAX_RENDER_CHARS = 80_000

// The props of the editor Client (serialized text included) stay under 100 000 characters: beyond this margin
// Edit turns off.
export const EDIT_MAX_JSON = 90_000

// The line ending of a text: '\r\n' if every line ends that way, '\n' if none does; null if they are mixed or
// there is a lone \r. The editor works with `\n` and the draft puts the file's own ending back on save.
export function eolOf(text: string): '\n' | '\r\n' | null {
  const crlf = text.split('\r\n').length - 1
  const lf = text.split('\n').length - 1
  const cr = text.split('\r').length - 1
  if (cr !== crlf) return null
  if (crlf === 0) return '\n'
  return crlf === lf ? '\r\n' : null
}

// Why an open file cannot be edited in the pane; null if it can. `isProtected` comes from classify: protected
// sources, CLAUDE.md, excluded files or files outside the vault. Code and the other text files are read-only.
export function editBlock(r: Reading, isProtected: boolean, t: Strings): string | null {
  const why = t.reading.blocked
  if (isProtected) return why.protected
  if (r.path !== null && !isMarkdown(r.path)) return why.notMarkdown
  if (r.isTooBig || (r.text !== null && JSON.stringify(r.text).length > EDIT_MAX_JSON)) return why.tooBig
  if (r.text === null) return why.notRead
  if (isNotUtf8(r.text)) return why.notUtf8
  if (eolOf(r.text) === null) return why.mixedEol
  return null
}

// A NUL does not belong in a text file: Reading does not draw it.
export const isBinaryText = (s: string): boolean => s.includes('\u0000')

// A draft with unsaved changes.
export const isDirty = (d: Draft | null): boolean => d !== null && d.text !== d.base

export type Doc = { meta: { key: string; value: string }[]; body: string }

// Removes the quotes and reduces markdown links to their text.
function clean(v: string): string {
  return v.trim().replace(/^(["'])(.*)\1$/, '$2').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
}

// Simple YAML frontmatter: `key: value` and `- item` lists joined by commas; the rest is the body.
export function splitFrontmatter(md: string): Doc {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  if (!m) return { meta: [], body: md }
  const meta: { key: string; value: string }[] = []
  for (const line of (m[1] ?? '').split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*):\s*(.*)$/)
    if (kv) {
      meta.push({ key: kv[1] ?? '', value: clean(kv[2] ?? '') })
      continue
    }
    const item = line.match(/^\s+-\s+(.*)$/)
    const last = meta[meta.length - 1]
    if (item && last) last.value = last.value ? `${last.value}, ${clean(item[1] ?? '')}` : clean(item[1] ?? '')
  }
  return { meta, body: md.slice(m[0].length) }
}

// Segments of `path` appended to `base`: skips '' and '.', goes up with '..'; null if it leaves the root.
function walk(base: readonly string[], path: string): string[] | null {
  const out = [...base]
  for (const part of path.split('/')) {
    if (part === '' || part === '.') continue
    if (part === '..') {
      if (out.length === 0) return null
      out.pop()
    } else out.push(part)
  }
  return out
}

// From a relative href (also %20 and #anchor) to a path relative to the root; null if it leaves the vault.
export function resolveRel(fromRel: string, href: string, root: string): string | null {
  let path: string
  try {
    path = decodeURIComponent(href.split('#')[0] ?? '')
  } catch {
    return null
  }
  if (path === '') return null
  let base: string[]
  if (path.startsWith('/')) {
    if (!path.startsWith(`${root}/`)) return null
    path = path.slice(root.length + 1)
    base = []
  } else base = fromRel.split('/').slice(0, -1)
  const out = walk(base, path)
  return out && out.length > 0 ? out.join('/') : null
}

// Parentheses are encoded too: they would close the markdown link.
export function fileUrl(root: string, rel: string): string {
  return `file://${encodeURI(`${root}/${rel}`).replace(/\(/g, '%28').replace(/\)/g, '%29')}`
}

const LINK = /(\]\()(<[^>]+>|[^)\s]+)((?:\s+"[^"]*")?\))/g

// The engine's Markdown makes only https:, http: and file: clickable. Relative links become absolute file://
// ones; `internal` are the rewritten hrefs, the ones the pane handles (max 256).
export function rewriteLinks(body: string, fromRel: string, root: string): { text: string; internal: string[] } {
  const internal: string[] = []
  const text = body.replace(LINK, (all: string, open: string, raw: string, close: string) => {
    const href = raw.startsWith('<') ? raw.slice(1, -1) : raw
    if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('#')) return all
    const rel = resolveRel(fromRel, href, root)
    if (rel === null) return all
    const url = fileUrl(root, rel)
    if (internal.length < 256) internal.push(url)
    return `${open}${url}${close}`
  })
  return { text: drawable(text), internal }
}

// From the pressed link to the relative path, if it is a vault file; accepts the raw or the already decoded href.
// It is decoded only once (decodeURI: %2e becomes '.'), then the segments are normalized as in resolveRel.
export function pressedRel(href: string, root: string): string | null {
  if (!href.startsWith('file://')) return null
  let abs = href.slice('file://'.length)
  try {
    abs = decodeURI(abs)
  } catch {}
  if (!abs.startsWith(`${root}/`)) return null
  const out = walk([], abs.slice(root.length + 1))
  return out && out.length > 0 ? out.join('/') : null
}
