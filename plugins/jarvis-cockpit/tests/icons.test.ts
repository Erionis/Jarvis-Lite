import { test, expect } from 'claude-code/testing'
import { strings } from '../hooks/i18n'
import { ICON, fileIcon, type IconName } from '../hooks/icons'

test('icons: each source is a small 16x16 svg, with its alternative text', () => {
  const names = Object.keys(ICON) as IconName[]
  expect(names.length).toBe(13)
  for (const n of names) {
    const src = ICON[n]
    expect(src.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">')).toBe(true)
    expect(src.endsWith('</svg>')).toBe(true)
    expect(src.length).toBeLessThan(1200)
    expect(strings('it').files.icons[n].length).toBeGreaterThan(0)
  }
})

test('icons: the file type comes from the extension; open and closed folders; links', () => {
  const cases: [string, IconName][] = [
    ['NOVA.md', 'md'], ['offerta.PDF', 'pdf'], ['nota.docx', 'word'], ['budget.xlsx', 'excel'], ['dati.csv', 'excel'],
    ['deck.pptx', 'ppt'], ['logo.png', 'image'], ['schema.svg', 'image'], ['register.tsx', 'code'], ['run.sh', 'code'],
    ['plugin.json', 'data'], ['values.yaml', 'data'], ['index.html', 'html'], ['LICENSE', 'file'], ['.gitignore', 'file'],
  ]
  for (const [name, icon] of cases) expect([name, fileIcon(name, 'file', false, false)]).toEqual([name, icon])
  expect(fileIcon('03 - Projects', 'dir', false, false)).toBe('dir')
  expect(fileIcon('03 - Projects', 'dir', true, false)).toBe('dirOpen')
  expect(fileIcon('repos', 'dir', false, true)).toBe('link')
  expect(fileIcon('note.md', 'file', false, true)).toBe('link')
})
