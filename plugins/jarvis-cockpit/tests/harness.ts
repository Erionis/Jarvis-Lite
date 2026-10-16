import { mock, type FoundElement, type MockClock } from 'claude-code/testing'
import type { On } from 'claude-code'
import { PLUGIN } from '../hooks/state'
import { EMPTY_READING } from '../hooks/reader'
import { emptyTree } from '../hooks/tree'
import { IDLE } from '../hooks/mascot'
import { SETTLE_MS } from '../hooks/flight'

// The work after writes starts once they settle (settle.ts): let the wait register, then go past it.
export async function settled(clock: MockClock): Promise<void> {
  await clock.settle()
  await clock.advance(SETTLE_MS)
}

// Lets what is already running finish (editor messages, handlers without await) without advancing the clock:
// it is the `settle` of the fake clock, the engine's signal that the event loop has settled, not a real-time wait.
export function quiet(clock: MockClock): Promise<void> {
  return clock.settle()
}

export const AT = new Date(2026, 9, 9, 14, 32).getTime()
export const ROOT = '/v'

export const paneProps = (bodyColumns = 46) => ({ title: 'Jarvis', isFocused: false, bodyColumns, placement: 'dock' as const, scroll: { offset: 0, bodyRows: 40 }, view: {} })

type Waiter = { key: string; pred: (v: unknown) => boolean; done: () => void }

// Real in-memory state: update() reads and writes as in the engine; `until` waits for a write
// that satisfies the predicate (fire-and-forget handlers have no other event to wait for).
// `clock` is the fake clock (AT): advance() fires the expired $.clock.after timers.
// `hold(key)`: if it returns a promise, the write of that key lands only when it resolves (like an engine
// write that arrives later): until it lands, whoever reads the atom still sees the previous value.
// A held write that rejects makes `update` fail. The types document a retry only on a missed version
// (`ifVersion`), not after a rejection: how many attempts the engine makes is not assumed, and `hold` is called again on each attempt.
export function liveState(on: On, init: Record<string, unknown>, hold?: (key: string) => Promise<void> | undefined) {
  const clock = mock.clock(on, { now: AT })
  const values: Record<string, unknown> = {
    turn: 1, feed: [], touched: [], agentRuns: {}, mascot: IDLE, ends: [], working: false, tab: 'recap', opened: false, tree: emptyTree(), git: null, written: {}, sizes: {}, numstat: null, reading: EMPTY_READING, draft: null,
    ...init,
  }
  const waiters: Waiter[] = []
  // Version per key, with compare-and-set as in the engine: concurrent update() calls are not lost.
  const versions: Record<string, number> = {}
  const versionOf = (key: string): number => versions[key] ?? 1
  // Successful writes per key: every write redraws the pane.
  const sets: Record<string, number> = {}
  // Reads per key: a draw redraws when a value it read changes.
  const gets: Record<string, number> = {}
  on('state.get', { plugin: PLUGIN }, (_$, e) => {
    gets[e.key] = (gets[e.key] ?? 0) + 1
    return { value: { value: values[e.key], version: versionOf(e.key) } } as never
  })
  const land = (e: { key: string; value: unknown }): never => {
    const ifVersion = (e as { ifVersion?: number }).ifVersion
    if (ifVersion !== undefined && ifVersion !== versionOf(e.key)) return { value: { isSet: false as const, version: versionOf(e.key) } } as never
    values[e.key] = e.value
    const version = versionOf(e.key) + 1
    versions[e.key] = version
    sets[e.key] = (sets[e.key] ?? 0) + 1
    for (const w of waiters.splice(0)) {
      if (w.key === e.key && w.pred(e.value)) w.done()
      else waiters.push(w)
    }
    return { value: { isSet: true as const, version } } as never
  }
  on('state.set', { plugin: PLUGIN }, (_$, e) => {
    const wait = hold?.(e.key)
    return wait === undefined ? land(e) : wait.then(() => land(e))
  })
  const until = (key: string, pred: (v: unknown) => boolean): Promise<void> =>
    new Promise(done => { if (pred(values[key])) done(); else waiters.push({ key, pred, done }) })
  return { values, until, clock, sets, gets }
}

// Fake plugin store: `data` per key; `sets` the keys written (rejected writes too), `deletes` the ones
// deleted, in order. With `failSet` every write rejects, like a full store. `until` waits for a condition
// to hold after a write or a delete.
export function fakeStore(on: On, init: Record<string, unknown> = {}, opts: { failSet?: boolean } = {}) {
  const data: Record<string, unknown> = { ...init }
  const sets: string[] = []
  const deletes: string[] = []
  const waiters: { pred: () => boolean; done: () => void }[] = []
  const wake = (): void => {
    for (const w of waiters.splice(0)) {
      if (w.pred()) w.done()
      else waiters.push(w)
    }
  }
  on('store.get', (_$, e) => ({ value: data[e.key] }) as never)
  on('store.keys', () => ({ value: Object.keys(data) }) as never)
  on('store.set', (_$, e) => {
    sets.push(e.key)
    if (opts.failSet !== true) data[e.key] = e.value
    wake()
    return (opts.failSet === true ? { deny: 'store pieno' } : { value: undefined }) as never
  })
  on('store.delete', (_$, e) => {
    deletes.push(e.key)
    delete data[e.key]
    wake()
    return { value: undefined } as never
  })
  const until = (pred: () => boolean): Promise<void> => new Promise(done => { if (pred()) done(); else waiters.push({ pred, done }) })
  return { data, sets, deletes, until }
}

