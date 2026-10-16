import { test, expect } from 'claude-code/testing'
import { dueDate, handoffMeta, itemTitle, nextStep, parseBlame, waitingItems, parseFocus, parseHandoff, latestDiary, loadSnapshot, shortDetail, shortTitle, stateStep, MAX_READ_BYTES } from '../hooks/snapshot'
import { parseCapabilities } from '../hooks/sources'

const LOOPS = `# To Do

## This week

### Now

- [ ] **NOVA 4.0** — chiudere [PRD](x.md) branding
- Helios: offerta \`GPU-01\`
  - sotto-punto ignorato

### Next

- dopo

## Waiting / Blocked

- attesa A
- attesa B
`

const TODAY = new Date(2026, 9, 9, 14, 30).getTime()

test('parseFocus: the Now items and the Waiting count', () => {
  expect(parseFocus(LOOPS, TODAY)).toEqual({ now: ['NOVA 4.0 — chiudere PRD branding', 'Helios: offerta GPU-01'], label: 'Now', titles: ['NOVA 4.0', 'Helios: offerta GPU-01'], details: ['chiudere PRD branding', ''], due: [null, null], waiting: 2, waitingLines: ['- attesa A', '- attesa B'] })
})

test('parseFocus: an unrecognized structure', () => {
  expect(parseFocus('# To Do\n\n- a\n', TODAY)).toEqual({ now: null, label: null, titles: [], details: [], due: [], waiting: 0, waitingLines: [] })
})

test('shortTitle: from the leading bold text, else up to the first long dash, without Markdown', () => {
  expect(shortTitle('- **NOVA 3.5 — informativa per la sorveglianza del 5/10** — Confermare la voce')).toBe('NOVA 3.5 — informativa per la sorveglianza del 5/10')
  expect(shortTitle('- [ ] **Latenza TP=4** — L\'unico numero che manca')).toBe('Latenza TP=4')
  expect(shortTitle('- [ ] NOVA KB workflow — [#964](https://h/964): fermo')).toBe('NOVA KB workflow')
  expect(shortTitle('- Helios – offerta `GPU-01` [bozza](x.md)')).toBe('Helios')
  expect(shortTitle('- Fare X con **Y** — poi Z')).toBe('Fare X con Y')
  expect(shortTitle('- voce senza trattino [link](a.md)')).toBe('voce senza trattino link')
  expect(shortTitle('NOVA 4.0 — chiudere PRD branding')).toBe('NOVA 4.0')
})

test('shortDetail: what follows the short title, without Markdown or links, without the separator, cut at 120', () => {
  expect(shortDetail('- [ ] **NOVA 4.0** — chiudere [PRD](x.md) branding')).toBe('chiudere PRD branding')
  expect(shortDetail('- **NOVA 3.5 — informativa** — Confermare la voce')).toBe('Confermare la voce')
  expect(shortDetail('- **Latenza TP=4**: manca `un` numero')).toBe('manca un numero')
  expect(shortDetail('- **Titolo** – con trattino corto')).toBe('con trattino corto')
  expect(shortDetail('- [ ] NOVA KB workflow — [#964](https://h/964): fermo')).toBe('#964: fermo')
  expect(shortDetail('- Helios – offerta `GPU-01` [bozza](x.md) — poi altro')).toBe('offerta GPU-01 bozza — poi altro')
  // No detail: only the title, or a bold text followed by nothing else.
  expect(shortDetail('- voce senza trattino')).toBe('')
  expect(shortDetail('- **Solo titolo**')).toBe('')
  expect(shortDetail('- **Solo titolo** —')).toBe('')
  expect(shortDetail(`- **T** — ${'parola '.repeat(40)}`)).toHaveLength(120)
  expect(shortDetail(`- **T** — ${'parola '.repeat(40)}`).endsWith('…')).toBe(true)
})

test('due date: the date in the bold title, aligned with each item', () => {
  const md = '### Now\n\n- **NOVA 3.5 — sorveglianza del 5/10 alle 09:00** — restituire [doc](x.md)\n- **Helios** — audit del 25/09 rivisto\n'
  expect(parseFocus(md, TODAY).due).toEqual(['2026-10-05', null])
})

