import { test, expect } from 'claude-code/testing'
import { MAX_UNDO, VIEW, follow, fromText, pointAt, reduce, toText, type Ed, type KeyEv } from '../hooks/edit'

// Applies a series of keys and returns the final state.
const keys = (ed: Ed, evs: readonly KeyEv[]): Ed => evs.reduce((e, ev) => reduce(e, ev).ed, ed)
const typed = (s: string): KeyEv[] => [...s].map(key => ({ key }))

test('edit: insertion, accents and a space in the middle of a line', () => {
  const ed = keys(fromText('ciao mondo', 0, 4), [...typed(' è'), { key: 'space' }])
  expect(toText(ed)).toBe('ciao è  mondo')
  expect([ed.row, ed.col]).toEqual([0, 7])
})

test('edit: special keys and cmd combinations do not type', () => {
  const ed = fromText('abc', 0, 1)
  for (const ev of [{ key: 'escape' }, { key: 'f1' }, { key: 'a', meta: true }, { key: 'a', ctrl: true }, { key: '\u0007' }] as KeyEv[]) {
    expect(reduce(ed, ev).act).toBe('none')
  }
  expect(reduce(ed, { key: 'A', shift: true }).ed.lines).toEqual(['aAbc'])
})

test('edit: return splits, backspace and delete join, tab inserts two spaces', () => {
  let ed = keys(fromText('primadopo', 0, 5), [{ key: 'return' }])
  expect(ed.lines).toEqual(['prima', 'dopo'])
  expect([ed.row, ed.col]).toEqual([1, 0])
  ed = keys(ed, [{ key: 'backspace' }])
  expect(ed.lines).toEqual(['primadopo'])
  expect([ed.row, ed.col]).toEqual([0, 5])
  ed = keys(fromText('a\nb', 0, 1), [{ key: 'delete' }])
  expect(ed.lines).toEqual(['ab'])
  ed = keys(fromText('x', 0, 0), [{ key: 'tab' }])
  expect([toText(ed), ed.col]).toEqual(['  x', 2])
  expect(reduce(fromText('x', 0, 0), { key: 'backspace' }).act).toBe('none')
})

test('edit: arrows, home/end, page up and down stay within bounds', () => {
  const text = Array.from({ length: 100 }, (_, i) => `riga ${i}`).join('\n')
  let ed = keys(fromText(text, 0, 3), [{ key: 'end' }])
  expect(ed.col).toBe(6)
  ed = keys(ed, [{ key: 'right' }])
  expect([ed.row, ed.col]).toEqual([1, 0])
  ed = keys(ed, [{ key: 'left' }, { key: 'home' }, { key: 'up' }])
  expect([ed.row, ed.col]).toEqual([0, 0])
  ed = keys(ed, [{ key: 'pagedown' }, { key: 'pagedown' }, { key: 'pagedown' }, { key: 'pagedown' }])
  expect(ed.row).toBe(99)
  ed = keys(ed, [{ key: 'pageup' }])
  expect(ed.row).toBe(99 - VIEW)
  expect(reduce(ed, { key: 'up' }).act).toBe('move')
})

test('edit: the window follows the cursor with a three-line margin', () => {
  expect(follow(0, 10, 100)).toBe(0)
  expect(follow(0, 25, 100)).toBe(1)
  expect(follow(50, 52, 100)).toBe(49)
  expect(follow(0, 99, 100)).toBe(100 - VIEW)
  expect(follow(5, 3, 10)).toBe(0)
})

test('edit: cmd+s saves and cmd+v pastes, neither changes the text', () => {
  const ed = fromText('a')
  expect(reduce(ed, { key: 's', meta: true }).act).toBe('save')
  expect(reduce(ed, { key: 's', ctrl: true }).act).toBe('save')
  const pasted = reduce(ed, { key: 'v', meta: true })
  expect(pasted.act).toBe('paste')
  expect(pasted.ed).toBe(ed)
})

