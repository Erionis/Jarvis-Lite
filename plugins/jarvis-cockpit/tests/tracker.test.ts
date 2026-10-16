import { test, expect, mock } from 'claude-code/testing'
import { strings } from '../hooks/i18n'
import { relCommand, toActivities } from '../hooks/tracker'
import type { Activity, Sources } from '../types'

const S: Sources = { root: '/v', hasTable: true, roles: { 'Future work': 'To Do.md' }, lang: 'it' }
const ctx = { sources: S, t: strings('it'), cwd: '/v', turn: 3, at: 1000 }

test('toActivities: a Read of a source', () => {
  expect(toActivities({ tool: 'Read', file_path: '/v/To Do.md' }, ctx)).toEqual([
    { at: 1000, turn: 3, count: 1, isApprox: false, verb: 'read', path: 'To Do.md', role: 'futuro op.', isProtected: true },
  ])
})

test('toActivities: Write is create when new, edit when it existed', () => {
  expect(toActivities({ tool: 'Write', file_path: '/v/n.md' }, { ...ctx, existed: false })[0]?.verb).toBe('create')
  expect(toActivities({ tool: 'Write', file_path: '/v/n.md' }, { ...ctx, existed: true })[0]?.verb).toBe('edit')
})

test('toActivities: Edit, MultiEdit, NotebookEdit', () => {
  expect(toActivities({ tool: 'Edit', file_path: '/v/a.md' }, ctx)[0]?.verb).toBe('edit')
  expect(toActivities({ tool: 'MultiEdit', file_path: '/v/a.md' }, ctx)[0]?.verb).toBe('edit')
  expect(toActivities({ tool: 'NotebookEdit', notebook_path: '/v/n.ipynb' }, ctx)[0]?.path).toBe('n.ipynb')
})

test('toActivities: Grep and Glob are a search with a pattern', () => {
  expect(toActivities({ tool: 'Grep', pattern: 'NOVA', path: '/v/03 - Projects' }, ctx)[0]).toMatchObject({ verb: 'search', path: '03 - Projects', detail: 'NOVA' })
  expect(toActivities({ tool: 'Glob', pattern: '**/*.md' }, ctx)[0]).toMatchObject({ verb: 'search', path: '.', detail: '**/*.md' })
})

test('toActivities: Bash reads are approximate', () => {
  expect(toActivities({ tool: 'Bash', command: 'cat "To Do.md"' }, ctx)).toEqual([
    { at: 1000, turn: 3, count: 1, isApprox: true, verb: 'read', path: 'To Do.md', role: 'futuro op.', isProtected: true },
  ])
})

test('toActivities: a Bash command that cannot be interpreted inside the vault → a shell entry', () => {
  expect(toActivities({ tool: 'Bash', command: 'git status' }, ctx)).toEqual([
    { at: 1000, turn: 3, count: 1, isApprox: true, verb: 'shell', path: '.', detail: 'git status', isProtected: false },
  ])
})

test('toActivities: an uninterpretable Bash command has its vault paths made relative', () => {
  // The detail is the program launched; without a recognizable program the command stays, with relative paths.
  expect(toActivities({ tool: 'Bash', command: 'cd "/v/99 - Jarvis/handoffs" && git log' }, ctx)[0]?.detail).toBe('git log')
  expect(toActivities({ tool: 'Bash', command: '"$PY" /v/x.py' }, ctx)[0]?.detail).toBe('"$PY" x.py')
  expect(relCommand('cd /v && ls /var/log /v; git -C "/v" status', '/v')).toBe('cd . && ls /var/log .; git -C "." status')
  expect(relCommand('python3 /home/alex/vault (copia)/x.py', '/home/alex/vault (copia)')).toBe('python3 x.py')
})

test('toActivities: an uninterpretable Bash command outside the vault → nothing', () => {
  expect(toActivities({ tool: 'Bash', command: 'git status' }, { ...ctx, cwd: '/tmp' })).toEqual([])
})

