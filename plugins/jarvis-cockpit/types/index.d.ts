export type Verb = 'read' | 'search' | 'edit' | 'create' | 'move' | 'delete' | 'shell'

// The mascot states (hooks/mascot.ts). `since`: when the state began; `back`: where `done` and `error` return after
// TRANSIENT_MS. `sleep`: reached after waiting SLEEP_MS.
export type MascotState = 'idle' | 'sleep' | 'thinking' | 'reading' | 'writing' | 'agent' | 'done' | 'error'
export type Mascot = {
  state: MascotState
  since: number
  back: MascotState
  // Where it stood on the stage before this scene (0-100): the walk starts from there.
  from?: number
  // A test or commit that succeeded in the turn: the end of the turn becomes a party.
  win?: boolean
}

// A mascot figure: the drawing the stage (hooks/stage.ts) moves around. One pose for each scene (`Pose`), each an
// art with its own viewBox, plus an optional waving arm drawn over the body while the mascot talks. `css` is the
// figure's own style, added after the stage's theme; `kind` tells the built-in Terminal from a custom one.
// The stage's class contract, all optional: `al` is hidden while the mascot talks (the resting arm the wave
// replaces); `fa` is turned while it talks (the figure sets its transform-origin in `css`); `heart` beats at the party.
export type Pose = 'idle' | 'sleep' | 'work' | 'agent' | 'done' | 'party' | 'error'
export type FigureArt = { viewBox: string; body: string }
export type Figure = { kind: 'terminal' | 'custom'; css: string; poses: Record<Pose, FigureArt>; talk: FigureArt | null }

// The mascot's steps while it moves (hooks/register.tsx).
export type Motion = { until: number; at: number; isRunning: boolean }

// The end of a main-loop turn, for the Activity log: how it ended, how many files it wrote, the turn number and how
// long it lasted (from the start of the turn); turn and ms are missing from the ends recorded by older versions.
export type TurnEnd = { at: number; reason: string; files: number; turn?: number; ms?: number }
// A submitted prompt: the turn number, the time and the text on one line (up to 160 characters).
export type TurnPrompt = { turn: number; at: number; text: string }
// The face of the Recap: 'auto' follows the moment (Opening before the first prompt, Session after); 'open' is the
// choice made with the button that shows the Opening face, until the next prompt.
export type RecapFace = 'auto' | 'open'

// A session in the cockpit's registry ($.store, key `session:<id>`): from when to when, about what, what it wrote and
// whether it saved the diary.
export type SessionRecord = {
  v: 1
  id: string
  // The time of the first prompt.
  startAt: number
  // The last turn end (the first prompt until a turn ends).
  lastAt: number
  // session.end; null while the session is open (or if it ended without saying so).
  endAt: number | null
  prompts: number
  // The first prompt on one line, up to 160 characters.
  firstPrompt: string
  // The topic being resumed, if the first prompt was a resume text from the cockpit.
  resumeOf: string | null
  // Files written, paths relative to the root, the most recent first (at most 20), and how many in all.
  files: string[]
  fileCount: number
  // The last handoff written: path relative to the root, topic and status read at the end of the turn.
  handoff: { file: string; topic: string; status: string } | null
  // The ISO day of the last diary note written in the session and the time of that write.
  diaryDay: string | null
  diaryAt: number | null
  subagents: number
  // Main turns that ended with neither 'answer' nor 'aborted'.
  errors: number
}

// The panel tabs. 'diary' exists only if "Daily history" is declared, 'todo' (To Do) only if "Future work"
// is, 'memories' only if "Durable memory" is.
export type Tab = 'recap' | 'diary' | 'files' | 'reading' | 'todo' | 'memories'

// The interface language, deduced from the vault and never asked (hooks/i18n.ts).
export type Lang = 'it' | 'en'

// The group of a memory: from the frontmatter `type`, or from the prefix of the file name.
export type MemoryGroup = 'people' | 'projects' | 'preferences' | 'references' | 'other'

// A memory in the folder (hooks/memories.ts): the file in the folder, name and description from the frontmatter, the
// linked memories (file names, in both directions, each once), new or changed in the last 7 days.
export type Memory = {
  file: string
  name: string
  description: string
  group: MemoryGroup
  links: string[]
  fresh: 'new' | 'changed' | null
}