type DirEntry = { name: string; kind: 'file' | 'dir' | 'other'; mtimeMs?: number; size?: number; isLink?: boolean }

// The only line a vault needs for the cockpit to speak Italian: the heading of the Italian capability table.
export const ITALIAN_HEADING = "## Capacita' Jarvis\n"

// Fake vault under ROOT: `files` and `dirs` by relative path ('' is the root). Without CLAUDE.md
// among the files, the sources table is missing and there are no roles; the fallback CLAUDE.md has only
// the Italian heading, so the inferred language is Italian, as in the tests written before the catalog. `links`: symlink (relative
// path) → absolute target, even outside ROOT; a missing target is a broken link.
// fs.write writes into the files map, which fakeVault returns; with `writeError` it fails.
// `writes` collects the written paths; with `bumpMtime` every write advances the mtime of the file.
export function fakeVault(on: On, files: Record<string, string>, dirs: Record<string, DirEntry[]> = {}, links: Record<string, string> = {}, opts: { writeError?: string; writes?: string[]; bumpMtime?: boolean } = {}) {
  const bumped = new Map<string, number>()
  const abs = (rel: string) => (rel === '' ? ROOT : rel.startsWith('/') ? rel : `${ROOT}/${rel}`)
  const fileAt = new Map(Object.entries({ 'CLAUDE.md': ITALIAN_HEADING, ...files }).map(([k, v]) => [abs(k), v]))
  const dirAt = new Map(Object.entries(dirs).map(([k, v]) => [abs(k), v]))
  const linkAt = new Map(Object.entries(links).map(([k, v]) => [abs(k), v]))
  on('session.root', () => ({ value: ROOT }))
  on('session.cwd', () => ({ value: ROOT }))
  on('fs.exists', (_$, e) => ({ value: fileAt.has(e.path) || dirAt.has(e.path) }) as never)
  on('fs.read', (_$, e) => {
    const f = fileAt.get(e.path)
    if (f === undefined) throw new Error('ENOENT')
    // `as: 'bytes'`: the content as UTF-8 base64, like the engine.
    if (e.as === 'bytes') return { value: { base64: btoa(Array.from(new TextEncoder().encode(f), c => String.fromCharCode(c)).join('')) } } as never
    return { value: f } as never
  })
  on('fs.stat', (_$, e) => {
    const to = linkAt.get(e.path)
    const p = to ?? e.path
    const isLink = to !== undefined
    const f = fileAt.get(p)
    const real = e.resolve ? { realPath: p } : {}
    if (f === undefined && dirAt.has(p)) return { value: { kind: 'dir', size: 0, mtimeMs: AT, isLink, ...real } } as never
    if (f === undefined && isLink) return { value: { kind: 'other', size: 0, mtimeMs: 0, isLink } } as never
    if (f === undefined) throw new Error('ENOENT')
    return { value: { kind: 'file', size: f.length, mtimeMs: bumped.get(p) ?? AT - 3 * 86_400_000, isLink, ...real } } as never
  })
  on('fs.write', (_$, e) => {
    if (opts.writeError !== undefined) return { deny: opts.writeError } as never
    fileAt.set(e.path, e.text)
    opts.writes?.push(e.path)
    if (opts.bumpMtime) bumped.set(e.path, AT + (opts.writes?.length ?? 1) * 1000)
    return { value: undefined } as never
  })
  on('fs.list', (_$, e) => {
    const d = dirAt.get(e.path)
    if (d === undefined) throw new Error('ENOENT')
    return { value: d.map(x => ({ name: x.name, kind: x.kind, size: x.size ?? 1, mtimeMs: x.mtimeMs ?? 0, isLink: x.isLink ?? false })) } as never
  })
  // The files by absolute path: a test reads here what was written.
  return fileAt
}

// Fake git: answers by subcommand (the first word after the options); unknown → exit 1. `late`: per
// subcommand, what to await before answering (for example the `clock.sleep` of liveState: it answers late).
export function fakeGit(on: On, out: Record<string, string>, calls: string[][] = [], late: Record<string, () => Promise<void>> = {}): string[][] {
  on('process.run', (_$, e) => {
    calls.push([...e.argv])
    const sub = e.argv.find((a, i) => i > 0 && !a.startsWith('-')) ?? ''
    const stdout = out[sub]
    const answer = { value: stdout === undefined
      ? { exitCode: 1, stdout: '', stderr: 'no', isStdoutTruncated: false }
      : { exitCode: 0, stdout, stderr: '', isStdoutTruncated: false } } as never
    const wait = late[sub]
    return wait === undefined ? answer : wait().then(() => answer)
  })
  return calls
}

// Card titles are Svg (`▌TITLE` or `01 TITLE`, class card-title): find({ text }) does not see them, they
// are read from the `alt`, which is the title as written in the code. Other Svg (icons, mascot) are not.
export async function cardTitles(pane: { findAll: (q: { type: string }) => Promise<FoundElement[]> }): Promise<string[]> {
  return (await pane.findAll({ type: 'Svg' })).filter(n => String(n.props.source ?? '').includes('class="card-title"')).map(n => String(n.props.alt ?? ''))
}
