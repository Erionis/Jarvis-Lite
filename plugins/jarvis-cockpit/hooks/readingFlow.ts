import type { Activity, DiffView, Draft, Reading, Sources, Tab, Tree } from '../types'
import { classify, isEditable, type Classified } from './classify'
import type { EditorPost } from './editor'
import { runGit } from './filesFlow'
import { basename } from './format'
import { diffSource, parseLogHead, toDiffView } from './git'
import { strings, type Strings } from './i18n'
import type { ConflictAct, PendingAct } from './readingView'
import { lineDiff } from './linediff'
import { abs, changes, type Cell, type ClockPort, type FsPort, type RunPort, type SourcesPort } from './ports'
import { EMPTY_READING, eolOf, isDirty, pressedRel } from './reader'
import { EN } from './strings.en'
import { loadText, safeWrite } from './textfile'
import { isTextFile, joinRel, under } from './tree'

// The Reading tab: the open file, the diff, the draft and the editor, and the files that follow Jarvis's writes.
// The ports are given by register.tsx.
export type ReadingDeps = {
  fs: FsPort
  run: RunPort
  clock: ClockPort
  sources: SourcesPort
  reading: Cell<Reading>
  draft: Cell<Draft | null>
  tree: Cell<Tree>
  // The chosen tab and register.tsx's tab switch (it saves the choice and loads the tab).
  tab: () => Promise<Tab>
  setTab: (tab: Tab) => Promise<void>
  toast: (text: string) => void
  // The mascot shakes: the draft ends up in conflict.
  fault: () => Promise<void>
  // After a save: git, tree, sizes and, for the Future work file, the To Do tab.
  wrote: (rel: string) => Promise<void>
  // A vault binary in the app's Files pane.
  openInApp: (rel: string) => Promise<void>
}

// The flow cannot see `$` (so not `catalog($)`): it resolves the catalog itself, English when the sources cannot be read.
async function catalogOf(d: ReadingDeps): Promise<Strings> {
  try { return strings((await d.sources()).lang) } catch { return EN }
}

// --- open file ---

// Opens a file in Reading with the given history; false if the file is not there (notice already given). The
// same file keeps the diff it had, which stays on screen until the new one arrives.
export async function openReading(d: ReadingDeps, rel: string, back: string[]): Promise<boolean> {
  try {
    await syncDraft(d)
    const s = await d.sources()
    const t = strings(s.lang)
    if (!(await d.fs.exists(abs(s, rel)))) {
      d.toast(t.toasts.fileNotFound(rel))
      return false
    }
    const loaded = await loadText(d.fs, abs(s, rel))
    // Gone between the check and the read: we stay where we were.
    if (loaded.error !== null) {
      d.toast(t.toasts.fileNotFound(rel))
      return false
    }
    await d.reading.set(x => ({ ...EMPTY_READING, ...loaded, path: rel, back, diff: x.path === rel ? x.diff : null }))
    await d.tree.set(tr => ({ ...tr, selected: rel, cursor: rel }))
    return true
  } catch {
    return false
  }
}

// Closes the open file, if it is still `rel`, and goes from the Reading tab back to the tree. `gone`: says the file is no longer in the vault.
export async function closeReading(d: ReadingDeps, rel: string, gone = false): Promise<void> {
  try {
    if (gone) d.toast((await catalogOf(d)).toasts.goneFromVault)
    const r = await d.reading.set(x => (x.path === rel ? EMPTY_READING : x))
    if (r.path === null && (await d.tab()) === 'reading') await d.setTab('files')
  } catch {}
}

async function reloadReading(d: ReadingDeps, rel: string, at: number): Promise<void> {
  try {
    const s = await d.sources()
    const loaded = await loadText(d.fs, abs(s, rel))
    if (loaded.error !== null) return await closeReading(d, rel, true)
    const r = await d.reading.set(x => (x.path === rel ? { ...x, ...loaded, updatedAt: at } : x))
    if (r.path === rel && r.mode === 'diff') await showDiff(d, rel)
  } catch {}
}

