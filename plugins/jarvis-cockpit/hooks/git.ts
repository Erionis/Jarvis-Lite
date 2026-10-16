// Read-only git state of the vault. The parsing comes from filetree (MIT, Kurt Buhler; see LICENSE-filetree), simplified:
// status, ls-files, log, diff and numstat, with paths relative to the repo root.
import type { DiffView, GitView, Numstat } from '../types'

export type Change = 'new' | 'mod' | 'del'
export type DiffSource = 'untracked' | 'uncommitted' | 'committed'

// Beyond this length the diff is cut: a drawing carries at most 100 000 characters.
export const MAX_DIFF_CHARS = 80_000

// `git status --porcelain=v1 -z --ignored=traditional --untracked-files=normal` from the vault root.
export function parseStatus(stdout: string): GitView {
  const changed: Record<string, Change> = {}
  const ignored: string[] = []
  const parts = stdout.split('\0')
  for (let i = 0; i < parts.length; i++) {
    const rec = parts[i] ?? ''
    if (rec.length < 4 || rec.startsWith('## ')) continue
    const xy = rec.slice(0, 2)
    const path = rec.slice(3).replace(/\/$/, '')
    // A rename or copy carries the original path in the next record.
    if (xy[0] === 'R' || xy[0] === 'C') i++
    if (xy === '!!') {
      ignored.push(path)
      continue
    }
    changed[path] = xy === '??' || (xy.includes('A') && !xy.includes('D')) ? 'new' : xy.includes('D') ? 'del' : 'mod'
  }
  return { changed, ignored }
}

// `git ls-files -co --exclude-standard -z`: a truncated output loses the last path, which may be cut in half.
export function parseLsFiles(stdout: string, isTruncated: boolean): string[] {
  const paths = stdout.split('\0').filter(Boolean)
  if (isTruncated) paths.pop()
  return paths
}

// The status of the file alone decides where the diff comes from: empty (or ignored) means the last commit.
export function diffSource(statusOfFile: string): DiffSource {
  const rec = statusOfFile.split('\0')[0] ?? ''
  if (rec.startsWith('??')) return 'untracked'
  return rec.length >= 4 && !rec.startsWith('!!') ? 'uncommitted' : 'committed'
}

// `git log -1 --format=%H%x00%ct%x00%s -- <file>`; empty if the file has no history.
export function parseLogHead(stdout: string): { hash: string; at: number; subject: string } | null {
  const [hash = '', ct = '', subject = ''] = stdout.trim().split('\0')
  if (!/^[0-9a-f]{7,64}$/.test(hash)) return null
  return { hash, at: Number(ct) * 1000, subject }
}

// A diff cut in the middle of a hunk is not drawn: it is cut before the hunk that overflows.
export function clipDiff(text: string, max: number): { text: string; isCut: boolean } {
  if (text.length <= max) return { text, isCut: false }
  // The `\n` of the cut stays in the text: the cut falls at max - 1 so that the result is within max.
  const cut = text.lastIndexOf('\n@@', max - 1)
  return { text: cut > 0 ? text.slice(0, cut + 1) : '', isCut: true }
}

export function toDiffView(source: DiffSource, diffText: string | null, head: { at: number; subject: string } | null): DiffView {
  if (source === 'untracked') return { kind: 'untracked' }
  if (diffText === null) return { kind: 'error' }
  const { text, isCut } = clipDiff(diffText, MAX_DIFF_CHARS)
  if (source === 'uncommitted') return { kind: 'uncommitted', text, isCut }
  if (head === null) return { kind: 'none' }
  return { kind: 'commit', text, isCut, at: head.at, subject: head.subject }
}

// `git diff --numstat -z HEAD`: "add\tdel\tpath" for each file; a rename has an empty path and carries source
// and destination in the next two records; a binary has "-" and counts zero.
export function parseNumstat(stdout: string): Numstat {
  const out: Numstat = {}
  const parts = stdout.split('\0')
  for (let i = 0; i < parts.length; i++) {
    const m = (parts[i] ?? '').match(/^(-|\d+)\t(-|\d+)\t(.*)$/)
    if (!m) continue
    let path = m[3] ?? ''
    if (path === '') {
      path = parts[i + 2] ?? ''
      i += 2
    }
    if (path !== '') out[path] = { add: m[1] === '-' ? 0 : Number(m[1]), del: m[2] === '-' ? 0 : Number(m[2]) }
  }
  return out
}
