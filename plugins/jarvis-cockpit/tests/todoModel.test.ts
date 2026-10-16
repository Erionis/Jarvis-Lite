import { test, expect } from 'claude-code/testing'
import { strings } from '../hooks/i18n'
import { addItem, cleanEntry, deleteItem, findHead, findLine, parseTodo, todoLabel, toggleItem, type TodoBlock, type TodoHead, type TodoItem } from '../hooks/todoModel'

// A Future work file with every kind of block: frontmatter, a title, a callout, Now and Next items in bold without
// a checkbox (one already ticked), a backlog with checkboxes and indented lines, an empty section, a table at the bottom.
export const LOOPS = [
  '---', 'type: todo', '---', '',
  '# To Do', '',
  '> [!info] How this file works', '> The **short list** of current work.', '>', '> - **1 task = 1 line**', '',
  '## This week', '',
  '### Now', '',
  '- [x] NOVA KB workflow — applied to Selenia',
  '- **NOVA Chat — files and images** — [#597](https://x/597) is with Robin',
  '',
  '### Next', '',
  '- **Registry** — rotate token',
  '',
  '## Backlog by area', '',
  '> Only the title and the next step here.', '',
  '### Jarvis', '',
  '- [ ] **Release 1.2** — ship the fix',
  '  - indented detail',
  '',
  '  - after a blank line',
  '- [X] **Docs** — review the guide',
  '',
  '### Empty', '',
  '## Links', '',
  '| Area | Where |', '|---|---|', '| NOVA | [Hub](<NOVA Hub.md>) |',
  '',
].join('\n')

const shape = (b: TodoBlock): string =>
  b.kind === 'item' ? `item ${b.line} ${b.box} ${b.title}` : b.kind === 'prose' ? `prose ${b.line}` : `${b.kind} ${b.line} ${'title' in b ? b.title : ''}`

test('parseTodo: the whole file in order, without frontmatter or title; an "+ Add" entry at the end of each section', () => {
  expect(parseTodo(LOOPS).map(shape)).toEqual([
    'prose 6',
    'group 11 This week',
    'sub 13 Now', 'item 15 done NOVA KB workflow', 'item 16 none NOVA Chat — files and images', 'add 13 Now',
    'sub 18 Next', 'item 20 none Registry', 'add 18 Next',
    'group 22 Backlog by area', 'prose 24',
    'sub 26 Jarvis', 'item 28 open Release 1.2', 'item 32 done Docs', 'add 26 Jarvis',
    'sub 34 Empty', 'add 34 Empty',
    'group 36 Links', 'prose 38',
  ])
})

test('parseTodo: every item whole in Markdown with its indented lines underneath, the prose whole without > and callout', () => {
  const blocks = parseTodo(LOOPS)
  const at = (line: number) => blocks.find(b => b.line === line && b.kind !== 'add')
  expect(at(15)).toMatchObject({ md: 'NOVA KB workflow — applied to Selenia' })
  expect(at(16)).toMatchObject({ md: '**NOVA Chat — files and images** — [#597](https://x/597) is with Robin' })
  expect(at(28)).toMatchObject({ md: '**Release 1.2** — ship the fix\n- indented detail\n\n- after a blank line' })
  expect(at(6)).toEqual({ kind: 'prose', line: 6, md: '**How this file works**\n\nThe **short list** of current work.\n\n- **1 task = 1 line**' })
  expect(at(24)).toEqual({ kind: 'prose', line: 24, md: 'Only the title and the next step here.' })
  expect(at(38)).toEqual({ kind: 'prose', line: 38, md: '| Area | Where |\n|---|---|\n| NOVA | [Hub](<NOVA Hub.md>) |' })
  // Lines indented by four spaces or more: the common indent is removed, they do not become code.
  expect(parseTodo('- uno\n    - due\n      - tre\n')[0]).toMatchObject({ md: 'uno\n- due\n  - tre' })
  // A ## with its own items has its own "+ Add"; without frontmatter it starts from the first line.
  expect(parseTodo('## Inbox\n- a\n### Sotto\n').map(shape)).toEqual(['group 0 Inbox', 'item 1 none a', 'add 0 Inbox', 'sub 2 Sotto', 'add 2 Sotto'])
})

test('parseTodo: a lone --- or >, and an empty ``` fence, between two items do not make an empty prose line', () => {
  expect(parseTodo('## A\n- [ ] uno\n\n---\n\n>\n\n```\n```\n\n- [ ] due\n').map(shape)).toEqual(['group 0 A', 'item 1 open uno', 'item 10 open due', 'add 0 A'])
})

test('headings: trailing # are stripped only after a space; a long run of spaces is parsed quickly', () => {
  const titles = (md: string) => parseTodo(md).flatMap(b => (b.kind === 'group' || b.kind === 'sub' ? [b.title] : []))
  expect(titles('### C#\n## Titolo ##\n### Fix #12 #   \n### ###\n')).toEqual(['C#', 'Titolo', 'Fix #12', ''])
  const slow = `## a${' '.repeat(4000)}x`
  const long = `## A\n- [ ] voce\n${slow}\n`
  const t0 = Date.now()
  const blocks = parseTodo(long)
  const added = addItem(long, { line: 0, raw: '## A' }, 'nuova')
  expect(Date.now() - t0).toBeLessThan(1000)
  expect(blocks.map(b => b.kind)).toEqual(['group', 'item', 'add', 'group'])
  expect(added?.split('\n').slice(1, 4)).toEqual(['- [ ] voce', '- [ ] nuova', slow])
})