export async function goBack(d: ReadingDeps): Promise<void> {
  try {
    const r = await d.reading.get()
    const prev = r.back[r.back.length - 1]
    if (prev === undefined || !(await openReading(d, prev, r.back.slice(0, -1)))) await d.setTab('files')
  } catch {}
}

// An internal link to a text file opens in Reading (← goes back), an image or another vault binary in the Files
// pane.
export async function pressLink(d: ReadingDeps, href: string): Promise<void> {
  try {
    const s = await d.sources()
    const rel = pressedRel(href, s.root)
    if (rel === null) return
    if (!isTextFile(rel)) {
      if (await d.fs.exists(abs(s, rel))) await d.openInApp(rel)
      else d.toast(strings(s.lang).toasts.fileNotFound(rel))
      return
    }
    const r = await d.reading.get()
    await openReading(d, rel, r.path === null ? [] : [...r.back, r.path])
  } catch {}
}

// --- diff ---

// Last change of the file: the uncommitted one if there is one, otherwise its last commit. Never throws.
function loadDiff(d: ReadingDeps, rel: string): Promise<DiffView> {
  return readDiff(d, rel).catch((): DiffView => ({ kind: 'error' }))
}

async function readDiff(d: ReadingDeps, rel: string): Promise<DiffView> {
  const s = await d.sources()
  const st = await runGit(d.run, s.root, ['status', '--porcelain=v1', '-z', '--', rel])
  if (st === null) return { kind: 'error' }
  const source = diffSource(st.stdout)
  if (source === 'untracked') return toDiffView(source, '', null)
  if (source === 'uncommitted') {
    const diff = await runGit(d.run, s.root, ['diff', '--no-color', 'HEAD', '--', rel], 10_000)
    return toDiffView(source, diff?.stdout ?? null, null)
  }
  const log = await runGit(d.run, s.root, ['log', '-1', '--format=%H%x00%ct%x00%s', '--', rel])
  const head = log === null ? null : parseLogHead(log.stdout)
  if (head === null) return toDiffView(source, log === null ? null : '', null)
  const diff = await runGit(d.run, s.root, ['show', '--no-color', '--format=', head.hash, '--', rel], 10_000)
  return toDiffView(source, diff?.stdout ?? null, head)
}

// Reads the file's diff again and writes it only if it changed: every write redraws the pane.
async function showDiff(d: ReadingDeps, rel: string): Promise<void> {
  const diff = await loadDiff(d, rel)
  const cur = await d.reading.get()
  if (cur.path === rel && JSON.stringify(cur.diff) !== JSON.stringify(diff)) await d.reading.set(x => (x.path === rel ? { ...x, diff } : x))
}

// Text or Diff in the Reading tab. The diff is read again every time it is chosen; meanwhile the previous one of
// the same file stays, and the loading text appears only the first time.
export async function setReaderMode(d: ReadingDeps, mode: 'text' | 'diff'): Promise<void> {
  try {
    const r = await d.reading.get()
    const path = r.path
    if (!path) return
    if (mode === 'text') {
      await d.reading.set(x => ({ ...x, mode: 'text' as const }))
      return
    }
    await d.reading.set(x => (x.path === path ? { ...x, mode: 'diff' as const } : x))
    await showDiff(d, path)
  } catch {}
}

// --- draft and editor ---

let draftGen = 0
// A save in progress: the second click waits for the same outcome. `savingForce`: it is an overwrite.
let saving: Promise<boolean> | null = null
let savingForce = false
// The editor's last message, not yet written to the draft atom: the atom is written at once when the unsaved
// dot changes, otherwise DRAFT_MS after the last message. null: the atom is in sync.
type Typed = { path: string; gen: number; text: string; row: number; col: number }
let typed: Typed | null = null
let typedSeq = 0
export const DRAFT_MS = 500

// The draft as the user sees it: the atom's draft with the text and cursor of the editor's last message.
export function draftView(d: Draft | null): Draft | null {
  const t = typed
  return d === null || t === null || t.gen !== d.gen || t.path !== d.path ? d : { ...d, text: t.text, row: t.row, col: t.col }
}

