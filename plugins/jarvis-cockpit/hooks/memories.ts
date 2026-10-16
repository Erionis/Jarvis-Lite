// The read-only Memories tab: from the files of the memories folder, name, description, group, links and
// new/changed. Pure functions: register.tsx reads the files and git, here they are interpreted.
import type { MemoriesState, Memory, MemoryGroup } from '../types'
import { basename, clip, dirname } from './format'

export const EMPTY_MEMORIES: MemoriesState = { dir: null, list: null, error: null, open: null, back: [], expanded: [] }
export const MEMORY_GROUPS: readonly MemoryGroup[] = ['people', 'projects', 'preferences', 'references', 'other']
// A saved value (atom `memories.expanded` after a reload) may hold a group name from an older version.
export const isGroup = (x: unknown): x is MemoryGroup => (MEMORY_GROUPS as readonly unknown[]).includes(x)
const BY_TYPE: Readonly<Record<string, MemoryGroup>> = { user: 'people', project: 'projects', feedback: 'preferences', reference: 'references' }
// The prefixes of Jarvis's files; `infra_` (state and access to clusters) is a reference.
const PREFIX = /^(user|project|feedback|reference|infra)_/
const PREFIX_TYPE: Readonly<Record<string, string>> = { user: 'user', project: 'project', feedback: 'feedback', reference: 'reference', infra: 'reference' }
const FRESH_MS = 7 * 86_400_000
const SHORT_CHARS = 18

// A file of the folder as read: text null if it is too big or unreadable.
export type MemoryFile = { name: string; text: string | null; mtimeMs: number }
// First and last commit of each file (ms), by file name; dirty: files with uncommitted changes.
export type GitDates = Record<string, { first: number; last: number }>
export type MemoryGit = { dates: GitDates; dirty: ReadonlySet<string> }
export type MemoryGroupView = { group: MemoryGroup; items: Memory[]; fresh: number }

// The files that are memories: the .md files of the folder, without README and the index MEMORY.md (by name:
// even with Durable memory declared as a folder) and without the files of the declared sources (the Identity
// file if it lives there).
export function memoryNames(entries: readonly { name: string; kind: string }[], dir: string, roles: Readonly<Record<string, string>>): string[] {
  const sources = new Set(Object.values(roles))
  return entries
    .filter(e => e.kind === 'file' && /\.md$/i.test(e.name) && !/^(readme|memory)\.md$/i.test(e.name) && !sources.has(`${dir}/${e.name}`))
    .map(e => e.name)
}

