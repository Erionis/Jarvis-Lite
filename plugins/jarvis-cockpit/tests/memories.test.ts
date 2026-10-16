import { test, expect } from 'claude-code/testing'
import { buildMemories, freshOf, linkTargets, memoryGroup, memoryGroups, memoryNames, parseGitDates, readFrontmatter, shortName, type MemoryFile } from '../hooks/memories'

const DAY = 86_400_000
const NOW = Date.UTC(2026, 9, 12, 12)
const DIR = '99 - Jarvis/memory'
const fm = (name: string, type: string, body = '') => `---\nname: ${name}\ndescription: Di ${name}\ntype: ${type}\n---\n\n${body}`

test('memories: the .md files of the folder, without README and without the source files (index, Soul)', () => {
  const entries = [
    { name: 'MEMORY.md', kind: 'file' }, { name: 'soul.md', kind: 'file' }, { name: 'README.md', kind: 'file' },
    { name: 'user_alex.md', kind: 'file' }, { name: 'note.txt', kind: 'file' }, { name: 'old', kind: 'dir' }, { name: 'project_nova_chat.md', kind: 'file' },
  ]
  const roles = { 'Durable memory': `${DIR}/MEMORY.md`, Identity: `${DIR}/soul.md`, 'Daily history': '01 - Diary' }
  expect(memoryNames(entries, DIR, roles)).toEqual(['user_alex.md', 'project_nova_chat.md'])
})

test('memories: with Durable memory declared as a folder, the MEMORY.md index is left out by name', () => {
  const entries = [{ name: 'MEMORY.md', kind: 'file' }, { name: 'README.md', kind: 'file' }, { name: 'user_alex.md', kind: 'file' }, { name: 'soul.md', kind: 'file' }]
  expect(memoryNames(entries, DIR, { 'Durable memory': DIR, Identity: `${DIR}/soul.md` })).toEqual(['user_alex.md'])
})

test('frontmatter: keys and values, quotes removed, CRLF; no frontmatter gives empty; opened but never closed is broken', () => {
  expect(readFrontmatter('---\r\nname: "NOVA Chat"\r\ndescription: Confini: ownership\r\ntype: project\r\n---\r\ntesto')).toEqual({
    fields: { name: 'NOVA Chat', description: 'Confini: ownership', type: 'project' }, isBroken: false,
  })
  expect(readFrontmatter('# Titolo\n\ntesto')).toEqual({ fields: {}, isBroken: false })
  expect(readFrontmatter('---\nname: x\n\ntesto senza chiusura')).toEqual({ fields: {}, isBroken: true })
})

test('group: from the type, then from the file prefix (infra_ is a reference), then Other', () => {
  expect(memoryGroup('user', 'x.md')).toBe('people')
  expect(memoryGroup('feedback', 'project_y.md')).toBe('preferences')
  expect(memoryGroup(undefined, 'project_nova.md')).toBe('projects')
  expect(memoryGroup(undefined, 'reference_x.md')).toBe('references')
  expect(memoryGroup(undefined, 'infra_lab.md')).toBe('references')
  expect(memoryGroup('idea', 'feedback_x.md')).toBe('other')
  expect(memoryGroup(undefined, 'appunti.md')).toBe('other')
  expect(shortName('infra_lab_access.md')).toBe('lab access')
  expect(shortName('project_desk_booking_system.md')).toBe('desk booking syst…')
})

test('links: markdown links with <…>, %20, ./ and #anchor, wikilinks with an alias; no websites', () => {
  const md = [
    'Vedi [stato](<reference_cluster.md>) e [chat](project_nova_chat.md#fonti).',
    'Anche [spazi](./user%20setup.md), [[project_nova_cowork]], [[feedback_x.md|alias]] e [[cartella/user_alex#Ruolo]].',
    'Sito: [x](https://example.com/project_y.md), immagine ![a](img.png), [soul](<soul.md>).',
  ].join('\n')
  expect(linkTargets(md).sort()).toEqual(['feedback_x.md', 'project_nova_chat.md', 'project_nova_cowork.md', 'reference_cluster.md', 'soul.md', 'user setup.md', 'user_alex.md'])
})