// The atom write in progress. Whoever arrives while another has not landed yet (a save while the DRAFT_MS
// timer fires) waits for it and then reads again: `typed` is already cleared, and without the wait it would read
// the old draft, save it and report a successful save.
let syncing: Promise<Draft | null> | null = null

// Writes the editor's last message to the atom and returns the draft. Whoever reads the draft's text (save,
// conflict, Jarvis's writes, file change, pane closed, trash and move) goes through here first.
export function syncDraft(d: ReadingDeps): Promise<Draft | null> {
  const next = (): Promise<Draft | null> => syncOnce(d)
  const run: Promise<Draft | null> = (syncing === null ? syncOnce(d) : syncing.then(next, next)).finally(() => { if (syncing === run) syncing = null })
  syncing = run
  return run
}

async function syncOnce(d: ReadingDeps): Promise<Draft | null> {
  const t = typed
  typed = null
  try {
    const cur = await d.draft.get()
    if (t === null || cur === null || cur.gen !== t.gen || cur.path !== t.path) return cur
    if (cur.text === t.text && cur.row === t.row && cur.col === t.col && !cur.confirmDiscard) return cur
    return await d.draft.set(x => (x === null || x.gen !== t.gen || x.path !== t.path ? x : { ...x, text: t.text, row: t.row, col: t.col, confirmDiscard: false }))
  } catch (e) {
    // Reading or writing the atom failed: the typed text goes back to pending (if a newer text has not arrived in
    // the meantime), otherwise the next save would write the old draft and report a successful save.
    if (t !== null && typed === null) typed = t
    throw e
  }
}

// A new draft with the text on disk; the new generation makes the editor restart from here. `floor`: the
// generation of the draft that exists (after a hot reload the counter starts from zero). The editor works with
// `\n`: a CRLF file is remembered in `eol` and is rewritten as it was. Mixed line endings: null, it is not
// edited in the pane.
export function freshDraft(path: string, raw: string, mtimeMs: number, size: number | null, floor = 0): Draft | null {
  const eol = eolOf(raw)
  if (eol === null) return null
  const text = eol === '\r\n' ? raw.replace(/\r\n/g, '\n') : raw
  draftGen = Math.max(draftGen, floor) + 1
  return { path, text, base: text, eol, baseMtimeMs: mtimeMs, baseSize: size, row: 0, col: 0, gen: draftGen, confirmDiscard: false, error: null, conflict: null, conflictDiff: null, conflictDiffCut: false, pendingOpen: null }
}

// The draft's text as it goes to disk, with the line ending of the file.
const onDisk = (d: Draft): string => (d.eol === '\r\n' ? d.text.replace(/\n/g, '\r\n') : d.text)

// Edit: opens a draft of the file in Reading or resumes the existing one. One draft at a time: with an unsaved
// draft on another file, that one is saved or discarded first.
export async function startEdit(d: ReadingDeps): Promise<void> {
  try {
    const cur = await syncDraft(d)
    const r = await d.reading.get()
    if (!r.path || r.text === null) return
    const path = r.path
    if (cur !== null && cur.path !== path && isDirty(cur)) {
      await d.draft.set(x => (x === null ? x : { ...x, pendingOpen: path }))
      return
    }
    if (cur === null || cur.path !== path) {
      const fresh = freshDraft(path, r.text, r.mtimeMs, r.size ?? null, cur?.gen)
      // Mixed line endings: edit stays blocked, editBlock says why.
      if (fresh === null) return
      await d.draft.set(() => fresh)
    } else if (cur.pendingOpen !== null) await d.draft.set(x => (x === null ? x : { ...x, pendingOpen: null }))
    await d.reading.set(x => (x.path === path ? { ...x, mode: 'edit' as const } : x))
  } catch {}
}

