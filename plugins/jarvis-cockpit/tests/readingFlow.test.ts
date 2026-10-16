import { test, expect } from 'claude-code/testing'
import type { Draft, Reading, Tree } from '../types'
import { EMPTY_READING } from '../hooks/reader'
import { emptyTree } from '../hooks/tree'
import type { EditorPost } from '../hooks/editor'
import type { Cell } from '../hooks/ports'
import { conflictAct, editorFault, editorMessage, followOwnWrite, freshDraft, openReading, pendingAct, saveDraft, syncDraft, type ReadingDeps } from '../hooks/readingFlow'
import { MEM_ROOT, flush, memCell, memClock, memFs, memRun, memSources } from './ports'

const REL = 'To Do.md'
const PATH = `${MEM_ROOT}/${REL}`

// Reading and draft with fake ports: the file in memory, Reading in Edit with a clean draft of the file.
function readingWorld(text: string) {
  const files = memFs({ [PATH]: text })
  const reading = memCell<Reading>({ ...EMPTY_READING, path: REL, mode: 'edit', text, mtimeMs: 1000, size: text.length })
  const draft = memCell<Draft | null>(freshDraft(REL, text, 1000, text.length))
  const deps: ReadingDeps = {
    fs: files.fs, run: memRun(() => null).run, clock: memClock(), sources: memSources({ 'Future work': REL }),
    reading, draft, tree: memCell<Tree>(emptyTree()),
    tab: async () => 'reading', setTab: async () => {}, toast: () => {}, fault: async () => {}, wrote: async () => {}, openInApp: async () => {},
  }
  return { files, reading, draft, deps }
}

test('followOwnWrite: a clean draft restarts from the new text, Reading stays in Edit', async () => {
  const w = readingWorld('- [ ] uno\n')
  w.files.touch(PATH, '- [x] uno\n')
  await followOwnWrite(w.deps, REL)
  expect(w.draft.value).toMatchObject({ path: REL, text: '- [x] uno\n', base: '- [x] uno\n' })
  expect(w.reading.value).toMatchObject({ mode: 'edit', text: '- [x] uno\n' })
})

test('followOwnWrite: when the file ends up with mixed line endings there is no draft and Reading goes back to Text', async () => {
  const w = readingWorld('- [ ] uno\n- [ ] due\n')
  w.files.touch(PATH, '- [ ] uno\r\n- [x] due\n')
  await followOwnWrite(w.deps, REL)
  expect(w.draft.value).toBe(null)
  expect(w.reading.value).toMatchObject({ mode: 'text', text: '- [ ] uno\r\n- [x] due\n' })
})

// The draft of the world above, with the atom write failing once: `gate` holds it back until it is released,
// then it fails (like an engine write that arrives later and is rejected).
function flakyDraft(w: ReturnType<typeof readingWorld>) {
  const toasts: string[] = []
  let failing = false
  let gate: Promise<void> | null = null
  const draft: Cell<Draft | null> = {
    get: w.draft.get,
    set: async fn => {
      if (!failing) return w.draft.set(fn)
      failing = false
      if (gate !== null) await gate
      throw new Error('atom rifiutato')
    },
  }
  return {
    deps: { ...w.deps, draft, toast: (t: string) => { toasts.push(t) } },
    toasts,
    failOnce: (hold: Promise<void> | null = null): void => { failing = true; gate = hold },
  }
}

const post = (w: ReturnType<typeof readingWorld>, text: string, extra: { save?: true } = {}): EditorPost => ({ gen: (w.draft.value as Draft).gen, text, row: 0, col: 0, ...extra })

test('syncDraft: when the draft write to the atom fails once, the typed text stays and Save writes it', async () => {
  const w = readingWorld('- [ ] uno\n')
  const f = flakyDraft(w)
  f.failOnce()
  // The first key changes the "unsaved" dot: the atom is written at once, and the write fails.
  await editorMessage(f.deps, post(w, '- [ ] uno!\n'))
  expect(w.draft.value).toMatchObject({ text: '- [ ] uno\n', base: '- [ ] uno\n' })
  expect(await saveDraft(f.deps)).toBe(true)
  expect(w.files.text.get(PATH)).toBe('- [ ] uno!\n')
  expect(f.toasts).toEqual(['Salvato'])
  expect(w.draft.value).toMatchObject({ text: '- [ ] uno!\n', base: '- [ ] uno!\n' })
})

