import { test, expect } from 'claude-code/testing'
import { diaryDay, diaryLine, firstLine, parseDiary, previousDiary } from '../hooks/diary'

const DIARY = [
  '---', 'type: diary', '---', '', '# Domenica 11 ottobre', '',
  '## Focus', '', '- **Jarvis Cockpit** — robottino', '- [NOVA](<03 - Projects/NOVA/NOVA.md>) roadmap', '- Helios', '- quarta',
  '', '## Fatto', '', '- uno', '- due', '  - rientrata, non conta', '- **Jarvis Cockpit** — faccia D', '- [[To Do|todo]] riletti', '- [[reference_cluster]] aggiornato',
  '', '### Dettagli', '- dentro Fatto anche sotto un ###',
  '', '## Decisioni', '', '- decisione A',
  '', '## Stato di chiusura', '', '- non si mostra',
].join('\n')

test('diary: previousDiary picks the latest note before today, even across a weekend', () => {
  expect(previousDiary(['2026-10-09.md', '2026-10-12.md', '2026-10-08.md', 'note.md', '2026-10-10.txt'], '2026-10-12')).toBe('2026-10-09')
  expect(previousDiary(['2026-10-12.md'], '2026-10-12')).toBe(null)
  expect(previousDiary([], '2026-10-12')).toBe(null)
  // Up to and including today: the last note for the Recap.
  expect(previousDiary(['2026-10-12.md', '2026-10-09.md', '2026-10-13.md'], '2026-10-12', true)).toBe('2026-10-12')
  expect(previousDiary(['2026-10-09.md'], '2026-10-12', true)).toBe('2026-10-09')
})

test('diary: caps each part (first 3 of Focus and Closing state, last 3 of Done and Decisions) with a +N count; indented items are skipped', () => {
  const parts = parseDiary(DIARY)
  expect(parts.map(p => `${p.part} ${p.lines.length} +${p.more}`)).toEqual(['focus 3 +1', 'done 3 +3', 'decisions 1 +0', 'closing 1 +0'])
  expect(parts[3]?.lines).toEqual([{ lead: '', rest: 'non si mostra' }])
  expect(parts[0]?.lines).toEqual([
    { lead: 'Jarvis Cockpit', rest: ' — robottino' },
    { lead: '', rest: 'NOVA roadmap' },
    { lead: '', rest: 'Helios' },
  ])
  expect(parts[1]?.lines.map(l => l.rest)).toEqual(['todo riletti', 'reference_cluster aggiornato', 'dentro Fatto anche sotto un ###'])
})

test('diary: the Done and Decisions headings of Jarvis Lite; no section with items means no note', () => {
  expect(parseDiary('## Done\n- a\n## Decisions\n- b\n').map(p => p.part)).toEqual(['done', 'decisions'])
  expect(diaryDay('2026-10-11', 'D/2026-10-11.md', '# vuota\n\n## Note\n- x\n')).toBe(null)
  expect(diaryDay('2026-10-11', 'D/2026-10-11.md', '## Focus\n\n')).toBe(null)
  expect(diaryDay('2026-10-11', 'D/x.md', '## Focus\n- a\n')).toEqual({ day: '2026-10-11', path: 'D/x.md', parts: [{ part: 'focus', lines: [{ lead: '', rest: 'a' }], more: 0 }] })
})

test('diary: Closing state works without Focus; the first item of a part comes back as one line', () => {
  const note = diaryDay('2026-10-14', 'D/2026/10/2026-10-14.md', '## Stato di chiusura\n\n- **Cockpit 0.7** — spec scritta\n- piano dopo\n')
  expect(note?.parts.map(p => p.part)).toEqual(['closing'])
  expect(note === null ? null : firstLine(note, 'closing')).toBe('Cockpit 0.7 — spec scritta')
  expect(note === null ? null : firstLine(note, 'focus')).toBe(null)
  expect(firstLine({ day: 'x', path: 'x', parts: [{ part: 'focus', lines: [{ lead: '  ', rest: ' ' }], more: 0 }] }, 'focus')).toBe(null)
})

test('diary: one line for each item, links reduced to their text, a leading bold kept, other markup stripped, CRLF handled', () => {
  expect(diaryLine('- [x] **NOVA** — vedi [doc](https://x.y/(a)) e `kubectl` **ok**')).toEqual({ lead: 'NOVA', rest: ' — vedi doc e kubectl ok' })
  expect(diaryLine('* testo').rest).toBe('testo')
  expect(diaryLine(`- ${'a'.repeat(300)}`).rest).toHaveLength(200)
  expect(parseDiary('## Focus\r\n- a\r\n- b\r\n').map(p => p.lines.map(l => l.rest))).toEqual([['a', 'b']])
})

test('diary: the Lite closing heading fills the closing part', () => {
  const day = diaryDay('2026-10-01', '01 - Diary/2026/10/2026-10-01.md', '# 2026-10-01\n\n## Done\n\n- one\n\n## Closing state\n\n- stopped at the plan\n')
  expect(day?.parts.map(p => p.part)).toEqual(['done', 'closing'])
})
