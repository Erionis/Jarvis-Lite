import type { Verb } from '../types'
import { resolve } from './classify'
import { WRITES } from './theme'

export type ShellTouch = { verb: Verb; path: string; detail?: string }
export type ShellResult = { touches: ShellTouch[]; isUnparsed: boolean }

const READERS = new Set(['cat', 'head', 'tail', 'less', 'more', 'wc', 'bat', 'stat', 'file', 'diff', 'shasum', 'md5'])
const LISTERS = new Set(['ls', 'tree', 'du'])
const SEARCHERS = new Set(['grep', 'egrep', 'fgrep', 'rg', 'ugrep'])
const QUIET = new Set(['echo', 'printf', 'true', 'false', 'sleep', 'date', 'which', 'pwd', 'sort', 'uniq', 'tr', 'cut', 'fold', 'jq', 'xargs', 'export', 'test', '['])
const REDIRECT = /^(\d?>>?|&>)$/
const GREP_VALUE_FLAGS = ['-A', '-B', '-C', '-m', '-e', '-f']
const VALUE_FLAGS: Record<string, Set<string>> = {
  head: new Set(['-n', '-c']),
  tail: new Set(['-n', '-c']),
  tree: new Set(['-L', '-I']),
  sed: new Set(['-e', '-f']),
  grep: new Set(GREP_VALUE_FLAGS),
  egrep: new Set(GREP_VALUE_FLAGS),
  fgrep: new Set(GREP_VALUE_FLAGS),
  ugrep: new Set(GREP_VALUE_FLAGS),
  rg: new Set([...GREP_VALUE_FLAGS, '-g', '-t']),
}

export function splitSegments(command: string): string[] {
  const segments: string[] = []
  let current = ''
  let quote: string | null = null
  let heredoc: string | null = null
  const lines = command.split('\n')
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li] ?? ''
    if (heredoc !== null) {
      if (line.trim() === heredoc) heredoc = null
      continue
    }
    const hd = line.match(/<<-?\s*['"]?(\w+)['"]?/)
    for (let i = 0; i < line.length; i++) {
      const c = line.charAt(i)
      if (quote) {
        current += c
        if (c === quote) quote = null
        continue
      }
      if (c === '"' || c === "'") { quote = c; current += c; continue }
      if (c === '\\' && i + 1 < line.length) { current += c + line.charAt(i + 1); i++; continue }
      const two = line.slice(i, i + 2)
      if (two === '&&' || two === '||') { segments.push(current); current = ''; i++; continue }
      if (c === ';' || (c === '|' && line[i + 1] !== '|')) { segments.push(current); current = ''; continue }
      current += c
    }
    if (!quote) { segments.push(current); current = '' }
    else current += '\n'
    if (hd) heredoc = hd[1] ?? null
  }
  if (current) segments.push(current)
  return segments.map(s => s.trim()).filter(Boolean)
}

type Lexeme = { text: string; isOp: boolean }

// Like tokenize, but marks as operators (isOp) only the redirects/heredocs/inputs that appear unquoted.
function lex(segment: string): Lexeme[] {
  const tokens: Lexeme[] = []
  let current = ''
  let hasToken = false
  let quote: string | null = null
  for (let i = 0; i < segment.length; i++) {
    const c = segment.charAt(i)
    if (quote) {
      if (c === quote) quote = null
      else current += c
      continue
    }
    if (c === '"' || c === "'") { quote = c; hasToken = true; continue }
    if (c === '\\' && i + 1 < segment.length) { current += segment.charAt(i + 1); hasToken = true; i++; continue }
    if (c === ' ' || c === '\t') {
      if (hasToken) tokens.push({ text: current, isOp: false })
      current = ''
      hasToken = false
      continue
    }
    const redirect = segment.slice(i).match(/^(\d?>>?|&>)/)?.[1]
    if (redirect !== undefined && !hasToken) {
      tokens.push({ text: redirect, isOp: true })
      i += redirect.length - 1
      continue
    }
    if (redirect !== undefined && /^\d$/.test(current) && hasToken) {
      tokens.push({ text: current + redirect, isOp: true })
      current = ''
      hasToken = false
      i += redirect.length - 1
      continue
    }
    if (c === '<' && !hasToken) {
      const input = segment.slice(i).match(/^(<<<|<<-|<<|<)/)?.[1] ?? '<'
      tokens.push({ text: input, isOp: true })
      i += input.length - 1
      continue
    }
    current += c
    hasToken = true
  }
  if (hasToken) tokens.push({ text: current, isOp: false })
  return tokens
}

export function tokenize(segment: string): string[] {
  return lex(segment).map(t => t.text)
}

const dirOf = (p: string): string => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) || '/' : '.')
const isGlob = (p: string): boolean => /[*?]/.test(p)

