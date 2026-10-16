// Size column of the Files tab. The folder calculation with `du -sk` comes from filetree
// (MIT, Kurt Buhler; see LICENSE-filetree); here only the pure parts: parsing, format and the cache for the session.
import { ancestors } from './tree'

// Bytes in short form, base 1000 like the Finder: "999 B", "14 kB", "6,1 MB", "48 MB". `mark`: the decimal mark
// of the language (the catalog's files.decimalMark).
export function formatSize(bytes: number, mark: string): string {
  if (bytes < 1000) return `${bytes} B`
  const kb = Math.round(bytes / 1000)
  if (kb < 1000) return `${kb} kB`
  const units: [string, number][] = [['MB', 1e6], ['GB', 1e9], ['TB', 1e12]]
  for (const [unit, div] of units) {
    const v = bytes / div
    if (v < 999.5 || unit === 'TB') return v < 9.95 ? `${v.toFixed(1).replace('.', mark)} ${unit}` : `${Math.round(v)} ${unit}`
  }
  return `${bytes} B`
}

// `du -sk <folder>`: the first column in kilobytes (1024 bytes); null if the output does not have it.
export function parseDu(stdout: string): number | null {
  const m = stdout.match(/^(\d+)\s/)
  return m ? Number(m[1]) * 1024 : null
}

// The visible folders to measure: with no cached value (null means "failed", not repeated) or marked to be
// measured again, and with no `du` already running.
export function duTargets(dirs: readonly string[], sizes: Readonly<Record<string, number | null>>, running: ReadonlySet<string>, stale: ReadonlySet<string>): string[] {
  return dirs.filter(d => (!(d in sizes) || stale.has(d)) && !running.has(d))
}

// After a write the path itself (if it is a moved folder) and the folders that contain it are measured again.
export function staleDirs(paths: readonly string[]): string[] {
  return [...new Set(paths.flatMap(p => [p, ...ancestors(p)]))]
}