test('syncDraft: after the failure the text does not replace a newer one that arrived in the meantime, and the queue restarts', async () => {
  const w = readingWorld('- [ ] uno\n')
  const f = flakyDraft(w)
  let release = (): void => {}
  f.failOnce(new Promise<void>(r => { release = r }))
  // The write of the first text is stuck; a newer text arrives (it waits in the queue) and then the rejection.
  const first = editorMessage(f.deps, post(w, '- [ ] uno!\n'))
  await flush()
  const second = editorMessage(f.deps, post(w, '- [ ] uno!!\n'))
  await flush()
  release()
  await Promise.all([first, second])
  expect(w.draft.value).toMatchObject({ text: '- [ ] uno!!\n', base: '- [ ] uno\n' })
  expect(await saveDraft(f.deps)).toBe(true)
  expect(w.files.text.get(PATH)).toBe('- [ ] uno!!\n')
})

// The conflict card shows up while the first Save is still waiting for the mascot (`fault`); Overwrite, pressed
// at that point, waits for that save and then writes: it used to return that save's outcome (false) and leave the file as it was.
test('saveDraft: Overwrite pressed while the first Save waits for the mascot writes the draft', async () => {
  const w = readingWorld('- [ ] uno\n')
  let release = (): void => {}
  const gate = new Promise<void>(r => { release = r })
  const deps: ReadingDeps = { ...w.deps, fault: () => gate }
  await editorMessage(deps, post(w, '- [ ] uno!\n'))
  // Another chat writes the file: the first Save finds the conflict and holds `saving` until the mascot is done.
  w.files.touch(PATH, '- [ ] due\n')
  const first = saveDraft(deps)
  await flush()
  await flush()
  expect(w.draft.value).toMatchObject({ conflict: 'disk' })
  const second = conflictAct(deps, 'overwrite')
  await flush()
  await flush()
  release()
  expect(await first).toBe(false)
  await second
  expect(w.files.text.get(PATH)).toBe('- [ ] uno!\n')
  expect(w.draft.value).toMatchObject({ text: '- [ ] uno!\n', base: '- [ ] uno!\n', conflict: null })
})

test('saveDraft: two Overwrites in a row write only once', async () => {
  const w = readingWorld('- [ ] uno\n')
  await editorMessage(w.deps, post(w, '- [ ] uno!\n'))
  w.files.touch(PATH, '- [ ] due\n')
  const before = w.files.writes.length
  const [a, b] = await Promise.all([saveDraft(w.deps, true), saveDraft(w.deps, true)])
  expect([a, b]).toEqual([true, true])
  expect(w.files.writes.length - before).toBe(1)
})

// After the write, the steps that follow (draft, Reading, git and tree) do not change the outcome.
test('saveDraft: if the draft fails to update after the write → true, and Reading and git still follow', async () => {
  const w = readingWorld('- [ ] uno\n')
  const f = flakyDraft(w)
  const wrote: string[] = []
  const deps: ReadingDeps = { ...f.deps, wrote: async rel => { wrote.push(rel) } }
  await editorMessage(deps, post(w, '- [ ] uno!\n'))
  f.failOnce()
  expect(await saveDraft(deps)).toBe(true)
  expect(w.files.text.get(PATH)).toBe('- [ ] uno!\n')
  expect(w.reading.value.text).toBe('- [ ] uno!\n')
  expect(wrote).toEqual([REL])
  // The file is saved but the draft does not know it: the user sees a notice.
  expect(f.toasts).toEqual(['Salvato', 'Salvato, ma la scheda non si è aggiornata: riapri il file'])
})

test('saveDraft: if Reading or git fail after the write → true and a warning, not a false Saved', async () => {
  const w = readingWorld('- [ ] uno\n')
  const toasts: string[] = []
  const deps: ReadingDeps = { ...w.deps, toast: t => { toasts.push(t) }, wrote: async () => { throw new Error('git') } }
  await editorMessage(deps, post(w, '- [ ] uno!\n'))
  expect(await saveDraft(deps)).toBe(true)
  expect(w.draft.value).toMatchObject({ base: '- [ ] uno!\n', conflict: null })
  expect(toasts).toEqual(['Salvato', 'Salvato, ma la scheda non si è aggiornata: riapri il file'])
})

