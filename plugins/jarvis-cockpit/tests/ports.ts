import type { Lang, Sources } from '../types'
import { same, type Cell, type ClockPort, type FsPort, type RunPort, type SourcesPort } from '../hooks/ports'

// Fake ports for the modules that do not see `$` (hooks/ports.ts).

export const MEM_ROOT = '/m'

const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s)
const toBase64 = (b: Uint8Array): string => btoa(Array.from(b, c => String.fromCharCode(c)).join(''))

// In-memory files by absolute path. Each write advances the mtime by 1000. `bom`: paths whose bytes
// start with the BOM, which the text read strips (like an engine that strips it). `writes`: the writes,
// in order; `beforeWrite`: called before every write (another chat writing in between).
// `onStat`: called before every stat with how many there have been on that path (1 for the first).
// There are no links: with `resolve`, a file lands on its own path.
export function memFs(files: Record<string, string>, opts: { bom?: string[]; beforeWrite?: (p: string) => void; onStat?: (p: string, n: number) => void } = {}) {
  const text = new Map(Object.entries(files))
  const mtime = new Map<string, number>()
  const bom = new Set(opts.bom ?? [])
  const writes: { path: string; text: string }[] = []
  const stats = new Map<string, number>()
  let tick = 1000
  const bytes = (p: string): Uint8Array => {
    const t = text.get(p)
    if (t === undefined) throw new Error('ENOENT')
    return utf8(bom.has(p) && !t.startsWith('\uFEFF') ? `\uFEFF${t}` : t)
  }
  const fs: FsPort = {
    read: async p => {
      const t = text.get(p)
      if (t === undefined) throw new Error('ENOENT')
      return t.startsWith('\uFEFF') ? t.slice(1) : t
    },
    readBytes: async p => toBase64(bytes(p)),
    stat: async (p, o) => {
      stats.set(p, (stats.get(p) ?? 0) + 1)
      opts.onStat?.(p, stats.get(p) ?? 0)
      return { kind: 'file', size: bytes(p).length, mtimeMs: mtime.get(p) ?? 1000, isLink: false, ...(o?.resolve === true ? { realPath: p } : {}) }
    },
    write: async (p, t) => {
      opts.beforeWrite?.(p)
      writes.push({ path: p, text: t })
      text.set(p, t)
      bom.delete(p)
      mtime.set(p, (tick += 1000))
    },
    list: async () => [],
    exists: async p => text.has(p),
  }
  // Another chat writes the file: new text, new mtime.
  const touch = (p: string, t: string): void => {
    text.set(p, t)
    mtime.set(p, (tick += 1000))
  }
  // The file's bytes as the base64 read would give them.
  const raw = (p: string): string => toBase64(bytes(p))
  return { fs, text, writes, touch, raw }
}

// Fake processes: `answer` gives the stdout for an argv (null: exit 1). `calls`: the argvs, in order. After `hold`
// the answers stay put until `release`; the exit is computed on release.
export function memRun(answer: (argv: readonly string[]) => string | null) {
  const calls: string[][] = []
  const held: (() => void)[] = []
  let holding = false
  const run: RunPort = async argv => {
    calls.push([...argv])
    if (holding) await new Promise<void>(r => { held.push(r) })
    const out = answer(argv)
    return { exitCode: out === null ? 1 : 0, stdout: out ?? '', stderr: '', isStdoutTruncated: false, isStderrTruncated: false }
  }
  const hold = (): void => { holding = true }
  const release = (): void => {
    holding = false
    for (const r of held.splice(0)) r()
  }
  return { run, calls, hold, release }
}

// An in-memory atom: `sets` counts the writes.
export function memCell<T>(init: T): Cell<T> & { value: T; sets: number } {
  const c = {
    value: init,
    sets: 0,
    get: async () => c.value,
    // Like the Cells of register.tsx (cellOf): an equal value is not written.
    set: async (fn: (cur: T) => T) => {
      const next = fn(c.value)
      if (same(next, c.value)) return c.value
      c.value = next
      c.sets++
      return c.value
    },
  }
  return c
}

// A fake clock: `advance` fires the expired timers, in order.
export function memClock(now = 0): ClockPort & { advance: (ms: number) => void; pending: () => number } {
  let at = now
  let timers: { due: number; fn: () => void }[] = []
  return {
    now: async () => at,
    after: (ms, fn) => { timers.push({ due: at + ms, fn }) },
    advance: ms => {
      at += ms
      const due = timers.filter(t => t.due <= at).sort((a, b) => a.due - b.due)
      timers = timers.filter(t => t.due > at)
      for (const t of due) t.fn()
    },
    pending: () => timers.length,
  }
}

// `lang`: the cockpit's language; the existing tests are Italian, so Italian is what they get.
export const memSources = (roles: Record<string, string>, lang: Lang = 'it'): SourcesPort => async (): Promise<Sources> => ({ root: MEM_ROOT, roles, hasTable: true, lang })

// Lets the queued promises run.
export const flush = async (): Promise<void> => { for (let i = 0; i < 20; i++) await Promise.resolve() }

// Handoff file names as Jarvis writes them (`<prefix>-<day>-<slug>.md`), built here so that no dated name is
// spelled out in the public sources. `md: false` gives the name as `/handoff resume` takes it, without the extension.
export const handoffName = (day: string, slug: string, opts: { prefix?: 'handoff' | 'session'; md?: boolean } = {}): string =>
  [opts.prefix ?? 'handoff', day, slug].join('-') + (opts.md === false ? '' : '.md')