// The Memories tab (hooks/memoriesView.tsx): the memories read, the open one, the "← back" stack and the groups
// opened in full.
export type MemoriesState = {
  // Relative folder; null until the tab has read it.
  dir: string | null
  list: Memory[] | null
  error: string | null
  // File of the open memory; null: the list.
  open: string | null
  // The memories the view was reached from, the last one at the end.
  back: string[]
  // Groups opened in full with the "N more ›" button.
  expanded: MemoryGroup[]
}

// The To Do tab (hooks/todoModel.ts): the file of the "Future work" source as read, the item waiting for the
// second click to be deleted, the add in progress and the last notice.
export type TodoState = {
  // Relative path of the source; null until the tab has read it.
  path: string | null
  text: string | null
  mtimeMs: number
  // Bytes of the file at read time, with the date: they tell whether the file has changed. null: unknown.
  size: number | null
  isTooBig: boolean
  error: string | null
  // Key of the item showing the delete confirmation in place of ✕ (the first click): text and copy number; null if
  // none.
  confirm: string | null
  // The title of the section whose add field is open, as it was when it opened; null if none. The text typed in the
  // field is not kept here: it is a variable in todoFlow.ts, so a keystroke does not redraw.
  adding: { line: number; raw: string } | null
  // File changed under the tab or write failed; null if there is nothing to say.
  note: string | null
}

// A vault source modified in this session, with how many writes it received.
export type Touched = { role: string; count: number; isProtected: boolean }

// A Waiting item: title and days since the line was last changed (null if unknown).
export type WaitingItem = { title: string; ageDays: number | null }

// A node of the vault tree: id is the path relative to the root ('' is the root).
// `size`: bytes of a file (0 for folders and links); `isLink`: symbolic link, a click follows it.
export type TreeNode = { id: string; parent: string; name: string; kind: 'dir' | 'file'; mtimeMs: number; size: number; isLink: boolean }

export type Tree = {
  nodes: TreeNode[]
  // Folders already read ('' included); the others are read when they are opened.
  loaded: string[]
  expanded: string[]
  // Folders that could not be read: they stay closed with ⚠.
  broken: string[]
  cursor: string
  selected: string
  query: string
  hits: string[]
  showHidden: boolean
  // Σ: size column in place of the age (also in $.store 'sizes').
  showSizes: boolean
  // The root cannot be read: the Files tab says so.
  error: string | null
}

// A trash or move in progress on the selected file, in the bar at the bottom of the Files tab: the trash confirmation,
// or the move field with the text typed so far.
export type FileOp = { kind: 'trash'; path: string } | { kind: 'move'; path: string; text: string }

// Git state of the vault: changed files (relative paths) and ignored paths (folders without a trailing `/`).
export type GitView = { changed: Record<string, 'new' | 'mod' | 'del'>; ignored: string[] }

// Uncommitted lines added and removed for each file (`git diff --numstat HEAD`).
export type Numstat = Record<string, { add: number; del: number }>

// The "last change" diff of a file, as the Reading tab shows it.
export type DiffView =
  | { kind: 'uncommitted'; text: string; isCut: boolean }
  | { kind: 'commit'; text: string; isCut: boolean; at: number; subject: string }
  | { kind: 'untracked' }
  | { kind: 'none' }
  | { kind: 'error' }

// The file open in the Reading tab.
export type Reading = {
  path: string | null
  // History of the links followed: `←` walks back through it before returning to the tree.
  back: string[]
  // Edit ('edit') opens only if the file is not protected and fits within the editor's props.
  mode: 'text' | 'diff' | 'edit'
  text: string | null
  mtimeMs: number
  // Bytes of the file at read time; null: unknown (a Reading opened by an older version).
  size: number | null
  isTooBig: boolean
  error: string | null
  // Last reload caused by a write from Jarvis.
  updatedAt: number | null
  diff: DiffView | null
}

