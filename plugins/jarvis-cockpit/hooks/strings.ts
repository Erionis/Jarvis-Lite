import type { Activity, MascotState, MemoryGroup } from '../types'
import type { Refusal } from './customFigure'
import type { IconName } from './icons'

// Every text the cockpit draws, in one typed catalog for each language (strings.en.ts, strings.it.ts).
// Texts with numbers or names are functions, so each language handles its own plurals and order.
export type DateWords = {
  // Short and long day names, Sunday first; short and long month names, January first.
  days: readonly string[]
  daysLong: readonly string[]
  months: readonly string[]
  monthsLong: readonly string[]
  today: string
  yesterday: string
  // How long ago something is, in days: `age` for an age ("today", "yesterday", "12d"), `daysAgo` for a day
  // past (two or more days: "4d ago").
  age: (days: number) => string
  daysAgo: (days: number) => string
  // The age of a file in the Files column and the meta line: days ("3d") and months ("2mo").
  shortDays: (days: number) => string
  shortMonths: (months: number) => string
}

// The sources the Recap names when one is declared but the file is missing (the keys of the capability table).
export type SourceRole = 'Identity' | 'Durable memory' | 'Future work' | 'Daily history'

export interface Strings {
  dates: DateWords
  // Tab labels; the To Do tab takes the Future work file's name when one is declared.
  tabs: { recap: string; diary: string; files: string; reading: string; readingDraft: string; todo: string; memories: string }
  mascot: {
    // What the mascot says to someone who cannot see it, for each state; the stage's tooltip for each pose.
    alt: Readonly<Record<MascotState, string>>
    title: { idle: string; sleep: string; work: string; agent: string; done: string; party: string; error: string }
  }
  // The /jarvis command: its description, and the reply once the cockpit is open.
  command: { description: string; opened: string }
  // The notice for a mascot file the cockpit ignores (hooks/customFigure.ts).
  figure: { refused: (file: string, reason: Refusal) => string }
  // Short role names in the activity log.
  roles: { identity: string; memory: string; futureWork: string; diary: string; handoff: string; inbox: string }
  // The Recap tab: the Sources card, the Opening face (Today, Last session, Next step) and the Session face
  // (This session, Now, What happened, Written, the footer).
  recap: {
    loading: string
    sources: {
      title: string
      noTable: string
      // The name of each source in the "declared but missing" line; any other source is shown as the user wrote it.
      names: Readonly<Record<SourceRole, string>>
      missing: (name: string) => string
    }
    today: {
      title: string
      // The long date on the card ("Friday 9 October"): Italian writes it lowercase, English keeps the capitals.
      date: (day: string) => string
      none: string
      waitingSince: (age: string) => string
      noNow: string
      inNow: (count: number, section: string) => string
      waiting: (count: number) => string
      // `oldest`: the age of the oldest note, when it is known.
      inbox: (count: number, oldest: string | null) => string
    }
    last: {
      title: string
      fromDiary: string
      diaryButton: string
      unsaved: string
      notInDiary: string
      resumeThis: string
      before: (topic: string, closing: string) => string
    }
    next: { title: string; nothing: string; resume: string; briefing: string; others: string; backToWork: string }
    work: {
      title: string
      since: (time: string) => string
      logTitle: string
      logAlt: (rows: number) => string
      logLess: string
      logMore: (rows: number) => string
      writtenTitle: string
      writtenLess: string
      saved: (time: string) => string
      save: string
      handoff: string
      seeOpen: string
    }
    // The Now card: what Jarvis is doing, or how the last turn ended. `time`: HH:MM; `span`: the length of a turn.
    now: {
      title: string
      working: string
      workingSince: (time: string) => string
      waiting: string
      thinking: string
      agentRunning: (type: string, time: string) => string
      lastDone: (time: string, span: string | null) => string
      lastStopped: (time: string) => string
      lastFailed: (time: string) => string
    }
    // The activity log. The verbs sit in a column of 8 characters in the drawing (lettering.ts): at most 7 each.
    activity: {
      verbs: Readonly<Record<Activity['verb'], string>>
      review: string
      context: (counts: string) => string
      files: (count: number) => string
      searches: (count: number) => string
      running: string
      // How a turn ended: "✓ done in 3m10 · 2 files". The first word is the glyph, the log draws it apart.
      end: (kind: 'answer' | 'aborted' | 'error', span: string | null, files: number) => string
    }
  }
  // The texts of a session (sessionModel.ts): the facts, the closing and the prompts the buttons prepare.
  session: {
    untitled: string
    filesWritten: (count: number) => string
    handoff: { completed: string; superseded: string; open: string }
    turns: (count: number) => string
    subagents: (count: number) => string
    errors: (count: number) => string
    savedInDiary: string
    // "Let's resume the session from yesterday 09:40–14:28: "topic". Files written: a.md, b.md and 7 more".
    // `resumeOf` (sessionModel.ts) recognizes the start of each language's prompt: keep them in step.
    resumeSession: (when: string, topic: string, files: readonly string[], more: number) => string
    resumeNow: (title: string, detail: string) => string
    // The source of the Next step, with the lateness of an item that is due.
    sourceHandoff: (age: string) => string
    sourceSection: (section: string) => string
    sourceLate: (section: string, late: string) => string
    late: (days: number) => string
  }
  // The Diary tab. `parts`: the name of each section of a note.
  diary: {
    empty: string
    loading: string
    tooBig: string
    openInReading: string
    readNote: (path: string, error: string) => string
    readDiary: (error: string) => string
    // The names of the Diary sections; the interface is ready, no view reads it yet.
    parts: Readonly<Record<'focus' | 'done' | 'decisions' | 'closing', string>>
  }
  // The To Do tab (todo.tsx, todoFlow.ts); `name` is what a technical file name (todo, tasks) is called.
  todo: {
    name: string
    confirmDelete: string
    add: string
    cancel: string
    enterToAdd: string
    newItemIn: (section: string) => string
    loading: string
    unreadable: (file: string, error: string) => string
    tooBig: (name: string) => string
    openInReading: string
    notAdded: string
    discard: string
    editFile: string
    // The notes the tab shows after a write that did not happen.
    changed: (name: string) => string
    cannotWrite: (error: string) => string
    notUtf8: string
  }
  // The Memories tab (memoriesView.tsx, memgraph.ts); a group or freshness value this version does not know is not drawn.
  memories: {
    groups: Readonly<Record<MemoryGroup, string>>
    fresh: Readonly<Record<'new' | 'changed', string>>
    // The name of the tab, for the way back from a memory to the list.
    title: string
    loading: string
    // `dir`: the memories folder, null while it is not known.
    unreadable: (dir: string | null, error: string) => string
    none: (dir: string | null) => string
    footer: string
    // The count on a group card: "4" or "4 · 1 new".
    count: (total: number, fresh: number) => string
    more: (hidden: number) => string
    less: string
    openInReading: string
    askChange: string
    linked: string
    map: string
    // What the map says to someone who cannot see it.
    mapAlt: (name: string, links: number) => string
    // The prompt the "ask for a change" button prepares; the rest is written by the user.
    askPrompt: (name: string) => string
  }
  // The Files tab (files.tsx, fileops.ts, icons.ts, sizes.ts).
  files: {
    openInApp: string
    copyPath: string
    filter: string
    noSelection: string
    unreadableTitle: string
    unreadable: (error: string) => string
    noMatch: (query: string) => string
    moreRows: (hidden: number) => string
    writtenByJarvis: (time: string) => string
    modifiedAt: (time: string) => string
    modifiedAgo: (age: string) => string
    // The decimal mark of a size ("6,1 MB" or "6.1 MB").
    decimalMark: string
    trashAsk: string
    trashYes: string
    cancel: string
    moveHint: string
    move: string
    duplicate: string
    trash: string
    // The end of a copy's name before the extension: " copy", then " copy 2" (`n` starts at 1).
    copySuffix: (n: number) => string
    // What each file icon says to someone who cannot see it.
    icons: Readonly<Record<IconName, string>>
  }
  // The Reading tab (readingView.tsx, reader.ts, readingFlow.ts).
  reading: {
    modes: { text: string; diff: string; edit: string }
    // The line beside the modes when Edit is off; `why` is one of `blocked`.
    editOff: (why: string) => string
    blocked: { protected: string; notMarkdown: string; tooBig: string; notRead: string; notUtf8: string; mixedEol: string }
    updatedNow: string
    modifiedByJarvis: (time: string) => string
    tooLong: string
    loading: string
    notText: string
    unreadable: (error: string) => string
    noFile: string
    pickFile: string
    diff: {
      loading: string
      untracked: string
      none: string
      error: string
      uncommitted: string
      // `when`: the day and time of the commit.
      lastCommit: (when: string, subject: string) => string
      noDifference: string
      cut: string
      // The two sides of the diff the conflict card shows.
      onDisk: string
      draft: string
    }
    conflict: { jarvis: string; disk: string; keep: string; overwrite: string; reload: string; showDiff: string; hideDiff: string; diffCut: string }
    pending: { title: (name: string) => string; hint: string; save: string; discard: string; back: string }
    edit: { notSaved: string; unsaved: string; saved: string; confirmDiscard: string; cancel: string; save: string }
    // What the draft says when a save is refused.
    protectedError: string
    outsideError: string
    cannotWrite: (error: string) => string
    notUtf8: string
  }
  // The labels the activity log gives to the profile (CLAUDE.md, AGENTS.md) and to Jarvis Lite's managed core.
  log: { profile: string; core: string }
  // The panel outside the desktop app, and the card for a drawing that failed.
  pane: { elsewhere: string; faultTitle: string; faultReload: string }
  // The notices ($.ui.toast) of the Files, Reading and prompt buttons.
  toasts: {
    promptNotEmpty: string
    copied: (path: string) => string
    cannotCopy: string
    linkNowhere: string
    linkOutside: string
    outsideVault: string
    protectedFile: (name: string) => string
    saveFirst: string
    cannotTrash: (error: string) => string
    trashed: (name: string) => string
    moveWhere: string
    onlyInVault: string
    alreadyThere: string
    notThere: (rel: string) => string
    exists: (rel: string) => string
    cannotCreate: (dir: string, error: string) => string
    cannotMove: (error: string) => string
    moved: (rel: string) => string
    cannotDuplicate: (error: string) => string
    created: (name: string) => string
    // A command that exits with an error and says nothing.
    commandFailed: (command: string, code: number) => string
    cannotOpenPane: string
    paneUnavailable: string
    fileNotFound: (rel: string) => string
    cannotReread: (name: string) => string
    goneFromVault: string
    saved: string
    cannotSave: string
    savedStale: string
    pasteUnavailable: string
    editorStopped: string
  }
  // The status under the lettering, and the label beside the button that reopens a closed panel.
  header: { working: string; workingSince: (time: string) => string; waiting: string; reopen: string }
  // What the mascot says: the phrases, the labels of its buttons and the lists the cheers rotate through.
  bubble: {
    // `first`: the first name, empty when there is none.
    hello: (first: string) => string
    setup: (hello: string) => string
    setupAction: string
    memory: string
    memoryAction: string
    handoff: string
    handoffAction: string
    save: string
    saveAction: string
    wins: readonly string[]
    saved: readonly string[]
  }
}