test('due date: without bold the short title counts, not the body; explicit or inferred year', () => {
  expect(dueDate('- consegna offerta 12/10', TODAY)).toBe('2026-10-12')
  expect(dueDate('- consegna 12/10 — poi altro', TODAY)).toBe('2026-10-12')
  // The real item: "E 2/3 PASS" is in the body and is not 2 March.
  expect(dueDate('- [ ] NOVA KB workflow — [#964](https://x/964): rivedere citazioni; [#1037](https://x/1037) draft, E 2/3 PASS ma NO PROMOTION.', TODAY)).toBe(null)
  // A date in the bold text stays valid.
  expect(dueDate('- [ ] **NOVA KB 2/3** — [#964](https://x/964): rivedere', TODAY)).toBe('2026-03-02')
  expect(dueDate('- **chiusura 3/1/2027**', TODAY)).toBe('2027-01-03')
  expect(dueDate('- **chiusura 3/1/27**', TODAY)).toBe('2027-01-03')
  // December seen from January is the year just ended, not the next one
  expect(dueDate('- **retro 28/12**', new Date(2027, 0, 4).getTime())).toBe('2026-12-28')
})

test('due date: no fake dates from issues, links or out-of-range values', () => {
  expect(dueDate('- **NOVA Chat** — [#964](https://h/x/12/3) e #12/3', TODAY)).toBe(null)
  expect(dueDate('- **rapporto 3/4/2026/1**', TODAY)).toBe(null)
  expect(dueDate('- **finestra 32/10**', TODAY)).toBe(null)
  expect(dueDate('- **finestra 31/11**', TODAY)).toBe(null)
  expect(dueDate('- **niente data qui**', TODAY)).toBe(null)
})

const HO = `---
type: handoff
status: active
created: 2026-10-01 22:08
updated: 2026-10-07 15:09
topic: NOVA Chat Demo — bug discovery
---
# x`

test('parseHandoff: an active handoff with its age from updated', () => {
  expect(parseHandoff(HO, 'h.md', new Date(2026, 9, 9, 10).getTime())).toEqual({ file: 'h.md', topic: 'NOVA Chat Demo — bug discovery', ageDays: 2 })
})

test('nextStep: the declared next step, first paragraph or first item, cut', () => {
  const md = `${HO}\n\n## Fatto\n\n- a\n\n## Prossima azione concreta\n\n1. **Giudizio di Alex** sulla v7.3:\n   aggiustare le slide.\n2. Poi l'audio.\n`
  expect(nextStep(md)).toBe('Giudizio di Alex sulla v7.3: aggiustare le slide.')
  expect(nextStep('## Prossimi step\n\nNessuno: il pilot e\' concluso.\n\n## Altro\n')).toBe("Nessuno: il pilot e' concluso.")
  expect(nextStep(`## Prossima azione\n\n${'parola '.repeat(40)}`)?.length).toBe(140)
  expect(nextStep('# x\n\n## Contesto\n\ntesto\n')).toBe(null)
  expect(parseHandoff(md, 'h.md', new Date(2026, 9, 9, 10).getTime())?.next).toBe('Giudizio di Alex sulla v7.3: aggiustare le slide.')
  expect(nextStep('## Contesto\n\n### Prossima azione dopo il passaggio\n\nRileggere il bilancio.\n')).toBe('Rileggere il bilancio.')
})

test('stateStep: the Current state, the whole first paragraph without Markdown, cut at 220', () => {
  const md = `${HO}\n\n## Stato corrente — passaggio dell'11 ottobre\n\n**Risultato parziale, lavoro fermo.**\nEsistono [componenti](<a b.md>) utili. Altro.\n\nSecondo paragrafo.\n\n## Prossima azione\n\nRiprendere i test.\n`
  expect(stateStep(md)).toBe('Risultato parziale, lavoro fermo. Esistono componenti utili. Altro.')
  expect(stateStep('## Stato corrente (fotografia del 25/09)\n\n- Repo: `main@9d9f11a`, allineato a\n  `origin/main`. Da rileggere.\n- Selenia: READY\n')).toBe('Repo: main@9d9f11a, allineato a origin/main. Da rileggere.')
  expect(stateStep('## Stato corrente\n\n**Fatto (29/09)**\n\n- cartella creata\n')).toBe('Fatto (29/09)')
  expect(stateStep(`## Stato corrente\n\n${'parola '.repeat(40)}`)?.length).toBe(220)
  expect(stateStep(`## Stato corrente\n\n${'parola '.repeat(40)}`)?.endsWith('…')).toBe(true)
  // The next step stays at 140.
  expect(nextStep(`## Prossima azione\n\n${'parola '.repeat(40)}`)?.length).toBe(140)
  expect(stateStep('## Stato corrente\n\n## Prossima azione\n\nx\n')).toBe(null)
  expect(stateStep('# x\n\n## Contesto\n\ntesto\n')).toBe(null)
})

