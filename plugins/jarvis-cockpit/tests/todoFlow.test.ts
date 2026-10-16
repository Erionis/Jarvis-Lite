import { test, expect } from 'claude-code/testing'
import type { Lang, TodoState } from '../types'
import { EMPTY_TODO, toggleItem } from '../hooks/todoModel'
import { strings } from '../hooks/i18n'
import { addTodo, cancelAdd, checkTodo, confirmTodo, loadTodo, openAdd, removeTodo, todoEntry, typeTodo, writeTodo, type TodoDeps } from '../hooks/todoFlow'
import { MEM_ROOT, flush, memCell, memClock, memFs, memSources } from './ports'
import { itemAt } from './todoModel.test'

const PATH = `${MEM_ROOT}/To Do.md`

// The To Do tab with fake ports: the file in memory, the atom in memory, `wrote` as a counter.
export function todoWorld(text: string, opts: Parameters<typeof memFs>[1] = {}, lang: Lang = 'it') {
  const files = memFs({ [PATH]: text }, opts)
  const todo = memCell<TodoState>(EMPTY_TODO)
  const clock = memClock()
  const wrote: string[] = []
  const deps: TodoDeps = { fs: files.fs, clock, sources: memSources({ 'Future work': 'To Do.md' }, lang), todo, wrote: async rel => { wrote.push(rel) } }
  return { files, todo, clock, wrote, deps }
}

test('todoFlow: the tab reads the file through the ports; an identical re-read does not write the atom', async () => {
  const w = todoWorld('- [ ] uno\n')
  await loadTodo(w.deps)
  expect(w.todo.value).toMatchObject({ path: 'To Do.md', text: '- [ ] uno\n', note: null })
  const sets = w.todo.sets
  await loadTodo(w.deps)
  expect(w.todo.sets).toBe(sets)
})

test('todoFlow: a write goes through the file and then through wrote', async () => {
  const w = todoWorld('- [ ] uno\n')
  expect(await writeTodo(w.deps, t => t.replace('[ ]', '[x]'))).toBe(true)
  await flush()
  expect(w.files.text.get(PATH)).toBe('- [x] uno\n')
  expect(w.wrote).toEqual(['To Do.md'])
})

test('todoFlow: a file that is not UTF-8 → no write, and a note', async () => {
  const w = todoWorld('- [ ] caff\uFFFD\n')
  expect(await writeTodo(w.deps, t => t.replace('[ ]', '[x]'))).toBe(false)
  expect(w.files.writes).toEqual([])
  expect(w.todo.value.note).toBe('Il file non è UTF-8: modificalo fuori dal pannello')
})

test('todoFlow: the file changes between read and write → it is re-read and redone once', async () => {
  // Another chat writes at the second stat: the check right before writing.
  let other = (_p: string, _n: number): void => {}
  const w = todoWorld('- [ ] uno\n', { onStat: (p, n) => other(p, n) })
  other = (p, n) => { if (n === 2) w.files.touch(p, '- [ ] zero\n- [ ] uno\n') }
  expect(await writeTodo(w.deps, t => toggleItem(t, { line: 0, raw: '- [ ] uno' }))).toBe(true)
  expect(w.files.text.get(PATH)).toBe('- [ ] zero\n- [x] uno\n')
  expect(w.files.writes).toHaveLength(1)
})

test('todoFlow: the file changes again on the second attempt → no write, and a note', async () => {
  let other = (_p: string, _n: number): void => {}
  const w = todoWorld('- [ ] uno\n', { onStat: (p, n) => other(p, n) })
  other = (p, n) => { if (n === 2 || n === 4) w.files.touch(p, `- [ ] altro ${n}\n- [ ] uno\n`) }
  expect(await writeTodo(w.deps, t => toggleItem(t, { line: 0, raw: '- [ ] uno' }))).toBe(false)
  expect(w.files.writes).toEqual([])
  expect(w.todo.value.note).toBe(strings('it').todo.changed('To Do'))
})