test('toActivities: outside the vault, excluded paths and other tools → nothing', () => {
  expect(toActivities({ tool: 'Read', file_path: '/tmp/x' }, ctx)).toEqual([])
  expect(toActivities({ tool: 'Read', file_path: '/v/.git/HEAD' }, ctx)).toEqual([])
  expect(toActivities({ tool: 'WebFetch', url: 'https://x' }, ctx)).toEqual([])
  expect(toActivities({ tool: 'SubagentHandback' }, ctx)).toEqual([])
})

test('move: fromRole when the source has a role', () => {
  const sc = { ...ctx, sources: { ...S, roles: { ...S.roles, Inbox: '00 - Inbox' } } }
  const out = toActivities({ tool: 'Bash', command: 'mv "00 - Inbox/a.md" Archivio/a.md' }, sc)
  expect(out).toHaveLength(1)
  expect(out[0]).toMatchObject({ verb: 'move', path: 'Archivio/a.md', detail: '00 - Inbox/a.md', fromRole: 'inbox' })
  expect(out[0]?.role).toBe(undefined)
  const plain = toActivities({ tool: 'Bash', command: 'mv a.md Archivio/a.md' }, sc)[0]
  expect(plain?.verb).toBe('move')
  expect('fromRole' in (plain ?? {})).toBe(false)
  expect('fromRole' in (toActivities({ tool: 'Bash', command: 'rm "00 - Inbox/a.md"' }, sc)[0] ?? {})).toBe(false)
})

test('move: from is the source relative to the vault, detail stays as written', () => {
  const abs = toActivities({ tool: 'Bash', command: 'mv "/v/00 - Inbox/a.md" /v/Archivio/a.md' }, ctx)[0]
  expect(abs).toMatchObject({ verb: 'move', path: 'Archivio/a.md', detail: '/v/00 - Inbox/a.md', from: '00 - Inbox/a.md' })
  expect(toActivities({ tool: 'Bash', command: 'git mv a.md b.md' }, { ...ctx, cwd: '/v/X' })[0]).toMatchObject({ path: 'X/b.md', detail: 'a.md', from: 'X/a.md' })
  expect('from' in (toActivities({ tool: 'Bash', command: 'mv /tmp/a.md /v/a.md' }, ctx)[0] ?? {})).toBe(false)
})

test('toActivities: a subagent is labeled', () => {
  expect(toActivities({ tool: 'Read', file_path: '/v/a.md', agentId: 'x' }, { ...ctx, agent: 'Explore' })[0]?.agent).toBe('Explore')
})

// The test `$` is the engine's view: cwd, fs, clock, agent and state are the events the
// hook reaches "under" the plugins, so we simulate them with `on` and read the feed from state.set.
test('hook: a Read in the root ends up in the feed', async ($, on) => {
  mock.clock(on, { now: 5000 })
  on('session.root', () => ({ value: '/v' }))
  on('session.cwd', () => ({ value: '/v' }))
  on('fs.exists', () => ({ value: false }))
  on('agent.list', () => ({ value: [] }))
  on('tool.call', () => ({ result: 'ok' }) as never)
  let feed: Activity[] = []
  on('state.set', { plugin: 'jarvis-cockpit', key: 'feed' }, ($$, e, next) => {
    feed = e.value
    return next(e)
  })
  await $.tool.call({ tool: 'Read', file_path: '/v/nota.md' })
  expect(feed.map(x => [x.verb, x.path, x.at])).toEqual([['read', 'nota.md', 5000]])
})

test('hook: prompt.submit increments the turn', async ($, on) => {
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  let turn = -1
  on('state.set', { plugin: 'jarvis-cockpit', key: 'turn' }, ($$, e, next) => {
    turn = e.value
    return next(e)
  })
  await $.prompt.submit({ text: 'ciao', wait: false, origin: { kind: 'composer' } })
  expect(turn).toBe(1)
})
