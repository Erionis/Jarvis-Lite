import { test, expect } from 'claude-code/testing'
import { commandLabel, parseShell, tokenize, splitSegments } from '../hooks/shell'

const V = '/v'

test('tokenize: quotes, spaces, concatenation, redirects', () => {
  expect(tokenize('cat "99 - Jarvis/memory/soul.md"')).toEqual(['cat', '99 - Jarvis/memory/soul.md'])
  expect(tokenize(`ls "99 - Jarvis/handoffs/"*.md`)).toEqual(['ls', '99 - Jarvis/handoffs/*.md'])
  expect(tokenize("echo 'a b' >> x.md")).toEqual(['echo', 'a b', '>>', 'x.md'])
  expect(tokenize('grep foo f 2>/dev/null')).toEqual(['grep', 'foo', 'f', '2>', '/dev/null'])
})

test('splitSegments: && ; | and heredoc', () => {
  expect(splitSegments('cd /v && cat a | head -3; echo x')).toEqual(['cd /v', 'cat a', 'head -3', 'echo x'])
  expect(splitSegments("python3 - <<'EOF'\nopen('a').write('x')\nEOF\nls b")).toEqual(["python3 - <<'EOF'", 'ls b'])
})

test('bootstrap: cd + cat + head', () => {
  const r = parseShell('cd /v && cat .jarvis-core/core-instructions.md | head -120; echo ----; cat "99 - Jarvis/memory/soul.md" | head -80', '/tmp')
  expect(r.touches).toEqual([
    { verb: 'read', path: '/v/.jarvis-core/core-instructions.md' },
    { verb: 'read', path: '/v/99 - Jarvis/memory/soul.md' },
  ])
  expect(r.isUnparsed).toBe(false)
})

test('sed: -n reads, -i edits', () => {
  expect(parseShell('sed -n 80,200p "99 - Jarvis/memory/soul.md"', V).touches).toEqual([{ verb: 'read', path: '/v/99 - Jarvis/memory/soul.md' }])
  expect(parseShell("sed -i '' 's/a/b/' f.md", V).touches).toEqual([{ verb: 'edit', path: '/v/f.md' }])
})

test('grep: the pattern as detail, the file as path', () => {
  expect(parseShell('grep -n -i -E "mode|claude code" "99 - Jarvis/memory/MEMORY.md"', V).touches).toEqual([
    { verb: 'search', path: '/v/99 - Jarvis/memory/MEMORY.md', detail: 'mode|claude code' },
  ])
  expect(parseShell('grep -rl foo', V).touches).toEqual([{ verb: 'search', path: '/v', detail: 'foo' }])
})

test('parseShell: ls and glob become a search on the folder', () => {
  expect(parseShell('ls "99 - Jarvis/handoffs/" | tail -5', V).touches).toEqual([{ verb: 'search', path: '/v/99 - Jarvis/handoffs' }])
  expect(parseShell('ls "99 - Jarvis/handoffs/"*.md', V).touches).toEqual([{ verb: 'search', path: '/v/99 - Jarvis/handoffs' }])
})

test('writes: redirect, touch, mv, rm, cp, tee', () => {
  expect(parseShell('echo hi > notes/x.md', V).touches).toEqual([{ verb: 'edit', path: '/v/notes/x.md' }])
  expect(parseShell('touch a.md', V).touches).toEqual([{ verb: 'create', path: '/v/a.md' }])
  expect(parseShell('mv "a b.md" c.md', V).touches).toEqual([{ verb: 'move', path: '/v/c.md', detail: 'a b.md' }])
  expect(parseShell('rm -rf old/', V).touches).toEqual([{ verb: 'delete', path: '/v/old' }])
  expect(parseShell('cp a.md b.md', V).touches).toEqual([{ verb: 'read', path: '/v/a.md' }, { verb: 'create', path: '/v/b.md' }])
  expect(parseShell('echo x | tee log.md', V).touches).toEqual([{ verb: 'edit', path: '/v/log.md' }])
})

test('parseShell: stderr and /dev/null are ignored', () => {
  expect(parseShell('cat a.md 2>/dev/null', V).touches).toEqual([{ verb: 'read', path: '/v/a.md' }])
})

test('parseShell: an unparseable command → isUnparsed', () => {
  expect(parseShell("python3 - <<'EOF'\nopen('a').write('x')\nEOF", V)).toEqual({ touches: [], isUnparsed: true })
  expect(parseShell('git status', V).isUnparsed).toBe(true)
})

test('parseShell: harmless commands → nothing', () => {
  expect(parseShell('echo ---; date', V)).toEqual({ touches: [], isUnparsed: false })
})

test('parseShell: flags with a value do not become operands', () => {
  expect(parseShell('head -n 50 a.md', V).touches).toEqual([{ verb: 'read', path: '/v/a.md' }])
  expect(parseShell('tail -n 20 a.md', V).touches).toEqual([{ verb: 'read', path: '/v/a.md' }])
  expect(parseShell('grep -A 3 foo a.md', V).touches).toEqual([{ verb: 'search', path: '/v/a.md', detail: 'foo' }])
})

