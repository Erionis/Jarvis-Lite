import { atom, read, update } from 'claude-code'
import type { Elements, EngineInterface, Register, RenderElement } from 'claude-code'
import type { Draft, FileOp, Figure, GitView, MemoriesState, Motion, Numstat, Reading, SessionRecord, Sources, Tab, TodoState, Tree, TurnEnd } from '../types'
import { addTouched, addWritten, pushActivity, statusText } from './feed'
import { ancestors, emptyTree, isTextFile, parentOf, toggleExpanded } from './tree'
import { basename, dirname, errText, isoDay, oneLine } from './format'
import { parseStatus } from './git'
import { drawFiles } from './files'
import { drawReader } from './readingView'
import { EMPTY_READING, editBlock, isDirty, pressedRel } from './reader'
import type { EditorPost } from './editor'
import { memoryDir, parseCapabilities, userName } from './sources'
import { detectLang, strings, type Strings } from './i18n'
import { EN } from './strings.en'
import { classify, isEditable, resolve } from './classify'
import { toActivities, type ToolEvent } from './tracker'
import { drawElsewhere, drawFault, drawPane, migrateTab } from './pane'
import { drawReopen } from './hint'
import { drawRecap } from './recap'
import { activityLog, bindRun, dropRun, endRun, liveRuns, pruneRuns, reconcileRuns, sortWritten, startRun, turnFiles } from './recapModel'
import { IDLE, SLEEP_MS, TRANSIENT_MS, stepMascot, type MascotEvent } from './mascot'
import { motionMs, walkEnd } from './stage'
import { TERMINAL } from './terminalFigure'
import { FIGURE_DIR, FIGURE_FILES, MAX_FIGURE_CHARS, buildFigure, fileOf, type FigureFile } from './customFigure'
import { WALK_MIN_COLUMNS } from './chrome'
import { NO_TALK, dismiss, expire, greet, holdTyping, isTyped, noteWrites, onPrompt, onTurnEnd, replay, setup, talkMs, visible, type Bubble, type Talk } from './bubble'
import { MAX_READ_BYTES, NO_SESSIONS, handoffMeta, loadSnapshot, type SessionsInput } from './snapshot'
import { KEEP_SESSIONS, SESSION_KEY, addSubagent, asRecord, closeRecord, diaryDaysOf, endRecordTurn, noteRecordWrites, onPromptRecord, pastSessions, promptLine, recordWritten, staleKeys } from './sessionModel'
import { WRITES } from './theme'
import { COMMAND, PANE, TITLE } from './state'
import { clickthrough } from './clickthrough'
import { copyName, moveTarget as typedTarget } from './fileops'
import { EMPTY_TODO, todoLabel, toggleItem } from './todoModel'
import { abs, cellOf, changes, same, shaped, type Cell, type ClockPort, type FsPort, type RunPort } from './ports'
import { flight, oneAtATime } from './flight'
import { loadText } from './textfile'
import { addTodo, cancelAdd, checkTodo, confirmTodo, loadTodo, openAdd, removeTodo, todoEntry, typeTodo, writeTodo, type TodoDeps } from './todoFlow'
import { drawTodo } from './todo'
import { dropIndex, loadDir as loadDirFlow, markStale, measureDirs as measureDirsFlow, moveText, queryText, refreshGit as refreshGitFlow, resetMove, resetQuery, runGit as runGitFlow, search as searchFlow, typeMove, typeQuery, type FilesDeps } from './filesFlow'
import { EMPTY_MEMORIES, buildMemories, isGroup, memoryNames, parseGitDates } from './memories'
import { drawMemories } from './memoriesView'
import { EMPTY_DIARY, defaultDay, diaryNotes } from './diary'
import { drawDiary } from './diaryView'
import { resetSettle, settleWrites, type SettleDeps } from './settle'
import { cancelDraft, closeReading as closeReadingFlow, conflictAct, draftView, editorFault, editorMessage, followOwnWrite, followWrites, goBack, openReading as openReadingFlow, pendingAct, pressLink, saveDraft, setReaderMode, startEdit as startEditFlow, syncDraft, type ReadingDeps } from './readingFlow'

// The only owner of the atoms: the `plugin validate` scan only sees atoms defined in the file that reads or writes
// them, not imported ones.
const feedAtom = atom({ plugin: 'jarvis-cockpit', key: 'feed' } as const, [])
const snapshotAtom = atom({ plugin: 'jarvis-cockpit', key: 'snapshot' } as const, null)
const turnAtom = atom({ plugin: 'jarvis-cockpit', key: 'turn' } as const, 0)
const touchedAtom = atom({ plugin: 'jarvis-cockpit', key: 'touched' } as const, [])
const agentRunsAtom = atom({ plugin: 'jarvis-cockpit', key: 'agentRuns' } as const, {})
const mascotAtom = atom({ plugin: 'jarvis-cockpit', key: 'mascot' } as const, IDLE)
const workingAtom = atom({ plugin: 'jarvis-cockpit', key: 'working' } as const, false)
const turnAtAtom = atom({ plugin: 'jarvis-cockpit', key: 'turnAt' } as const, null as number | null)
const endsAtom = atom({ plugin: 'jarvis-cockpit', key: 'ends' } as const, [])
const paneOpenAtom = atom({ plugin: 'jarvis-cockpit', key: 'paneOpen' } as const, false)
const tabAtom = atom({ plugin: 'jarvis-cockpit', key: 'tab' } as const, 'recap')
const openedAtom = atom({ plugin: 'jarvis-cockpit', key: 'opened' } as const, false)
const treeAtom = atom({ plugin: 'jarvis-cockpit', key: 'tree' } as const, { nodes: [], loaded: [], expanded: [], broken: [], cursor: '', selected: '', query: '', hits: [], showHidden: false, showSizes: false, error: null })
const gitAtom = atom({ plugin: 'jarvis-cockpit', key: 'git' } as const, null)
const writtenAtom = atom({ plugin: 'jarvis-cockpit', key: 'written' } as const, {})
const logOpenAtom = atom({ plugin: 'jarvis-cockpit', key: 'logOpen' } as const, false)
const sizesAtom = atom({ plugin: 'jarvis-cockpit', key: 'sizes' } as const, {})
const numstatAtom = atom({ plugin: 'jarvis-cockpit', key: 'numstat' } as const, null)
const draftAtom = atom({ plugin: 'jarvis-cockpit', key: 'draft' } as const, null)
const readingAtom = atom({ plugin: 'jarvis-cockpit', key: 'reading' } as const, { path: null, back: [], mode: 'text', text: null, mtimeMs: 0, size: null, isTooBig: false, error: null, updatedAt: null, diff: null })
const fileOpAtom = atom({ plugin: 'jarvis-cockpit', key: 'fileOp' } as const, null as FileOp | null)
const talkAtom = atom({ plugin: 'jarvis-cockpit', key: 'talk' } as const, NO_TALK)
const NO_MOTION: Motion = { until: 0, at: 0, isRunning: false }
const motionAtom = atom({ plugin: 'jarvis-cockpit', key: 'motion' } as const, NO_MOTION)
const todoAtom = atom({ plugin: 'jarvis-cockpit', key: 'todo' } as const, EMPTY_TODO)
const memoriesAtom = atom({ plugin: 'jarvis-cockpit', key: 'memories' } as const, EMPTY_MEMORIES)
const diaryAtom = atom({ plugin: 'jarvis-cockpit', key: 'diary' } as const, EMPTY_DIARY)
const promptsAtom = atom({ plugin: 'jarvis-cockpit', key: 'prompts' } as const, [])
const sessionAtom = atom({ plugin: 'jarvis-cockpit', key: 'session' } as const, null as SessionRecord | null)
const recapViewAtom = atom({ plugin: 'jarvis-cockpit', key: 'recapView' } as const, 'auto')
const figureAtom = atom({ plugin: 'jarvis-cockpit', key: 'figure' } as const, TERMINAL)
const figureNotesAtom = atom({ plugin: 'jarvis-cockpit', key: 'figureNotes' } as const, [] as string[])

// Recap, Diary, To Do, Files, Reading, Memories: Diary, To Do and Memories only if their sources are declared.
function tabsFor(roles: Readonly<Record<string, string>>): Tab[] {
  return [
    'recap',
    ...(roles['Daily history'] !== undefined ? ['diary' as const] : []),
    ...(roles['Future work'] !== undefined ? ['todo' as const] : []),
    'files', 'reading',
    ...(memoryDir(roles) !== null ? ['memories' as const] : []),
  ]
}
// `$.agent.list()` statuses in which a subagent is still working.
const LIVE: ReadonlySet<string> = new Set(['pending', 'running', 'waiting'])