test('todoFlow: «cancella?» on an item with a new indented line below → no write, the tab reloads and says so', async () => {
  const seen = '- [ ] uno\n  - dettaglio\n- [ ] due\n'
  const w = todoWorld(seen.replace('  - dettaglio\n', "  - dettaglio\n  - di un'altra chat\n"))
  await confirmTodo(w.deps, itemAt(seen, 0).key)
  await removeTodo(w.deps, itemAt(seen, 0))
  await flush()
  expect(w.files.writes).toEqual([])
  expect(w.todo.value).toMatchObject({ confirm: null, note: strings('it').todo.changed('To Do') })
  expect(w.todo.value.text).toContain("di un'altra chat")
})

test('todoFlow: checkTodo re-reads only if the file date or bytes changed', async () => {
  const w = todoWorld('- [ ] uno\n')
  await loadTodo(w.deps)
  const sets = w.todo.sets
  await checkTodo(w.deps)
  expect(w.todo.sets).toBe(sets)
  w.files.touch(PATH, '- [ ] uno\n- [ ] due\n')
  await checkTodo(w.deps)
  expect(w.todo.value.text).toBe('- [ ] uno\n- [ ] due\n')
})

const HEAD = { line: 0, raw: '### Jarvis' }

test('todoFlow: after an item is added successfully the field is empty', async () => {
  const w = todoWorld('### Jarvis\n- [ ] uno\n')
  await openAdd(w.deps, HEAD)
  typeTodo('due')
  await addTodo(w.deps, HEAD, 'due')
  expect(w.files.text.get(PATH)).toBe('### Jarvis\n- [ ] uno\n- [ ] due\n')
  expect(todoEntry()).toBe('')
  expect(w.todo.value.adding).toBe(null)
})

test('todoFlow: when adding an item fails, the text goes back into the field, which reopens on the heading', async () => {
  const w = todoWorld('### Jarvis\n- [ ] uno\n', { beforeWrite: () => { throw new Error('disco pieno') } })
  await openAdd(w.deps, HEAD)
  typeTodo('due')
  await addTodo(w.deps, HEAD, 'due')
  expect(w.files.writes).toEqual([])
  expect(todoEntry()).toBe('due')
  expect(w.todo.value.adding).toEqual(HEAD)
  typeTodo('')
})

test('todoFlow: when adding an item fails while the user has typed something else in the field, the new text is not replaced', async () => {
  const w = todoWorld('### Jarvis\n- [ ] uno\n', { beforeWrite: () => { typeTodo('testo nuovo'); throw new Error('disco pieno') } })
  await openAdd(w.deps, HEAD)
  typeTodo('due')
  await addTodo(w.deps, HEAD, 'due')
  expect(w.files.writes).toEqual([])
  expect(todoEntry()).toBe('testo nuovo')
  typeTodo('')
})

const OTHER = { line: 2, raw: '### Altro' }
const TWO = '### Jarvis\n- [ ] uno\n### Altro\n'

// The file is not written and, while the write fails, the user does `meanwhile` (opens a field, closes it).
function failingAdd(meanwhile: (w: ReturnType<typeof todoWorld>) => void) {
  const ref: { w: ReturnType<typeof todoWorld> | null } = { w: null }
  const w = todoWorld(TWO, { beforeWrite: () => { if (ref.w !== null) meanwhile(ref.w); throw new Error('disco pieno') } })
  ref.w = w
  return w
}

test('todoFlow: when adding an item fails while the user opens the field of another heading, the text does not go to that field', async () => {
  const w = failingAdd(x => { void openAdd(x.deps, OTHER) })
  await openAdd(w.deps, HEAD)
  typeTodo('due')
  await addTodo(w.deps, HEAD, 'due')
  expect(w.files.writes).toEqual([])
  expect(w.todo.value.adding).toEqual(OTHER)
  expect(todoEntry()).toBe('')
})

test('todoFlow: when adding an item fails while the user closes the field, it reopens on the heading with the text', async () => {
  const w = failingAdd(x => { void cancelAdd(x.deps) })
  await openAdd(w.deps, HEAD)
  typeTodo('due')
  await addTodo(w.deps, HEAD, 'due')
  expect(w.files.writes).toEqual([])
  expect(w.todo.value.adding).toEqual(HEAD)
  expect(todoEntry()).toBe('due')
  typeTodo('')
})

test('todoFlow: when adding an item fails while the user reopens the field of the same heading, the text goes back into it', async () => {
  const w = failingAdd(x => { void openAdd(x.deps, HEAD) })
  await openAdd(w.deps, HEAD)
  typeTodo('due')
  await addTodo(w.deps, HEAD, 'due')
  expect(w.files.writes).toEqual([])
  expect(w.todo.value.adding).toEqual(HEAD)
  expect(todoEntry()).toBe('due')
  typeTodo('')
})

