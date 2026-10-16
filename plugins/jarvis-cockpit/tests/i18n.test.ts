import { test, expect } from 'claude-code/testing'
import { detectLang, strings } from '../hooks/i18n'
import { relDay, longDay, shortDay } from '../hooks/format'

const LITE = '## Capabilities\n\n| Role | Authoritative source |\n|---|---|\n| Identity | `99 - Jarvis/memory/soul.md` |\n'
const ITALIAN = "## Capacita' Jarvis\n\n| Capacita' | Fonte |\n|---|---|\n| Identita' | `99 - Jarvis/memory/soul.md` |\n"

test('detectLang: the Identity source decides when it names a language', () => {
  expect(detectLang(LITE, "- L'italiano è la lingua di base; uso i termini tecnici inglesi.")).toBe('it')
  expect(detectLang(LITE, '- La mia lingua predefinita è **italiano**.')).toBe('it')
  expect(detectLang(ITALIAN, '- My default language is **English**.')).toBe('en')
  expect(detectLang(ITALIAN, '- My default language is **Deutsch**.')).toBe('en')
})

test('detectLang: without a language line the table heading decides, then English', () => {
  expect(detectLang(ITALIAN, '')).toBe('it')
  expect(detectLang("## Capacità Jarvis\n", '')).toBe('it')
  expect(detectLang(LITE, '')).toBe('en')
  expect(detectLang(LITE, '- My default language is **[LANGUAGE]**.')).toBe('en')
  expect(detectLang('', '')).toBe('en')
})

test('detectLang: an Italian capability table and an Italian identity line give it', () => {
  expect(detectLang(ITALIAN, "- L'italiano è la lingua di base; uso i termini tecnici inglesi.")).toBe('it')
})

test('detectLang: only the first line that names a language counts, and an unrelated heading does not', () => {
  expect(detectLang(ITALIAN, '# Soul\n\n- My default language is **English**.\n- La lingua del repo è italiano.\n')).toBe('en')
  expect(detectLang(ITALIAN, '# Soul\n\n- La lingua del repo è italiano.\n- My default language is **English**.\n')).toBe('it')
  expect(detectLang('## Capacita\' Jarvis extra\n', '')).toBe('en')
  expect(detectLang('Qualche riga\n## Capabilities\n', '')).toBe('en')
})