test('parseHandoff: Next action in next and Current state in state, kept apart; with no sections, neither', () => {
  const now = new Date(2026, 9, 9, 10).getTime()
  const both = `${HO}\n\n## Stato corrente\n\nFermo in attesa di Robin. Poi si vede.\n\n## Prossima azione\n\nScrivere a Robin.\n`
  expect(parseHandoff(both, 'h.md', now)).toMatchObject({ next: 'Scrivere a Robin.', state: 'Fermo in attesa di Robin. Poi si vede.' })
  const onlyNext = parseHandoff(`${HO}\n\n## Stato corrente\n\n## Prossima azione\n\nScrivere a Robin.\n`, 'h.md', now)
  expect(onlyNext?.next).toBe('Scrivere a Robin.')
  expect(onlyNext).not.toHaveProperty('state')
  expect(parseHandoff(HO, 'h.md', now)).not.toHaveProperty('next')
  expect(parseHandoff(HO, 'h.md', now)).not.toHaveProperty('state')
})

test('handoffMeta: topic and status from the frontmatter, even of a closed handoff; with no topic, the file name', () => {
  expect(handoffMeta(HO.replace('status: active', 'status: completed'), 'H/h.md')).toEqual({ topic: 'NOVA Chat Demo — bug discovery', status: 'completed' })
  expect(handoffMeta('# senza frontmatter', 'H/handoff-x.md')).toEqual({ topic: 'handoff-x', status: '' })
})

test('parseHandoff: a handoff that is not active → null', () => {
  expect(parseHandoff(HO.replace('status: active', 'status: completed'), 'h.md', 0)).toBe(null)
})

test('latestDiary: the most recent diary note', () => {
  expect(latestDiary(['2026-10-04.md', '2026-10-07.md', 'note.txt'])).toBe('2026-10-07')
  expect(latestDiary([])).toBe(null)
})

test('loadSnapshot: reads the declared sources through a read-only fs', async () => {
  const now = new Date(2026, 9, 9, 10).getTime()
  const files: Record<string, string> = {
    '/v/To Do.md': LOOPS,
    '/v/H/h.md': HO,
  }
  const dirs: Record<string, { name: string; kind: 'file' | 'dir' | 'other'; size: number; mtimeMs: number; isLink: boolean }[]> = {
    '/v/H': [{ name: 'h.md', kind: 'file', size: 1, mtimeMs: 0, isLink: false }],
    '/v/In': [
      { name: '.keep', kind: 'file', size: 0, mtimeMs: 0, isLink: false },
      { name: 'a.md', kind: 'file', size: 1, mtimeMs: new Date(2026, 9, 6, 9).getTime(), isLink: false },
    ],
    '/v/D': [],
    '/v/D/2026/10': [{ name: '2026-10-08.md', kind: 'file', size: 1, mtimeMs: 0, isLink: false }],
  }
  const fs = {
    exists: async (p: string) => p in files || p in dirs,
    read: async (p: string) => { const f = files[p]; if (f === undefined) throw new Error('ENOENT'); return f },
    list: async (p: string) => { const d = dirs[p]; if (d === undefined) throw new Error('ENOENT'); return d },
    stat: async (p: string) => { const f = files[p]; if (f === undefined) throw new Error('ENOENT'); return { size: f.length } },
  }
  const s = {
    root: '/v',
    hasTable: true,
    lang: 'it' as const,
    roles: { 'Future work': 'To Do.md', Handoff: 'H', Inbox: 'In', 'Daily history': 'D', Memoria: 'gone.md' },
  }
  expect(await loadSnapshot(fs, s, now)).toEqual({
    takenAt: now,
    hasTable: true,
    missing: ['Memoria'],
    now: ['NOVA 4.0 — chiudere PRD branding', 'Helios: offerta GPU-01'],
    nowLabel: 'Now',
    nowTitles: ['NOVA 4.0', 'Helios: offerta GPU-01'],
    nowDetails: ['chiudere PRD branding', ''],
    nowDue: [null, null],
    waiting: 2,
    waitingItems: [{ title: 'attesa A', ageDays: null }, { title: 'attesa B', ageDays: null }],
    handoffs: [{ file: 'h.md', topic: 'NOVA Chat Demo — bug discovery', ageDays: 2 }],
    inbox: { count: 1, oldestDays: 3 },
    diary: { hasToday: false, last: '2026-10-08' },
    lastDiary: null,
    diaryDays: [],
    sessions: [],
  })
})

