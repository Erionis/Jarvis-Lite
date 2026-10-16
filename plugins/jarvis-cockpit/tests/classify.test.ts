import { test, expect } from 'claude-code/testing'
import { classify, isEditable, resolve, normalize } from '../hooks/classify'
import { strings } from '../hooks/i18n'
import { roleLabel } from '../hooks/sources'
import type { Sources } from '../types'

const IT = strings('it')
const EN = strings('en')
const S: Sources = {
  root: '/v',
  hasTable: true,
  lang: 'it',
  roles: {
    Identity: '99 - Jarvis/memory/soul.md',
    'Durable memory': '99 - Jarvis/memory/MEMORY.md',
    'Future work': 'To Do.md',
    'Daily history': '01 - Diary',
    Inbox: '00 - Inbox',
  },
}

test('classify: normalize and resolve', () => {
  expect(normalize('/v/a/./b/../c.md')).toBe('/v/a/c.md')
  expect(resolve('/v/x', '../y.md')).toBe('/v/y.md')
  expect(resolve('/v', '/abs/z.md')).toBe('/abs/z.md')
})

test('classify: a path outside the vault gives null', () => {
  expect(classify('/tmp/a.md', S, IT)).toBe(null)
  expect(classify('/vault2/a.md', S, IT)).toBe(null)
})

test('classify: excluded paths give null', () => {
  expect(classify('/v/.git/HEAD', S, IT)).toBe(null)
  expect(classify('/v/.jarvis-core/core/guardrails.md', S, IT)).toBe(null)
  expect(classify('/v/99 - Jarvis/lab/repos/x/a.ts', S, IT)).toBe(null)
})

test('classify: a declared source gets its short role and its protection', () => {
  expect(classify('/v/99 - Jarvis/memory/soul.md', S, IT)).toEqual({ rel: '99 - Jarvis/memory/soul.md', role: 'identità', isProtected: true })
  expect(classify('/v/01 - Diary/2026/10/2026-10-09.md', S, IT)).toEqual({ rel: '01 - Diary/2026/10/2026-10-09.md', role: 'diario', isProtected: true })
  expect(classify('/v/00 - Inbox/nota.md', S, IT)).toEqual({ rel: '00 - Inbox/nota.md', role: 'inbox', isProtected: false })
})

test('isEditable: unprotected files and the Future work file are writable; the rest is protected and files outside the vault are not', () => {
  expect(isEditable(classify('/v/00 - Inbox/nota.md', S, IT), IT)).toBe(true)
  expect(isEditable(classify('/v/To Do.md', S, IT), IT)).toBe(true)
  expect(classify('/v/To Do.md', S, IT)).toEqual({ rel: 'To Do.md', role: 'futuro op.', isProtected: true })
  for (const p of ['/v/99 - Jarvis/memory/soul.md', '/v/99 - Jarvis/memory/MEMORY.md', '/v/01 - Diary/2026/10/2026-10-09.md', '/v/CLAUDE.md', '/tmp/a.md']) {
    expect([p, isEditable(classify(p, S, IT), IT)]).toEqual([p, false])
  }
  expect(isEditable(undefined, IT)).toBe(false)
})

test('classify: AGENTS.md is the profile like CLAUDE.md, and Jarvis Lite\'s managed core is protected and read-only', () => {
  expect(classify('/v/AGENTS.md', S, IT)).toEqual({ rel: 'AGENTS.md', role: 'profilo', isProtected: true })
  expect(classify('/v/AGENTS.md', S, EN)).toEqual({ rel: 'AGENTS.md', role: 'profile', isProtected: true })
  expect(classify('/v/99 - Jarvis/system/core-instructions.md', S, EN)).toEqual({ rel: '99 - Jarvis/system/core-instructions.md', role: 'core', isProtected: true })
  expect(classify('/v/99 - Jarvis/system', S, IT)).toEqual({ rel: '99 - Jarvis/system', role: 'core', isProtected: true })
  expect(classify('/v/99 - Jarvis/systemx/a.md', S, IT)).toEqual({ rel: '99 - Jarvis/systemx/a.md', isProtected: false })
  // Read-only even where a source declares an editable role inside it.
  const inCore: Sources = { ...S, roles: { ...S.roles, 'Future work': '99 - Jarvis/system/todo.md' } }
  for (const p of ['/v/AGENTS.md', '/v/99 - Jarvis/system/core/guardrails.md', '/v/99 - Jarvis/system/todo.md']) {
    expect([p, isEditable(classify(p, inCore, EN), EN)]).toEqual([p, false])
  }
})