test('grep: without a file it reads stdin, unless recursive', () => {
  expect(parseShell('cat a.md | grep foo', V).touches).toEqual([{ verb: 'read', path: '/v/a.md' }])
  expect(parseShell('grep -rl foo', V).touches).toEqual([{ verb: 'search', path: '/v', detail: 'foo' }])
  expect(parseShell('rg foo', V).touches).toEqual([{ verb: 'search', path: '/v', detail: 'foo' }])
})

test('glob: destructive globs keep the verb', () => {
  expect(parseShell('rm "h/"*.md', V).touches).toEqual([{ verb: 'delete', path: '/v/h', detail: '*.md' }])
})

test('sed -e/-f: the value is a script, not a file', () => {
  expect(parseShell('sed -n -e 5p a.md', V).touches).toEqual([{ verb: 'read', path: '/v/a.md' }])
  expect(parseShell("sed -i '' -e 's/a/b/' a.md", V).touches).toEqual([{ verb: 'edit', path: '/v/a.md' }])
})

test('parseShell: heredoc and input redirect', () => {
  expect(parseShell("cat > notes/x.md <<'EOF'\nciao\nEOF", V).touches).toEqual([{ verb: 'edit', path: '/v/notes/x.md' }])
  expect(parseShell('wc -l < a.md', V).touches).toEqual([{ verb: 'read', path: '/v/a.md' }])
})

test('operators: only when not quoted', () => {
  expect(parseShell("grep '<div>' a.md", V).touches).toEqual([{ verb: 'search', path: '/v/a.md', detail: '<div>' }])
  expect(parseShell("grep '>' a.md", V).touches).toEqual([{ verb: 'search', path: '/v/a.md', detail: '>' }])
  expect(parseShell('grep "<<EOF" f', V).touches).toEqual([{ verb: 'search', path: '/v/f', detail: '<<EOF' }])
  expect(parseShell("grep '<<' f", V).touches).toEqual([{ verb: 'search', path: '/v/f', detail: '<<' }])
  expect(parseShell('echo "<b>"', V)).toEqual({ touches: [], isUnparsed: false })
})

test('variables: the ones assigned in the command are substituted, the others leave the command as a plain "run"', () => {
  // The original bug: `$NEW/tsc` is not a vault folder named "$NEW".
  expect(parseShell('NEW=/tmp/s; OLD=/tmp/o; mkdir -p $NEW/tsc && cp $OLD/m.py "$NEW/"', V).touches)
    .toEqual([{ verb: 'create', path: '/tmp/s/tsc' }, { verb: 'read', path: '/tmp/o/m.py' }, { verb: 'create', path: '/tmp/s' }])
  expect(parseShell('D=notes; echo x > "${D}/a.md"', V).touches).toEqual([{ verb: 'edit', path: '/v/notes/a.md' }])
  expect(parseShell('mkdir -p "$TMPDIR/x"', V)).toEqual({ touches: [], isUnparsed: true })
  expect(parseShell('cat "$(ls | head -1)"', V)).toEqual({ touches: [], isUnparsed: true })
  // After a cd it cannot resolve, a relative path is unknown; an absolute one is not.
  expect(parseShell('cd "$X" && touch a.md && touch /v/b.md', V)).toEqual({ touches: [{ verb: 'create', path: '/v/b.md' }], isUnparsed: true })
  // In front of a command the assignment applies only to that command; an mv with the source in a variable.
  expect(parseShell('A=1 cat $A', V).isUnparsed).toBe(true)
  expect(parseShell('S=a.md; mv $S b.md', V).touches).toEqual([{ verb: 'move', path: '/v/b.md', detail: 'a.md' }])
})

test('commandLabel: the programs launched, without cd, assignments, paths and arguments', () => {
  expect(commandLabel('git log --oneline -6 && git log -3 --stat')).toBe('git log')
  const commit = 'C=/v/.claude/skills/x && F=("$C/a.ts" "$C/b.ts") && git add -- "${F[@]}" && git commit -m "x" -- "${F[@]}"'
  expect(commandLabel(commit)).toBe('git add, git commit')
  expect(commandLabel('cd /v && python3 /private/tmp/modtest.py tests/a.test.ts')).toBe('python3')
  expect(commandLabel('npx -y -p typescript@5.6.3 tsc -p tsc </dev/null')).toBe('npx')
  expect(commandLabel('git -C /v status')).toBe('git status')
  expect(commandLabel('kubectl -n nova get pods')).toBe('kubectl get')
  expect(commandLabel("python3 - <<'EOF'\nimport os\nprint(os.getcwd())\nEOF")).toBe('python3')
  expect(commandLabel('/usr/local/bin/tea issues ls --repo x')).toBe('tea issues')
  expect(commandLabel('sudo brew install jq')).toBe('brew install')
  expect(commandLabel('X=$(git rev-parse HEAD) && git show --stat $X')).toBe('git show')
  expect(commandLabel('make')).toBe('make')
})

test('commandLabel: filters count only when nothing else is left; no program, empty string', () => {
  expect(commandLabel('git log | head -5 | wc -l')).toBe('git log')
  expect(commandLabel('for f in *.md; do wc -l "$f"; done')).toBe('wc')
  expect(commandLabel('"$PY" x.py')).toBe('')
  expect(commandLabel('cd /v')).toBe('')
  expect(commandLabel('# solo un commento')).toBe('')
  expect(commandLabel('if [ -f a ]; then ./run.sh; fi')).toBe('run.sh')
})
