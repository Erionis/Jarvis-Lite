import { test, expect } from 'claude-code/testing'
import type { GitView, Numstat, Tree } from '../types'
import { SEARCH_MS, markStale, measureDirs, queryText, refreshGit, search, typeQuery, type FilesDeps } from '../hooks/filesFlow'
import { emptyTree, withChildren } from '../hooks/tree'
import { MEM_ROOT, flush, memCell, memClock, memFs, memRun, memSources } from './ports'

const dir = (name: string) => ({ name, kind: 'dir' as const, mtimeMs: 0, size: 0, isLink: false })
const isStatus = (argv: readonly string[]): boolean => argv.includes('status')
const ignoredFlags = (calls: string[][]) => calls.filter(isStatus).map(a => a.find(x => x.startsWith('--ignored=')))

// The Files tab with fake ports: fake processes, in-memory atoms; `view.shown` says whether the tab is in view.
function filesWorld(answer: (argv: readonly string[]) => string | null, over: { tree?: Tree; sizes?: Record<string, number | null> } = {}) {
  const proc = memRun(answer)
  const clock = memClock()
  const view = { shown: true }
  const tree = memCell<Tree>(over.tree ?? emptyTree())
  const git = memCell<GitView | null>(null)
  const numstat = memCell<Numstat | null>(null)
  const sizes = memCell<Record<string, number | null>>(over.sizes ?? {})
  const deps: FilesDeps = { fs: memFs({}).fs, run: proc.run, clock, sources: memSources({}), tree, git, numstat, sizes, inView: async () => view.shown }
  return { proc, clock, view, tree, git, sizes, deps }
}

test('filesFlow: git calls are queued, one run in flight and a single one after it; the newest state wins', async () => {
  let n = 0
  const w = filesWorld(argv => (!isStatus(argv) ? '' : ++n === 1 ? ' M a.md\0' : '?? b.md\0'))
  w.proc.hold()
  const first = refreshGit(w.deps)
  await flush()
  const later = [refreshGit(w.deps), refreshGit(w.deps)]
  w.proc.release()
  await Promise.all([first, ...later])
  expect(w.proc.calls.filter(isStatus).length).toBe(2)
  expect(w.git.value).toEqual({ changed: { 'b.md': 'new' }, ignored: [] })
})

test('filesFlow: with the Files tab hidden git does not run', async () => {
  const w = filesWorld(() => '')
  w.view.shown = false
  await refreshGit(w.deps, { ignored: true })
  expect(w.proc.calls).toEqual([])
  expect(w.git.sets).toBe(0)
})

test('filesFlow: ignored files are read only when asked for, other runs keep the previous ones', async () => {
  const w = filesWorld(argv => (!isStatus(argv) ? '' : argv.includes('--ignored=traditional') ? ' M a.md\0!! node_modules/\0' : '?? b.md\0'))
  await refreshGit(w.deps, { ignored: true })
  expect(w.git.value).toEqual({ changed: { 'a.md': 'mod' }, ignored: ['node_modules'] })
  await refreshGit(w.deps)
  expect(w.git.value).toEqual({ changed: { 'b.md': 'new' }, ignored: ['node_modules'] })
  await refreshGit(w.deps, { ignored: true })
  expect(ignoredFlags(w.proc.calls)).toEqual(['--ignored=traditional', '--ignored=no', '--ignored=traditional'])
})

test('filesFlow: a failed git status does not lose the request to read ignored files', async () => {
  let fail = true
  const w = filesWorld(argv => (isStatus(argv) && fail ? null : ''))
  await refreshGit(w.deps, { ignored: true })
  expect(w.git.value).toBe(null)
  fail = false
  await refreshGit(w.deps)
  expect(ignoredFlags(w.proc.calls)).toEqual(['--ignored=traditional', '--ignored=traditional'])
})