test('classify: Durable memory declared as a file makes its whole folder memory, while the identity stays identity', () => {
  expect(classify('/v/99 - Jarvis/memory/project_nova_chat.md', S, IT)).toEqual({ rel: '99 - Jarvis/memory/project_nova_chat.md', role: 'memoria', isProtected: true })
  expect(classify('/v/99 - Jarvis/memory/archivio/vecchia.md', S, IT)?.role).toBe('memoria')
  expect(classify('/v/99 - Jarvis/memory/soul.md', S, IT)?.role).toBe('identità')
  expect(classify('/v/99 - Jarvis/memoryx/a.md', S, IT)).toEqual({ rel: '99 - Jarvis/memoryx/a.md', isProtected: false })
  // Not at the root: the whole vault is not memory.
  expect(classify('/v/a.md', { ...S, roles: { 'Durable memory': 'MEMORY.md' } }, IT)).toEqual({ rel: 'a.md', isProtected: false })
})

test('classify: CLAUDE.md is the protected profile', () => {
  expect(classify('/v/CLAUDE.md', S, IT)).toEqual({ rel: 'CLAUDE.md', role: 'profilo', isProtected: true })
})

test('classify: an ordinary vault file has no role and is not protected', () => {
  expect(classify('/v/03 - Projects/NOVA/NOVA.md', S, IT)).toEqual({ rel: '03 - Projects/NOVA/NOVA.md', isProtected: false })
})

test('English: the roles carry the English short names, and the same files stay editable', () => {
  const en = { ...S, lang: 'en' as const }
  expect(classify('/v/99 - Jarvis/memory/soul.md', en, EN)).toEqual({ rel: '99 - Jarvis/memory/soul.md', role: 'identity', isProtected: true })
  expect(classify('/v/To Do.md', en, EN)).toEqual({ rel: 'To Do.md', role: 'to do', isProtected: true })
  expect(classify('/v/99 - Jarvis/memory/project_nova_chat.md', en, EN)?.role).toBe('memory')
  expect(classify('/v/00 - Inbox/nota.md', en, EN)).toEqual({ rel: '00 - Inbox/nota.md', role: 'inbox', isProtected: false })
  // The vault profile (CLAUDE.md) is named by the catalog too.
  expect(classify('/v/CLAUDE.md', en, EN)).toEqual({ rel: 'CLAUDE.md', role: 'profile', isProtected: true })
  expect(isEditable(classify('/v/To Do.md', en, EN), EN)).toBe(true)
  expect(isEditable(classify('/v/00 - Inbox/nota.md', en, EN), EN)).toBe(true)
  for (const p of ['/v/99 - Jarvis/memory/soul.md', '/v/99 - Jarvis/memory/MEMORY.md', '/v/01 - Diary/2026/10/2026-10-09.md', '/v/CLAUDE.md']) {
    expect([p, isEditable(classify(p, en, EN), EN)]).toEqual([p, false])
  }
})

test('roleLabel: a role without a name in the catalog is shown lowercase', () => {
  expect(roleLabel('Handoff', IT)).toBe('handoff')
  expect(roleLabel('Future work', EN)).toBe('to do')
  expect(roleLabel('Projects', EN)).toBe('projects')
})