test('loadSnapshot: unreadable sources → empty values, no exception', async () => {
  const boom = async (): Promise<never> => { throw new Error('boom') }
  const fs = { exists: boom, read: boom, list: boom, stat: boom }
  const s = { root: '/v', hasTable: true, lang: 'it' as const, roles: { 'Future work': 'x.md', Handoff: 'H', Inbox: 'In', 'Daily history': 'D' } }
  const snap = await loadSnapshot(fs, s, 1_000_000)
  expect(snap).toMatchObject({ missing: ['Future work', 'Handoff', 'Inbox', 'Daily history'], now: null, waiting: 0, handoffs: [], inbox: null, diary: null })
})

type Entry = { name: string; kind: 'file' | 'dir' | 'other'; size: number; mtimeMs: number }
const file = (name: string, size = 1, mtimeMs = 0): Entry => ({ name, kind: 'file', size, mtimeMs })

function fakeFs(files: Record<string, string>, dirs: Record<string, Entry[]>, sizes: Record<string, number> = {}, failing: string[] = []) {
  return {
    exists: async (p: string) => p in files || p in dirs,
    read: async (p: string) => {
      const f = files[p]
      if (f === undefined || failing.includes(p)) throw new Error('EIO')
      return f
    },
    list: async (p: string) => { const d = dirs[p]; if (d === undefined) throw new Error('ENOENT'); return d },
    stat: async (p: string) => { const f = files[p]; if (f === undefined) throw new Error('ENOENT'); return { size: sizes[p] ?? f.length } },
  }
}

test('loadSnapshot: the diary from the previous month (start of the month)', async () => {
  const fs = fakeFs({}, { '/v/D': [], '/v/D/2026/10': [file('2026-10-30.md')] })
  const snap = await loadSnapshot(fs, { root: '/v', hasTable: true, lang: 'it' as const, roles: { 'Daily history': 'D' } }, new Date(2026, 10, 2, 10).getTime())
  expect(snap.diary).toEqual({ hasToday: false, last: '2026-10-30' })
})

test('loadSnapshot: an empty current month → falls back to the previous one', async () => {
  const fs = fakeFs({}, { '/v/D': [], '/v/D/2026/11': [], '/v/D/2026/10': [file('2026-10-29.md')] })
  const snap = await loadSnapshot(fs, { root: '/v', hasTable: true, lang: 'it' as const, roles: { 'Daily history': 'D' } }, new Date(2026, 10, 2, 10).getTime())
  expect(snap.diary).toEqual({ hasToday: false, last: '2026-10-29' })
})

test('loadSnapshot: the last diary note is the most recent up to today, even in the previous month or in the root', async () => {
  const nov2 = new Date(2026, 10, 2, 10).getTime()
  const roles = { root: '/v', hasTable: true, lang: 'it' as const, roles: { 'Daily history': 'D' } }
  const fs = fakeFs(
    { '/v/D/2026/10/2026-10-30.md': '## Fatto\n- chiuso\n', '/v/D/2026-10-31.md': '## Focus\n- radice\n' },
    { '/v/D': [file('2026-10-31.md')], '/v/D/2026/11': [file('2026-11-03.md')], '/v/D/2026/10': [file('2026-10-30.md')] },
  )
  expect((await loadSnapshot(fs, roles, nov2)).lastDiary).toEqual({ day: '2026-10-31', path: 'D/2026-10-31.md', parts: [{ part: 'focus', lines: [{ lead: '', rest: 'radice' }], more: 0 }] })
  const monthOnly = fakeFs({ '/v/D/2026/10/2026-10-30.md': '## Fatto\n- chiuso\n' }, { '/v/D': [], '/v/D/2026/11': [file('2026-11-03.md')], '/v/D/2026/10': [file('2026-10-30.md')] })
  expect((await loadSnapshot(monthOnly, roles, nov2)).lastDiary?.path).toBe('D/2026/10/2026-10-30.md')
})

