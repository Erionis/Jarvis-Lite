// Lazy tree of the vault. The pure parts come from filetree (MIT, Kurt Buhler; see LICENSE-filetree), hooks/tree.ts,
// simplified: ids relative to the root, no themes or Windows drives.
import type { Tree, TreeNode } from '../types'
import { basename, daysBetween, hhmm } from './format'
import type { DateWords } from './strings'

export type Entry = { name: string; kind: 'file' | 'dir' | 'other'; mtimeMs: number; isLink: boolean; size?: number }
export type Row = { node: TreeNode; depth: number; open: boolean }

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function emptyTree(): Tree {
  return { nodes: [], loaded: [], expanded: [], broken: [], cursor: '', selected: '', query: '', hits: [], showHidden: false, showSizes: false, error: null }
}

export const joinRel = (dir: string, name: string): string => (dir === '' ? name : `${dir}/${name}`)
export const parentOf = (id: string): string => (id.includes('/') ? id.slice(0, id.lastIndexOf('/')) : '')
// The folders that contain `id`, from the outermost: 'a/b/c.md' → ['a', 'a/b'].
export function ancestors(id: string): string[] {
  const out: string[] = []
  for (let d = parentOf(id); d !== ''; d = parentOf(d)) out.unshift(d)
  return out
}
export const isMarkdown = (path: string): boolean => /\.md$/i.test(path)
// Read as text in Reading: everything except images, PDFs, archives, Office documents, audio and video, fonts,
// databases and model weights, compiled binaries. It is a denylist, so any extension not on the list opens in Reading.
const BINARY = /\.(png|jpe?g|gif|webp|bmp|ico|tiff?|heic|heif|avif|svg|psd|ai|sketch|fig|pdf|zip|gz|tgz|bz2|xz|7z|rar|tar|zst|dmg|iso|pkg|docx?|xlsx?|pptx?|odt|ods|odp|key|numbers|pages|mp3|wav|m4a|aac|flac|ogg|opus|mp4|mov|avi|mkv|webm|m4v|ttf|otf|woff2?|eot|db|sqlite3?|parquet|feather|arrow|pkl|pickle|npy|npz|pt|pth|bin|safetensors|onnx|gguf|h5|ckpt|exe|dll|so|dylib|o|a|class|jar|wasm|pyc)$/i
export const isTextFile = (path: string): boolean => !BINARY.test(path) && !/(^|\/)\.DS_Store$/.test(path)
// `path` is under `dir`; the root '' contains everything.
export const under = (dir: string, path: string): boolean => (dir === '' ? path !== '' : path.startsWith(`${dir}/`))

export function toNodes(dir: string, list: readonly Entry[]): TreeNode[] {
  return list
    .filter(x => x.kind !== 'other' || x.isLink)
    .map((x): TreeNode => ({ id: joinRel(dir, x.name), parent: dir, name: x.name, kind: x.kind === 'dir' ? 'dir' : 'file', mtimeMs: x.mtimeMs, size: x.kind === 'file' ? x.size ?? 0 : 0, isLink: x.isLink }))
    .sort((a, b) => (a.kind === 'dir' ? 0 : 1) - (b.kind === 'dir' ? 0 : 1) || collator.compare(a.name, b.name))
}

// Replaces the children of `dir`; children that are gone leave with their descendants, also from the expanded and loaded lists.
export function withChildren(t: Tree, dir: string, list: readonly Entry[]): Tree {
  const kids = toNodes(dir, list)
  const ids = new Set(kids.map(k => k.id))
  const gone = t.nodes.filter(n => n.parent === dir && !ids.has(n.id)).map(n => n.id)
  const isGone = (id: string): boolean => gone.some(g => id === g || under(g, id))
  return {
    ...t,
    nodes: [...t.nodes.filter(n => n.parent !== dir && !isGone(n.id)), ...kids],
    loaded: [...t.loaded.filter(d => d !== dir && !isGone(d)), dir],
    expanded: t.expanded.filter(d => !isGone(d)),
    broken: t.broken.filter(d => d !== dir),
  }
}

export function visibleRows(t: Tree, ignored: ReadonlySet<string>): Row[] {
  const kids = new Map<string, TreeNode[]>()
  for (const n of t.nodes) {
    if (!t.showHidden && (n.name.startsWith('.') || ignored.has(n.id))) continue
    const list = kids.get(n.parent)
    if (list) list.push(n)
    else kids.set(n.parent, [n])
  }
  const open = new Set(t.expanded)
  const rows: Row[] = []
  const walk = (dir: string, depth: number): void => {
    for (const n of kids.get(dir) ?? []) {
      const isOpen = n.kind === 'dir' && open.has(n.id)
      rows.push({ node: n, depth, open: isOpen })
      if (isOpen) walk(n.id, depth + 1)
    }
  }
  walk('', 0)
  return rows
}

export function toggleExpanded(t: Tree, id: string): Tree {
  const isOpen = t.expanded.includes(id)
  return { ...t, cursor: id, expanded: isOpen ? t.expanded.filter(x => x !== id) : [...t.expanded, id] }
}

export function dirCounts(dir: string, written: readonly string[], changed: readonly string[]): { written: number; changed: number } {
  return { written: written.filter(p => under(dir, p)).length, changed: changed.filter(p => under(dir, p)).length }
}

// The age of a file for the Files column and the meta line: the time today, then days, then months.
export function ageLabel(mtimeMs: number, nowMs: number, dates: DateWords): string {
  if (mtimeMs <= 0) return ''
  const days = daysBetween(mtimeMs, nowMs)
  if (days <= 0) return hhmm(mtimeMs)
  return days < 60 ? dates.shortDays(days) : dates.shortMonths(Math.floor(days / 30))
}

// Search by file name over the whole vault; paths in hidden folders stay out until they are shown.
export function searchHits(paths: readonly string[], query: string, limit: number, showHidden: boolean): string[] {
  const q = query.trim().toLowerCase()
  if (q === '') return []
  return paths
    .filter(p => (showHidden || !p.split('/').some(part => part.startsWith('.'))) && basename(p).toLowerCase().includes(q))
    .slice(0, limit)
}
