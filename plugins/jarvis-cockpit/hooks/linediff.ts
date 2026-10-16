// Unified line diff between two texts, for the diff button of the conflict card (file on disk → draft).
// A single hunk: the changed stretch between the common prefix and suffix, with CONTEXT lines around it.
// Inside the stretch the equal lines are aligned with the LCS; beyond MAX_CELLS cells the stretch becomes
// all "removed and then added" (correct, only less precise).

export const CONTEXT = 3
export const MAX_CELLS = 1_000_000

type Op = { sign: ' ' | '-' | '+'; line: string }

function middle(a: readonly string[], b: readonly string[]): Op[] {
  const n = a.length
  const m = b.length
  if (n * m > MAX_CELLS) return [...a.map(line => ({ sign: '-' as const, line })), ...b.map(line => ({ sign: '+' as const, line }))]
  // lcs[i][j]: lines in common between a[i..] and b[j..], in a flat array.
  const w = m + 1
  const lcs = new Uint32Array((n + 1) * w)
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      lcs[i * w + j] = a[i] === b[j] ? (lcs[(i + 1) * w + j + 1] ?? 0) + 1 : Math.max(lcs[(i + 1) * w + j] ?? 0, lcs[i * w + j + 1] ?? 0)
    }
  }
  const out: Op[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) { out.push({ sign: ' ', line: a[i] ?? '' }); i++; j++ }
    else if ((lcs[(i + 1) * w + j] ?? 0) >= (lcs[i * w + j + 1] ?? 0)) { out.push({ sign: '-', line: a[i] ?? '' }); i++ }
    else { out.push({ sign: '+', line: b[j] ?? '' }); j++ }
  }
  for (; i < n; i++) out.push({ sign: '-', line: a[i] ?? '' })
  for (; j < m; j++) out.push({ sign: '+', line: b[j] ?? '' })
  return out
}

// '' if the texts are equal.
export function lineDiff(before: string, after: string, nameBefore: string, nameAfter: string): string {
  if (before === after) return ''
  const a = before.split('\n')
  const b = after.split('\n')
  let pre = 0
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++
  let suf = 0
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++
  const lead = Math.min(CONTEXT, pre)
  const trail = Math.min(CONTEXT, suf)
  const ops: Op[] = [
    ...a.slice(pre - lead, pre).map(line => ({ sign: ' ' as const, line })),
    ...middle(a.slice(pre, a.length - suf), b.slice(pre, b.length - suf)),
    ...a.slice(a.length - suf, a.length - suf + trail).map(line => ({ sign: ' ' as const, line })),
  ]
  const lenA = ops.filter(o => o.sign !== '+').length
  const lenB = ops.filter(o => o.sign !== '-').length
  // With zero lines on one side, the number is that of the line before (the diff -u convention).
  const startA = lenA === 0 ? pre - lead : pre - lead + 1
  const startB = lenB === 0 ? pre - lead : pre - lead + 1
  return [`--- ${nameBefore}`, `+++ ${nameAfter}`, `@@ -${startA},${lenA} +${startB},${lenB} @@`, ...ops.map(o => `${o.sign}${o.line}`)].join('\n')
}