// An editor message: text and cursor stay in the module; cmd+s saves, cmd+v shows a notice. A message for a text
// already replaced (old gen) does not count.
export async function editorMessage(d: ReadingDeps, m: EditorPost): Promise<void> {
  try {
    // A message without the expected shape (text, generation, cursor) does not count.
    if (typeof m.text !== 'string' || typeof m.gen !== 'number' || typeof m.row !== 'number' || typeof m.col !== 'number') return
    const cur = await d.draft.get()
    if (cur === null || m.gen !== cur.gen) return
    if (m.paste === true) {
      d.toast((await catalogOf(d)).toasts.pasteUnavailable)
      return
    }
    const wasDirty = isDirty(draftView(cur))
    typed = { path: cur.path, gen: m.gen, text: m.text, row: m.row, col: m.col }
    const seq = ++typedSeq
    if (m.save === true) {
      await saveDraft(d)
      return
    }
    // The unsaved dot and the second click on cancel change the drawing: the atom is written at once.
    if (wasDirty !== (m.text !== cur.base) || cur.confirmDiscard) {
      await syncDraft(d)
      return
    }
    d.clock.after(DRAFT_MS, () => {
      if (seq === typedSeq) void syncDraft(d).catch(() => {})
    })
  } catch {}
}

// The editor stopped by the app: Reading goes back to text mode, the draft keeps the last text that arrived.
export async function editorFault(d: ReadingDeps): Promise<void> {
  try {
    d.toast((await catalogOf(d)).toasts.editorStopped)
    await syncDraft(d)
    await d.reading.set(x => (x.mode === 'edit' ? { ...x, mode: 'text' as const } : x))
  } catch {}
}

// Saves the draft only if the file on disk is still the one from when it was opened; then Reading, the tree, git
// and sizes follow. No "written by Jarvis" dot: the user wrote the file, not Jarvis.
// With `force` (overwrite) it writes even if the file changed. Returns true if it wrote.
export function saveDraft(d: ReadingDeps, force = false): Promise<boolean> {
  // A save in progress (double cmd+s or double click): the second click waits for the same outcome. This does
  // not hold for an overwrite pressed while an unforced save is still running (the conflict card appears while
  // that save waits for the mascot): that save ends with false, and the overwrite writes after it, not in its
  // place.
  const prev = saving
  if (prev !== null && (!force || savingForce)) return prev
  // writeDraft never rejects: the queue restarts anyway from the outcome of whoever was there.
  const run: Promise<boolean> = (prev === null ? writeDraft(d, force) : prev.then(() => writeDraft(d, force), () => writeDraft(d, force)))
    .finally(() => { if (saving === run) { saving = null; savingForce = false } })
  saving = run
  savingForce = force
  return run
}

// A notice that cannot change the outcome of a save.
function say(d: ReadingDeps, text: string): void {
  try { d.toast(text) } catch {}
}

// Where a path really lands, every symbolic link followed, as followLink resolves it. A file that is not there
// lands in its folder's real path; undefined when it leads nowhere (a broken link) or cannot be resolved.
async function landing(fs: FsPort, p: string): Promise<string | undefined> {
  const own = await fs.stat(p, { resolve: true }).catch(() => null)
  if (own !== null) return own.realPath
  const cut = p.lastIndexOf('/')
  if (cut <= 0) return undefined
  const dir = await fs.stat(p.slice(0, cut), { resolve: true }).catch(() => null)
  return dir?.realPath === undefined ? undefined : `${dir.realPath.replace(/\/$/, '')}${p.slice(cut)}`
}

// The class of the file a save writes into: a symbolic link is written through, so what counts is where it lands,
// under the vault's own real path. Null: outside the vault, or nowhere.
async function realClass(fs: FsPort, s: Sources, p: string, t: Strings): Promise<Classified | null> {
  const [real, rootReal] = await Promise.all([landing(fs, p), fs.stat(s.root, { resolve: true }).then(st => st.realPath, () => undefined)])
  const root = rootReal ?? s.root
  if (real === undefined || !real.startsWith(`${root}/`)) return null
  return classify(abs(s, real.slice(root.length + 1)), s, t)
}