test('filesFlow: a failed git status without ignored files does not lose the list: the next run reads them again', async () => {
  let failNo = false
  const w = filesWorld(argv => (!isStatus(argv) ? '' : argv.includes('--ignored=no') && failNo ? null : argv.includes('--ignored=traditional') ? ' M a.md\0!! node_modules/\0' : '?? b.md\0'))
  await refreshGit(w.deps, { ignored: true })
  expect(w.git.value).toEqual({ changed: { 'a.md': 'mod' }, ignored: ['node_modules'] })
  failNo = true
  await refreshGit(w.deps)
  expect(w.git.value).toBe(null)
  failNo = false
  await refreshGit(w.deps)
  expect(w.git.value).toEqual({ changed: { 'a.md': 'mod' }, ignored: ['node_modules'] })
  expect(ignoredFlags(w.proc.calls)).toEqual(['--ignored=traditional', '--ignored=no', '--ignored=traditional'])
})

test('filesFlow: a request during a run with ignored files asks for the ignored files again', async () => {
  const w = filesWorld(argv => (!isStatus(argv) ? '' : argv.includes('--ignored=traditional') ? ' M a.md\0!! node_modules/\0' : '?? b.md\0'))
  await refreshGit(w.deps, { ignored: true })
  w.proc.hold()
  const first = refreshGit(w.deps, { ignored: true })
  await flush()
  const queued = refreshGit(w.deps, { ignored: true })
  w.proc.release()
  await Promise.all([first, queued])
  expect(ignoredFlags(w.proc.calls)).toEqual(['--ignored=traditional', '--ignored=traditional', '--ignored=traditional'])
  expect(w.git.value).toEqual({ changed: { 'a.md': 'mod' }, ignored: ['node_modules'] })
})

test('filesFlow: with Σ off there is no du and no size write', async () => {
  const w = filesWorld(argv => `1\t${argv[2]}\n`, { tree: withChildren(emptyTree(), '', [dir('A')]) })
  markStale(['A/x.md'])
  await measureDirs(w.deps)
  await flush()
  expect(w.proc.calls).toEqual([])
  expect(w.sizes.sets).toBe(0)
})

test('filesFlow: with Σ on only the written folder is measured again; the old size stays until the new one', async () => {
  const tree = { ...withChildren(emptyTree(), '', [dir('A'), dir('B')]), showSizes: true }
  const w = filesWorld(argv => (argv[0] === 'du' ? `9\t${argv[2]}\n` : ''), { tree, sizes: { A: 1024, B: 2048 } })
  markStale(['A/x.md'])
  w.proc.hold()
  await measureDirs(w.deps)
  await flush()
  expect(w.proc.calls).toEqual([['du', '-sk', `${MEM_ROOT}/A`]])
  expect(w.sizes.value).toEqual({ A: 1024, B: 2048 })
  w.proc.release()
  await flush()
  expect(w.sizes.value).toEqual({ A: 9 * 1024, B: 2048 })
  expect(w.sizes.sets).toBe(1)
  // Measured again, it no longer needs redoing.
  await measureDirs(w.deps)
  await flush()
  expect(w.proc.calls.length).toBe(1)
})

test('filesFlow: three keystrokes close together in the filter give a single search, SEARCH_MS after the last', async () => {
  const w = filesWorld(argv => (argv.includes('ls-files') ? 'To Do.md\0NOVA.md\0' : ''))
  typeQuery(w.deps, 't')
  w.clock.advance(50)
  typeQuery(w.deps, 'to')
  w.clock.advance(50)
  typeQuery(w.deps, 'to d')
  expect(queryText(w.tree.value)).toBe('to d')
  w.clock.advance(SEARCH_MS - 1)
  await flush()
  expect(w.tree.sets).toBe(0)
  w.clock.advance(1)
  await flush()
  expect(w.tree.sets).toBe(1)
  expect(w.tree.value).toMatchObject({ query: 'to d', hits: ['To Do.md'] })
  expect(w.proc.calls.filter(a => a.includes('ls-files')).length).toBe(1)
})

test('filesFlow: Enter searches at once and the pending keystroke does not write afterwards', async () => {
  const w = filesWorld(argv => (argv.includes('ls-files') ? 'To Do.md\0NOVA.md\0' : ''))
  typeQuery(w.deps, 'nov')
  await search(w.deps, 'nova')
  expect(w.tree.value).toMatchObject({ query: 'nova', hits: ['NOVA.md'] })
  w.clock.advance(SEARCH_MS)
  await flush()
  expect(w.tree.sets).toBe(1)
})