test('loadSnapshot: the last diary note is absent if too big, unreadable or without sections', async () => {
  const at = new Date(2026, 9, 12, 9).getTime()
  const roles = { root: '/v', hasTable: true, lang: 'it' as const, roles: { 'Daily history': 'D' } }
  const dirs = { '/v/D': [], '/v/D/2026/10': [file('2026-10-11.md', 600 * 1024)] }
  expect((await loadSnapshot(fakeFs({ '/v/D/2026/10/2026-10-11.md': '## Focus\n- a\n' }, dirs), roles, at)).lastDiary).toBe(null)
  const small = { '/v/D': [], '/v/D/2026/10': [file('2026-10-11.md')] }
  expect((await loadSnapshot(fakeFs({ '/v/D/2026/10/2026-10-11.md': '## Focus\n- a\n' }, small, {}, ['/v/D/2026/10/2026-10-11.md']), roles, at)).lastDiary).toBe(null)
  expect((await loadSnapshot(fakeFs({ '/v/D/2026/10/2026-10-11.md': '# niente\n' }, small), roles, at)).lastDiary).toBe(null)
  expect((await loadSnapshot(fakeFs({}, {}), { root: '/v', hasTable: true, lang: 'it' as const, roles: {} }, at)).lastDiary).toBe(null)
})

test('loadSnapshot: the last diary note up to and including today, and the notes of the days in the records', async () => {
  const at = new Date(2026, 9, 15, 9).getTime()
  const roles = { root: '/v', hasTable: true, lang: 'it' as const, roles: { 'Daily history': 'D' } }
  const fs = fakeFs(
    {
      '/v/D/2026/10/2026-10-15.md': '## Focus\n- oggi\n',
      '/v/D/2026/10/2026-10-14.md': '## Stato di chiusura\n- chiusa ieri\n',
      '/v/D/2026/10/2026-10-12.md': '## Focus\n- lunedi\n',
    },
    { '/v/D': [], '/v/D/2026/10': [file('2026-10-12.md'), file('2026-10-14.md'), file('2026-10-15.md')] },
  )
  const rec = { v: 1 as const, id: 'a', startAt: 1, lastAt: 2, endAt: null, prompts: 1, firstPrompt: 'x', resumeOf: null, files: [], fileCount: 0, handoff: null, diaryDay: '2026-10-14', diaryAt: 2, subagents: 0, errors: 0 }
  const snap = await loadSnapshot(fs, roles, at, { sessions: [rec], diaryDays: ['2026-10-15', '2026-10-14', '2026-10-12'] })
  expect(snap.lastDiary?.day).toBe('2026-10-15')
  // At most two days; the day of lastDiary is not read again.
  expect(snap.diaryDays?.map(d => `${d.day} ${d.parts[0]?.lines[0]?.rest}`)).toEqual(['2026-10-15 oggi', '2026-10-14 chiusa ieri'])
  expect(snap.sessions).toEqual([rec])
  // A note of the records that is gone or too big is skipped.
  const big = fakeFs({ '/v/D/2026/10/2026-10-14.md': '## Focus\n- a\n' }, { '/v/D': [], '/v/D/2026/10': [] }, { '/v/D/2026/10/2026-10-14.md': MAX_READ_BYTES + 1 })
  expect((await loadSnapshot(big, roles, at, { sessions: [], diaryDays: ['2026-10-13', '2026-10-14'] })).diaryDays).toEqual([])
})

test('loadSnapshot: an unreadable handoff does not remove the others', async () => {
  const ok = HO.replace('NOVA Chat Demo — bug discovery', 'Altro')
  const fs = fakeFs(
    { '/v/H/a.md': HO, '/v/H/b.md': ok },
    { '/v/H': [file('a.md'), file('b.md')] },
    {},
    ['/v/H/a.md'],
  )
  const snap = await loadSnapshot(fs, { root: '/v', hasTable: true, lang: 'it' as const, roles: { Handoff: 'H' } }, new Date(2026, 9, 9, 10).getTime())
  expect(snap.handoffs).toEqual([{ file: 'b.md', topic: 'Altro', ageDays: 2 }])
})

test('loadSnapshot: a handoff over the limit is not read', async () => {
  const fs = fakeFs({ '/v/H/a.md': HO }, { '/v/H': [file('a.md', MAX_READ_BYTES + 1)] })
  const snap = await loadSnapshot(fs, { root: '/v', hasTable: true, lang: 'it' as const, roles: { Handoff: 'H' } }, new Date(2026, 9, 9, 10).getTime())
  expect(snap.handoffs).toEqual([])
})

