import { test, expect } from 'claude-code/testing'
import { copyKeys, keyText, oneLine } from '../hooks/format'
import { strings } from '../hooks/i18n'
import { EMPTY_READING, drawable, editBlock, eolOf, isBinaryText, fileUrl, pressedRel, resolveRel, rewriteLinks, splitFrontmatter } from '../hooks/reader'

const FROM = '99 - Jarvis/roadmap/a.md'
const IT = strings('it')
const BLOCKED = IT.reading.blocked

test('frontmatter: key and value, lists joined, quotes and links reduced to their text', () => {
  const md = '---\ntype: spec\nstatus: "approved-design"\nrelated:\n  - "[Spec v1](Jarvis%20Cockpit%20-%20Spec%20v1.md)"\n  - "[Idee UX](x.md)"\ntags:\n  - jarvis\n---\n\n# Titolo\n'
  expect(splitFrontmatter(md)).toEqual({
    meta: [
      { key: 'type', value: 'spec' },
      { key: 'status', value: 'approved-design' },
      { key: 'related', value: 'Spec v1, Idee UX' },
      { key: 'tags', value: 'jarvis' },
    ],
    body: '\n# Titolo\n',
  })
  expect(splitFrontmatter('# Solo corpo\n')).toEqual({ meta: [], body: '# Solo corpo\n' })
})

test('relative links: %20, anchors, parent steps, absolute paths inside the vault; null outside the vault', () => {
  expect(resolveRel(FROM, 'Jarvis%20Cockpit%20-%20Spec%20v1.md', '/v')).toBe('99 - Jarvis/roadmap/Jarvis Cockpit - Spec v1.md')
  expect(resolveRel(FROM, '../../To%20Do.md#focus', '/v')).toBe('To Do.md')
  expect(resolveRel(FROM, '../../../x.md', '/v')).toBe(null)
  expect(resolveRel(FROM, '/v/03 - Projects/x.md', '/v')).toBe('03 - Projects/x.md')
  expect(resolveRel(FROM, '/etc/hosts', '/v')).toBe(null)
  expect(resolveRel(FROM, '#sezione', '/v')).toBe(null)
})

test('link rewriting: relative links become absolute file:// URLs, the others stay', () => {
  const body = 'vedi [Spec](Jarvis%20Cockpit%20-%20Spec%20v1.md), [sito](https://example.test), [sez](#a) e [rel](<../Note (bozza).md>)'
  const spec = 'file:///v/99%20-%20Jarvis/roadmap/Jarvis%20Cockpit%20-%20Spec%20v1.md'
  const rel = 'file:///v/99%20-%20Jarvis/Note%20%28bozza%29.md'
  expect(rewriteLinks(body, FROM, '/v')).toEqual({
    text: `vedi [Spec](${spec}), [sito](https://example.test), [sez](#a) e [rel](${rel})`,
    internal: [spec, rel],
  })
  expect(fileUrl('/v', 'To Do.md')).toBe('file:///v/To%20Do.md')
})

test('pressed link: raw or decoded href, only inside the vault', () => {
  expect(pressedRel('file:///v/99%20-%20Jarvis/a.md', '/v')).toBe('99 - Jarvis/a.md')
  expect(pressedRel('file:///v/99 - Jarvis/a.md', '/v')).toBe('99 - Jarvis/a.md')
  expect(pressedRel('file:///w/a.md', '/v')).toBe(null)
  expect(pressedRel('https://example.test', '/v')).toBe(null)
})

test('pressed link: never outside the vault, even with .. or %2e%2e; a .. that stays inside resolves', () => {
  expect(pressedRel('file:///v/../etc/passwd', '/v')).toBe(null)
  expect(pressedRel('file:///v/%2e%2e/etc/passwd', '/v')).toBe(null)
  expect(pressedRel('file:///v/', '/v')).toBe(null)
  expect(pressedRel('file:///v/a/../b.md', '/v')).toBe('b.md')
})