test('toggleItem: [ ], [x], [X] and a box-less item each flip, only that line changes', () => {
  const lines = LOOPS.split('\n')
  const flip = (line: number) => {
    const out = toggleItem(LOOPS, { line, raw: lines[line] ?? '' })
    const changed = out?.split('\n').flatMap((l, i) => (l === lines[i] ? [] : [`${i}: ${l}`]))
    return changed
  }
  expect(flip(28)).toEqual(['28: - [x] **Release 1.2** — ship the fix'])
  expect(flip(15)).toEqual(['15: - [ ] NOVA KB workflow — applied to Selenia'])
  expect(flip(32)).toEqual(['32: - [ ] **Docs** — review the guide'])
  expect(flip(20)).toEqual(['20: - [x] **Registry** — rotate token'])
})

test('toggleItem: a moved but unique line → writes; changed, gone or duplicated → null; CRLF and the final newline are kept', () => {
  const lines = LOOPS.split('\n')
  const raw = lines[28] ?? ''
  const moved = `- nuova riga in cima\n${LOOPS}`
  expect(toggleItem(moved, { line: 28, raw })?.split('\n')[29]).toBe('- [x] **Release 1.2** — ship the fix')
  expect(toggleItem(LOOPS.replace(raw, `${raw} ora`), { line: 28, raw })).toBe(null)
  expect(toggleItem(LOOPS.replace(`${raw}\n`, ''), { line: 28, raw })).toBe(null)
  expect(toggleItem(`${raw}\n${moved}`, { line: 28, raw })).toBe(null)
  const crlf = LOOPS.replace(/\n/g, '\r\n')
  const out = toggleItem(crlf, { line: 28, raw }) ?? ''
  expect(out.endsWith('\r\n')).toBe(true)
  expect(out.replace(/\r\n/g, '\n')).toBe(toggleItem(LOOPS, { line: 28, raw }))
  expect(findLine(['a', 'b', 'a'], 2, 'a')).toBe(2)
  expect(findLine(['a', 'b', 'a'], 1, 'a')).toBe(null)
})

test('addItem: after the last item (and its indented lines), in an empty section after the heading and a blank line', () => {
  const lines = LOOPS.split('\n')
  const head = (line: number) => ({ line, raw: lines[line] ?? '' })
  const jarvis = addItem(LOOPS, head(26), '  provare   la scheda\n To Do ')?.split('\n') ?? []
  expect(jarvis.slice(32, 35)).toEqual(['- [X] **Docs** — review the guide', '- [ ] provare la scheda To Do', ''])
  expect(jarvis).toHaveLength(lines.length + 1)
  const now = addItem(LOOPS, head(13), 'x')?.split('\n') ?? []
  expect(now.slice(16, 19)).toEqual(['- **NOVA Chat — files and images** — [#597](https://x/597) is with Robin', '- [ ] x', ''])
  const empty = addItem(LOOPS, head(34), 'prima')?.split('\n') ?? []
  expect(empty.slice(34, 38)).toEqual(['### Empty', '', '- [ ] prima', ''])
  expect(empty[38]).toBe('## Links')
  expect(addItem('### Fine', { line: 0, raw: '### Fine' }, 'z')).toBe('### Fine\n\n- [ ] z')
  expect(addItem('### Fine\n', { line: 0, raw: '### Fine' }, 'z')).toBe('### Fine\n\n- [ ] z\n')
  expect(addItem('### A\ntesto\n', { line: 0, raw: '### A' }, 'z')).toBe('### A\n\n- [ ] z\n\ntesto\n')
})

test('addItem: empty text → nothing; heading changed → null', () => {
  expect(cleanEntry(' \n ')).toBe('')
  expect(addItem(LOOPS, { line: 26, raw: '### Jarvis' }, '   ')).toBe(null)
  expect(addItem(LOOPS.replace('### Jarvis', '### Jarvis 2'), { line: 26, raw: '### Jarvis' }, 'x')).toBe(null)
})

test('todoLabel: the file name, technical names become To Do', () => {
  expect(todoLabel('Da fare.md', strings('it'))).toBe('Da fare')
  for (const n of ['todo.md', 'TO-DO.md', 'notes/To_Do.md', 'Tasks.md']) expect(todoLabel(n, strings('it'))).toBe('To Do')
})

// The item as the tab shows it (line, head and whole block).
export const itemAt = (text: string, line: number): TodoItem => {
  const it = parseTodo(text).find((b): b is TodoItem => b.kind === 'item' && b.line === line)
  if (it === undefined) throw new Error(`no item at line ${line}`)
  return it
}

