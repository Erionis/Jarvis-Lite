import { test, expect } from 'claude-code/testing'
import { EDITABLE_ROLES, memoryDir, parseCapabilities } from '../hooks/sources'

const MD = `# Vault

## Capacita' Jarvis

| Capacita' | Fonte autorevole |
|---|---|
| Identita' | \`99 - Jarvis/memory/soul.md\` |
| Memoria durevole | \`99 - Jarvis/memory/MEMORY.md\` |
| Futuro operativo | \`Da fare.md\` |
| Diario | \`01 - Diary/\` |
| Handoff | \`99 - Jarvis/handoffs/\` |
| Inbox | \`00 - Inbox/\` |

Queste sono le fonti.

## Altro

| Finta | \`non/questa.md\` |
`

test('parseCapabilities: reads the table and strips the trailing slash', () => {
  const s = parseCapabilities(MD, '/v')
  expect(s.hasTable).toBe(true)
  expect(s.root).toBe('/v')
  expect(s.roles).toEqual({
    Identity: '99 - Jarvis/memory/soul.md',
    'Durable memory': '99 - Jarvis/memory/MEMORY.md',
    'Future work': 'Da fare.md',
    'Daily history': '01 - Diary',
    Handoff: '99 - Jarvis/handoffs',
    Inbox: '00 - Inbox',
  })
})

test('parseCapabilities: without the section, hasTable is false', () => {
  const s = parseCapabilities('# Niente', '/v')
  expect(s.hasTable).toBe(false)
  expect(s.roles).toEqual({})
})

test('parseCapabilities: accepts the accented spelling', () => {
  const s = parseCapabilities('## Capacità Jarvis\n\n| Inbox | `In/` |\n', '/v')
  expect(s.roles).toEqual({ Inbox: 'In' })
})

test('memoryDir: the source if it is a folder, its folder if it is a file, nothing at the root', () => {
  expect(memoryDir({ 'Durable memory': '99 - Jarvis/memory/MEMORY.md' })).toBe('99 - Jarvis/memory')
  expect(memoryDir({ 'Durable memory': 'memory' })).toBe('memory')
  expect(memoryDir({ 'Durable memory': 'MEMORY.md' })).toBe(null)
  expect(memoryDir({})).toBe(null)
})

test('sources: Lite and Italian tables map to the same English role keys', () => {
  const it = parseCapabilities("## Capacita' Jarvis\n\n| Capacita' | Fonte |\n|---|---|\n| Identita' | `99 - Jarvis/memory/soul.md` |\n| Futuro operativo | `Da fare.md` |\n| Diario | `01 - Diary/` |\n| Memoria durevole | `99 - Jarvis/memory/MEMORY.md` |\n", '/v')
  const en = parseCapabilities('## Capabilities\n\n| Role | Authoritative source |\n|---|---|\n| Identity | `99 - Jarvis/memory/soul.md` |\n| Future work | `To Do.md` |\n| Daily history | `01 - Diary/` |\n| Durable memory | `99 - Jarvis/memory/MEMORY.md` |\n', '/v')
  expect(Object.keys(it.roles).sort()).toEqual(['Daily history', 'Durable memory', 'Future work', 'Identity'])
  expect(Object.keys(en.roles).sort()).toEqual(['Daily history', 'Durable memory', 'Future work', 'Identity'])
  expect(EDITABLE_ROLES).toEqual(['Future work'])
})