// Every write of the atom redraws the pane: `drawn` has, for every write that lands (a Cell does not write an equal
// value, so it does not redraw), the field and the text that the draw finds. `before` does something right before
// the write that takes the field from closed to open.
function drawing(w: ReturnType<typeof todoWorld>, before: () => Promise<void> = async () => {}) {
  const drawn: string[] = []
  const raw = w.todo.set
  let armed = true
  w.todo.set = async fn => {
    const cur = await w.todo.get()
    // The updater is tried on a copy: it only serves to recognize the reopening.
    if (armed && cur.adding === null && fn({ ...cur }).adding !== null) {
      armed = false
      await before()
    }
    const sets = w.todo.sets
    const r = await raw(fn)
    if (w.todo.sets > sets) drawn.push(`${w.todo.value.adding?.raw ?? 'chiuso'}|${todoEntry()}`)
    return r
  }
  return drawn
}

test('todoFlow: when adding an item fails while the user reopens the field of the same heading, the field is redrawn with the text', async () => {
  const w = failingAdd(x => { void openAdd(x.deps, HEAD) })
  await openAdd(w.deps, HEAD)
  typeTodo('due')
  const drawn = drawing(w)
  await addTodo(w.deps, HEAD, 'due')
  expect(w.files.writes).toEqual([])
  expect(w.todo.value.adding).toEqual(HEAD)
  expect(todoEntry()).toBe('due')
  // The last write, that is the last draw, already finds the text in the open field.
  expect(drawn.at(-1)).toBe('### Jarvis|due')
  typeTodo('')
})

test('todoFlow: when adding an item fails after the user typed something else in the reopened field, it is neither closed nor touched', async () => {
  const w = failingAdd(x => { void openAdd(x.deps, HEAD); typeTodo('altro') })
  await openAdd(w.deps, HEAD)
  typeTodo('due')
  const drawn = drawing(w)
  await addTodo(w.deps, HEAD, 'due')
  expect(w.todo.value.adding).toEqual(HEAD)
  expect(todoEntry()).toBe('altro')
  // The field closed only once, when the item was submitted: no closing and reopening while the user types.
  expect(drawn.filter(x => x.startsWith('chiuso|'))).toHaveLength(1)
  typeTodo('')
})

test('todoFlow: when adding an item fails and the user opens the field of another heading just before the text comes back, the text does not reach it', async () => {
  const w = failingAdd(() => {})
  await openAdd(w.deps, HEAD)
  typeTodo('due')
  // The field is closed (submitting closed it) when the text is about to come back: at that point the user opens another heading's.
  drawing(w, () => openAdd(w.deps, OTHER))
  await addTodo(w.deps, HEAD, 'due')
  expect(w.files.writes).toEqual([])
  expect(w.todo.value.adding).toEqual(OTHER)
  expect(todoEntry()).toBe('')
})

// The notes the tab shows after a write that did not happen, in the vault's language.
test('todoFlow in English: the notes are English', async () => {
  const bad = todoWorld('- [ ] caff�\n', {}, 'en')
  expect(await writeTodo(bad.deps, t => t.replace('[ ]', '[x]'))).toBe(false)
  expect(bad.todo.value.note).toBe('The file is not UTF-8: edit it outside the panel')
  let other = (_p: string, _n: number): void => {}
  const busy = todoWorld('- [ ] one\n', { onStat: (p, n) => other(p, n) }, 'en')
  other = (p, n) => { if (n === 2 || n === 4) busy.files.touch(p, `- [ ] other ${n}\n- [ ] one\n`) }
  expect(await writeTodo(busy.deps, t => toggleItem(t, { line: 0, raw: '- [ ] one' }))).toBe(false)
  expect(busy.todo.value.note).toBe('To Do changed, I reloaded it')
  // A write that fails says why, in English.
  const full = todoWorld('- [ ] one\n', { beforeWrite: () => { throw new Error('disk full') } }, 'en')
  expect(await writeTodo(full.deps, t => t.replace('[ ]', '[x]'))).toBe(false)
  expect(full.todo.value.note).toMatch(/^Cannot write the file: .*disk full/)
})