// An English vault: the toasts and the errors the flows write into the draft are English.
test('saveDraft, openReading and the editor in English: the toasts and the draft errors', async () => {
  const w = readingWorld('- [ ] uno\n')
  const toasts: string[] = []
  const deps: ReadingDeps = { ...w.deps, sources: memSources({ 'Future work': REL }, 'en'), toast: t => { toasts.push(t) }, wrote: async () => { throw new Error('git') } }
  await editorMessage(deps, post(w, '- [ ] uno!\n'))
  expect(await saveDraft(deps)).toBe(true)
  await editorMessage(deps, { ...post(w, '- [ ] uno!\n'), paste: true })
  await editorFault(deps)
  expect(await openReading(deps, 'missing.md', [])).toBe(false)
  expect(toasts).toEqual([
    'Saved',
    'Saved, but the tab did not update: reopen the file',
    'Paste is not available here: use ↗ to open the file in the app',
    'The editor stopped: the draft stays, reopen it from Edit',
    'File not found: missing.md',
  ])
  // A file that is protected: the draft says so, in English.
  const guarded = readingWorld('- [ ] uno\n')
  const protectedDeps: ReadingDeps = { ...guarded.deps, sources: memSources({ 'Durable memory': REL }, 'en') }
  await editorMessage(protectedDeps, post(guarded, '- [ ] uno!\n'))
  expect(await saveDraft(protectedDeps)).toBe(false)
  expect(guarded.draft.value).toMatchObject({ error: 'Protected file: it cannot be saved from the cockpit' })
})

test('pendingAct: Save with a draft that fails to update after the write still opens the pending file', async () => {
  const OTHER = 'altro.md'
  const w = readingWorld('- [ ] uno\n')
  w.files.touch(`${MEM_ROOT}/${OTHER}`, 'altro testo\n')
  w.reading.value = { ...EMPTY_READING, path: OTHER, text: 'altro testo\n', mtimeMs: 2000, size: 12 }
  w.draft.value = { ...(w.draft.value as Draft), text: '- [ ] uno!\n', pendingOpen: OTHER }
  const f = flakyDraft(w)
  f.failOnce()
  await pendingAct(f.deps, 'save')
  expect(w.files.text.get(PATH)).toBe('- [ ] uno!\n')
  expect(w.draft.value).toMatchObject({ path: OTHER, text: 'altro testo\n', pendingOpen: null })
  expect(w.reading.value).toMatchObject({ path: OTHER, mode: 'edit' })
})

test('saveDraft: when the atom write with the typed text is rejected → a visible notice, the draft stays and the next Save writes', async () => {
  const w = readingWorld('- [ ] uno\n')
  const f = flakyDraft(w)
  // cmd+s: the typed text (not yet in the atom) goes into the atom, and the write is rejected.
  f.failOnce()
  await editorMessage(f.deps, post(w, '- [ ] uno!\n', { save: true }))
  expect(w.files.text.get(PATH)).toBe('- [ ] uno\n')
  expect(f.toasts).toEqual(['Non riesco a salvare: la bozza resta, riprova'])
  expect(await saveDraft(f.deps)).toBe(true)
  expect(w.files.text.get(PATH)).toBe('- [ ] uno!\n')
  expect(f.toasts).toEqual(['Non riesco a salvare: la bozza resta, riprova', 'Salvato'])
})

// The typed text lives in the module until it reaches the atom; whoever closes the editor hands it over first.
test('editorFault: typed text that is not yet in the atom goes into the draft before Reading goes back to Text', async () => {
  const w = readingWorld('- [ ] uno\n')
  await editorMessage(w.deps, post(w, '- [ ] uno!\n'))
  // The second message does not change the dot: it stays in the module, with the DRAFT_MS timer still pending.
  await editorMessage(w.deps, post(w, '- [ ] uno!!\n'))
  expect(w.draft.value).toMatchObject({ text: '- [ ] uno!\n' })
  await editorFault(w.deps)
  expect(w.draft.value).toMatchObject({ text: '- [ ] uno!!\n', base: '- [ ] uno\n' })
  expect(w.reading.value.mode).toBe('text')
})

// The test engine does not raise `ui.close` (its `$.ui` has no `close`): the register.tsx handler, with the pane closed,
// calls `syncDraft` with the real ports, and that is the part that matters.
test('syncDraft (ui.close): typed text not yet in the atom, with no timer fired, goes into the draft', async () => {
  const w = readingWorld('- [ ] uno\n')
  await editorMessage(w.deps, post(w, '- [ ] uno!\n'))
  await editorMessage(w.deps, post(w, '- [ ] uno!!\n'))
  expect(w.draft.value).toMatchObject({ text: '- [ ] uno!\n' })
  expect(await syncDraft(w.deps)).toMatchObject({ text: '- [ ] uno!!\n' })
  expect(w.draft.value).toMatchObject({ text: '- [ ] uno!!\n', base: '- [ ] uno\n' })
})