test('strings: both catalogs have the same groups and no empty text', () => {
  const walk = (o: unknown, path: string, out: string[]): string[] => {
    if (typeof o === 'string') { if (o.trim() === '') out.push(path); return out }
    if (o !== null && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`, out)
    return out
  }
  expect(walk(strings('en'), 'en', [])).toEqual([])
  expect(walk(strings('it'), 'it', [])).toEqual([])
  expect(Object.keys(strings('en')).sort()).toEqual(Object.keys(strings('it')).sort())
})

test('strings: the two catalogs have the same shape, field by field', () => {
  const shape = (o: unknown): unknown => {
    if (typeof o === 'string') return 'text'
    if (Array.isArray(o)) return o.map(shape)
    if (o !== null && typeof o === 'object') return Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, shape(v)]))
    return typeof o
  }
  expect(shape(strings('en'))).toEqual(shape(strings('it')))
})

test('strings: the Italian catalog keeps the texts the cockpit has always drawn', () => {
  const it = strings('it')
  expect(it.dates.days).toEqual(['dom', 'lun', 'mar', 'mer', 'gio', 'ven', 'sab'])
  expect(it.dates.months).toEqual(['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'])
  expect(it.dates.daysLong).toEqual(['Domenica', 'Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato'])
  expect([it.dates.today, it.dates.yesterday]).toEqual(['oggi', 'ieri'])
  expect(it.tabs).toEqual({ recap: 'Recap', diary: 'Diario', files: 'File', reading: 'Lettura', readingDraft: 'Lettura ●', todo: 'Da fare', memories: 'Memorie' })
  expect(it.roles).toEqual({ identity: 'identità', memory: 'memoria', futureWork: 'futuro op.', diary: 'diario', handoff: 'handoff', inbox: 'inbox' })
  expect(it.command.description).toBe('Apre il cockpit di Jarvis: stato del vault e attività live')
  expect(it.mascot.alt).toEqual({
    idle: 'Jarvis in attesa', sleep: 'Jarvis dorme', thinking: 'Jarvis pensa', reading: 'Jarvis legge', writing: 'Jarvis scrive',
    agent: 'Jarvis con un subagent', done: 'Jarvis ha finito', error: 'Jarvis ha un problema',
  })
  expect(it.mascot.title).toEqual({
    idle: 'Jarvis in attesa',
    sleep: "Jarvis dorme: nessun turno da un quarto d'ora",
    work: 'Jarvis al lavoro',
    agent: 'Jarvis con un subagent',
    done: 'Jarvis ha finito',
    party: 'Jarvis festeggia: test o commit riuscito',
    error: 'Jarvis ha un problema: turno interrotto o fermato',
  })
})

test('strings: a mascot title is « short text: detail », and its short text is the alt of the same scene', () => {
  for (const lang of ['it', 'en'] as const) {
    const { alt, title } = strings(lang).mascot
    expect(title.idle.split(':')[0]).toBe(alt.idle)
    expect(title.sleep.split(':')[0]).toBe(alt.sleep)
    expect(title.agent.split(':')[0]).toBe(alt.agent)
    expect(title.done.split(':')[0]).toBe(alt.done)
    expect(title.error.split(':')[0]).toBe(alt.error)
  }
})

test('dates: English and Italian words, same shapes', () => {
  const now = new Date(2026, 9, 15, 12).getTime()
  const en = strings('en').dates
  const it = strings('it').dates
  expect(relDay(now, now, en)).toBe('today')
  expect(relDay(now - 86_400_000, now, en)).toBe('yesterday')
  expect(relDay(new Date(2026, 9, 12, 9).getTime(), now, en)).toBe('Mon 12')
  expect(relDay(new Date(2026, 9, 1, 9).getTime(), now, en)).toBe('1 Oct')
  expect(relDay(now, now, it)).toBe('oggi')
  expect(longDay(now, en)).toBe('Thursday 15 October')
  expect(longDay(now, it)).toBe('Giovedì 15 ottobre')
  expect(shortDay('2026-10-08', en)).toBe('8 Oct')
})

test('strings: the Italian Recap, Diary, header and bubble texts are the ones the cockpit has always drawn', () => {
  const it = strings('it')
  expect([it.dates.age(0), it.dates.age(1), it.dates.age(12), it.dates.daysAgo(4)]).toEqual(['oggi', 'ieri', '12g', '4g fa'])
  expect(it.recap.sources.names).toEqual({ Identity: "Identita'", 'Durable memory': 'Memoria durevole', 'Future work': 'Futuro operativo', 'Daily history': 'Diario' })
  expect(it.recap.sources.missing("Identita'")).toBe("✕ Identita' dichiarata ma assente")
  expect(it.recap.today.inbox(5, '23g')).toBe('5 in Inbox, la più vecchia 23g')
  expect(it.recap.today.inbox(5, null)).toBe('5 in Inbox')
  expect(it.recap.last.before('A', 'non salvata')).toBe('Prima, stesso giorno: A · non salvata')
  expect([it.recap.activity.searches(1), it.recap.activity.searches(2), it.recap.activity.files(1)]).toEqual(['1 ricerca', '2 ricerche', '1 file'])
  expect(it.recap.activity.end('answer', '3m10', 2)).toBe('✓ fatto in 3m10 · 2 file')
  expect(it.recap.activity.end('aborted', null, 0)).toBe('✗ interrotto')
  expect(it.recap.activity.end('error', null, 1)).toBe('✗ finito con un errore · 1 file')
  expect(Object.values(it.recap.activity.verbs)).toEqual(['legge', 'cerca', 'scrive', 'crea', 'sposta', 'elimina', 'esegue'])
  expect([it.session.late(0), it.session.late(1), it.session.late(5)]).toEqual(['scade oggi', 'scaduta ieri', 'scaduta 5g fa'])
  expect(it.session.resumeSession('ieri 09:40–14:28', 'tema', ['a.md'], 3)).toBe('Riprendiamo la sessione di ieri 09:40–14:28: «tema». File scritti: a.md e altri 3')
  expect(it.session.resumeNow('NOVA', '')).toBe('Riprendiamo «NOVA»')
  expect(it.diary.parts).toEqual({ focus: 'Focus', done: 'Fatto', decisions: 'Decisioni', closing: 'Stato di chiusura' })
  expect([it.header.working, it.header.workingSince('14:31'), it.header.waiting, it.header.reopen]).toEqual(['al lavoro', 'al lavoro · da 14:31', 'in attesa', 'riapre il cockpit'])
  expect(it.bubble.setup(it.bubble.hello('Anna'))).toBe('Hello, Anna! Configuriamo Jarvis?')
  expect(it.bubble.wins).toEqual(['Well done!', 'Tutto verde ✓', 'Evvai!', 'Ottimo lavoro!', 'Missione compiuta', 'Happy!'])
  expect(it.bubble.saved).toEqual(['Sessione al sicuro ✓', 'Salvato. Bel lavoro!', 'Tutto annotato ✓'])
})

test('strings: the English Recap, Diary, header and bubble texts read naturally and keep the glyphs', () => {
  const en = strings('en')
  expect([en.dates.age(0), en.dates.age(1), en.dates.age(12), en.dates.daysAgo(4)]).toEqual(['today', 'yesterday', '12d', '4d ago'])
  expect(en.recap.today.inbox(5, '23d')).toBe('5 in Inbox, oldest 23d')
  expect(en.recap.activity.end('answer', '3m10', 2)).toBe('✓ done in 3m10 · 2 files')
  expect(en.recap.activity.end('error', null, 1)).toBe('✗ ended with an error · 1 file')
  expect(en.session.resumeSession('yesterday 09:40–14:28', 'topic', ['a.md'], 3)).toBe(`Let's resume the session from yesterday 09:40–14:28: "topic". Files written: a.md and 3 more`)
  expect([en.session.late(0), en.session.late(1), en.session.late(5)]).toEqual(['due today', 'overdue since yesterday', 'overdue 5d'])
  expect(en.diary.parts).toEqual({ focus: 'Focus', done: 'Done', decisions: 'Decisions', closing: 'Closing state' })
  expect(en.bubble.setup(en.bubble.hello(''))).toBe('Hello! Shall we set up Jarvis?')
  // The log draws the first word of a turn end as its glyph.
  for (const t of [strings('it'), en]) {
    for (const kind of ['answer', 'aborted', 'error'] as const) expect(t.recap.activity.end(kind, null, 0)).toMatch(/^[✓✗] \S/)
  }
})

test('strings: the Italian To Do, Memories, Files, Reading, log and toast texts are the ones the cockpit has always drawn', () => {
  const it = strings('it')
  expect([it.todo.name, it.todo.confirmDelete, it.todo.add, it.todo.cancel, it.todo.enterToAdd]).toEqual(['To Do', 'cancella?', '+ aggiungi', 'annulla', 'Invio per aggiungere'])
  expect(it.todo.newItemIn('Jarvis')).toBe('Nuova voce in Jarvis')
  expect(it.todo.unreadable('Da fare.md', 'EACCES')).toBe('Non riesco a leggere Da fare.md: EACCES')
  expect(it.todo.tooBig('Da fare')).toBe('Da fare è troppo grande per la scheda')
  expect(it.todo.changed('Da fare')).toBe("Da fare è cambiato, l'ho ricaricato")
  expect(it.todo.cannotWrite('disco pieno')).toBe('Non riesco a scrivere il file: disco pieno')
  expect([it.todo.notAdded, it.todo.discard, it.todo.editFile, it.todo.openInReading]).toEqual(['Voce non aggiunta', 'scarta', 'Modifica il file ›', 'Apri in Lettura ›'])
  expect(it.memories.groups).toEqual({ people: 'Persone', projects: 'Progetti', preferences: 'Preferenze', references: 'Riferimenti', other: 'Altre' })
  expect(it.memories.fresh).toEqual({ new: 'nuova', changed: 'cambiata' })
  expect([it.memories.count(4, 0), it.memories.count(4, 1), it.memories.count(4, 2)]).toEqual(['4', '4 · 1 nuova', '4 · 2 nuove'])
  expect([it.memories.more(3), it.memories.less]).toEqual(['altre 3 ›', 'meno ‹'])
  expect([it.memories.mapAlt('NOVA Chat', 1), it.memories.mapAlt('NOVA Chat', 4)]).toEqual(['NOVA Chat e 1 memoria collegata', 'NOVA Chat e 4 memorie collegate'])
  expect(it.memories.askPrompt('NOVA Chat')).toBe('Modifica la memoria «NOVA Chat»: ')
  expect(it.memories.footer).toBe('Per modificare le memorie chiedi a Jarvis')
  expect([it.memories.unreadable(null, 'x'), it.memories.none(null)]).toEqual(['Non riesco a leggere la cartella delle memorie: x', 'Nessuna memoria in questa cartella'])
  expect([it.files.openInApp, it.files.copyPath, it.files.noSelection, it.files.filter]).toEqual(["Apri nell'app", 'Copia path', 'nessun file selezionato', 'Filtra…'])
  expect([it.files.noMatch('zz'), it.files.moreRows(5), it.files.writtenByJarvis('14:31')]).toEqual(['Nessun file con «zz»', 'altre 5 righe: usa il filtro', 'scritto da Jarvis alle 14:31'])
  expect([it.files.modifiedAt('14:31'), it.files.modifiedAgo('3g'), it.files.decimalMark]).toEqual(['modificato alle 14:31', 'modificato 3g fa', ','])
  expect([it.files.trashAsk, it.files.trashYes, it.files.move, it.files.duplicate, it.files.trash]).toEqual(['Mettere nel Cestino di macOS?', '✕ sì, nel cestino', '→ sposta', '+ duplica', '✕ cestino'])
  expect([it.files.copySuffix(1), it.files.copySuffix(2)]).toEqual([' copia', ' copia 2'])
  expect([it.files.icons.dir, it.files.icons.dirOpen, it.files.icons.excel]).toEqual(['cartella', 'cartella aperta', 'foglio di calcolo'])
  expect([it.dates.shortDays(3), it.dates.shortMonths(2)]).toEqual(['3g', '2m'])
  expect([it.reading.modes.text, it.reading.modes.diff, it.reading.modes.edit]).toEqual(['Testo', 'Diff', 'Modifica'])
  expect([it.reading.tooLong, it.reading.loading, it.reading.notText]).toEqual(['File troppo lungo per il pannello.', 'Carico il file…', 'Non è un file di testo.'])
  expect([it.reading.updatedNow, it.reading.modifiedByJarvis('14:31')]).toEqual(['aggiornato ora', 'modificato da Jarvis alle 14:31'])
  expect([it.reading.diff.onDisk, it.reading.diff.draft]).toEqual(['(su disco)', '(bozza)'])
  expect(it.reading.diff.lastCommit('ieri 14:31', 'fix')).toBe('ultimo commit · ieri 14:31 · fix')
  // The six reasons are pinned literally: reader.test.ts reads them from the catalog, so a change here must be seen.
  expect(it.reading.blocked).toEqual({
    protected: 'file protetto, si modifica in chat',
    notMarkdown: 'solo per i Markdown',
    tooBig: 'troppo lungo, usa ↗',
    notRead: 'file non letto',
    notUtf8: 'il file non è UTF-8, modificalo fuori dal pannello',
    mixedEol: 'fine riga misti, modificalo fuori dal pannello',
  })
  expect([it.reading.protectedError, it.reading.outsideError]).toEqual(['File protetto: non si salva dal cockpit', 'File fuori dal vault: non si salva dal cockpit'])
  expect(it.reading.pending.title('a.md')).toBe('Bozza non salvata su a.md')
  expect([it.log.profile, it.log.core, it.command.opened]).toEqual(['profilo', 'core', 'Cockpit aperto.'])
  expect([it.pane.elsewhere, it.pane.faultTitle, it.pane.faultReload]).toEqual(["Il cockpit è disegnato per l'app desktop", 'Il cockpit ha avuto un problema', 'Ricarica'])
  expect([it.toasts.promptNotEmpty, it.toasts.copied('a.md'), it.toasts.trashed('a.md'), it.toasts.moved('b/a.md'), it.toasts.created('a copia.md')])
    .toEqual(['Prompt non vuoto: svuotalo e riprova', 'Copiato a.md', 'a.md nel cestino', 'Spostato in b/a.md', 'Creato a copia.md'])
  expect([it.toasts.exists('a.md'), it.toasts.notThere('a.md'), it.toasts.protectedFile('a.md'), it.toasts.fileNotFound('a.md'), it.toasts.cannotReread('a.md')])
    .toEqual(['Esiste già a.md', 'Non lì: a.md è protetto', 'a.md è protetto', 'File non trovato: a.md', 'Non riesco a rileggere a.md'])
  expect([it.toasts.moveWhere, it.toasts.onlyInVault, it.toasts.alreadyThere]).toEqual(['Scrivi dove spostarlo', 'Solo percorsi dentro il vault', 'È già lì'])
})

test('strings: the English To Do, Memories, Files, Reading, log and toast texts read naturally', () => {
  const en = strings('en')
  expect([en.todo.name, en.todo.confirmDelete, en.todo.add, en.todo.cancel, en.todo.enterToAdd]).toEqual(['To Do', 'Delete?', '+ Add', 'Cancel', 'Enter to add'])
  expect(en.todo.newItemIn('Jarvis')).toBe('New item in Jarvis')
  expect(en.todo.changed('To Do')).toBe('To Do changed, I reloaded it')
  expect(en.memories.groups).toEqual({ people: 'People', projects: 'Projects', preferences: 'Preferences', references: 'References', other: 'Other' })
  expect(en.memories.fresh).toEqual({ new: 'New', changed: 'Changed' })
  expect([en.memories.count(4, 0), en.memories.count(4, 1), en.memories.count(4, 2)]).toEqual(['4', '4 · 1 new', '4 · 2 new'])
  expect([en.memories.mapAlt('NOVA Chat', 1), en.memories.mapAlt('NOVA Chat', 4)]).toEqual(['NOVA Chat and 1 linked memory', 'NOVA Chat and 4 linked memories'])
  expect(en.memories.askPrompt('NOVA Chat')).toBe('Edit the memory "NOVA Chat": ')
  expect([en.files.noMatch('zz'), en.toasts.notThere('a.md')]).toEqual(['No file matches "zz"', 'a.md is protected'])
  expect([en.files.modifiedAt('14:31'), en.files.modifiedAgo('3d'), en.files.decimalMark]).toEqual(['modified at 14:31', 'modified 3d ago', '.'])
  expect([en.files.copySuffix(1), en.files.copySuffix(2)]).toEqual([' copy', ' copy 2'])
  expect([en.dates.shortDays(3), en.dates.shortMonths(2)]).toEqual(['3d', '2mo'])
  expect([en.reading.modes.text, en.reading.modes.diff, en.reading.modes.edit]).toEqual(['Text', 'Diff', 'Edit'])
  expect(en.reading.diff.lastCommit('yesterday 14:31', 'fix')).toBe('Last commit · yesterday 14:31 · fix')
  expect([en.log.profile, en.log.core, en.command.opened]).toEqual(['profile', 'core', 'Cockpit opened.'])
  expect([en.toasts.promptNotEmpty, en.toasts.copied('a.md'), en.toasts.trashed('a.md'), en.toasts.moved('b/a.md')])
    .toEqual(['The prompt is not empty: clear it and try again', 'Copied a.md', 'a.md moved to the Trash', 'Moved to b/a.md'])
  // A text with a count or a name is a function in both languages, and no English text keeps an Italian word.
  expect(JSON.stringify(en.todo) + JSON.stringify(en.memories) + JSON.stringify(en.files) + JSON.stringify(en.reading) + JSON.stringify(en.toasts)).not.toMatch(/\b(nuova|cambiata|cancella|aggiungi|annulla|Carico|File non trovato|Spostato|Creato|Copiato)\b/)
})
