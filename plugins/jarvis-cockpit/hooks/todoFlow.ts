import type { TodoState } from '../types'
import { classify, isEditable } from './classify'
import { flight, oneAtATime } from './flight'
import { strings } from './i18n'
import { changes, type Cell, type ClockPort, type FsPort, type SourcesPort } from './ports'
import { loadText, safeWrite } from './textfile'
import { isNotUtf8 } from './reader'
import { CONFIRM_MS, addItem, cleanEntry, deleteItem, todoLabel } from './todoModel'

// The To Do tab: rereading, checking, adding and deleting. The ports are given by register.tsx.
export type TodoDeps = {
  fs: FsPort
  clock: ClockPort
  sources: SourcesPort
  todo: Cell<TodoState>
  // After a write to the file: Reading and the draft follow it, then git, tree and Recap (register.tsx).
  wrote: (rel: string) => Promise<void>
}

const abs = (root: string, rel: string): string => `${root}/${rel}`

const todoFlight = flight()
// The tab's writes in a queue: each one rereads the file after the previous write, so two quick clicks
// do not overwrite each other. A failed write does not stop the queue.
let todoQueue: Promise<unknown> = Promise.resolve()
// The last confirmation asked: only its timer closes it again.
let confirmSeq = 0
// The text the user is typing in the add field: a key updates it without writing an atom, so without
// redrawing, and a redraw always carries the current text. A plugin reload resets it.
let entry = ''

export const todoEntry = (): string => entry
export function typeTodo(text: string): void {
  entry = text
}

type Head = { line: number; raw: string }

// The tab rereads the file; `note` is the notice to show (or none). One reload at a time.
export function loadTodo(d: TodoDeps, note: string | null = null): Promise<void> {
  return oneAtATime(todoFlight, () => readTodo(d, note))
}

async function readTodo(d: TodoDeps, note: string | null): Promise<void> {
  try {
    const s = await d.sources()
    const rel = s.roles['Future work']
    if (rel === undefined) return
    const loaded = await loadText(d.fs, abs(s.root, rel))
    const cur = await d.todo.get()
    // The confirmation and the add field stay: the item's key and the heading are found again in the new text.
    const next = { path: rel, ...loaded, note }
    if (changes(cur, next)) await d.todo.set(t => ({ ...t, ...next }))
  } catch {}
}

// Another chat may have written the file: if the date or bytes are not those of the read, the tab rereads.
// A vanished file (stat failed) rereads once, to say so.
export async function checkTodo(d: TodoDeps): Promise<void> {
  try {
    const t = await d.todo.get()
    if (t.path === null) return
    const s = await d.sources()
    const st = await d.fs.stat(abs(s.root, t.path)).catch(() => null)
    const changed = st === null ? t.error === null : st.mtimeMs !== t.mtimeMs || (t.size !== null && st.size !== t.size)
    if (changed) await loadTodo(d)
  } catch {}
}

// Check, add or delete, queued behind the previous writes. Returns true if it wrote.
export function writeTodo(d: TodoDeps, patch: (text: string) => string | null): Promise<boolean> {
  const run = todoQueue.then(() => patchTodo(d, patch))
  todoQueue = run.catch(() => false)
  return run
}

// Rereads the file just before, changes a single line and writes (textfile.ts). If the line is not found it does not write:
// it reloads and says so. If the file changes between the read and the write it is reread and done again once; if it changes
// again, it does not write and says so. Then `wrote`: Reading, draft, git and Recap follow. No "written by Jarvis" dot
// (ORANGE): the user wrote the file, not Jarvis.
async function patchTodo(d: TodoDeps, patch: (text: string) => string | null): Promise<boolean> {
  try {
    const s = await d.sources()
    const rel = s.roles['Future work']
    if (rel === undefined) return false
    const p = abs(s.root, rel)
    const t = strings(s.lang)
    if (!isEditable(classify(p, s, t), t)) return false
    for (let tries = 0; tries < 2; tries++) {
      const fresh = await loadText(d.fs, p)
      if (fresh.text !== null && isNotUtf8(fresh.text)) {
        await loadTodo(d, t.todo.notUtf8)
        return false
      }
      const next = fresh.text === null ? null : patch(fresh.text)
      if (fresh.text === null || next === null) break
      const w = await safeWrite(d.fs, p, next, { text: fresh.text, mtimeMs: fresh.mtimeMs, size: fresh.size })
      if (w.kind === 'changed') continue
      if (w.kind !== 'written') {
        await loadTodo(d, w.kind === 'failed' ? t.todo.cannotWrite(w.error) : t.todo.notUtf8)
        return false
      }
      await d.wrote(rel).catch(() => {})
      return true
    }
    await loadTodo(d, t.todo.changed(todoLabel(rel, t)))
  } catch {}
  return false
}