async function writeDraft(d: ReadingDeps, force: boolean): Promise<boolean> {
  try {
    const cur = await syncDraft(d)
    if (cur === null) return false
    const s = await d.sources()
    const p = abs(s, cur.path)
    // The cockpit does not write protected files (except the Future work file) or files outside the vault, not even
    // with overwrite: by the path, and by where a symbolic link lands.
    const t = strings(s.lang)
    const lexical = classify(p, s, t)
    const cls = isEditable(lexical, t) ? await realClass(d.fs, s, p, t) : lexical
    if (!isEditable(cls, t)) {
      await d.draft.set(x => (x?.path === cur.path ? { ...x, error: cls === null ? t.reading.outsideError : t.reading.protectedError } : x))
      return false
    }
    // The file changed (date or bytes) since it was opened or last saved: the conflict card.
    const w = !force && cur.conflict !== null ? { kind: 'changed' as const } : await safeWrite(d.fs, p, onDisk(cur), { text: cur.base, mtimeMs: cur.baseMtimeMs, size: cur.baseSize ?? null }, force)
    if (w.kind === 'changed') {
      await d.draft.set(x => (x?.path === cur.path ? { ...x, conflict: x.conflict ?? 'disk', pendingOpen: null } : x))
      // The conflict card is already on screen: a mascot that cannot shake is not a failed save.
      try { await d.fault() } catch {}
      return false
    }
    if (w.kind !== 'written') {
      const error = w.kind === 'failed' ? t.reading.cannotWrite(w.error) : t.reading.notUtf8
      await d.draft.set(x => (x?.path === cur.path ? { ...x, error } : x))
      return false
    }
    // The file is written: from here the outcome is true whatever goes wrong in the steps that follow (draft,
    // Reading, git and tree), each on its own. Otherwise pendingAct would go back to the draft after a successful save.
    let stale = false
    try {
      await d.draft.set(x => (x?.path === cur.path ? { ...x, base: cur.text, baseMtimeMs: w.mtimeMs ?? x.baseMtimeMs, baseSize: w.size, error: null, confirmDiscard: false, conflict: null, conflictDiff: null, conflictDiffCut: false } : x))
    } catch { stale = true }
    say(d, t.toasts.saved)
    try {
      const loaded = await loadText(d.fs, p)
      await d.reading.set(x => (x.path === cur.path ? { ...x, ...loaded } : x))
    } catch { stale = true }
    try { await d.wrote(cur.path) } catch { stale = true }
    if (stale) say(d, t.toasts.savedStale)
    return true
  } catch {
    // Something broke before the write (the draft in the atom, the sources): the draft stays, and it shows.
    say(d, (await catalogOf(d)).toasts.cannotSave)
    return false
  }
}

// The choices of the conflict card.
export async function conflictAct(d: ReadingDeps, a: ConflictAct): Promise<void> {
  try {
    const cur = await syncDraft(d)
    if (cur === null) return
    if (a === 'overwrite') {
      await saveDraft(d, true)
      return
    }
    const s = await d.sources()
    const t = strings(s.lang)
    const p = abs(s, cur.path)
    if (a === 'diff') {
      if (cur.conflictDiff !== null) {
        await d.draft.set(x => (x?.path === cur.path ? { ...x, conflictDiff: null, conflictDiffCut: false } : x))
        return
      }
      const disk = await d.fs.read(p).catch(() => '')
      // The draft of a CRLF file uses `\n`: the disk is compared the same way.
      let shown = lineDiff(cur.eol === '\r\n' ? disk.replace(/\r\n/g, '\n') : disk, cur.text, `${basename(cur.path)} ${t.reading.diff.onDisk}`, `${basename(cur.path)} ${t.reading.diff.draft}`)
      // The diff and the editor (with the draft's text) are in the same drawing: the diff is cut.
      const budget = Math.max(2_000, 90_000 - JSON.stringify(cur.text).length)
      const isCut = shown.length > budget
      if (isCut) {
        // It is cut at the end of a line and with no note in the source: the diff stays a diff, the card draws the note.
        const cut = shown.lastIndexOf('\n', budget)
        shown = shown.slice(0, cut === -1 ? budget : cut)
      }
      await d.draft.set(x => (x?.path === cur.path ? { ...x, conflictDiff: shown, conflictDiffCut: isCut } : x))
      return
    }
    // Reload: the draft restarts from the file on disk; Reading reads it again. Mixed line endings: no draft, back to text mode.
    const loaded = await loadText(d.fs, p)
    if (loaded.text === null) {
      d.toast(t.toasts.cannotReread(basename(cur.path)))
      return
    }
    const fresh = freshDraft(cur.path, loaded.text, loaded.mtimeMs, loaded.size, cur.gen)
    await d.draft.set(() => fresh)
    await d.reading.set(x => (x.path === cur.path ? { ...x, ...loaded, ...(fresh === null ? { mode: 'text' as const } : {}) } : x))
  } catch {}
}