test('edit: undo and redo; characters typed in a row are a single step', () => {
  let ed = keys(fromText(''), [...typed('ciao'), { key: 'return' }, ...typed('mondo')])
  expect(toText(ed)).toBe('ciao\nmondo')
  ed = keys(ed, [{ key: 'z', meta: true }])
  expect(toText(ed)).toBe('ciao\n')
  ed = keys(ed, [{ key: 'z', meta: true }])
  expect(toText(ed)).toBe('ciao')
  ed = keys(ed, [{ key: 'z', meta: true }])
  expect(toText(ed)).toBe('')
  expect(reduce(ed, { key: 'z', meta: true }).act).toBe('none')
  ed = keys(ed, [{ key: 'z', meta: true, shift: true }, { key: 'Z', meta: true, shift: true }])
  expect(toText(ed)).toBe('ciao\n')
  // A cursor move ends the step: the letters after it are a new step.
  ed = keys(fromText(''), [...typed('ab'), { key: 'left' }, ...typed('x'), { key: 'z', meta: true }])
  expect(toText(ed)).toBe('ab')
  // A new edit clears the redo history.
  ed = keys(ed, [...typed('q'), { key: 'z', meta: true, shift: true }])
  expect(toText(ed)).toBe('aqb')
})

test('edit: the history keeps at most 200 steps', () => {
  let ed = fromText('')
  for (let i = 0; i < MAX_UNDO + 20; i++) ed = keys(ed, [{ key: 'x' }, { key: 'left' }])
  expect(ed.undo.length).toBe(MAX_UNDO)
})

test('edit: a click puts the cursor on the line under the mouse, counting the wrapped rows of the cursor line', () => {
  const lines = ['# Titolo', 'x'.repeat(90), 'terza', 'quarta']
  // Cursor on the long line: at 50 columns it takes two screen rows (45 characters per row).
  const ed = fromText(lines.join('\n'), 1, 0)
  expect(pointAt(ed, 8, 0, 50)).toMatchObject({ row: 0, col: 3 })
  expect(pointAt(ed, 10, 2, 50)).toMatchObject({ row: 1, col: 50 })
  expect(pointAt(ed, 7, 3, 50)).toMatchObject({ row: 2, col: 2 })
  expect(pointAt(ed, 99, 4, 50)).toMatchObject({ row: 3, col: 6 })
  expect(pointAt(ed, 0, 40, 50)).toMatchObject({ row: 3 })
  expect(pointAt(ed, 0, -1, 50)).toMatchObject({ row: 0 })
})

test('edit: a typed emoji is deleted with a single backspace, column included', () => {
  const ed = keys(fromText('ab', 0, 1), typed('😀'))
  expect(toText(ed)).toBe('a😀b')
  expect(ed.col).toBe(3)
  const back = reduce(ed, { key: 'backspace' }).ed
  expect(toText(back)).toBe('ab')
  expect(back.col).toBe(1)
  // End of line: same effect, the pair goes away whole.
  const end = keys(fromText('x'), typed('😀'))
  expect(toText(reduce(end, { key: 'backspace' }).ed)).toBe('x')
})

test('edit: left and right arrows cross an emoji in one step', () => {
  let ed = fromText('a😀b', 0, 0)
  ed = keys(ed, [{ key: 'right' }])
  expect(ed.col).toBe(1)
  ed = keys(ed, [{ key: 'right' }])
  expect(ed.col).toBe(3)
  ed = keys(ed, [{ key: 'right' }])
  expect(ed.col).toBe(4)
  ed = keys(ed, [{ key: 'left' }])
  expect(ed.col).toBe(3)
  ed = keys(ed, [{ key: 'left' }])
  expect(ed.col).toBe(1)
  ed = keys(ed, [{ key: 'left' }])
  expect(ed.col).toBe(0)
})

test('edit: delete before an emoji removes it whole', () => {
  const ed = reduce(fromText('a😀b', 0, 1), { key: 'delete' }).ed
  expect(toText(ed)).toBe('ab')
  expect(ed.col).toBe(1)
})

test('edit: up or down onto a line with an emoji, the column lands at the start of the pair', () => {
  // Column 2 falls in the middle of 😀 in the line 'x😀y': it moves to 1.
  const down = reduce(fromText('abcd\nx😀y', 0, 2), { key: 'down' }).ed
  expect([down.row, down.col]).toEqual([1, 1])
  const up = reduce(fromText('x😀y\nabcd', 1, 2), { key: 'up' }).ed
  expect([up.row, up.col]).toEqual([0, 1])
})

test('edit: a click on the second half of an emoji goes to the start of the pair', () => {
  // Row 1, column 50: x=7 is column 2 of the text, in the middle of 😀.
  const ed = fromText('abcd\nx😀y', 0, 0)
  expect(pointAt(ed, 7, 1, 50)).toMatchObject({ row: 1, col: 1 })
})
