import type { FsEntry, FsStat, FsStatOptions, ProcessRunResult } from 'claude-code'
import type { Sources } from '../types'

// The ports: what a module that cannot see `$` needs. `claude plugin validate` accepts atoms and `$` only in
// the hooks module file: register.tsx builds these closures and passes them to the modules, which receive fake
// ports in tests.

export type FsPort = {
  read: (path: string) => Promise<string>
  // The content as standard base64: needed to see the BOM, which reading as text may drop.
  readBytes: (path: string) => Promise<string>
  // With `{ resolve: true }` also `realPath`, where the path lands (absent when it leads nowhere).
  stat: (path: string, opts?: FsStatOptions) => Promise<FsStat>
  write: (path: string, text: string) => Promise<void>
  list: (path: string) => Promise<FsEntry[]>
  exists: (path: string) => Promise<boolean>
}

export type RunPort = (argv: readonly string[], opts: { cwd: string; timeoutMs: number }) => Promise<ProcessRunResult>

export type ClockPort = { now: () => Promise<number>; after: (ms: number, fn: () => void) => void }

// An atom. `set` passes the function the value that is really there (two sets at once are not lost) and
// resolves to the new value.
export type Cell<T> = { get: () => Promise<T>; set: (fn: (cur: T) => T) => Promise<T> }

// Equal by content: the same fields with the same values, at every level.
export function same(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null || Array.isArray(a) !== Array.isArray(b)) return false
  const ka = Object.keys(a)
  if (ka.length !== Object.keys(b).length) return false
  return ka.every(k => Object.hasOwn(b, k) && same((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

// The Cell of an atom: a `set` that does not change the value does not write, because every write redraws.
// `write` applies the function again to the value that is really there.
// `fn` may run twice (once for the comparison, once in the write); the last call is on the real value: an
// effect inside `fn` must be assigned, not accumulated.
export const cellOf = <T>(get: () => Promise<T>, write: (fn: (cur: T) => T) => Promise<T>): Cell<T> => ({
  get,
  set: async fn => {
    const cur = await get()
    return same(cur, fn(cur)) ? cur : write(fn)
  },
})

// An object atom is read with today's shape, `{ ...empty, ...value }`: a value saved by an old version of the
// plugin gets the new fields from the empty one, instead of undefined.
export const shaped = <T extends object>(empty: T, value: T | null | undefined): T => (value == null ? empty : { ...empty, ...value })
// An atom write that changes nothing is not made: every write redraws the pane, and a redraw while the user is
// clicking may lose the click. True if `patch` changes at least one field.
export const changes = (cur: object, patch: object): boolean => Object.entries(patch).some(([k, v]) => (cur as Record<string, unknown>)[k] !== v)

// The vault sources: root and capabilities declared in CLAUDE.md.
export type SourcesPort = () => Promise<Sources>

// The absolute path of a vault path; `''` is the root.
export const abs = (s: Sources, rel: string): string => (rel === '' ? s.root : `${s.root}/${rel}`)
