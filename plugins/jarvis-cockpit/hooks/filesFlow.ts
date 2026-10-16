import type { GitView, Numstat, Tree } from '../types'
import { MAX_ROWS } from './files'
import { flight, oneAtATime } from './flight'
import { errText } from './format'
import { parseLsFiles, parseNumstat, parseStatus } from './git'
import { changes, type Cell, type ClockPort, type FsPort, type RunPort, type SourcesPort } from './ports'
import { duTargets, parseDu, staleDirs } from './sizes'
import { searchHits, visibleRows, withChildren } from './tree'

// The Files tab: git, folder sizes, tree folders and search. The ports are given by register.tsx.
export type FilesDeps = {
  fs: FsPort
  run: RunPort
  clock: ClockPort
  sources: SourcesPort
  tree: Cell<Tree>
  git: Cell<GitView | null>
  numstat: Cell<Numstat | null>
  sizes: Cell<Record<string, number | null>>
  // The Files tab is the chosen one: git and `du` only run then (the Recap does not use them).
  inView: () => Promise<boolean>
}

const abs = (root: string, rel: string): string => (rel === '' ? root : `${root}/${rel}`)

// Read-only git from the vault root; null if it fails or there is none.
export async function runGit(run: RunPort, root: string, args: readonly string[], timeoutMs = 5000): Promise<{ stdout: string; isTruncated: boolean } | null> {
  try {
    const r = await run(['git', '--no-optional-locks', ...args], { cwd: root, timeoutMs })
    return r.exitCode === 0 ? { stdout: r.stdout, isTruncated: r.isStdoutTruncated === true } : null
  } catch {
    return null
  }
}

// Reads a folder and replaces its children; an unreadable folder stays closed with ⚠, an unreadable root says
// so in the tab.
export async function loadDir(d: FilesDeps, rel: string): Promise<void> {
  try {
    const s = await d.sources()
    const list = await d.fs.list(abs(s.root, rel))
    await d.tree.set(t => ({ ...withChildren(t, rel, list), ...(rel === '' ? { error: null } : {}) }))
  } catch (err) {
    try {
      await d.tree.set(cur => (rel === '' ? { ...cur, error: errText(err) } : { ...cur, broken: [...new Set([...cur.broken, rel])], expanded: cur.expanded.filter(x => x !== rel) }))
    } catch {}
  }
}

// --- git ---

const gitFlight = flight()
// The list of ignored files is costly: `--ignored=traditional` takes about 290 ms, `--ignored=no` about 85.
// It is read again at startup, on entering the Files tab and when a `.gitignore` changes; the other runs keep
// the previous one.
let wantIgnored = true

// Git status and uncommitted changed lines, together. A run in flight and at most one after it: never results
// out of order. With the Files tab hidden it does not run; entering the tab runs it again.
export function refreshGit(d: FilesDeps, opts: { ignored?: boolean } = {}): Promise<void> {
  if (opts.ignored === true) wantIgnored = true
  return oneAtATime(gitFlight, () => readGit(d))
}

async function readGit(d: FilesDeps): Promise<void> {
  if (!(await d.inView())) return
  const s = await d.sources()
  // The flag is cleared when the run starts: a request that arrives while it runs asks for a new one, which
  // this run does not cancel.
  const withIgnored = wantIgnored
  wantIgnored = false
  const [r, n] = await Promise.all([
    runGit(d.run, s.root, ['status', '--porcelain=v1', '-z', `--ignored=${withIgnored ? 'traditional' : 'no'}`, '--untracked-files=normal']),
    runGit(d.run, s.root, ['diff', '--numstat', '-z', 'HEAD']),
  ])
  // Without `git status` the previous list is gone (git becomes null): the next run reads it again.
  if (r === null) wantIgnored = true
  const [curGit, curNum] = await Promise.all([d.git.get(), d.numstat.get()])
  const status = r === null ? null : parseStatus(r.stdout)
  const git = status === null ? null : { changed: status.changed, ignored: withIgnored ? status.ignored : curGit?.ignored ?? [] }
  const numstat = n === null ? null : parseNumstat(n.stdout)
  // Only what changed is written: every write redraws the pane.
  if (JSON.stringify(git) !== JSON.stringify(curGit)) await d.git.set(() => git)
  if (JSON.stringify(numstat) !== JSON.stringify(curNum)) await d.numstat.set(() => numstat)
}

// --- sizes ---

// `du` in the background: at most 4 at a time, the others queued.
const DU_PARALLEL = 4
const duRunning = new Set<string>()
const duQueue: string[] = []
// Sizes measured and not yet written to the atom (flushDu).
let duDone: Record<string, number | null> = {}
// Folders to measure again: a write marks them here instead of deleting their size, which stays on screen
// until the new one arrives. Not drawn.
const stale = new Set<string>()

// A write inside these folders (or on the folders themselves): they are measured again at the next measurement.
export function markStale(paths: readonly string[]): void {
  for (const p of staleDirs(paths)) stale.add(p)
}

