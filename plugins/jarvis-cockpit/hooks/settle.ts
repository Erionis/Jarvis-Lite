import type { Activity } from '../types'
import { settle, settleThen } from './flight'
import { FIGURE_DIR } from './customFigure'
import { basename, dirname } from './format'
import type { ClockPort } from './ports'
import { parentOf } from './tree'

// The work after writes (by Jarvis or by the cockpit) that does not protect the user's text, in a single step
// when the writes settle: tree folders, git, sizes, Recap snapshot, To Do, Memories and Diary tabs.
// The log, the status line, the bubble, Reading and the draft follow at once, outside this module.
export type SettleDeps = {
  clock: ClockPort
  // The tree folders already read.
  loaded: () => Promise<readonly string[]>
  loadDir: (rel: string) => Promise<void>
  refreshGit: (opts: { ignored?: boolean }) => Promise<void>
  measureDirs: () => Promise<void>
  snapshot: () => Promise<void>
  // The To Do tab rereads if the file is no longer the one read (a stat): after a cockpit write it has already reread it.
  todoPath: () => Promise<string | null>
  checkTodo: () => Promise<void>
  // The memories folder, if the Memories tab has read it.
  memDir: () => Promise<string | null>
  loadMemories: () => Promise<void>
  // The diary folder, if the Diary tab already has its notes.
  diaryRoot: () => Promise<string | null>
  loadDiary: () => Promise<void>
  // The mascot folder (`99 - Jarvis/mascot`): any write in it, or of the folder itself, reads the figure again.
  loadFigure: () => Promise<void>
}

export type Wrote = Pick<Activity, 'verb' | 'path' | 'from'>

type Pending = { writes: Wrote[]; snapshot: boolean; measure: boolean }

const NONE: Pending = { writes: [], snapshot: false, measure: false }
const wait = settle()
let pending: Pending = NONE

// A new session starts from scratch (session.start, like resetQuery and resetMove): pending writes are
// thrown away and the open wait no longer fires, timers already queued included.
export function resetSettle(): void {
  pending = NONE
  wait.isOpen = false
}

// Writes are collected; the work starts when they settle, with all of them. `snapshot`: a file of a
// capability changed (Now, Waiting, handoff…). `measure`: a cockpit write, outside the turn, so the sizes are
// measured again here and not at the end of the turn.
export function settleWrites(d: SettleDeps, writes: readonly Wrote[], opts: { snapshot?: boolean; measure?: boolean } = {}): void {
  pending = {
    writes: [...pending.writes, ...writes],
    snapshot: pending.snapshot || opts.snapshot === true,
    measure: pending.measure || opts.measure === true,
  }
  settleThen(wait, d.clock, () => {
    const p = pending
    pending = NONE
    void afterSettle(d, p)
  })
}

async function afterSettle(d: SettleDeps, p: Pending): Promise<void> {
  try {
    const paths = [...new Set(p.writes.flatMap(a => (a.from !== undefined ? [a.path, a.from] : [a.path])))]
    // The sources can throw (CLAUDE.md just edited): without the Diary the rest of the settling goes on.
    const [loaded, todoPath, memDir, diaryRoot] = await Promise.all([d.loaded(), d.todoPath(), d.memDir(), d.diaryRoot().catch(() => null)])
    const jobs: Promise<void>[] = [
      d.refreshGit({ ignored: paths.some(x => basename(x) === '.gitignore') }),
      ...dirsToReload(loaded, p.writes).map(dir => d.loadDir(dir)),
    ]
    if (p.snapshot) jobs.push(d.snapshot())
    if (todoPath !== null && paths.includes(todoPath)) jobs.push(d.checkTodo())
    if (memDir !== null && paths.some(x => dirname(x) === memDir)) jobs.push(d.loadMemories())
    if (diaryRoot !== null && paths.some(x => x.startsWith(`${diaryRoot}/`))) jobs.push(d.loadDiary())
    if (paths.some(x => x === FIGURE_DIR || x.startsWith(`${FIGURE_DIR}/`))) jobs.push(d.loadFigure())
    await Promise.all(jobs)
    // Sizes after the folders: the rows that are visible now are measured.
    if (p.measure) await d.measureDirs()
  } catch {}
}

// The folders to read again after some writes: for each touched path, the deepest already-read folder that
// contains it (new folders under an open one too). The destination of a move can itself be a read folder;
// a deleted path or the source of a move cannot, so we start from the parent.
export function dirsToReload(loaded: readonly string[], writes: readonly Wrote[]): string[] {
  const open = new Set(loaded)
  const deepest = (start: string): string | null => {
    let d = start === '.' ? '' : start
    while (d !== '' && !open.has(d)) d = parentOf(d)
    return open.has(d) ? d : null
  }
  const out = new Set<string>()
  for (const a of writes) {
    const starts = [a.verb === 'delete' ? parentOf(a.path) : a.path, ...(a.verb === 'move' && a.from !== undefined ? [parentOf(a.from)] : [])]
    for (const st of starts) {
      const d = deepest(st)
      if (d !== null) out.add(d)
    }
  }
  return [...out]
}