// The choices of the unsaved-draft card, from the file on which edit was requested.
export async function pendingAct(d: ReadingDeps, a: PendingAct): Promise<void> {
  try {
    const cur = await syncDraft(d)
    if (cur === null) return
    // Save and discard only count with a choice pending: a late or double click does nothing.
    if (a !== 'back' && cur.pendingOpen === null) return
    if (a === 'back') {
      const r = await d.reading.get()
      await d.draft.set(x => (x === null ? x : { ...x, pendingOpen: null }))
      const back = r.path === null ? r.back : [...r.back, r.path]
      const s = await d.sources()
      if (cur.conflict !== null && !(await d.fs.exists(abs(s, cur.path)))) {
        // The file is no longer there (Jarvis deleted it): the draft opens anyway, with the conflict card. The text
        // is the last one read; nothing is written until the user chooses.
        await d.reading.set(() => ({ ...EMPTY_READING, path: cur.path, back, mode: 'edit' as const, text: cur.base }))
      } else if (await openReading(d, cur.path, back)) {
        await d.reading.set(x => (x.path === cur.path ? { ...x, mode: 'edit' as const } : x))
      }
      return
    }
    if (a === 'save' && !(await saveDraft(d))) {
      // Conflict or failed write: back to the draft to see why.
      await pendingAct(d, 'back')
      return
    }
    await d.draft.set(() => null)
    await startEdit(d)
  } catch {}
}

// Cancel: a dirty draft asks for a second click; then the draft is discarded and we go back to text mode.
export async function cancelDraft(d: ReadingDeps): Promise<void> {
  try {
    const cur = await syncDraft(d)
    if (cur !== null && isDirty(cur) && !cur.confirmDiscard) {
      await d.draft.set(x => (x === null ? x : { ...x, confirmDiscard: true }))
      return
    }
    await d.draft.set(() => null)
    await d.reading.set(x => ({ ...x, mode: 'text' as const }))
  } catch {}
}

// --- files that follow the writes ---

// A move to an existing folder puts the file inside it, with its name.
async function moveTarget(d: ReadingDeps, to: string, from: string): Promise<string> {
  try {
    const s = await d.sources()
    return (await d.fs.stat(abs(s, to))).kind === 'dir' ? joinRel(to, basename(from)) : to
  } catch {
    return to
  }
}

// The file open in Reading follows Jarvis's writes: moved, it is reopened at the destination (history included),
// deleted, it closes with a notice, written, it reloads.
async function followReading(d: ReadingDeps, writes: readonly Activity[]): Promise<void> {
  try {
    const r = await d.reading.get()
    const cur = r.path
    if (!cur) return
    const moved = writes.find(a => a.verb === 'move' && a.from === cur)
    if (moved) {
      const to = await moveTarget(d, moved.path, cur)
      // openReading has already given a notice if the destination cannot be read.
      if (!(await openReading(d, to, r.back))) await closeReading(d, cur)
      return
    }
    if (writes.some(a => a.verb === 'delete' && (a.path === cur || under(a.path, cur)))) return await closeReading(d, cur, true)
    const hit = writes.find(a => a.path === cur)
    if (hit) await reloadReading(d, cur, hit.at)
  } catch {}
}