// The variables assigned in the command itself (`NEW=/tmp/x; mkdir $NEW/a`) are substituted. A variable
// the command does not assign, or a `$(…)` substitution, leaves the path unknown: null.
function expand(p: string, vars: ReadonlyMap<string, string>): string | null {
  if (/`|\$\(/.test(p)) return null
  let isKnown = true
  const out = p.replace(/\$\{(\w+)\}|\$(\w+)/g, (_, a: string | undefined, b: string | undefined) => {
    const v = vars.get(a ?? b ?? '')
    if (v === undefined) isKnown = false
    return v ?? ''
  })
  return isKnown ? out : null
}

export function parseShell(command: string, cwd: string): ShellResult {
  const touches: ShellTouch[] = []
  let isUnparsed = false
  // An unknown path (unknown variable, or relative after a `cd` we cannot resolve) does not become a
  // vault file: the command stays a plain shell run.
  let isUnknown = false
  const vars = new Map<string, string>()
  let dir: string | null = cwd
  // A path with the variables already substituted, from the current folder; null if it is relative and the folder is unknown.
  const from = (p: string): string | null => (dir === null && !p.startsWith('/') ? null : resolve(dir ?? '/', p))
  const at = (raw: string): string | null => { const p = expand(raw, vars); return p === null ? null : from(p) }
  const add = (verb: Verb, raw: string, detail?: string): void => {
    if (raw === '' || raw.startsWith('~') || raw === '/dev/null' || raw.startsWith('&')) return
    const p = expand(raw, vars)
    const path = p === null ? null : from(isGlob(p) ? dirOf(p) : p)
    if (p === null || path === null) { isUnknown = true; return }
    if (isGlob(p)) {
      if (WRITES.has(verb)) touches.push({ verb, path, detail: p.slice(p.lastIndexOf('/') + 1) })
      else touches.push(detail === undefined ? { verb: 'search', path } : { verb: 'search', path, detail })
    } else touches.push(detail === undefined ? { verb, path } : { verb, path, detail })
  }

  // The move: the source too (in detail, as written) with the variables substituted.
  const move = (to: string, source: string): void => {
    const src = expand(source, vars)
    if (src === null) { isUnknown = true; return }
    add('move', to, src)
  }

  for (const segment of splitSegments(command)) {
    let tokens = lex(segment)
    const assigned: [string, string][] = []
    while (tokens.length && !tokens[0]?.isOp && /^\w+=/.test(tokens[0]?.text ?? '')) {
      const t = tokens[0]?.text ?? ''
      assigned.push([t.slice(0, t.indexOf('=')), t.slice(t.indexOf('=') + 1)])
      tokens = tokens.slice(1)
    }
    // Assignments only: they hold for the rest of the command. In front of a command they hold only for that one.
    if (!tokens.length) {
      for (const [name, value] of assigned) {
        const v = expand(value, vars)
        if (v === null) vars.delete(name)
        else vars.set(name, v)
      }
      continue
    }

    const rest: string[] = []
    for (let i = 0; i < tokens.length; i++) {
      const { text: tok, isOp } = tokens[i] ?? { text: '', isOp: false }
      if (isOp && REDIRECT.test(tok)) {
        const target = tokens[i + 1]?.text
        if (target !== undefined && !tok.startsWith('2')) add('edit', target)
        i++
        continue
      }
      if (isOp && tok.startsWith('<<')) { i++; continue }
      if (isOp && tok === '<') {
        const source = tokens[i + 1]?.text
        if (source !== undefined) add('read', source)
        i++
        continue
      }
      rest.push(tok)
    }
    const [cmd, ...args] = rest
    if (cmd === undefined) continue
    const valueFlags = VALUE_FLAGS[cmd]
    const operands: string[] = []
    for (let i = 0; i < args.length; i++) {
      const a = args[i] ?? ''
      if (valueFlags?.has(a)) { i++; continue }
      if (!a.startsWith('-') || a === '-') operands.push(a)
    }
    const last = operands[operands.length - 1] ?? ''

    if (cmd === 'cd') { dir = at(operands[0] ?? cwd); continue }
    if (QUIET.has(cmd)) continue
    if (READERS.has(cmd)) { operands.filter(o => o !== '-').forEach(o => add('read', o)); continue }
    if (LISTERS.has(cmd)) { (operands.length ? operands : ['.']).forEach(o => add('search', o)); continue }
    if (cmd === 'find') {
      const firstFlag = args.findIndex(a => a.startsWith('-'))
      const paths = firstFlag === -1 ? args : args.slice(0, firstFlag)
      ;(paths.length ? paths : ['.']).forEach(o => add('search', o))
      continue
    }
    if (SEARCHERS.has(cmd)) {
      const eIndex = args.findIndex(a => a === '-e')
      const hasPatternFlag = eIndex >= 0 || args.includes('-f')
      const pattern = eIndex >= 0 ? args[eIndex + 1] : hasPatternFlag ? undefined : operands[0]
      const files = hasPatternFlag ? operands : operands.slice(1)
      if (!files.length) {
        const isRecursive = args.some(a => a === '--recursive' || /^-[A-Za-z]*[rR][A-Za-z]*$/.test(a))
        if (cmd !== 'rg' && !isRecursive) continue
      }
      ;(files.length ? files : ['.']).forEach(o => add('search', o, pattern))
      continue
    }
    if (cmd === 'sed') {
      const isInPlace = args.some(a => a.startsWith('-i'))
      const hasScriptFlag = args.includes('-e') || args.includes('-f')
      const ops = operands.filter(o => o !== '')
      const files = hasScriptFlag ? ops : ops.slice(1)
      files.forEach(o => add(isInPlace ? 'edit' : 'read', o))
      continue
    }
    if (cmd === 'awk') { operands.slice(1).forEach(o => add('read', o)); continue }
    if (cmd === 'touch' || cmd === 'mkdir') { operands.forEach(o => add('create', o)); continue }
    if (cmd === 'rm' || cmd === 'rmdir') { operands.forEach(o => add('delete', o.replace(/\/+$/, ''))); continue }
    if (cmd === 'tee') { operands.forEach(o => add('edit', o)); continue }
    if (cmd === 'mv' && operands.length >= 2) { move(last, operands[0] ?? ''); continue }
    if (cmd === 'cp' && operands.length >= 2) {
      operands.slice(0, -1).forEach(o => add('read', o))
      add('create', last)
      continue
    }
    if (cmd === 'git' && (operands[0] === 'mv' || operands[0] === 'rm')) {
      if (operands[0] === 'rm') operands.slice(1).forEach(o => add('delete', o))
      else if (operands.length >= 3) move(last, operands[1] ?? '')
      continue
    }
    isUnparsed = true
  }
  return { touches, isUnparsed: isUnparsed || isUnknown }
}

// For the Activity log: which programs a command runs, not the whole text (to a reader a truncated
// `python3 /private/tmp/…` says nothing). One program for each segment, with the name without the path; for
// tools with subcommands the subcommand too (`git commit`, `kubectl get`). Without cd, assignments,
// shell words and comments; filters (head, wc, grep…) only if nothing else is left. '' if there is no name.
const WRAPPERS = new Set(['sudo', 'env', 'time', 'nohup', 'command', 'exec', 'builtin', '!', 'if', 'then', 'else', 'elif', 'do', 'while', 'until', '{', '('])
const OPENERS = new Set(['for', 'select', 'case', 'function'])
const SILENT = new Set(['cd', 'pushd', 'popd', 'export', 'source', '.', ':', 'set', 'unset', 'read', 'local', 'declare', 'shift', 'return', 'exit', 'trap', 'wait', 'alias', 'done', 'fi', 'esac', '}', ')'])
const FILTERS = new Set([...QUIET, 'head', 'tail', 'wc', 'grep', 'egrep', 'cat', 'sed', 'awk', 'less', 'more', 'tee'])
const SUB_FLAGS: Record<string, Set<string>> = {
  git: new Set(['-C', '-c']),
  kubectl: new Set(['-n', '--namespace', '--context', '--kubeconfig']),
  helm: new Set(['-n', '--namespace', '--kube-context']),
  docker: new Set(['-H', '--host', '--context']),
  gh: new Set(['-R', '--repo']),
  npm: new Set(['--prefix']),
  pnpm: new Set(['-C', '--dir', '--filter']),
  yarn: new Set(['--cwd']),
  make: new Set(['-C', '-f']),
  go: new Set(['-C']),
}
const SUB = new Set([...Object.keys(SUB_FLAGS), 'bun', 'brew', 'tea', 'claude', 'uv', 'pip', 'pip3', 'cargo', 'poetry', 'conda'])
const depth = (s: string): number => (s.match(/\(/g)?.length ?? 0) - (s.match(/\)/g)?.length ?? 0)

function segmentLabel(segment: string): string {
  const words: string[] = []
  const lexed = lex(segment)
  for (let i = 0; i < lexed.length; i++) {
    const t = lexed[i]
    if (t === undefined) continue
    if (t.isOp) { i++; continue }
    if (t.text.startsWith('#')) break
    words.push(t.text)
  }
  let i = 0
  while (i < words.length) {
    const w = words[i] ?? ''
    if (/^\w+=/.test(w)) {
      // A value with open parentheses (`F=(a b)`, `X=$(git …)`) goes on up to the one that closes them.
      let open = depth(w)
      i++
      while (open > 0 && i < words.length) open += depth(words[i++] ?? '')
      continue
    }
    if (WRAPPERS.has(w)) { i++; continue }
    break
  }
  const prog = words[i] ?? ''
  if (prog === '' || prog.startsWith('$') || OPENERS.has(prog) || SILENT.has(prog)) return ''
  const name = prog.slice(prog.lastIndexOf('/') + 1)
  if (!SUB.has(name)) return name
  const flags = SUB_FLAGS[name]
  for (let j = i + 1; j < words.length; j++) {
    const a = words[j] ?? ''
    if (flags?.has(a)) { j++; continue }
    if (a.startsWith('-')) continue
    return /^[a-z][\w-]*$/i.test(a) ? `${name} ${a}` : name
  }
  return name
}

export function commandLabel(command: string): string {
  const all = [...new Set(splitSegments(command).map(segmentLabel).filter(x => x !== ''))]
  const main = all.filter(x => !FILTERS.has(x.split(' ')[0] ?? ''))
  return (main.length > 0 ? main : all).join(', ')
}