// The draft of the Reading tab's editor: one at a time, it survives tab and file changes.
export type Draft = {
  path: string
  text: string
  // The text on disk at open or at the last save: the draft is dirty if it differs.
  base: string
  // The file's line ending: text and base use `\n`, saving puts '\r\n' back into a CRLF file.
  eol: '\n' | '\r\n'
  // The file's mtime at open or at the last save: if it changes, saving does not write.
  baseMtimeMs: number
  // The file's bytes at open or at the last save: if they change, saving does not write either.
  // null: unknown (a draft from an older version), only the date counts.
  baseSize: number | null
  row: number
  col: number
  // Generation of the text given to the editor: it grows when the mod replaces it (open, reload).
  gen: number
  // Cancel pressed once on a dirty draft: the second click discards.
  confirmDiscard: boolean
  // Why the last write failed; the draft stays.
  error: string | null
  // The file changed under the draft: found at save time (disk) or written by Jarvis (jarvis).
  // While it is set, saving does not write: the overwrite and reload buttons decide.
  conflict: 'disk' | 'jarvis' | null
  // The "show the diff" view: file on disk → draft, as a unified diff; null if hidden.
  conflictDiff: string | null
  // The diff shown was cut to fit the drawing: the card draws the note, not the diff.
  conflictDiffCut: boolean
  // Edit requested on this file while the (dirty) draft is on another one: the choice card.
  pendingOpen: string | null
}

export type Activity = {
  at: number
  verb: Verb
  path: string
  // For Bash it is the operand as written (even absolute or relative to the cwd): for display only.
  detail?: string
  // Move: the source relative to the vault; missing if it is outside the vault or excluded.
  from?: string
  role?: string
  fromRole?: string
  isProtected: boolean
  isApprox: boolean
  agent?: string
  count: number
  turn: number
}

export type Sources = {
  root: string
  roles: Record<string, string>
  hasTable: boolean
  // The language of the cockpit's own texts: from CLAUDE.md and the Identity source (detectLang).
  lang: Lang
  // CLAUDE.md carries the Jarvis Lite marker `<!-- jarvis:onboarding-required -->`: the first run is not done.
  isOnboarding?: boolean
}

// The mascot's bubble (hooks/bubble.ts).
export type BubbleKind = 'hello' | 'cheer' | 'save' | 'memory' | 'handoff' | 'setup'
export type Bubble = {
  id: number
  kind: BubbleKind
  text: string
  // The bubble's button: prepares a command in the prompt or opens a vault file in Reading.
  action?: { label: string; send?: string; open?: string }
  // The cheer phrases disappear by themselves at this time.
  until?: number
  // Only for the cheer phrases (the ones that are typed out): when it starts saying them, which can be in the future if
  // the phrase waits for the end of a walk. The text is typed and the arm waves from then on; before that the phrase is
  // not visible.
  at?: number
}
export type Talk = {
  bubble: Bubble | null
  // Memory or handoff written in the turn: they are announced at the end of the turn.
  pending: Bubble | null
  // The bubbles already said (the greeting and the reminder are not repeated).
  said: BubbleKind[]
  // Files written and turns since the last /save-session.
  writes: string[]
  turns: number
  seq: number
  // The turn in progress is a /save-session.
  isSaving: boolean
}

// A subagent started in the session: type, start, end (null while it is working or if the engine does not say).
export type AgentRun = { type: string; at: number; endAt: number | null }

// `next`: the next step (the first paragraph of Next action, up to 140 characters), if there is one; `state`: where
// things stand (the first paragraph of Current state, up to 220), if there is one.
export type Handoff = { file: string; topic: string; ageDays: number; next?: string; state?: string }

// A diary note in the Recap (hooks/diary.ts). A diary entry on one line: `lead` is the initial bold text, `rest` the
// remainder.
export type DiaryLine = { lead: string; rest: string }
// A section shown: the chosen lines and how many entries are left out ("+N").
export type DiaryPart = { part: 'focus' | 'done' | 'decisions' | 'closing'; lines: DiaryLine[]; more: number }
// A diary note as read: ISO day, path relative to the root, sections with entries.
export type DiaryDay = { day: string; path: string; parts: DiaryPart[] }

// A diary note: ISO day and path relative to the root.
export type DiaryNote = { day: string; path: string }
// The Diary tab (hooks/diaryView.tsx): the notes up to today, the one shown and its text as read.
export type DiaryState = {
  // Oldest first; null until the tab has looked for them (or if the folder cannot be read).
  notes: DiaryNote[] | null
  // The day of the note shown; null: no note.
  day: string | null
  text: string | null
  isTooBig: boolean
  error: string | null
}