let sources: Sources | null = null
// For the provisional key in agent.spawn: the subagents of one workflow share the tool_use_id.
let spawnSeq = 0
// Turn ends kept for the Activity log.
const MAX_ENDS = 50
// Successful Bash commands that earn a celebration at the end of the turn: a test suite or a commit.
const WIN = /(^|[\s;&|(])(git\s+commit|claude\s+plugin\s+test|(npm|pnpm|yarn|bun)\s+(run\s+)?test|bun\s+test|pytest|vitest|jest|go\s+test|cargo\s+test)\b/

// Context for the model, never drawn: so it stays out of the catalog.
// Same sentence as filetree: "this" or "it" in the chat points to the file selected in the panel.
const SELECTED = 'The user has this file selected in the file tree; "this" or "it" in the prompt likely refers to it: '

// Every notice of the cockpit goes through here: one line, whatever the text carries (an error text may hold newlines).
const toast = ($: EngineInterface, text: string): void => $.ui.toast(oneLine(text))

// The ports (ports.ts): closures over `$` for the modules that cannot see it. One for each atom, with the atom written
// by name: the `plugin validate` scan follows them.
const fsPort = ($: EngineInterface): FsPort => ({
  read: p => $.fs.read(p).then(String),
  readBytes: p => $.fs.read(p, { as: 'bytes' }).then(b => b.base64),
  stat: (p, opts) => $.fs.stat(p, opts),
  write: (p, text) => $.fs.write(p, text),
  list: p => $.fs.list(p),
  exists: p => $.fs.exists(p),
})
const clockPort = ($: EngineInterface): ClockPort => ({ now: () => $.clock.now(), after: (ms, fn) => { $.clock.after(ms, fn) } })
const runPort = ($: EngineInterface): RunPort => (argv, opts) => $.process.run(argv, opts)
// The tree with the current shape (the other object atoms go through `shaped` with their empty value).
const asTree = (t: Tree | null | undefined): Tree => shaped(emptyTree(), t)
const todoCell = ($: EngineInterface): Cell<TodoState> => cellOf(async () => shaped(EMPTY_TODO, await read($, todoAtom)), fn => update($, todoAtom, t => fn(shaped(EMPTY_TODO, t))))
const todoDeps = ($: EngineInterface): TodoDeps => ({ fs: fsPort($), clock: clockPort($), sources: () => getSources($), todo: todoCell($), wrote: rel => todoWrote($, rel) })
const treeCell = ($: EngineInterface): Cell<Tree> => cellOf(async () => asTree(await read($, treeAtom)), fn => update($, treeAtom, t => fn(asTree(t))))
const gitCell = ($: EngineInterface): Cell<GitView | null> => cellOf(async () => (await read($, gitAtom)) ?? null, fn => update($, gitAtom, fn))
const numstatCell = ($: EngineInterface): Cell<Numstat | null> => cellOf(async () => (await read($, numstatAtom)) ?? null, fn => update($, numstatAtom, fn))
const sizesCell = ($: EngineInterface): Cell<Record<string, number | null>> => cellOf(async () => (await read($, sizesAtom)) ?? {}, fn => update($, sizesAtom, fn))
// The ports that both the Files and Reading flows ask for: files, processes, clock and the vault's sources.
const basePorts = ($: EngineInterface) => ({ fs: fsPort($), run: runPort($), clock: clockPort($), sources: () => getSources($) })
const filesDeps = ($: EngineInterface): FilesDeps => ({
  ...basePorts($),
  tree: treeCell($), git: gitCell($), numstat: numstatCell($), sizes: sizesCell($),
  inView: async () => migrateTab(await read($, tabAtom)) === 'files',
})

const figureCell = ($: EngineInterface): Cell<Figure> => cellOf(async () => (await read($, figureAtom)) ?? TERMINAL, fn => update($, figureAtom, f => fn(f ?? TERMINAL)))
const readingCell = ($: EngineInterface): Cell<Reading> => cellOf(async () => shaped(EMPTY_READING, await read($, readingAtom)), fn => update($, readingAtom, r => fn(shaped(EMPTY_READING, r))))
const draftCell = ($: EngineInterface): Cell<Draft | null> => cellOf(async () => (await read($, draftAtom)) ?? null, fn => update($, draftAtom, fn))
// The memories atom with the shape of today (like `shaped`); groups expanded, and memories listed, under a group
// name from an older version are dropped.
const asMemories = (m: MemoriesState | null | undefined): MemoriesState => {
  const cur = shaped(EMPTY_MEMORIES, m)
  return { ...cur, expanded: cur.expanded.filter(isGroup), list: cur.list === null ? null : cur.list.filter(item => isGroup(item?.group)) }
}
const memoriesCell = ($: EngineInterface): Cell<MemoriesState> => cellOf(async () => asMemories(await read($, memoriesAtom)), fn => update($, memoriesAtom, m => fn(asMemories(m))))
const readingDeps = ($: EngineInterface): ReadingDeps => ({
  ...basePorts($),
  reading: readingCell($), draft: draftCell($), tree: treeCell($),
  tab: async () => migrateTab(await read($, tabAtom)) ?? 'recap',
  setTab: tab => setTab($, tab),
  toast: text => toast($, text),
  fault: () => mascotStep($, { kind: 'fault' }),
  wrote: async rel => afterWrite($, await getSources($), rel),
  openInApp: rel => openInFiles($, rel),
})
const settleDeps = ($: EngineInterface): SettleDeps => ({
  clock: clockPort($),
  loaded: async () => (await read($, treeAtom))?.loaded ?? [],
  loadDir: rel => loadDir($, rel),
  refreshGit: opts => refreshGit($, opts),
  measureDirs: () => measureDirs($),
  snapshot: () => refresh($),
  todoPath: async () => (await read($, todoAtom))?.path ?? null,
  checkTodo: () => checkTodo(todoDeps($)),
  memDir: async () => (await read($, memoriesAtom))?.dir ?? null,
  loadMemories: () => loadMemories($),
  diaryRoot: async () => {
    const [s, d] = await Promise.all([getSources($), read($, diaryAtom)])
    return (d?.notes ?? null) === null ? null : s.roles['Daily history'] ?? null
  },
  loadDiary: () => loadDiary($),
  loadFigure: () => loadFigure($),
})

async function getSources($: EngineInterface): Promise<Sources> {
  if (sources) return sources
  const root = await $.session.root()
  const path = `${root}/CLAUDE.md`
  const md = (await $.fs.exists(path)) ? String(await $.fs.read(path)) : ''
  const parsed = parseCapabilities(md, root)
  // The Identity source, if declared, can name the language (detectLang); a missing or unreadable one is just empty.
  const soulRel = parsed.roles['Identity']
  const soul = soulRel === undefined ? '' : await $.fs.read(`${root}/${soulRel}`).then(String, () => '')
  sources = { ...parsed, lang: detectLang(md, soul) }
  return sources
}

// The catalog of the cockpit's language, for what is drawn or registered outside a draw that already has the
// sources; English while they cannot be read.
async function catalog($: EngineInterface): Promise<Strings> {
  try { return strings((await getSources($)).lang) } catch { return EN }
}

// Switches tab; the choice is kept in later sessions too.
async function setTab($: EngineInterface, tab: Tab): Promise<void> {
  try {
    await update($, tabAtom, () => tab)
    await $.store.set('tab', tab).catch(() => {})
    if (tab === 'files') enterFiles($)
    if (tab === 'diary') void loadDiary($)
    if (tab === 'todo') void loadTodo(todoDeps($))
    if (tab === 'memories') void loadMemories($)
  } catch {}
}

// The reload button on the problem card: back to the Recap; Reading, the file operation and the bubble are reset. The
// draft stays: it may hold unsaved text.
async function recoverPane($: EngineInterface): Promise<void> {
  resetMove()
  await Promise.all([
    setTab($, 'recap'),
    update($, readingAtom, () => EMPTY_READING).catch(() => {}),
    update($, fileOpAtom, () => null).catch(() => {}),
    update($, talkAtom, () => NO_TALK).catch(() => {}),
  ])
}

// On entering the Files tab: git (with the list of ignored paths) and the sizes to measure.
function enterFiles($: EngineInterface): void {
  void refreshGit($, { ignored: true })
  void measureDirs($)
}

// The saved tab, if it still exists (Diary, To Do and Memories go away when their source is no longer
// declared); an id from an older version is migrated (migrateTab).
async function loadTab($: EngineInterface): Promise<void> {
  try {
    const [saved, s] = await Promise.all([$.store.get('tab').catch(() => undefined), getSources($)])
    const tab = migrateTab(saved)
    if (tab === null || !tabsFor(s.roles).includes(tab)) return
    await update($, tabAtom, () => tab)
    if (tab === 'files') enterFiles($)
    if (tab === 'diary') void loadDiary($)
    if (tab === 'todo') void loadTodo(todoDeps($))
    if (tab === 'memories') void loadMemories($)
  } catch {}
}

// The Files tab lives in filesFlow.ts: here the same functions, bound to the ports of this `$`.
const runGit = ($: EngineInterface, root: string, args: readonly string[], timeoutMs = 5000) => runGitFlow(runPort($), root, args, timeoutMs)
const loadDir = ($: EngineInterface, rel: string): Promise<void> => loadDirFlow(filesDeps($), rel)
const refreshGit = ($: EngineInterface, opts: { ignored?: boolean } = {}): Promise<void> => refreshGitFlow(filesDeps($), opts)
const measureDirs = ($: EngineInterface): Promise<void> => measureDirsFlow(filesDeps($))
const openReading = ($: EngineInterface, rel: string, back: string[]): Promise<boolean> => openReadingFlow(readingDeps($), rel, back)
const startEdit = ($: EngineInterface): Promise<void> => startEditFlow(readingDeps($))
const closeReading = ($: EngineInterface, rel: string): Promise<void> => closeReadingFlow(readingDeps($), rel)

// At startup: the saved open folders and switches, the root, those folders, the git state.
async function initFiles($: EngineInterface): Promise<void> {
  try {
    const [saved, hidden, sizes] = await Promise.all(['expanded', 'hidden', 'sizes'].map(k => $.store.get(k).catch(() => undefined)))
    const expanded = Array.isArray(saved) ? saved.filter((x): x is string => typeof x === 'string') : []
    await update($, treeAtom, t => ({ ...asTree(t), expanded, showHidden: hidden === true, showSizes: sizes === true }))
    await loadDir($, '')
    for (const d of expanded) await loadDir($, d)
  } catch {}
  await refreshGit($, { ignored: true })
  await measureDirs($)
}

async function toggleDir($: EngineInterface, id: string): Promise<void> {
  try {
    const t = await update($, treeAtom, cur => toggleExpanded(asTree(cur), id))
    await $.store.set('expanded', t.expanded).catch(() => {})
    if (t.expanded.includes(id) && !t.loaded.includes(id)) await loadDir($, id)
    await measureDirs($)
  } catch {}
}

// Click on a row: a folder opens or closes, a text file opens in Reading, an image, a PDF or another binary is
// selected, a symbolic link is followed.
async function pressRow($: EngineInterface, id: string): Promise<void> {
  try {
    const t = asTree(await read($, treeAtom))
    const node = t.nodes.find(n => n.id === id)
    if (node?.isLink === true) return await followLink($, id)
    const kind = node?.kind ?? (t.hits.includes(id) ? 'file' : undefined)
    if (kind === 'dir') return await toggleDir($, id)
    if (kind !== 'file') return
    if (isTextFile(id)) {
      if (await openReading($, id, [])) await setTab($, 'reading')
    } else await update($, treeAtom, cur => ({ ...asTree(cur), cursor: id, selected: id }))
  } catch {}
}

// Shows a path in the Files tab: opens the folders that contain it (and the path itself, if it is a folder) and
// highlights it; the filter is cleared.
async function reveal($: EngineInterface, rel: string, isDir: boolean): Promise<void> {
  try {
    const chain = [...ancestors(rel), ...(isDir ? [rel] : [])]
    resetQuery()
    const t = await update($, treeAtom, t0 => { const cur = asTree(t0); return { ...cur, query: '', hits: [], cursor: rel, ...(isDir ? {} : { selected: rel }), expanded: [...new Set([...cur.expanded, ...chain])] } })
    await $.store.set('expanded', t.expanded).catch(() => {})
    for (const d of chain) if (!t.loaded.includes(d)) await loadDir($, d)
    await setTab($, 'files')
    await measureDirs($)
  } catch {}
}

// From the Recap and the other tabs: a text file (Markdown, code, configuration) opens in Reading; images, PDFs and
// other binaries are shown and selected in the Files tab.
async function openFromRecap($: EngineInterface, rel: string): Promise<void> {
  if (!isTextFile(rel)) return await reveal($, rel, false)
  if (await openReading($, rel, [])) await setTab($, 'reading')
}

// A symbolic link goes where it points: inside the vault a folder is shown in the Files tab, a text file opens in
// Reading, a binary is selected; outside the vault there is only a notice.
async function followLink($: EngineInterface, id: string): Promise<void> {
  const t = await catalog($)
  try {
    const s = await getSources($)
    const [st, rootSt] = await Promise.all([$.fs.stat(abs(s, id), { resolve: true }), $.fs.stat(s.root, { resolve: true })])
    const root = rootSt.realPath ?? s.root
    const real = st.realPath
    if (real === undefined || st.kind === 'other') {
      toast($, t.toasts.linkNowhere)
      return
    }
    if (!real.startsWith(`${root}/`)) {
      toast($, t.toasts.linkOutside)
      return
    }
    const rel = real.slice(root.length + 1)
    if (st.kind === 'dir') return await reveal($, rel, true)
    if (isTextFile(rel)) {
      if (await openReading($, rel, [])) await setTab($, 'reading')
      return
    }
    await reveal($, rel, false)
    await update($, treeAtom, t => ({ ...asTree(t), selected: rel }))
  } catch {
    toast($, t.toasts.linkNowhere)
  }
}

// The `.` and Σ switches of the bar: remembered across sessions.
async function toggleTree($: EngineInterface, key: 'hidden' | 'sizes'): Promise<void> {
  try {
    const t = await update($, treeAtom, t0 => { const cur = asTree(t0); return key === 'hidden' ? { ...cur, showHidden: !cur.showHidden } : { ...cur, showSizes: !cur.showSizes } })
    await $.store.set(key, key === 'hidden' ? t.showHidden : t.showSizes).catch(() => {})
    await measureDirs($)
  } catch {}
}

// ⊟: closes all folders.
async function collapseAll($: EngineInterface): Promise<void> {
  try {
    await update($, treeAtom, cur => ({ ...asTree(cur), expanded: [] }))
    await $.store.set('expanded', []).catch(() => {})
  } catch {}
}

async function copyPath($: EngineInterface, rel: string): Promise<void> {
  try {
    const t = await catalog($)
    const done = await $.ui.copy({ text: rel })
    toast($, done.isCopied ? t.toasts.copied(rel) : t.toasts.cannotCopy)
  } catch {}
}

// Trash, move and duplicate: only on an unprotected vault file with no draft to save.
// The reason why not, or null.
async function opBlock($: EngineInterface, s: Sources, rel: string): Promise<string | null> {
  const t = strings(s.lang)
  const cls = classify(resolve(s.root, rel), s, t)
  if (cls === null) return t.toasts.outsideVault
  if (cls.isProtected) return t.toasts.protectedFile(basename(rel))
  // The draft goes through the flow: the user's last keystroke may not be in the atom yet.
  const draft = await syncDraft(readingDeps($))
  if (draft !== null && draft.path === rel && isDirty(draft)) return t.toasts.saveFirst
  return null
}

// Runs a command on the file (trash, mv, cp, mkdir); the reason if it fails, or null.
async function runOp($: EngineInterface, s: Sources, argv: string[]): Promise<string | null> {
  try {
    const r = await $.process.run(argv, { cwd: s.root, timeoutMs: 10_000 })
    return r.exitCode === 0 ? null : (r.stderr.trim() || strings(s.lang).toasts.commandFailed(argv[0] ?? '', r.exitCode))
  } catch (err) {
    return errText(err)
  }
}

// After an action: the touched folders that are already open are read again, and so is git; the filter index
// restarts; the new file is shown (or the selection is cleared). The file open in Reading follows the move or closes.
async function afterOp($: EngineInterface, dirs: string[], show: string, gone: string | null): Promise<void> {
  dropIndex()
  const t = asTree(await read($, treeAtom))
  for (const d of new Set(dirs)) if (t.loaded.includes(d)) await loadDir($, d)
  if (show !== '') await reveal($, show, false)
  else await update($, treeAtom, x => ({ ...asTree(x), selected: '', cursor: '' }))
  const rd = shaped(EMPTY_READING, await read($, readingAtom))
  if (gone !== null && rd.path === gone) {
    if (show !== '' && gone !== show) await openReading($, show, rd.back)
    else await closeReading($, gone)
    await setTab($, 'files')
  }
  void refreshGit($)
}

async function startOp($: EngineInterface, kind: FileOp['kind']): Promise<void> {
  try {
    const path = (await read($, treeAtom))?.selected ?? ''
    if (path === '') return
    const block = await opBlock($, await getSources($), path)
    if (block !== null) return toast($, block)
    resetMove()
    await update($, fileOpAtom, () => (kind === 'trash' ? { kind, path } : { kind, path, text: path }))
  } catch {}
}

async function trashFile($: EngineInterface): Promise<void> {
  try {
    const op = await read($, fileOpAtom)
    await update($, fileOpAtom, () => null)
    if (op?.kind !== 'trash') return
    const s = await getSources($)
    const block = await opBlock($, s, op.path)
    if (block !== null) return toast($, block)
    const err = await runOp($, s, ['/usr/bin/trash', '-s', abs(s, op.path)])
    const t = strings(s.lang)
    if (err !== null) return toast($, t.toasts.cannotTrash(err))
    toast($, t.toasts.trashed(basename(op.path)))
    await afterOp($, [parentOf(op.path)], '', op.path)
  } catch {}
}

// Enter in the move field: on an error the field stays and the notice says why.
async function moveFile($: EngineInterface, text: string): Promise<void> {
  try {
    const op = await read($, fileOpAtom)
    if (op?.kind !== 'move') return
    const from = op.path
    const t = await catalog($)
    const target = typedTarget(text, from, t)
    if ('error' in target) return toast($, target.error)
    const s = await getSources($)
    const block = await opBlock($, s, from)
    if (block !== null) return toast($, block)
    const dest = classify(resolve(s.root, target.rel), s, t)
    if (dest === null) return toast($, t.toasts.onlyInVault)
    if (dest.isProtected) return toast($, t.toasts.notThere(target.rel))
    if (await $.fs.exists(abs(s, target.rel))) return toast($, t.toasts.exists(target.rel))
    const dir = parentOf(target.rel)
    if (dir !== '' && !(await $.fs.exists(abs(s, dir)))) {
      const err = await runOp($, s, ['mkdir', '-p', abs(s, dir)])
      if (err !== null) return toast($, t.toasts.cannotCreate(dir, err))
    }
    const err = await runOp($, s, ['mv', '-n', abs(s, from), abs(s, target.rel)])
    if (err !== null) return toast($, t.toasts.cannotMove(err))
    resetMove()
    await update($, fileOpAtom, () => null)
    toast($, t.toasts.moved(target.rel))
    await afterOp($, [parentOf(from), dir], target.rel, from)
  } catch {}
}

async function duplicateFile($: EngineInterface): Promise<void> {
  try {
    const from = (await read($, treeAtom))?.selected ?? ''
    if (from === '') return
    const s = await getSources($)
    const block = await opBlock($, s, from)
    if (block !== null) return toast($, block)
    const dir = parentOf(from)
    const names = new Set((await $.fs.list(abs(s, dir))).map(e => e.name))
    const t = strings(s.lang)
    const to = copyName(from, names, t)
    const err = await runOp($, s, ['cp', '-n', abs(s, from), abs(s, to)])
    if (err !== null) return toast($, t.toasts.cannotDuplicate(err))
    toast($, t.toasts.created(basename(to)))
    await afterOp($, [dir], to, null)
  } catch {}
}

async function openInFiles($: EngineInterface, rel: string): Promise<void> {
  const t = await catalog($)
  try {
    const s = await getSources($)
    const r = await $.mcp.call('ccd_view', 'show_pane', { pane: 'file', path: abs(s, rel) })
    if (r.isError) toast($, t.toasts.cannotOpenPane)
  } catch {
    toast($, t.toasts.paneUnavailable)
  }
}

const memoriesFlight = flight()
const diaryFlight = flight()
const figureFlight = flight()

// After a cockpit write: the To Do tab reloads at once (it is the user's own gesture); git, tree, sizes, tabs and
// the Recap snapshot follow the file when the writes settle. The old size stays on screen until the new one arrives.
async function afterWrite($: EngineInterface, s: Sources, rel: string): Promise<void> {
  markStale([rel])
  const isTodo = rel === s.roles['Future work']
  settleWrites(settleDeps($), [{ verb: 'edit', path: rel }], { snapshot: isTodo, measure: true })
  if (isTodo && (await read($, todoAtom))?.path === rel) await loadTodo(todoDeps($))
}

// After a write from the To Do tab: Reading and the draft follow the file (readingFlow), then git, tree and
// Recap.
async function todoWrote($: EngineInterface, rel: string): Promise<void> {
  await followOwnWrite(readingDeps($), rel)
  await afterWrite($, await getSources($), rel)
}

// With the To Do tab in view, a click in the panel and the start and end of a turn check whether another chat has
// written the file (a stat): if so, the tab reloads.
async function checkTodoInView($: EngineInterface): Promise<void> {
  try {
    const [tab, isOpen] = await Promise.all([read($, tabAtom), read($, paneOpenAtom)])
    if (migrateTab(tab) === 'todo' && isOpen === true) await checkTodo(todoDeps($))
  } catch {}
}

// The Memories tab reads the folder again: each file on its own (those over the limit get no text), and git log and
// status on the folder together. Without git, or with a truncated log, new/changed come from the file dates.
// One reload at a time: a single `git log` at once.
function loadMemories($: EngineInterface): Promise<void> {
  return oneAtATime(memoriesFlight, () => readMemories($))
}

async function readMemories($: EngineInterface): Promise<void> {
  try {
    const s = await getSources($)
    const dir = memoryDir(s.roles)
    if (dir === null) return
    let entries: Awaited<ReturnType<EngineInterface['fs']['list']>>
    try {
      entries = await $.fs.list(abs(s, dir))
    } catch (err) {
      await memoriesCell($).set(m => ({ ...m, dir, list: null, error: errText(err) }))
      return
    }
    const names = memoryNames(entries, dir, s.roles)
    const [log, status, nowMs, files] = await Promise.all([
      runGit($, s.root, ['log', '-z', '--format=%ct', '--name-only', '--', dir], 10_000),
      runGit($, s.root, ['status', '--porcelain=v1', '-z', '--untracked-files=all', '--', dir]),
      $.clock.now(),
      Promise.all(names.map(async name => {
        const e = entries.find(x => x.name === name)
        const text = e === undefined || e.size > MAX_READ_BYTES ? null : await $.fs.read(abs(s, `${dir}/${name}`)).then(String, () => null)
        return { name, text, mtimeMs: e?.mtimeMs ?? 0 }
      })),
    ])
    const inDir = (p: string): boolean => dirname(p) === dir || dirname(p).endsWith(`/${dir}`)
    const git = log === null || log.isTruncated ? null : {
      dates: parseGitDates(log.stdout, dir),
      dirty: new Set(Object.keys(parseStatus(status?.stdout ?? '').changed).filter(inDir).map(basename)),
    }
    const list = buildMemories(files, git, nowMs)
    const has = (f: string): boolean => list.some(x => x.file === f)
    // A memory that has disappeared closes its view and leaves the stack.
    await memoriesCell($).set(m => ({ ...m, dir, list, error: null, open: m.open !== null && has(m.open) ? m.open : null, back: m.back.filter(has) }))
  } catch {}
}

// The Diary tab looks for the notes up to today (the year/month folders and the diary root) and reads the one for the
// requested day, or the one already shown if it still exists, or the last one before today. The note changes in the
// tab only once it has been read: no loading text between one note and the next. One reload at a time.
function loadDiary($: EngineInterface, day: string | null = null): Promise<void> {
  return oneAtATime(diaryFlight, () => readDiary($, day))
}

async function readDiary($: EngineInterface, want: string | null): Promise<void> {
  try {
    const s = await getSources($)
    const root = s.roles['Daily history']
    if (root === undefined) return
    const cur = shaped(EMPTY_DIARY, await read($, diaryAtom))
    const list = (dir: string) => $.fs.list(abs(s, dir))
    let top: Awaited<ReturnType<typeof list>>
    try {
      top = await list(root)
    } catch (err) {
      if (changes(cur, { notes: null, error: errText(err) })) await update($, diaryAtom, d => ({ ...shaped(EMPTY_DIARY, d), notes: null, error: errText(err) }))
      return
    }
    const today = isoDay(await $.clock.now())
    const subdirs = async (dir: string, name: RegExp): Promise<string[]> =>
      (await list(dir).catch(() => [])).filter(x => x.kind === 'dir' && name.test(x.name)).map(x => `${dir}/${x.name}`)
    const months = (await Promise.all((await subdirs(root, /^\d{4}$/)).map(y => subdirs(y, /^\d{2}$/)))).flat()
    const found = await Promise.all(months.map(async dir => ({ dir, names: (await list(dir).catch(() => [])).map(x => x.name) })))
    const notes = diaryNotes([...found, { dir: root, names: top.filter(x => x.kind === 'file').map(x => x.name) }], today)
    const has = (day: string | null): day is string => day !== null && notes.some(n => n.day === day)
    const day = has(want) ? want : has(cur.day) ? cur.day : defaultDay(notes, today)
    const note = notes.find(n => n.day === day)
    const loaded = note === undefined ? { text: null, isTooBig: false, error: null } : await loadText(fsPort($), abs(s, note.path))
    // The same notes as before stay the same array: a reload that changes nothing does not redraw.
    const unchanged = cur.notes !== null && cur.notes.length === notes.length && cur.notes.every((n, i) => n.day === notes[i]?.day && n.path === notes[i]?.path)
    const next = { notes: unchanged ? cur.notes : notes, day: note?.day ?? null, text: loaded.text, isTooBig: loaded.isTooBig, error: loaded.error }
    if (changes(cur, next)) await update($, diaryAtom, d => ({ ...shaped(EMPTY_DIARY, d), ...next }))
  } catch {}
}

// The Diary button of the Recap's Last session (recapOpen.tsx): that day's note in the Diary tab.
async function openDiary($: EngineInterface, day: string): Promise<void> {
  try {
    await loadDiary($, day)
    await setTab($, 'diary')
  } catch {}
}

// A link in the Diary and To Do tabs: a text file opens in Reading, a binary in the Files pane.
async function tabLink($: EngineInterface, href: string): Promise<void> {
  try {
    const rel = pressedRel(href, (await getSources($)).root)
    if (rel !== null && isTextFile(rel)) await openFromRecap($, rel)
    else await pressLink(readingDeps($), href)
  } catch {}
}

// The edit-the-file button: the Future work file in the Reading editor.
async function editTodo($: EngineInterface): Promise<void> {
  try {
    const s = await getSources($)
    const rel = s.roles['Future work']
    if (rel === undefined || !(await openReading($, rel, []))) return
    await setTab($, 'reading')
    await startEdit($)
  } catch {}
}

// The past sessions of the registry, most recent first: read from the store once and kept here (drawing never reads
// the store); session.start and session.end make them load again. null: not read yet.
let pastCache: SessionRecord[] | null = null
// The last record written to the store, as JSON: it is written again only if it changed.
let savedJson = ''

// The registry for the snapshot: the latest past sessions (without the current one) and the days of their diary notes.
// A store that does not answer (the keys, or even a single read) gives an empty or incomplete registry that is not
// kept in `pastCache`: it is tried again at the next refresh.
async function registry($: EngineInterface): Promise<SessionsInput> {
  try {
    if (pastCache === null) {
      const keys = (await $.store.keys()).filter(k => k.startsWith(SESSION_KEY))
      let failed = false
      const records = (await Promise.all(keys.map(k => $.store.get(k).then(asRecord, () => { failed = true; return null })))).filter((r): r is SessionRecord => r !== null)
      let id: string | null = null
      try { id = await $.session.id() } catch {}
      const past = pastSessions(records, id)
      if (!failed) pastCache = past
      return { sessions: past, diaryDays: diaryDaysOf(past) }
    }
    return { sessions: pastCache, diaryDays: diaryDaysOf(pastCache) }
  } catch {
    return NO_SESSIONS
  }
}

// The record in the store under `session:<id>`, only if it changed since the last successful write. A refused write
// stops nothing: the record stays in the state and is tried again next time. Without an id nothing is written.
async function saveSession($: EngineInterface, rec: SessionRecord | null | undefined): Promise<void> {
  if (rec == null || rec.id === '') return
  const json = JSON.stringify(rec)
  if (json === savedJson) return
  try {
    await $.store.set(`${SESSION_KEY}${rec.id}`, rec)
    savedJson = json
  } catch {}
}

// The record the store already has for this session (a session resumed in a new process), reopened: endAt goes back
// to null. null if there is none, it cannot be read or it belongs to another session.
async function storedSession($: EngineInterface, id: string): Promise<SessionRecord | null> {
  try {
    const rec = asRecord(await $.store.get(`${SESSION_KEY}${id}`))
    return rec === null || rec.id !== id ? null : { ...rec, endAt: null }
  } catch {
    return null
  }
}

// At session start the store keeps the KEEP_SESSIONS most recent sessions: the other `session:` keys are deleted,
// including those of other sessions (they are old). The other keys (tab, expanded…) are not touched.
async function startSessions($: EngineInterface): Promise<void> {
  try {
    const keys = (await $.store.keys()).filter(k => k.startsWith(SESSION_KEY))
    if (keys.length <= KEEP_SESSIONS) return
    const entries = await Promise.all(keys.map(async key => ({ key, value: await $.store.get(key).catch(() => undefined) })))
    for (const key of staleKeys(entries)) await $.store.delete(key).catch(() => {})
  } catch {}
}

// A submitted prompt: the start of its turn in the log, the Recap going back to following the session, and the session
// record, which is born with the first prompt and goes to the store at once. Never throws.
async function notePrompt($: EngineInterface, turn: number, text: string): Promise<void> {
  try {
    const at = await $.clock.now()
    await update($, promptsAtom, p => [...(p ?? []), { turn, at, text: promptLine(text) }].slice(-MAX_ENDS))
    if ((await read($, recapViewAtom)) === 'open') await update($, recapViewAtom, () => 'auto' as const)
    const held = await read($, sessionAtom)
    let id = ''
    try { id = await $.session.id() } catch {}
    // An id that does not answer while the session is open: the record's own id stays (a new record without an id would
    // lose the old one).
    if (id === '' && held != null && held.endAt === null) id = held.id
    // Another session in the same process (after /clear or /resume the id changes without a session.start).
    const isOther = id !== '' && held != null && held.id !== id
    // The first prompt of a process, or of another session, picks up the store's record if the session was resumed.
    const stored = id !== '' && (held == null || isOther) ? await storedSession($, id) : null
    // The written files are those of the session: another session does not inherit those of the closed one, a resumed
    // one finds its own (so the turn end, which takes them from `written`, does not lose them).
    if (isOther || stored !== null) await update($, writtenAtom, w => ({ ...(stored === null ? {} : recordWritten(stored)), ...(isOther ? {} : w ?? {}) }))
    const rec = await update($, sessionAtom, r => onPromptRecord(r != null && r.id === id ? r : stored ?? r ?? null, id, at, text))
    if (rec !== null && rec.prompts === 1) await saveSession($, rec)
  } catch {}
}

// Topic and status of the handoff written in the session, from its frontmatter (within MAX_READ_BYTES); null if it
// cannot be read.
async function handoffMetaOf($: EngineInterface, file: string): Promise<{ topic: string; status: string } | null> {
  try {
    const p = abs(await getSources($), file)
    if ((await $.fs.stat(p)).size > MAX_READ_BYTES) return null
    return handoffMeta(String(await $.fs.read(p)), file)
  } catch {
    return null
  }
}

// Recomputes the snapshot; never throws: a caller using `void` leaves no rejection.
async function refresh($: EngineInterface): Promise<void> {
  try {
    const s = await getSources($)
    const at = await $.clock.now()
    // The registry comes before the snapshot: it says which diary notes to read.
    const reg = await registry($)
    const snap = await loadSnapshot({
      exists: p => $.fs.exists(p), read: p => $.fs.read(p), list: p => $.fs.list(p), stat: p => $.fs.stat(p),
      blame: async p => {
        const r = await $.process.run(['git', 'blame', '--line-porcelain', '--', p], { cwd: s.root, timeoutMs: 3000 })
        return r.exitCode === 0 && !r.isStdoutTruncated ? r.stdout : ''
      },
    }, s, at, reg)
    // The same snapshot, taken at another time, is not written again.
    const cur = await read($, snapshotAtom)
    if (cur == null || !same({ ...cur, takenAt: 0 }, { ...snap, takenAt: 0 })) await update($, snapshotAtom, () => snap)
  } catch {}
}

// The mascot: an event moves it to another state, and it is written only if it changes. `done` and `error` go back by
// themselves after TRANSIENT_MS, `idle` falls asleep after SLEEP_MS: a tick with $.clock.after. Never throws.
async function mascotStep($: EngineInterface, ev: MascotEvent): Promise<void> {
  try {
    const [cur, working, runs, at] = await Promise.all([read($, mascotAtom), read($, workingAtom), read($, agentRunsAtom), $.clock.now()])
    const ctx = { working: working ?? false, agents: liveRuns(runs ?? {}) }
    // No change, no write (update always writes and would trigger a redraw).
    const shown = shaped(IDLE, cur)
    if (stepMascot(shown, ev, ctx, at) === shown) return
    // The step is recomputed inside the updater, on the value that is really there: two steps at once are not lost. The
    // return tick starts only if this step wrote the entry into done/error.
    let entered = false
    let rested = false
    // A new scene: how long it moves (walk, hop, party, shake) and whether the walk is visible.
    let moves = 0
    let walks = false
    await update($, mascotAtom, now => {
      const was = shaped(IDLE, now)
      const moved = stepMascot(was, ev, ctx, at)
      entered = moved !== was && ev.kind !== 'tick' && (moved.state === 'done' || moved.state === 'error')
      rested = moved.state === 'idle' && was.state !== 'idle'
      const isNew = moved.since !== was.since
      moves = isNew ? motionMs(moved, canWalk()) : 0
      walks = isNew && walkEnd(moved, canWalk()) !== null
      return moved
    })
    if (entered) $.clock.after(TRANSIENT_MS, () => { void mascotStep($, { kind: 'tick' }) })
    if (rested) $.clock.after(SLEEP_MS, () => { void mascotStep($, { kind: 'tick' }) })
    await animate($, moves)
    // Walking and typing never together: a cheer phrase typed halfway starts over on arrival.
    if (walks) await talkStep($, t => t)
  } catch {}
}

// Whether the panel is narrower than WALK_MIN_COLUMNS (as of the last draw): there the mascot does not walk, so the
// walk takes no steps. Before the first draw it is assumed wide.
let isNarrow = false
const canWalk = (): boolean => !isNarrow

// The steps: while the mascot moves (or types) the panel redraws every STEP_MS with the image for that instant, then
// the chain stops with a last step at rest. Never an interactive frame: it would reload and flicker on every step.
// One chain at a time; one that has been stalled for too long (module reloaded halfway) starts again. No steps while
// the panel is closed: nothing moving can be seen, and the panel that opens takes up the missing ones (resumeMotion).
// They never throw.
const STEP_MS = 160
async function animate($: EngineInterface, ms: number): Promise<void> {
  if (ms <= 0) return
  try {
    if ((await read($, paneOpenAtom)) !== true) return
    const at = await $.clock.now()
    let isStart = false
    await update($, motionAtom, m => {
      const was = shaped(NO_MOTION, m)
      isStart = !was.isRunning || at - was.at > 4 * STEP_MS
      return { until: Math.max(was.until, at + ms), at: isStart ? at : was.at, isRunning: true }
    })
    if (isStart) stepLater($)
  } catch {}
}

function stepLater($: EngineInterface): void {
  $.clock.after(STEP_MS, () => {
    void (async () => {
      // A chain already running stops if the panel has closed: no steps while the panel is closed. The panel that opens
      // takes it up again (resumeMotion).
      const [now, isOpen] = await Promise.all([$.clock.now(), read($, paneOpenAtom)])
      let isMore = false
      await update($, motionAtom, m => {
        const was = shaped(NO_MOTION, m)
        isMore = isOpen === true && now < was.until
        return { ...was, at: now, isRunning: isMore }
      })
      if (isMore) stepLater($)
    })().catch(() => {})
  })
}

// The bubble: a pure step on `talk`, written only if it changes. A cheer phrase said now takes its start time and is
// typed out, after the walk in progress (holdTyping); a bubble with a button appears whole, without steps. A new
// expiry removes the phrase after CHEER_MS. Never throws.
async function talkStep($: EngineInterface, fn: (t: Talk) => Talk): Promise<void> {
  try {
    const [cur, mascot, at] = await Promise.all([read($, talkAtom), read($, mascotAtom), $.clock.now()])
    const walk = walkEnd(shaped(IDLE, mascot), canWalk())
    const step = (was: Talk): Talk => {
      const next = fn(was)
      const b = next.bubble
      // A new cheer phrase takes the time it starts: the drawing types it out only from then on.
      const stamped = b !== null && isTyped(b) && b.id !== was.bubble?.id && b.at === undefined ? { ...next, bubble: { ...b, at } } : next
      return holdTyping(stamped, at, walk)
    }
    const shown = shaped(NO_TALK, cur)
    if (step(shown) === shown) return
    let timed = null as Bubble | null
    let said = null as Bubble | null
    await update($, talkAtom, t => {
      const was = shaped(NO_TALK, t)
      const next = step(was)
      const b = next.bubble
      const isNew = b !== null && b.id !== was.bubble?.id
      // Said now (new, said again or held until arrival): waves the arm and types out the text.
      said = b !== null && isTyped(b) && b.at !== undefined && (isNew || b.at !== was.bubble?.at) ? b : null
      // A new expiry (new phrase, greeting said again or held) starts its timer.
      timed = b !== null && b.until !== undefined && (isNew || b.until !== was.bubble?.until) ? b : null
      return next
    })
    const s = said
    if (s !== null && s.at !== undefined) await animate($, s.at - at + talkMs(s.text))
    const b = timed
    if (b !== null && b.until !== undefined) {
      $.clock.after(Math.max(b.until - at, 0), () => {
        void $.clock.now().then(now => talkStep($, t => expire(t, now)), () => {})
      })
    }
  } catch {}
}

// The bubble's button: prepares the command or opens the file, then the bubble closes.
async function bubbleAct($: EngineInterface, b: Bubble): Promise<void> {
  if (b.action?.send !== undefined) await send($, b.action.send)
  if (b.action?.open !== undefined) await openFromRecap($, b.action.open)
  await talkStep($, t => dismiss(t, b.id))
}

// Reads the mascot folder and swaps the stage's figure; one read at a time, so a write during a read is not
// lost. A refused file is reported once in each session. Never throws.
function loadFigure($: EngineInterface): Promise<void> {
  return oneAtATime(figureFlight, () => readFigure($))
}

async function readFigure($: EngineInterface): Promise<void> {
  try {
    const s = await getSources($)
    const dir = abs(s, FIGURE_DIR)
    const names = (await $.fs.exists(dir)) ? new Set((await $.fs.list(dir)).map(e => e.name)) : new Set<string>()
    const texts: Partial<Record<FigureFile, string | null>> = {}
    for (const f of FIGURE_FILES) {
      if (!names.has(fileOf(f))) continue
      const p = `${dir}/${fileOf(f)}`
      // A file that cannot be statted counts as missing. A UTF-8 character is at most four bytes: a bigger file
      // cannot fit the limit, so it is not read.
      const size = await $.fs.stat(p).then(x => x.size, () => undefined)
      if (size === undefined) continue
      if (size > MAX_FIGURE_CHARS * 4) { texts[f] = null; continue }
      const text = await $.fs.read(p).then(String, () => undefined)
      if (text !== undefined) texts[f] = text
    }
    const { figure, refused } = buildFigure(texts)
    await figureCell($).set(() => figure)
    const seen = (await read($, figureNotesAtom)) ?? []
    const fresh = refused.map(r => ({ ...r, key: `${r.file}:${r.reason}` })).filter(r => !seen.includes(r.key))
    const t = strings(s.lang)
    for (const r of fresh) toast($, t.figure.refused(r.file, r.reason))
    if (fresh.length > 0) await update($, figureNotesAtom, n => [...(n ?? []), ...fresh.map(r => r.key)])
  } catch {}
}

// The session greeting with the user's first name; without declared capabilities (or with the Lite marker) the
// invitation to set up.
async function hello($: EngineInterface): Promise<void> {
  try {
    const s = await getSources($)
    // The user's own name, as given to Jarvis (CLAUDE.md, then the identity); if missing, the git name and then the
    // name of the Mac account (`id -F`).
    const text = async (rel: string | undefined): Promise<string> =>
      rel === undefined ? '' : await $.fs.read(abs(s, rel)).then(String, () => '')
    let who = userName(await text('CLAUDE.md'), await text(s.roles['Identity'])) ?? ''
    if (who === '') who = (await runGit($, s.root, ['config', 'user.name']))?.stdout.trim() ?? ''
    if (who === '') who = await $.process.run(['id', '-F'], { cwd: s.root, timeoutMs: 2000 }).then(r => (r.exitCode === 0 ? r.stdout.trim() : ''), () => '')
    const name = who === '' ? null : who
    // To set up: a single bubble, greeting and invitation together.
    const t = strings(s.lang)
    await talkStep($, talk => (!s.hasTable || s.isOnboarding === true ? setup(greet(talk, name, t), t, name) : greet(talk, name, t)))
  } catch {}
}

// The last line of the log without the time (HH:MM and the space), or null if the log is empty.
const lastLine = (log: readonly string[]): string | null => { const l = log[log.length - 1]; return l === undefined ? null : l.slice(6) }

// Opens the panel and, if the engine places it, remembers that (the line under the prompt then drops ✦ Jarvis).
// Throws if $.ui.open throws: the caller decides.
async function openPane($: EngineInterface): Promise<void> {
  const r = await $.ui.open({ id: PANE, title: TITLE })
  if (r.isPlaced) {
    await update($, paneOpenAtom, () => true)
    const now = await $.clock.now()
    await talkStep($, t => replay(t, now))
    await resumeMotion($)
  }
}

// The panel opens or widens: the steps still missing for the current scene and phrase (while the panel is closed
// animate takes none, and in the narrow panel neither does the walk). Never throws.
async function resumeMotion($: EngineInterface): Promise<void> {
  try {
    const [m, t, now] = await Promise.all([read($, mascotAtom), read($, talkAtom), $.clock.now()])
    const mascot = shaped(IDLE, m)
    const b = shaped(NO_TALK, t).bubble
    const talking = b !== null && isTyped(b) && b.at !== undefined ? b.at + talkMs(b.text) : 0
    await animate($, Math.max(mascot.since + motionMs(mascot, canWalk()), talking) - now)
    // Widening the panel halfway through a turn restarts the walk while a phrase may already be typing (started while
    // narrow, when there was no walk): holdTyping puts it after the arrival.
    await talkStep($, t => t)
  } catch {}
}

// ✦ Jarvis: if the engine still has the panel (the app may have hidden its tab) it closes and reopens it, so the app
// brings it back into view; otherwise it opens it.
async function reopenPane($: EngineInterface): Promise<void> {
  const isListed = (await $.ui.panes().catch(() => [])).some(p => p.id === PANE)
  if (isListed) await $.ui.close({ id: PANE }).catch(() => {})
  await openPane($)
}

async function send($: EngineInterface, text: string): Promise<void> {
  try {
    if ((await $.prompt.read()).text.trim() === '') await $.prompt.fill({ text })
    else toast($, (await catalog($)).toasts.promptNotEmpty)
  } catch {}
}

// The actions on the selected file are drawn only for an unprotected vault file.
function selOps(s: Sources, hasSources: boolean, sel: string): boolean {
  if (!hasSources || sel === '') return false
  const cls = classify(resolve(s.root, sel), s, strings(s.lang))
  return cls !== null && !cls.isProtected
}

// The first click on a panel without keyboard focus becomes a press (clickthrough.ts). `paneHeld` is the last
// `isFocused` of the draw: gaining or losing keyboard focus redraws the panel.
const paneClicks = clickthrough()
let paneHeld = false

// A draw that throws does not make the panel disappear: a minimal card with the reload button (recoverPane).
async function fault($: EngineInterface, resolved: Elements['desktop'], message: string): Promise<RenderElement> {
  const t = await catalog($)
  const drawing = paneClicks.draw(resolved)
  const tree = drawFault(drawing.el, message, () => { void recoverPane($) }, t)
  drawing.done()
  return tree
}

// The panel: reads the atoms and draws the header, the tabs and the active tab. If it throws, the guard in the Pane
// hook draws the minimal card (fault).
async function drawCockpit($: EngineInterface, el: Elements['desktop'], columns: number): Promise<RenderElement> {
  const [snapshot, feed, turn, runs, tab, tree, gitView, written, reading, srcs, nowMs, sizes, numstat, draft, mascot, working, ends, fileOp, turnAt, talk, figure] = await Promise.all([
    read($, snapshotAtom), read($, feedAtom), read($, turnAtom), read($, agentRunsAtom), read($, tabAtom),
    read($, treeAtom), read($, gitAtom), read($, writtenAtom), read($, readingAtom), getSources($).catch(() => null), $.clock.now(),
    read($, sizesAtom), read($, numstatAtom), read($, draftAtom), read($, mascotAtom), read($, workingAtom), read($, endsAtom), read($, fileOpAtom),
    read($, turnAtAtom), read($, talkAtom), read($, figureAtom),
    // Read so the panel redraws at every step of the mascot (animate).
    read($, motionAtom),
  ])
  const todo = shaped(EMPTY_TODO, await read($, todoAtom))
  const memories = asMemories(await read($, memoriesAtom))
  const diary = shaped(EMPTY_DIARY, await read($, diaryAtom))
  const logOpen = await read($, logOpenAtom)
  const rd = shaped(EMPTY_READING, reading)
  const tr = asTree(tree)
  // The draft with the editor's latest text, even if the atom does not have it yet.
  const shownDraft = draftView(draft ?? null)
  // Without readable sources (root or CLAUDE.md not reachable) the open file in Reading is still drawn, just without
  // a role.
  const rs: Sources = srcs ?? { root: '', roles: {}, hasTable: false, lang: 'en' }
  const t = strings(rs.lang)
  const tabs = tabsFor(rs.roles)
  // A tab that no longer exists (source removed from CLAUDE.md) gives way to the Recap.
  const saved = migrateTab(tab)
  const active = saved !== null && tabs.includes(saved) ? saved : 'recap'
  // Prompts, session and face are only needed by the Recap: the other tabs do not redraw on every prompt.
  const [prompts, session, face] = active === 'recap' ? await Promise.all([read($, promptsAtom), read($, sessionAtom), read($, recapViewAtom)]) : [[], null, 'auto' as const]
  const loops = rs.roles['Future work']
  const todoName = loops === undefined ? t.tabs.todo : todoLabel(loops, t)
  const cls = rd.path === null || srcs === null ? undefined : classify(resolve(rs.root, rd.path), rs, t)
  const body = active === 'files' ? drawFiles(el, {
    t, tree: tr, query: queryText(tr), git: gitView ?? null, numstat: numstat ?? null, sizes: sizes ?? {}, written: written ?? {}, nowMs,
    press: id => { void pressRow($, id) },
    copy: id => { void copyPath($, id) },
    openInApp: id => { void openInFiles($, id) },
    typeQuery: q => { typeQuery(filesDeps($), q) },
    search: q => { void searchFlow(filesDeps($), q) },
    toggleHidden: () => { void toggleTree($, 'hidden') },
    toggleSizes: () => { void toggleTree($, 'sizes') },
    collapseAll: () => { void collapseAll($) },
    unselect: () => { void update($, treeAtom, t => ({ ...asTree(t), selected: '' })).catch(() => {}) },
    op: fileOp ?? null,
    moveText: fileOp?.kind === 'move' ? moveText(fileOp) : '',
    ops: selOps(rs, srcs !== null, tr.selected) ? {
      start: kind => { void startOp($, kind) },
      duplicate: () => { void duplicateFile($) },
      confirmTrash: () => { void trashFile($) },
      moveInput: typeMove,
      moveSubmit: text => { void moveFile($, text) },
      cancel: () => { resetMove(); void update($, fileOpAtom, () => null).catch(() => {}) },
    } : null,
  })
    : active === 'reading' ? drawReader(el, {
      reading: rd, t, root: rs.root, nowMs,
      role: cls?.role,
      // Without sources, outside the vault (classify null) or protected (except the Future work file) the file cannot
      // be edited in the panel.
      editBlocked: editBlock(rd, !isEditable(cls, t), t),
      writtenAt: rd.path === null ? undefined : (written ?? {})[rd.path],
      draft: shownDraft !== null && shownDraft.path === rd.path ? shownDraft : null,
      pending: shownDraft !== null && shownDraft.pendingOpen === rd.path && shownDraft.path !== rd.path ? basename(shownDraft.path) : null,
      saveDraft: () => { void saveDraft(readingDeps($)) },
      cancelDraft: () => { void cancelDraft(readingDeps($)) },
      conflictAct: a => { void conflictAct(readingDeps($), a) },
      pendingAct: a => { void pendingAct(readingDeps($), a) },
      strayDraft: rd.path === null && shownDraft !== null && isDirty(shownDraft) ? basename(shownDraft.path) : null,
      toDraft: () => { void pendingAct(readingDeps($), 'back') },
      back: () => { void goBack(readingDeps($)) },
      folder: rel => { void reveal($, rel, true) },
      setMode: m => { void (m === 'edit' ? startEdit($) : setReaderMode(readingDeps($), m)) },
      link: href => { void pressLink(readingDeps($), href) },
      openInApp: () => { if (rd.path !== null) void openInFiles($, rd.path) },
    })
    : active === 'diary' ? drawDiary(el, {
      diary, t, root: rs.root, nowMs,
      show: day => { void loadDiary($, day) },
      link: href => { void tabLink($, href) },
      read: path => { void openFromRecap($, path) },
    })
    : active === 'todo' ? drawTodo(el, {
      todo, t, label: todoName, root: rs.root, entry: todoEntry(),
      toggle: it => { void writeTodo(todoDeps($), text => toggleItem(text, it)) },
      confirm: key => { void confirmTodo(todoDeps($), key) },
      remove: it => { void removeTodo(todoDeps($), it) },
      link: href => { void tabLink($, href) },
      startAdd: head => { void openAdd(todoDeps($), head) },
      type: typeTodo,
      submit: (head, text) => { void addTodo(todoDeps($), head, text) },
      cancelAdd: () => { void cancelAdd(todoDeps($)) },
      edit: () => { void editTodo($) },
      read: () => { if (loops !== undefined) void openFromRecap($, loops) },
    })
    : active === 'memories' ? drawMemories(el, {
      memories, t, columns,
      open: file => { void update($, memoriesAtom, m => ({ ...asMemories(m), open: file, back: [] })).catch(() => {}) },
      follow: file => { void update($, memoriesAtom, m0 => { const m = asMemories(m0); return { ...m, open: file, back: m.open === null ? m.back : [...m.back, m.open] } }).catch(() => {}) },
      back: () => { void update($, memoriesAtom, m0 => { const m = asMemories(m0); return { ...m, open: m.back[m.back.length - 1] ?? null, back: m.back.slice(0, -1) } }).catch(() => {}) },
      toggleGroup: g => { void update($, memoriesAtom, m0 => { const m = asMemories(m0); return { ...m, expanded: m.expanded.includes(g) ? m.expanded.filter(x => x !== g) : [...m.expanded, g] } }).catch(() => {}) },
      // In Reading, read-only: the memories folder is protected.
      read: file => { if (memories.dir !== null) void openFromRecap($, `${memories.dir}/${file}`) },
      // Like the bubble buttons: prepares the prompt, the user writes the rest.
      ask: m => { void send($, t.memories.askPrompt(m.name)) },
    })
    : drawRecap(el, {
      snapshot, t, feed: feed ?? [], prompts: prompts ?? [], session: session ?? null, face: face ?? 'auto', written: written ?? {}, runs: runs ?? {}, ends: ends ?? [], working: working ?? false, turnAt: turnAt ?? null, roles: rs.roles, nowMs, columns,
      openFile: rel => { void openFromRecap($, rel) },
      openFolder: rel => { void reveal($, rel, true) },
      openTodo: () => { if (tabs.includes('todo')) void setTab($, 'todo') },
      openDiary: day => { void openDiary($, day) },
      logOpen: logOpen ?? false,
      toggleLog: () => { void update($, logOpenAtom, x => !(x ?? false)).catch(() => {}) },
      showOpen: () => { void update($, recapViewAtom, () => 'open' as const).catch(() => {}) },
      showWork: () => { void update($, recapViewAtom, () => 'auto' as const).catch(() => {}) },
      // A slash command cannot be submitted by plugins: the button prepares the text, Enter sends it.
      // An existing prompt draft is never overwritten: better a notice.
      send: text => { void send($, text) },
    })
  return drawPane(el, {
    columns,
    t,
    header: {
      mascot: shaped(IDLE, mascot), figure: figure ?? TERMINAL, t, working: working ?? false, turnAt: turnAt ?? null, nowMs,
      bubble: visible(shaped(NO_TALK, talk), nowMs),
      bubbleAct: b => { void bubbleAct($, b) },
      bubbleClose: b => { void talkStep($, t => dismiss(t, b.id)) },
    },
    tabs,
    tab: active,
    setTab: t => { void setTab($, t) },
    todoLabel: todoName,
    hasDraft: isDirty(shownDraft),
    body,
  })
}

export const register: Register = on => {
  on('ui.focus', { requestId: PANE }, async ($, e, next) => {
    const wasHeld = paneHeld
    const r = await next(e)
    if (e.origin.kind === 'person' && r.deny === undefined) paneClicks.focus(e.element, wasHeld, await $.clock.now())
    void checkTodoInView($)
    return r
  }).catch(($, e, next) => next(e))
  on('ui.press', { requestId: PANE }, async ($, e, next) => {
    if (paneClicks.isEcho(e.element, await $.clock.now())) return { element: e.element }
    return next(e)
  }).catch(($, e, next) => next(e))
  on('prompt.submit', async ($, e, next) => {
    const turn = await update($, turnAtom, t => t + 1)
    await notePrompt($, turn, e.text)
    await talkStep($, t => onPrompt(t, e.text))
    let context = e.context
    try {
      // First request of the session: the panel opens at the side, once only. It answers a user input, so the engine
      // places it at any width; if closed by hand it stays closed.
      if (!(await read($, openedAtom))) {
        await update($, openedAtom, () => true)
        void openPane($).catch(() => {})
      }
      const sel = (await read($, treeAtom))?.selected ?? ''
      if (sel !== '') {
        const s = await getSources($)
        if (await $.fs.exists(abs(s, sel))) context = [...(e.context ?? []), SELECTED + abs(s, sel)]
      }
    } catch {}
    return next(context === e.context ? e : { ...e, context })
  }).catch(($, e, next) => next(e))

  on('tool.call', async ($, e, next) => {
    const ev = e as unknown as ToolEvent
    let cwd = ''
    let existed: boolean | undefined
    try {
      cwd = await $.session.cwd()
      const target = typeof ev.file_path === 'string' ? ev.file_path : undefined
      if (ev.tool === 'Write' && target) existed = await $.fs.exists(resolve(cwd, target))
    } catch {}

    const ran = await next(e)

    try {
      // A failing Bash keeps its activities: grep with no match, diff with exit 1, a late step after `sed -i`.
      if (ran.deny !== undefined || (ran.isError === true && ev.tool !== 'Bash')) return ran
      // Tests passed or commit succeeded (exit 0): it celebrates at the end of the turn, even outside the vault.
      if (ev.tool === 'Bash' && ran.isError !== true && typeof ev.command === 'string' && WIN.test(ev.command)) await mascotStep($, { kind: 'win' })
      const [s, turn, at] = await Promise.all([getSources($), read($, turnAtom), $.clock.now()])
      let agent: string | undefined
      if (ev.agentId) agent = (await $.agent.list()).find(x => x.id === ev.agentId)?.type ?? 'subagent'
      const t = strings(s.lang)
      const acts = toActivities(ev, { sources: s, t, cwd: cwd || s.root, turn, at, existed, agent })
      // The mascot reads, writes or thinks (a call with no vault file, like a web search).
      await mascotStep($, { kind: 'tool', verb: acts.find(a => WRITES.has(a.verb))?.verb ?? acts[0]?.verb ?? 'shell' })
      if (acts.length === 0) return ran
      const feed = await update($, feedAtom, f => acts.reduce(pushActivity, f))
      $.ui.status(statusText(feed, turn))
      const writes = acts.filter(a => WRITES.has(a.verb))
      if (writes.length > 0 && ev.agentId === undefined) await talkStep($, talk => noteWrites(talk, writes, t))
      if (writes.length > 0) {
        await update($, writtenAtom, w => addWritten(w ?? {}, writes))
        // A handoff or a diary note that was written goes into the session record. In its own try: if it throws, the
        // rest (index, folders, Reading, settle) still runs.
        try {
          const rec = await read($, sessionAtom)
          if (rec != null && noteRecordWrites(rec, writes, at, s.roles) !== rec) await update($, sessionAtom, x => (x == null ? null : noteRecordWrites(x, writes, at, s.roles)))
        } catch {}
        dropIndex()
        // The touched folders (and the ones containing them) are measured again at the end of the turn; meanwhile the
        // previous value stays.
        markStale(writes.flatMap(a => (a.from !== undefined ? [a.path, a.from] : [a.path])))
        // Reading and the draft follow the written files at once (readingFlow.followWrites); tree, git, tabs and
        // Recap when the writes settle (settle.ts).
        const following = followWrites(readingDeps($), writes)
        const ofRole = writes.some(a => a.role !== undefined || a.fromRole !== undefined)
        // The profile or the Identity source changed: the language may have changed with it.
        const identity = s.roles['Identity']
        if (writes.some(a => a.path === 'CLAUDE.md' || (identity !== undefined && a.path === identity))) sources = null
        // Before `touched`: settling does not depend on it, and if that write throws the step is not lost.
        settleWrites(settleDeps($), writes, { snapshot: ofRole })
        if (ofRole) await update($, touchedAtom, list => addTouched(list, acts, t))
        await following
      }
    } catch {}
    return ran
  }).catch(($, e, next) => next(e))

  on('session.start', async ($, e, next) => {
    await $.command.register({ name: COMMAND, description: (await catalog($)).command.description })
    const ran = await next(e)
    dropIndex()
    resetQuery()
    resetMove()
    resetSettle()
    pastCache = null
    void startSessions($)
    void refresh($)
    void loadTab($)
    void initFiles($)
    void hello($)
    void loadFigure($)
    return ran
  }).catch(($, e, next) => next(e))

  // The start of a subagent: taken before next, which answers as soon as the subagent has started. Until the engine
  // gives the id it lives under a provisional key (tool_use_id and a number), then it is bound to the id; a denial or
  // an error from next removes it.
  on('agent.spawn', async ($, e, next) => {
    const key = `t:${e.tool_use_id}:${++spawnSeq}`
    try {
      const at = await $.clock.now()
      await update($, agentRunsAtom, m => startRun(m ?? {}, key, e.subagentType || 'subagent', at))
    } catch {}
    let r: Awaited<ReturnType<typeof next>>
    try {
      r = await next(e)
    } catch (err) {
      try { await update($, agentRunsAtom, m => dropRun(m ?? {}, key)) } catch {}
      throw err
    }
    try {
      const id = r.deny === undefined ? r.agentId : undefined
      await update($, agentRunsAtom, m => (id !== undefined ? bindRun(m ?? {}, key, id) : dropRun(m ?? {}, key)))
      if (r.deny === undefined) await mascotStep($, { kind: 'agentStart' })
      if (r.deny === undefined && (await read($, sessionAtom)) != null) await update($, sessionAtom, x => (x == null ? null : addSubagent(x)))
    } catch {}
    return r
  }).catch(($, e, next) => next(e))

  // The start of a main-loop turn (subagents do not raise turn.start): Jarvis is working.
  on('turn.start', async ($, e, next) => {
    // During the turn the Written list follows the key order: it starts from the most recent. It is reordered before
    // working becomes true, so the drawing never sees the old order (with working false the reorder is not visible).
    try {
      const w = (await read($, writtenAtom)) ?? {}
      if (!same(Object.keys(w), Object.keys(sortWritten(w)))) await update($, writtenAtom, x => sortWritten(x ?? {}))
    } catch {}
    try {
      await update($, workingAtom, () => true)
      const at = await $.clock.now()
      await update($, turnAtAtom, () => at)
      await mascotStep($, { kind: 'turnStart' })
      void checkTodoInView($)
    } catch {}
    return next(e)
  }).catch(($, e, next) => next(e))

  // The end of a turn. With an agentId it is the end of a subagent (the engine has no agent.* end event); without one
  // it is the main turn: the subagents the engine no longer lists as working have finished.
  on('turn.complete', async ($, e, next) => {
    const r = await next(e)
    try {
      const at = await $.clock.now()
      const id = e.agentId
      if (id !== undefined) {
        await update($, agentRunsAtom, m => endRun(m ?? {}, id, at))
        await mascotStep($, { kind: 'agentEnd' })
        return r
      }
      await update($, workingAtom, () => false)
      void checkTodoInView($)
      // The folders written during the turn are measured again now, once (Σ on and the Files tab in view).
      void measureDirs($)
      // If agent.list does not answer, none is closed (nobody knows who is alive), but the mascot finishes all the
      // same.
      try {
        if (Object.values((await read($, agentRunsAtom)) ?? {}).some(x => x.endAt === null)) {
          const live = new Set((await $.agent.list()).filter(a => LIVE.has(a.status)).map(a => a.id))
          await update($, agentRunsAtom, m => reconcileRuns(m ?? {}, live, at))
        }
      } catch {}
      // Finished runs that the log no longer shows. In its own try: an error here does not skip the mascot and the
      // Activity log.
      try {
        const runs = (await read($, agentRunsAtom)) ?? {}
        if (pruneRuns(runs) !== runs) await update($, agentRunsAtom, m => pruneRuns(m ?? {}))
      } catch {}
      await mascotStep($, { kind: 'turnEnd', failed: e.reason !== 'answer' })
      const win = (await read($, mascotAtom))?.win === true
      const cat = await catalog($)
      await talkStep($, talk => onTurnEnd(talk, { win, failed: e.reason !== 'answer', nowMs: at }, cat))
      // The end of the turn in the Activity log: the files written in the turn, the turn number and how long it
      // lasted since turn.start.
      const [feed, turn, turnAt] = await Promise.all([read($, feedAtom), read($, turnAtom), read($, turnAtAtom)])
      const end: TurnEnd = { at, reason: e.reason, files: turnFiles(feed ?? [], turn ?? 0), turn: turn ?? 0, ...(turnAt == null ? {} : { ms: at - turnAt }) }
      await update($, endsAtom, x => [...(x ?? []), end].slice(-MAX_ENDS))
      // The session record and the store. In its own try: a store that refuses does not touch the rest of the turn.
      try {
        const cur = await read($, sessionAtom)
        if (cur != null) {
          const [meta, written] = await Promise.all([cur.handoff === null ? null : handoffMetaOf($, cur.handoff.file), read($, writtenAtom)])
          await saveSession($, await update($, sessionAtom, x => (x == null ? null : endRecordTurn(x, at, written ?? {}, e.reason, meta))))
        }
      } catch {}
    } catch {}
    return r
  }).catch(($, e, next) => next(e))

  // The end of the session: the closing time in the record and the last write to the store, within the short time the
  // engine gives the whole chain (when it runs out the engine cuts the chain). A record without an id (the engine had
  // not given it at the prompt) takes the id of the session that is ending.
  on('session.end', async ($, e, next) => {
    try {
      const at = await $.clock.now()
      if ((await read($, sessionAtom)) != null) {
        await saveSession($, await update($, sessionAtom, x => (x == null ? null : closeRecord(x.id === '' ? { ...x, id: e.sessionId } : x, at))))
      }
    } catch {}
    pastCache = null
    return next(e)
  }).catch(($, e, next) => next(e))

  // A panel element stopped by the app: the mascot shakes. For the editor: Reading goes back to Text, the draft stays
  // in the state. The editor goes first: it is the one the user cannot use, and a slow or failed write by the mascot
  // must not keep it stuck in Edit.
  on('ui.fault', async ($, e, next) => {
    if (e.requestId === PANE && e.element === 'editor') await editorFault(readingDeps($))
    if (e.requestId === PANE) await mascotStep($, { kind: 'fault' })
    return next(e)
  }).catch(($, e, next) => next(e))

  // The editor (editor.tsx) posts the draft, cmd+s and cmd+v.
  on('ui.message', async ($, e, next) => {
    if (e.requestId !== PANE || e.element !== 'editor' || !e.data || typeof e.data !== 'object') return next(e)
    await editorMessage(readingDeps($), e.data as EditorPost)
    return {}
  }).catch(($, e, next) => next(e))

  on('command.run', { command: COMMAND }, async $ => {
    await refresh($)
    await openPane($)
    return { text: (await catalog($)).command.opened }
  }).catch(($, e, next) => next(e))

  // The panel closes (from the X, from a plugin or from the engine): ✦ Jarvis returns under the prompt.
  on('ui.close', async ($, e, next) => {
    const r = await next(e)
    try {
      if (e.id === PANE) {
        await update($, paneOpenAtom, () => false)
        // The draft in the atom with the editor's latest text.
        await syncDraft(readingDeps($))
      }
    } catch {}
    return r
  }).catch(($, e, next) => next(e))

  // With the panel closed, in the band above the prompt of the desktop app: a small mascot and ✦ Jarvis that reopens
  // it (the desktop does not draw the line under the prompt). Closed = flag false (ui.close) or the engine has not
  // placed it (closed by an unload); an error from panes() counts as closed. With a survey in the band, and on the
  // other surfaces, the engine handles it.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'desktop' || e.props.hasSurvey) return next(e)
    // First, whether the panel is open: then it is enough to read the turn state, which changes twice in a turn and so
    // lets us notice a panel removed by the app. The rest is read only when it really has to be drawn.
    if ((await read($, paneOpenAtom)) === true) {
      await read($, workingAtom)
      let isPlaced = false
      try { isPlaced = (await $.ui.panes()).some(p => p.id === PANE && p.isPlaced) } catch {}
      if (isPlaced) return next(e)
    }
    const [mascot, working, feed, runs, ends, figure, nowMs, t] = await Promise.all([read($, mascotAtom), read($, workingAtom), read($, feedAtom), read($, agentRunsAtom), read($, endsAtom), read($, figureAtom), $.clock.now(), catalog($)])
    return drawReopen($.ui.resolve(e), {
      mascot: shaped(IDLE, mascot),
      figure: figure ?? TERMINAL,
      t,
      nowMs,
      // During a turn, the last line of the log without the time.
      doing: working === true ? lastLine(activityLog(feed ?? [], runs ?? {}, ends ?? [], t)) : null,
      reopen: () => { void reopenPane($).catch(() => {}) },
    })
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    // The cockpit is drawn only in the desktop app; elsewhere (terminal, mobile, VS Code) a single line.
    if (e.surface !== 'desktop') return drawElsewhere($.ui.resolve(e), await catalog($))
    paneHeld = e.props.isFocused
    // The panel widens past WALK_MIN_COLUMNS: the walk in progress resumes in steps. Scheduled outside the draw, which
    // cannot write.
    const wasNarrow = isNarrow
    isNarrow = e.props.bodyColumns < WALK_MIN_COLUMNS
    if (wasNarrow && !isNarrow) $.clock.after(0, () => { void resumeMotion($) })
    // The keys of this draw count for clicks only once it has finished (clickthrough.ts).
    const drawing = paneClicks.draw($.ui.resolve(e))
    try {
      const tree = await drawCockpit($, drawing.el, e.props.bodyColumns)
      drawing.done()
      return tree
    } catch (err) {
      return await fault($, $.ui.resolve(e), errText(err))
    }
  }).catch(($, e, next) => {
    // `re-entry`: the hook did not run (the draw arose under one of its own calls); it is not a fault.
    if (next.error.kind === 're-entry') return next(e)
    return e.surface === 'desktop' ? fault($, $.ui.resolve(e), next.error.message ?? next.error.kind) : undefined
  })
}
