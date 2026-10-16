import { test, expect } from 'claude-code/testing'
import { copyName, moveTarget } from '../hooks/fileops'
import { strings } from '../hooks/i18n'

const IT = strings('it')

test('moveTarget: the path is relative to the vault, a trailing / keeps the file name, nothing outside the vault', () => {
  expect(moveTarget(' note/b.md ', 'note/a.md', IT)).toEqual({ rel: 'note/b.md' })
  expect(moveTarget('./archivio/a.md', 'note/a.md', IT)).toEqual({ rel: 'archivio/a.md' })
  expect(moveTarget('archivio/', 'note/a.md', IT)).toEqual({ rel: 'archivio/a.md' })
  expect(moveTarget('archivio//2026/', 'note/a.md', IT)).toEqual({ rel: 'archivio/2026/a.md' })
  expect(moveTarget('', 'note/a.md', IT)).toEqual({ error: 'Scrivi dove spostarlo' })
  expect(moveTarget('/tmp/a.md', 'note/a.md', IT)).toEqual({ error: 'Solo percorsi dentro il vault' })
  expect(moveTarget('~/a.md', 'note/a.md', IT)).toEqual({ error: 'Solo percorsi dentro il vault' })
  expect(moveTarget('../a.md', 'note/a.md', IT)).toEqual({ error: 'Solo percorsi dentro il vault' })
  expect(moveTarget('note/./a.md', 'x.md', IT)).toEqual({ error: 'Solo percorsi dentro il vault' })
  expect(moveTarget('note/a.md', 'note/a.md', IT)).toEqual({ error: 'È già lì' })
})

test('copyName: the Italian suffix «copia» goes before the extension, then a number; with no extension, or for hidden files, at the end', () => {
  expect(copyName('note/a.md', new Set(['a.md']), IT)).toBe('note/a copia.md')
  expect(copyName('note/a.md', new Set(['a.md', 'a copia.md', 'a copia 2.md']), IT)).toBe('note/a copia 3.md')
  expect(copyName('README', new Set(), IT)).toBe('README copia')
  expect(copyName('.env', new Set(), IT)).toBe('.env copia')
  expect(copyName('x/archivio.tar.gz', new Set(), IT)).toBe('x/archivio.tar copia.gz')
})