// Jarvis wrote the file of a clean draft. Moved or deleted, the draft is dropped (Reading follows the file).
// Written, if Reading is still there in edit mode it restarts from the new text on disk (new generation for the
// editor); otherwise it is dropped. If the user has written in the meantime, the conflict applies.
async function refreshCleanDraft(d: ReadingDeps, cur: Draft, writes: readonly Activity[], followed: Promise<void>): Promise<void> {
  const gone = writes.some(a => (a.verb === 'move' && a.from === cur.path) || (a.verb === 'delete' && (a.path === cur.path || under(a.path, cur.path))))
  await followed
  let fresh: Draft | null = null
  try {
    const r = await d.reading.get()
    if (!gone && r.path === cur.path && r.mode === 'edit') {
      const s = await d.sources()
      const loaded = await loadText(d.fs, abs(s, cur.path))
      if (loaded.text !== null) fresh = freshDraft(cur.path, loaded.text, loaded.mtimeMs, loaded.size, cur.gen)
    }
  } catch {}
  const x = await syncDraft(d)
  if (x === null || x.path !== cur.path) return
  const after = await d.draft.set(y => (y === null || y.path !== cur.path ? y : isDirty(y) ? { ...y, conflict: 'jarvis' as const } : fresh))
  // Mixed line endings (the draft does not restart): Reading stays in edit mode with no draft, and no mode in the
  // selector is highlighted. As in conflictAct, it goes back to text mode.
  if (after === null) await d.reading.set(r => (r.path === cur.path && r.mode === 'edit' ? { ...r, mode: 'text' as const } : r))
}

// Jarvis's writes: Reading follows its file. A dirty draft of a written file stays and saving goes through the
// conflict (moved: the draft goes to the destination, overwrite writes there); a clean draft has nothing to
// defend and restarts from disk.
export async function followWrites(d: ReadingDeps, writes: readonly Activity[]): Promise<void> {
  try {
    const paths = new Set(writes.flatMap(a => (a.from !== undefined ? [a.path, a.from] : [a.path])))
    const followed = followReading(d, writes)
    const cur = await syncDraft(d)
    if (cur === null || !paths.has(cur.path)) return
    if (!isDirty(cur)) return await refreshCleanDraft(d, cur, writes, followed)
    const moved = writes.find(a => a.verb === 'move' && a.from === cur.path)
    const to = moved !== undefined ? await moveTarget(d, moved.path, cur.path) : null
    await d.draft.set(x => (x !== null && paths.has(x.path) ? { ...x, path: to !== null && x.path === cur.path ? to : x.path, conflict: 'jarvis' as const } : x))
    await d.fault()
  } catch {}
}

// After a cockpit write to `rel` (the Future work file): Reading reads again; a clean draft of the file restarts from the
// new text if Reading is in edit mode, otherwise it is dropped.
export async function followOwnWrite(d: ReadingDeps, rel: string): Promise<void> {
  try {
    const s = await d.sources()
    const loaded = await loadText(d.fs, abs(s, rel))
    const cur = await syncDraft(d)
    const r = await d.reading.get()
    if (r.path === rel && changes(r, loaded)) await d.reading.set(x => (x.path === rel ? { ...x, ...loaded } : x))
    if (cur !== null && cur.path === rel && !isDirty(cur)) {
      const redo = r.path === rel && r.mode === 'edit' && loaded.text !== null ? freshDraft(rel, loaded.text, loaded.mtimeMs, loaded.size, cur.gen) : null
      const after = await d.draft.set(x => (x !== null && x.path === rel && !isDirty(x) ? redo : x))
      // Mixed line endings: no draft and no edit mode, as in conflictAct.
      if (after === null) await d.reading.set(x => (x.path === rel && x.mode === 'edit' ? { ...x, mode: 'text' as const } : x))
    }
  } catch {}
}