// The frontmatter at the top (`---` … `---`), only the `key: value` lines, quotes removed. Broken if it opens
// and does not close.
export function readFrontmatter(md: string): { fields: Record<string, string>; isBroken: boolean } {
  const lines = md.split(/\r?\n/)
  const fields: Record<string, string> = {}
  if (lines[0]?.trim() !== '---') return { fields, isBroken: false }
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === '---')
  if (end < 0) return { fields, isBroken: true }
  for (const line of lines.slice(1, end)) {
    const kv = /^([\w-]+):\s*(.*)$/.exec(line)
    if (kv?.[1] !== undefined) fields[kv[1]] = (kv[2] ?? '').trim().replace(/^(["'])(.*)\1$/, '$2')
  }
  return { fields, isBroken: false }
}

export function memoryGroup(type: string | undefined, file: string): MemoryGroup {
  const t = type ?? PREFIX_TYPE[PREFIX.exec(file)?.[1] ?? ''] ?? ''
  return BY_TYPE[t] ?? 'other'
}

// The short name for the graph and the labels: the file without prefix and without .md, `_` → space.
export const shortName = (file: string): string => clip(file.replace(/\.md$/i, '').replace(PREFIX, '').replace(/_/g, ' '), SHORT_CHARS)

const decode = (s: string): string => { try { return decodeURIComponent(s) } catch { return s } }

// The .md files the text points to, by name: markdown links (also `<…>` and `%20`, without #anchor) and
// wikilinks. Links to websites (`https:`) are left out.
export function linkTargets(md: string): string[] {
  const out = new Set<string>()
  for (const m of md.matchAll(/\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+"[^"]*")?\s*\)/g)) {
    const raw = (m[1] ?? '').replace(/^<|>$/g, '').replace(/[#?].*$/, '')
    if (/^[a-z][\w+.-]*:/i.test(raw)) continue
    const name = basename(decode(raw))
    if (/\.md$/i.test(name)) out.add(name)
  }
  for (const m of md.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)) {
    const name = basename((m[1] ?? '').trim())
    if (name !== '') out.add(/\.md$/i.test(name) ? name : `${name}.md`)
  }
  return [...out]
}

// `git log -z --format=%ct --name-only -- <dir>`: a time (seconds) and then the files of that commit, separated
// by \0 (the first file starts with a newline). Only the files directly in the folder; paths from the repo root.
export function parseGitDates(stdout: string, dir: string): GitDates {
  const out: GitDates = {}
  let at: number | null = null
  for (const token of stdout.split('\0')) {
    const t = token.replace(/^\n/, '')
    if (t === '') continue
    if (/^\d+$/.test(t)) { at = Number(t) * 1000; continue }
    const parent = dirname(t)
    if (at === null || (parent !== dir && !parent.endsWith(`/${dir}`))) continue
    const name = basename(t)
    const cur = out[name]
    out[name] = cur === undefined ? { first: at, last: at } : { first: Math.min(cur.first, at), last: Math.max(cur.last, at) }
  }
  return out
}

// New: first commit in the last 7 days or not yet in git. Changed: last commit in the last 7 days or
// uncommitted changes. Without git: changed if the date of the file is within the last 7 days.
export function freshOf(file: string, git: MemoryGit | null, mtimeMs: number, nowMs: number): Memory['fresh'] {
  if (git === null) return nowMs - mtimeMs <= FRESH_MS ? 'changed' : null
  const d = git.dates[file]
  if (d === undefined || nowMs - d.first <= FRESH_MS) return 'new'
  return nowMs - d.last <= FRESH_MS || git.dirty.has(file) ? 'changed' : null
}

const rank = (m: Memory): number => (m.fresh === 'new' ? 0 : m.fresh === 'changed' ? 1 : 2)
// A fixed locale on purpose: the order must not change with the vault language (the links are sorted once, at build time, and stored).
const byName = (a: Memory, b: Memory): number => a.name.localeCompare(b.name, 'it')
const byGroup = (a: Memory, b: Memory): number => MEMORY_GROUPS.indexOf(a.group) - MEMORY_GROUPS.indexOf(b.group) || byName(a, b)

// The memories from the files read. Broken frontmatter: the `other` group, named after the file. File not read:
// named after the file, group from the prefix, without its links. Links in both directions, only between
// memories, once.
export function buildMemories(files: readonly MemoryFile[], git: MemoryGit | null, nowMs: number): Memory[] {
  const names = new Set(files.map(f => f.name))
  const links = new Map<string, Set<string>>(files.map(f => [f.name, new Set<string>()]))
  const list = files.map((f): Memory => {
    const plain = f.name.replace(/\.md$/i, '')
    const fm = f.text === null ? { fields: {}, isBroken: false } : readFrontmatter(f.text)
    for (const t of f.text === null ? [] : linkTargets(f.text)) {
      if (t === f.name || !names.has(t)) continue
      links.get(f.name)?.add(t)
      links.get(t)?.add(f.name)
    }
    const fields: Record<string, string | undefined> = fm.fields
    return {
      file: f.name,
      name: fields.name || plain,
      description: fields.description ?? '',
      group: fm.isBroken ? 'other' : memoryGroup(fields.type || undefined, f.name),
      links: [],
      fresh: freshOf(f.name, git, f.mtimeMs, nowMs),
    }
  })
  const byFile = new Map(list.map(m => [m.file, m]))
  return list.map(m => ({ ...m, links: [...(links.get(m.file) ?? [])].flatMap(f => byFile.get(f) ?? []).sort(byGroup).map(x => x.file) }))
}

// The groups in the fixed order, only those with memories; inside, the new ones, then the changed ones, then
// by number of links and by name.
export function memoryGroups(list: readonly Memory[]): MemoryGroupView[] {
  return MEMORY_GROUPS.flatMap(group => {
    const items = list.filter(m => m.group === group).sort((a, b) => rank(a) - rank(b) || b.links.length - a.links.length || byName(a, b))
    return items.length === 0 ? [] : [{ group, items, fresh: items.filter(m => m.fresh === 'new').length }]
  })
}