// With Σ on and the Files tab in view: the visible folders with no size, or to be measured again, are queued
// for `du`. Called at the end of a turn, on entering the Files tab, turning Σ on and opening a folder.
export async function measureDirs(d: FilesDeps): Promise<void> {
  try {
    const [t, sizes, g, isShown] = await Promise.all([d.tree.get(), d.sizes.get(), d.git.get(), d.inView()])
    if (!isShown || !t.showSizes || t.query.trim() !== '') return
    const dirs = visibleRows(t, new Set(g?.ignored ?? [])).slice(0, MAX_ROWS).filter(r => r.node.kind === 'dir' && !r.node.isLink).map(r => r.node.id)
    for (const dir of duTargets(dirs, sizes, duRunning, stale)) if (!duQueue.includes(dir)) duQueue.push(dir)
    void pumpDu(d)
  } catch {}
}

// Before a queued `du` starts, the tree is read again: with Σ off, an active filter or the tab hidden, the
// queue is emptied.
async function pumpDu(d: FilesDeps): Promise<void> {
  while (duRunning.size < DU_PARALLEL && duQueue.length > 0) {
    try {
      const [t, isShown] = await Promise.all([d.tree.get(), d.inView()])
      if (!isShown || !t.showSizes || t.query.trim() !== '') {
        duQueue.length = 0
        if (duRunning.size === 0) void flushDu(d)
        return
      }
    } catch {}
    if (duRunning.size >= DU_PARALLEL) return
    const dir = duQueue.shift()
    if (dir === undefined) return
    duRunning.add(dir)
    // A write during the measurement marks it again: the next measurement redoes it.
    stale.delete(dir)
    void runDu(d, dir).finally(() => {
      duRunning.delete(dir)
      if (duRunning.size === 0 && duQueue.length === 0) void flushDu(d)
      void pumpDu(d)
    })
  }
}

// `du -sk` of a folder: even with exit 1 (unreadable subfolders) the total is there; without one, null.
async function runDu(d: FilesDeps, dir: string): Promise<void> {
  let size: number | null = null
  try {
    const s = await d.sources()
    const r = await d.run(['du', '-sk', abs(s.root, dir)], { cwd: s.root, timeoutMs: 5000 })
    size = parseDu(r.stdout)
  } catch {}
  duDone[dir] = size
}

// The measured sizes are written all together when the queue empties, and only if something changes: every
// write redraws the pane.
async function flushDu(d: FilesDeps): Promise<void> {
  const done = duDone
  duDone = {}
  if (Object.keys(done).length === 0) return
  try {
    if (changes(await d.sizes.get(), done)) await d.sizes.set(cur => ({ ...cur, ...done }))
  } catch {}
}

// --- search and fields ---

const SEARCH_LIMIT = 50
// The search starts when the user stops typing for this long.
export const SEARCH_MS = 150
// Index of the vault paths for the search; dropped after every Jarvis write, at every session and when a
// search restarts from empty. null inside the promise: ls-files failed, never kept.
let index: Promise<string[] | null> | null = null
let searchSeq = 0
// The text of the Filter and Move fields: a key updates it without writing an atom, so without a redraw, and a
// redraw always carries the current text. null: no key since the module started (the atom counts).
let typedQuery: string | null = null
let typedMove: string | null = null

export function dropIndex(): void {
  index = null
}

export const queryText = (t: Tree): string => typedQuery ?? t.query
export const moveText = (op: { text: string }): string => typedMove ?? op.text
export function typeMove(text: string): void {
  typedMove = text
}
// A new or closed Move field starts again from the file's path.
export function resetMove(): void {
  typedMove = null
}
// The filter cleared from outside (a path shown in the Files tab): the field restarts from the atom and a
// pending search no longer writes.
export function resetQuery(): void {
  typedQuery = null
  searchSeq++
}

async function vaultPaths(d: FilesDeps, root: string): Promise<string[]> {
  const p = (index ??= runGit(d.run, root, ['ls-files', '-co', '--exclude-standard', '-z'], 10_000).then(r => (r === null ? null : parseLsFiles(r.stdout, r.isTruncated))))
  const paths = await p
  // A failed ls-files is not cached: the next search tries again.
  if (paths === null && index === p) index = null
  return paths ?? []
}

// A key in the filter: the text stays in the module, the search starts SEARCH_MS after the last key.
export function typeQuery(d: FilesDeps, text: string): void {
  typedQuery = text
  const seq = ++searchSeq
  d.clock.after(SEARCH_MS, () => {
    if (seq === searchSeq) void runSearch(d, text, seq)
  })
}

// Enter in the filter: the search starts at once.
export function search(d: FilesDeps, text: string): Promise<void> {
  typedQuery = text
  return runSearch(d, text, ++searchSeq)
}

// Query and results in a single write; a search overtaken by a newer key does not write.
async function runSearch(d: FilesDeps, query: string, seq: number): Promise<void> {
  try {
    const t = await d.tree.get()
    let hits: string[] = []
    if (query.trim() !== '') {
      // A new search reads the index again: files created by hand in the meantime are included.
      if (t.query.trim() === '') index = null
      const s = await d.sources()
      hits = searchHits(await vaultPaths(d, s.root), query, SEARCH_LIMIT, t.showHidden)
    }
    if (seq !== searchSeq) return
    await d.tree.set(x => ({ ...x, query, hits, cursor: hits[0] ?? x.cursor }))
  } catch {}
}