test('deleteItem: the item and its indented lines, only those; a lone blank line between headings; changed → null', () => {
  const lines = LOOPS.split('\n')
  const del = (line: number, text = LOOPS) => deleteItem(text, itemAt(LOOPS, line))
  expect(del(28)?.split('\n')).toEqual([...lines.slice(0, 28), ...lines.slice(32)])
  expect(del(16)?.split('\n')).toEqual([...lines.slice(0, 16), ...lines.slice(17)])
  expect(deleteItem('### A\n\n- x\n\n### B\n', { line: 2, raw: '- x', block: '- x' })).toBe('### A\n\n### B\n')
  expect(deleteItem('- x\n', { line: 0, raw: '- x', block: '- x' })).toBe('')
  expect(del(28, LOOPS.replace('ship the fix', 'shipped'))).toBe(null)
  const crlf = LOOPS.replace(/\n/g, '\r\n')
  expect(deleteItem(crlf, itemAt(LOOPS, 16))?.replace(/\r\n/g, '\n')).toBe(del(16))
})

test('deleteItem: only the block that was seen; an indented line added, removed or changed under the item → null', () => {
  const it = itemAt(LOOPS, 28)
  expect(it.block).toBe('- [ ] **Release 1.2** — ship the fix\n  - indented detail\n\n  - after a blank line')
  expect(deleteItem(LOOPS.replace('  - after a blank line', '  - after a blank line\n  - written by another chat'), it)).toBe(null)
  expect(deleteItem(LOOPS.replace('  - indented detail\n', ''), it)).toBe(null)
  expect(deleteItem(LOOPS.replace('indented detail', 'changed detail'), it)).toBe(null)
})

test('mixed line endings: ticking changes only the bytes of its own line; a new line takes the line ending of its neighbor', () => {
  const mixed = '### A\r\n\r\n- [ ] uno\n- [ ] due\r\n'
  expect(toggleItem(mixed, { line: 2, raw: '- [ ] uno' })).toBe('### A\r\n\r\n- [x] uno\n- [ ] due\r\n')
  expect(addItem(mixed, { line: 0, raw: '### A' }, 'tre')).toBe('### A\r\n\r\n- [ ] uno\n- [ ] due\r\n- [ ] tre\r\n')
  expect(deleteItem(mixed, { line: 3, raw: '- [ ] due', block: '- [ ] due' })).toBe('### A\r\n\r\n- [ ] uno\n')
  // Without a final newline: the new line ends like the others, and the file stays without one.
  expect(addItem('### A\n- [ ] uno', { line: 0, raw: '### A' }, 'due')).toBe('### A\n- [ ] uno\n- [ ] due')
  expect(deleteItem('### A\n- [ ] uno\n- [ ] due', { line: 2, raw: '- [ ] due', block: '- [ ] due' })).toBe('### A\n- [ ] uno')
})

test('keys: the text of the item (without checkbox) or of the heading, with the copy number; a line above does not change them', () => {
  const keys = (md: string) => parseTodo(md).flatMap(b => (b.kind === 'item' || b.kind === 'add' ? [`${b.kind} ${b.key}`] : []))
  expect(keys(LOOPS)).toEqual([
    'item NOVA KB workflow — applied to Selenia', 'item **NOVA Chat — files and images** — [#597](https://x/597) is with Robin', 'add ### Now',
    'item **Registry** — rotate token', 'add ### Next',
    'item **Release 1.2** — ship the fix', 'item **Docs** — review the guide', 'add ### Jarvis',
    'add ### Empty',
  ])
  expect(keys(LOOPS.replace('- [x] NOVA KB', '- [ ] nuova\n- [x] NOVA KB'))).toEqual(['item nuova', ...keys(LOOPS)])
  expect(keys('### A\n- [ ] uno\n- [x] uno\n### A\n- [ ] due\n')).toEqual(['item uno', 'item uno\\n2', 'add ### A', 'item due', 'add ### A\\n2'])
  // A control character in the text becomes a visible escape; two different texts never get the same key.
  expect(keys('### A\x1b\n- [ ] a\x1b\n- [ ] a\x1b\n- [ ] a\x07\n')).toEqual(['item a\\u001b', 'item a\\u001b\\n2', 'item a\\u0007', 'add ### A\\u001b'])
})

test('findHead: the heading at its line or the only one with the same text; gone or duplicated → null', () => {
  const head = { line: 26, raw: '### Jarvis' }
  expect(findHead(LOOPS, head)).toBe(26)
  expect(findHead(LOOPS.replace('- [x] NOVA KB', '- [ ] nuova\n- [x] NOVA KB'), head)).toBe(27)
  expect(findHead(LOOPS.replace('### Jarvis', '### Altro'), head)).toBe(null)
  expect(findHead(LOOPS.replace('- [x] NOVA KB', '- [ ] nuova\n- [x] NOVA KB').replace('### Empty', '### Jarvis'), head)).toBe(null)
})

test('headings: a lone carriage return at the end of a heading does not hide it', () => {
  const heads = parseTodo('## Gruppo\r\r\n\r\n- [ ] uno\r\n').filter((b): b is TodoHead => b.kind === 'group')
  expect(heads.map(x => x.title)).toEqual(['Gruppo'])
})
