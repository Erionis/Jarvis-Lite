import { test, expect } from 'claude-code/testing'
import { strings } from '../hooks/i18n'
import { ageLabel, ancestors, dirCounts, emptyTree, isTextFile, searchHits, toggleExpanded, visibleRows, withChildren } from '../hooks/tree'

const e = (name: string, kind: 'file' | 'dir' = 'file', mtimeMs = 0) => ({ name, kind, mtimeMs, isLink: false })
const NONE: ReadonlySet<string> = new Set()
const TODAY = new Date(2026, 9, 9, 14, 30).getTime()

test('tree: folders first, natural order, children under the open folder', () => {
  let t = withChildren(emptyTree(), '', [e('b.md'), e('03 - Projects', 'dir'), e('a 10.md'), e('a 9.md')])
  t = withChildren(toggleExpanded(t, '03 - Projects'), '03 - Projects', [e('x.md'), e('NOVA', 'dir')])
  expect(visibleRows(t, NONE).map(r => `${'  '.repeat(r.depth)}${r.node.name}`)).toEqual(['03 - Projects', '  NOVA', '  x.md', 'a 9.md', 'a 10.md', 'b.md'])
  expect(visibleRows(t, NONE)[0]?.open).toBe(true)
})

test('tree: hidden and ignored entries stay out until shown', () => {
  const t = withChildren(emptyTree(), '', [e('.claude', 'dir'), e('lab', 'dir'), e('n.md')])
  const ignored = new Set(['lab'])
  expect(visibleRows(t, ignored).map(r => r.node.id)).toEqual(['n.md'])
  expect(visibleRows({ ...t, showHidden: true }, ignored).map(r => r.node.id)).toEqual(['.claude', 'lab', 'n.md'])
})

test('tree: re-reading a folder drops the children that are gone and their descendants', () => {
  let t = withChildren(emptyTree(), '', [e('A', 'dir'), e('B', 'dir')])
  t = withChildren(toggleExpanded(t, 'A'), 'A', [e('a.md')])
  t = withChildren(toggleExpanded(t, 'B'), 'B', [e('b.md')])
  t = withChildren({ ...t, broken: ['A'] }, '', [e('A', 'dir'), e('c.md')])
  expect(t.nodes.map(n => n.id).sort()).toEqual(['A', 'A/a.md', 'c.md'])
  expect(t.expanded).toEqual(['A'])
  expect([...t.loaded].sort()).toEqual(['', 'A'])
  t = withChildren(t, 'A', [e('a.md')])
  expect(t.broken).toEqual([])
})

test('tree: toggle opens and closes and moves the cursor', () => {
  const t = toggleExpanded(emptyTree(), 'A')
  expect(t).toMatchObject({ expanded: ['A'], cursor: 'A' })
  expect(toggleExpanded(t, 'A').expanded).toEqual([])
})

test('ancestors: the folders that contain a path, outermost first', () => {
  expect(ancestors('03 - Projects/NOVA/NOVA.md')).toEqual(['03 - Projects', '03 - Projects/NOVA'])
  expect(ancestors('To Do.md')).toEqual([])
})

test('nodes: file size and symlinks from reading the folder', () => {
  const t = withChildren(emptyTree(), '', [{ name: 'a.md', kind: 'file', mtimeMs: 1, isLink: false, size: 14_200 }, { name: 'repos', kind: 'other', mtimeMs: 0, isLink: true }, { name: 'D', kind: 'dir', mtimeMs: 0, isLink: false, size: 96 }])
  expect(t.nodes.map(n => [n.id, n.kind, n.size, n.isLink])).toEqual([['D', 'dir', 0, false], ['a.md', 'file', 14_200, false], ['repos', 'file', 0, true]])
})

test('dirCounts: written and changed under the folder, without false prefixes', () => {
  const written = ['03 - Projects/NOVA/a.md', 'To Do.md']
  const changed = ['03 - Projects/x.md', '03 - Projects/NOVA/a.md']
  expect(dirCounts('03 - Projects', written, changed)).toEqual({ written: 1, changed: 2 })
  expect(dirCounts('03 - Projects/NOVA', written, changed)).toEqual({ written: 1, changed: 1 })
  expect(dirCounts('03 - Pro', ['03 - Projects/a.md'], [])).toEqual({ written: 0, changed: 0 })
  expect(dirCounts('', written, changed)).toEqual({ written: 2, changed: 2 })
})

test('ageLabel: the time if today, days, then months; nothing if unknown', () => {
  expect(ageLabel(new Date(2026, 9, 9, 9, 5).getTime(), TODAY, strings('it').dates)).toBe('09:05')
  expect(ageLabel(new Date(2026, 9, 6, 12).getTime(), TODAY, strings('it').dates)).toBe('3g')
  expect(ageLabel(new Date(2026, 7, 1, 12).getTime(), TODAY, strings('it').dates)).toBe('2m')
  expect(ageLabel(0, TODAY, strings('it').dates)).toBe('')
})

test('searchHits: by file name, without hidden folders, with a cap', () => {
  const paths = ['03 - Projects/NOVA/NOVA.md', '03 - Projects/Helios/Helios - Architettura.md', 'nova-notes/x.md', '.claude/nova.md']
  expect(searchHits(paths, 'NOVA', 10, false)).toEqual(['03 - Projects/NOVA/NOVA.md'])
  expect(searchHits(paths, 'nova', 10, true)).toEqual(['03 - Projects/NOVA/NOVA.md', '.claude/nova.md'])
  expect(searchHits(paths, '  ', 10, false)).toEqual([])
  expect(searchHits(paths, 'a', 1, false)).toEqual(['03 - Projects/NOVA/NOVA.md'])
})

test('isTextFile: text and code can be read; images, PDFs, archives and Office documents cannot', () => {
  for (const p of ['a.md', 'hooks/x.tsx', 'conf.yaml', 'Makefile', '.gitignore', 'dati.csv', 'note.TXT']) expect([p, isTextFile(p)]).toEqual([p, true])
  for (const p of ['logo.png', 'foto.JPG', 'icona.svg', 'offerta.pdf', 'a.zip', 'deck.pptx', 'modello.safetensors', '.DS_Store']) expect([p, isTextFile(p)]).toEqual([p, false])
})