// The add button: the field opens on the heading (row and text). The text already typed stays, even that of an item
// not added because its heading is gone.
export async function openAdd(d: TodoDeps, head: Head): Promise<void> {
  try {
    await d.todo.set(t => ({ ...t, adding: { line: head.line, raw: head.raw } }))
  } catch {}
}

// The cancel button in the field and the discard button on the not-added card: the text goes away and the field closes.
export async function cancelAdd(d: TodoDeps): Promise<void> {
  entry = ''
  try {
    await d.todo.set(t => (t.adding === null ? t : { ...t, adding: null }))
  } catch {}
}

// Enter in the add field: adding is claimed inside the updater, so a second Enter before the
// redraw finds it already claimed and does not write; the field closes at once. If it does not write (heading gone,
// write failed) the field reopens on the heading with the text: if the heading no longer exists, the tab
// shows the not-added card. Empty does not write.
export async function addTodo(d: TodoDeps, head: Head, text: string): Promise<void> {
  try {
    const open = (await d.todo.get()).adding
    if (cleanEntry(text) === '' || open === null || open.raw !== head.raw) return
    let mine = false
    await d.todo.set(t => {
      mine = t.adding !== null && t.adding.raw === head.raw
      return mine ? { ...t, adding: null } : t
    })
    if (!mine) return
    entry = ''
    if (await writeTodo(d, md => addItem(md, head, text))) return
    await giveBack(d, head, text)
  } catch {}
}

// The add was not written: the text goes back to the field. It goes back only if the field is closed (and then it reopens) or
// is already reopened on this heading and empty, and only if there is no other text: if the user has typed something else in the meantime
// that stays, and if the user has opened the field of another heading the text does not belong to it. It is decided inside
// the updater, on the value that is really there (here we assign, not accumulate: it may run twice), and the text is
// in the field before the write lands, so the drawing that follows finds it.
async function giveBack(d: TodoDeps, head: Head, text: string): Promise<void> {
  // The field is already reopened on this heading and empty: a Cell does not write an equal value, and without a write
  // the field does not redraw with the text. It closes, and reopens below.
  await d.todo.set(t => (t.adding !== null && t.adding.raw === head.raw && entry === '' ? { ...t, adding: null } : t))
  let opened = false
  let given = false
  await d.todo.set(t => {
    opened = t.adding === null
    if (opened && entry === '') {
      entry = text
      given = true
    } else if (!opened && given && entry === text) {
      // An earlier run of the updater had given it, but the field has opened on another heading: the text does not reach it.
      entry = ''
      given = false
    }
    return opened ? { ...t, adding: { line: head.line, raw: head.raw } } : t
  })
}

// The first click on ✕: the item (by key) asks for confirmation; without the second click, after CONFIRM_MS it goes back to ✕.
export async function confirmTodo(d: TodoDeps, key: string): Promise<void> {
  try {
    const seq = ++confirmSeq
    await d.todo.set(t => ({ ...t, confirm: key }))
    d.clock.after(CONFIRM_MS, () => {
      if (seq === confirmSeq) void d.todo.set(t => (t.confirm === key ? { ...t, confirm: null } : t)).catch(() => {})
    })
  } catch {}
}

// The second click, on the confirmation: the item and its indented lines leave the file. It is claimed inside
// the updater like adding: another click before the redraw finds it already claimed and does not delete twice.
export async function removeTodo(d: TodoDeps, item: { line: number; raw: string; block: string; key: string }): Promise<void> {
  try {
    let mine = false
    await d.todo.set(t => {
      mine = t.confirm === item.key
      return mine ? { ...t, confirm: null } : t
    })
    if (mine) await writeTodo(d, md => deleteItem(md, item))
  } catch {}
}