test('reading: Edit is off for protected files and for files that do not fit the editor props', () => {
  const r = { ...EMPTY_READING, path: 'a.md', text: '# A\n' }
  expect(editBlock(r, false, IT)).toBe(null)
  expect(editBlock(r, true, IT)).toBe(BLOCKED.protected)
  expect(editBlock({ ...r, text: null, isTooBig: true }, false, IT)).toBe(BLOCKED.tooBig)
  // 60 000 newlines become 120 000 serialized characters: over the margin even though under 80 000.
  expect(editBlock({ ...r, text: '\n'.repeat(60_000) }, false, IT)).toBe(BLOCKED.tooBig)
  expect(editBlock({ ...r, text: 'x'.repeat(60_000) }, false, IT)).toBe(null)
  // Code and other text files are read-only.
  expect(editBlock({ ...r, path: 'hooks/x.tsx' }, false, IT)).toBe(BLOCKED.notMarkdown)
  expect(editBlock({ ...r, path: 'CLAUDE.md' }, true, IT)).toBe(BLOCKED.protected)
  // Read with U+FFFD: it was not UTF-8, rewriting it would ruin it.
  expect(editBlock({ ...r, text: 'caff\uFFFD\n' }, false, IT)).toBe(BLOCKED.notUtf8)
})

test('line endings: CRLF throughout, LF throughout or none; mixed ones and a lone \\r block Edit', () => {
  expect([eolOf('a\r\nb\r\n'), eolOf('a\nb\n'), eolOf('una riga'), eolOf('')]).toEqual(['\r\n', '\n', '\n', '\n'])
  expect([eolOf('a\r\nb\n'), eolOf('a\rb'), eolOf('a\r\nb\r')]).toEqual([null, null, null])
  const r = { ...EMPTY_READING, path: 'a.md', text: 'a\r\nb\n' }
  expect(editBlock(r, false, IT)).toBe(BLOCKED.mixedEol)
  expect(editBlock({ ...r, text: 'a\r\nb\r\n' }, false, IT)).toBe(null)
})

test('drawable: \\r breaks the line, other control characters become U+FFFD, tab and newline stay; a NUL is not text', () => {
  expect(drawable('a\r\nb\rc\u0007d\te\n\u009b')).toBe('a\nb\nc\uFFFDd\te\n\uFFFD')
  expect(isBinaryText('ab\u0000cd')).toBe(true)
  expect(isBinaryText('abc')).toBe(false)
})

test('oneLine: puts text on one line and strips control characters', () => {
  expect(oneLine('Icon\r')).toBe('Icon ')
  expect(oneLine('a\r\nb\tc\u001bd')).toBe('a b c\uFFFDd')
})

test('keyText: writes control characters as visible escapes and never confuses two texts', () => {
  expect(keyText('To Do — è')).toBe('To Do — è')
  expect(keyText('Icon\r')).toBe('Icon\\u000d')
  expect(keyText('a\x1bb')).toBe('a\\u001bb')
  expect(keyText('x\t\n\x7f\x85')).toBe('x\\u0009\\u000a\\u007f\\u0085')
  // The backslash doubles: the text `a\u001bb` written with visible characters does not become the key of `a<ESC>b`.
  expect(keyText('a\\u001bb')).toBe('a\\\\u001bb')
  // No control in the result, and two different texts never share a key (oneLine would make them equal).
  const texts = ['a\x1b', 'a\x07', 'a\uFFFD', 'a\\u001b', 'a\\', 'a\\\\', 'a\n', 'a\r', 'a\t', 'a\\n', 'a', 'a ']
  expect(new Set(texts.map(oneLine)).size).toBeLessThan(texts.length)
  expect(new Set(texts.map(keyText)).size).toBe(texts.length)
  for (const t of texts) expect(keyText(t)).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/)
})

test('copyKeys: numbers copies with visible characters; a text that looks like a copy key is not mistaken for one', () => {
  const key = copyKeys()
  expect(['a', 'a', 'b', 'a'].map(key)).toEqual(['a', 'a\\n2', 'b', 'a\\n3'])
  const odd = copyKeys()
  expect(['a', 'a', 'a\\n2', 'a\\n2', 'a\x1b', 'a\x1b', 'a\x07'].map(odd))
    .toEqual(['a', 'a\\n2', 'a\\\\n2', 'a\\\\n2\\n2', 'a\\u001b', 'a\\u001b\\n2', 'a\\u0007'])
  // The key does not depend on position: the same copy of the same text, with other entries before it.
  const first = copyKeys(); const second = copyKeys()
  expect(['x', 'a', 'a'].map(first)[2]).toBe(['a', 'a'].map(second)[1])
})