export type Snapshot = {
  takenAt: number
  hasTable: boolean
  missing: string[]
  now: string[] | null
  // The name of the in-progress section as written in the file (Now, Active, In corso…); missing from older
  // snapshots.
  nowLabel?: string
  // Short title of each Now item, aligned by index (missing from older snapshots).
  nowTitles?: string[]
  // The detail of each Now item (the text after the short title, on one line), aligned by index (missing from older
  // snapshots).
  nowDetails?: string[]
  // ISO due date of each Now item, aligned by index; null if the item has no date.
  nowDue: (string | null)[]
  waiting: number
  // The Waiting items, the longest-unchanged first.
  waitingItems: WaitingItem[]
  handoffs: Handoff[]
  inbox: { count: number; oldestDays: number | null } | null
  diary: { hasToday: boolean; last: string | null } | null
  // The last diary note up to and including today with at least one section; null if there is none (missing from older
  // snapshots).
  lastDiary?: DiaryDay | null
  // The notes, as read, for the days on which the latest registry sessions saved (at most two).
  diaryDays?: DiaryDay[]
  // The past sessions of the registry (the plugin's store), most recent first; read before the snapshot.
  sessions?: SessionRecord[]
}

declare module 'claude-code' {
  interface PluginState {
    'jarvis-cockpit': {
      feed: Activity[]
      snapshot: Snapshot | null
      turn: number
      // Sources written in the session: they stay in the state (tracker, tests), the Recap does not show them.
      touched: Touched[]
      // Subagents started in the session: by id (or `t:<tool_use_id>:<n>` until the engine gives the id).
      agentRuns: Record<string, AgentRun>
      // The mascot: state, since when, where `done` and `error` return to.
      mascot: Mascot
      // The turn ends of the session (the last 50), for the Activity log.
      ends: TurnEnd[]
      // A main-loop turn in progress (turn.start → turn.complete): the cursor blinks.
      working: boolean
      // When the turn in progress began: the duration shown next to the tabs.
      turnAt: number | null
      // The panel is open: true when the mod opens it ($.ui.open), false on its ui.close.
      paneOpen: boolean
      // Active tab; it is remembered across sessions too ($.store 'tab').
      tab: Tab
      // The panel has already opened by itself in this session.
      opened: boolean
      // Tree of the Files tab: nodes read, open folders (also in $.store 'expanded'), selection, search.
      tree: Tree
      // Latest `git status` of the vault; null if git does not answer.
      git: GitView | null
      // Files written by Jarvis in this session: relative path → time of the last write.
      written: Record<string, number>
      // The Recap's Activity log open (all lines) instead of the last twelve.
      logOpen: boolean
      // The session's prompts, one for each turn (the last 50): the start of the turns in the log; from the first one
      // the Recap switches to the Session face.
      prompts: TurnPrompt[]
      // The record of the current session (the sessions registry): born at the first prompt, goes to the store when it
      // changes.
      session: SessionRecord | null
      recapView: RecapFace
      // Folder sizes from `du -sk` (bytes), for the session; null if `du` failed.
      sizes: Record<string, number | null>
      // Uncommitted changed lines for each file; null if git does not answer.
      numstat: Numstat | null
      reading: Reading
      draft: Draft | null
      fileOp: FileOp | null
      // The mascot's bubble and what is needed to decide when it speaks.
      talk: Talk
      // The mascot's steps (and those of the typed text): while it moves, every STEP_MS a write redraws the panel with
      // the image for that instant. `until`: when it ends; `at`: the last step; `isRunning`: the chain of steps is in
      // progress.
      motion: Motion
      // The To Do tab.
      todo: TodoState
      // The Memories tab.
      memories: MemoriesState
      // The Diary tab.
      diary: DiaryState
      // The mascot the stage draws: the Terminal, or the vault's own from `99 - Jarvis/mascot` (hooks/customFigure.ts).
      figure: Figure
      // The refused mascot files already reported in this session (`<file>:<reason>`), so each notice shows once.
      figureNotes: string[]
    }
  }
}