test('git log: first and last commit of each file, only the files of the folder, even from a repo higher up', () => {
  const t = (s: number) => String(Math.floor((NOW - s * DAY) / 1000))
  const out = [
    `${t(1)}\0\n${DIR}/project_a.md\0${DIR}/MEMORY.md\0`,
    `${t(3)}\0\n${DIR}/sub/project_z.md\0`,
    `${t(20)}\0\nvault/${DIR}/user_b.md\0${DIR}/project_a.md\0`,
    `${t(40)}\0\n${DIR}/user_b.md\0`,
  ].join('')
  const dates = parseGitDates(out, DIR)
  expect(Object.keys(dates).sort()).toEqual(['MEMORY.md', 'project_a.md', 'user_b.md'])
  expect(dates['project_a.md']).toEqual({ first: Number(t(20)) * 1000, last: Number(t(1)) * 1000 })
  expect(dates['user_b.md']).toEqual({ first: Number(t(40)) * 1000, last: Number(t(20)) * 1000 })
})

test('new and changed: from git (not in git is new, uncommitted changes are changed) and, without git, from the file date', () => {
  const git = {
    dates: { 'a.md': { first: NOW - 3 * DAY, last: NOW - DAY }, 'b.md': { first: NOW - 30 * DAY, last: NOW - 2 * DAY }, 'c.md': { first: NOW - 30 * DAY, last: NOW - 20 * DAY }, 'd.md': { first: NOW - 30 * DAY, last: NOW - 20 * DAY } },
    dirty: new Set(['d.md']),
  }
  expect(['a.md', 'b.md', 'c.md', 'd.md', 'e.md'].map(f => freshOf(f, git, 0, NOW))).toEqual(['new', 'changed', null, 'changed', 'new'])
  expect(freshOf('a.md', null, NOW - 2 * DAY, NOW)).toBe('changed')
  expect(freshOf('a.md', null, NOW - 9 * DAY, NOW)).toBe(null)
})

test('memories: name and description from the frontmatter, links in both directions once only, index excluded', () => {
  const files: MemoryFile[] = [
    { name: 'project_nova_chat.md', text: fm('NOVA Chat', 'project', 'Vedi [stato](<reference_cluster.md>), [utente](user_alex.md) e [indice](MEMORY.md).'), mtimeMs: 0 },
    { name: 'reference_cluster.md', text: fm('Stato cluster', 'reference', 'Usato da [[project_nova_chat]] e [[reference_cluster]].'), mtimeMs: 0 },
    { name: 'user_alex.md', text: fm('Alex', 'user'), mtimeMs: 0 },
    { name: 'appunti.md', text: '---\nname: rotto\nsenza chiusura', mtimeMs: 0 },
    { name: 'feedback_grande.md', text: null, mtimeMs: 0 },
  ]
  const list = buildMemories(files, null, NOW)
  expect(list.map(m => [m.file, m.name, m.group, m.links])).toEqual([
    ['project_nova_chat.md', 'NOVA Chat', 'projects', ['user_alex.md', 'reference_cluster.md']],
    ['reference_cluster.md', 'Stato cluster', 'references', ['project_nova_chat.md']],
    ['user_alex.md', 'Alex', 'people', ['project_nova_chat.md']],
    ['appunti.md', 'appunti', 'other', []],
    ['feedback_grande.md', 'feedback_grande', 'preferences', []],
  ])
  expect(list[0]?.description).toBe('Di NOVA Chat')
  expect(list[3]?.description).toBe('')
})

test('groups: fixed order, only the ones with memories; sorted by new, changed, most linked, then name; the count of new ones', () => {
  const m = (file: string, group: 'projects' | 'people', fresh: 'new' | 'changed' | null, links = 0) =>
    ({ file, name: file, description: '', group, links: Array.from({ length: links }, (_, i) => `l${i}`), fresh })
  const groups = memoryGroups([
    m('zeta', 'projects', null, 5), m('alfa', 'projects', null, 1), m('beta', 'projects', null, 1),
    m('gamma', 'projects', 'changed'), m('delta', 'projects', 'new'), m('alex', 'people', 'new'),
  ])
  expect(groups.map(g => [g.group, g.fresh, g.items.map(i => i.file)])).toEqual([
    ['people', 1, ['alex']],
    ['projects', 1, ['delta', 'gamma', 'zeta', 'alfa', 'beta']],
  ])
})