test('loadSnapshot: the Future work file over the limit → now null, the other sections stay', async () => {
  const fs = fakeFs(
    { '/v/To Do.md': LOOPS, '/v/H/h.md': HO },
    { '/v/H': [file('h.md')], '/v/In': [file('a.md', 1, new Date(2026, 9, 6, 9).getTime())] },
    { '/v/To Do.md': MAX_READ_BYTES + 1 },
  )
  const s = { root: '/v', hasTable: true, lang: 'it' as const, roles: { 'Future work': 'To Do.md', Handoff: 'H', Inbox: 'In' } }
  const snap = await loadSnapshot(fs, s, new Date(2026, 9, 9, 10).getTime())
  expect(snap.now).toBe(null)
  expect(snap.waiting).toBe(0)
  expect(snap.handoffs).toEqual([{ file: 'h.md', topic: 'NOVA Chat Demo — bug discovery', ageDays: 2 }])
  expect(snap.inbox).toEqual({ count: 1, oldestDays: 3 })
})

test('waitingItems: title from the bold text, age from the git blame line, the longest-waiting first', () => {
  const porcelain = [
    'abc 1 1 1', 'author Alex', 'author-time 1759000000', 'filename To Do.md', '\t- [ ] **Registry** — rotate token',
    'def 2 2 1', 'author Alex', 'author-time 1757000000', 'filename To Do.md', '\t- [ ] **Docs** — review the guide',
  ].join('\n')
  const times = parseBlame(porcelain)
  expect(times.get('- [ ] **Registry** — rotate token')).toBe(1759000000 * 1000)
  const now = 1759000000 * 1000 + 3 * 86_400_000
  expect(waitingItems(['- [ ] **Registry** — rotate token', '- [ ] **Docs** — review the guide', '- nuova'], times, now)).toEqual([
    { title: 'Docs', ageDays: daysFrom(1757000000 * 1000, now) },
    { title: 'Registry', ageDays: 3 },
    { title: 'nuova', ageDays: null },
  ])
  expect(itemTitle('- consegna [doc](x.md)')).toBe('consegna doc')
})

function daysFrom(a: number, b: number): number {
  const d = (ms: number) => { const x = new Date(ms); return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime() }
  return Math.round((d(b) - d(a)) / 86_400_000)
}

test('Jarvis Lite format: a Capabilities table with English roles, a To Do file with Active and Waiting, an English handoff', () => {
  const claude = '<!-- jarvis:onboarding-required -->\n# Jarvis\n\n## Capabilities\n\n| Role | Authoritative source |\n|---|---|\n'
    + '| Identity | `99 - Jarvis/memory/soul.md` |\n| Soul template | `99 - Jarvis/system/soul-template.md` |\n'
    + '| Durable memory | `99 - Jarvis/memory/MEMORY.md` |\n| Future work | `To Do.md` |\n| Daily history | `01 - Diary/` |\n'
    + '| Handoff | `99 - Jarvis/handoffs/` |\n| Inbox | `00 - Inbox/` |\n\n## Altro\n'
  expect(parseCapabilities(claude, '/v')).toEqual({ root: '/v', hasTable: true, isOnboarding: true, lang: 'en', roles: {
    Identity: '99 - Jarvis/memory/soul.md', 'Durable memory': '99 - Jarvis/memory/MEMORY.md', 'Future work': 'To Do.md',
    'Daily history': '01 - Diary', Handoff: '99 - Jarvis/handoffs', Inbox: '00 - Inbox',
  } })
  const todo = '# To Do\n\n## Active\n\n- **Offerta Rossi** — mandare la bozza\n\n## Later\n\n- dopo\n\n## Waiting\n\n- risposta di Bianchi\n'
  expect(parseFocus(todo, TODAY)).toMatchObject({ label: 'Active', titles: ['Offerta Rossi'], details: ['mandare la bozza'], waiting: 1 })
  expect(parseFocus('## In corso\n\n- uno\n\n## In attesa\n\n- due\n', TODAY)).toMatchObject({ label: 'In corso', titles: ['uno'], waiting: 1 })
  const handoff = '## Context and goal\n\nx\n\n## Current state\n\nBozza pronta.\n\n## Next action\n\nMandarla a Rossi.\n'
  expect(stateStep(handoff)).toBe('Bozza pronta.')
  expect(nextStep(handoff)).toBe('Mandarla a Rossi.')
})
