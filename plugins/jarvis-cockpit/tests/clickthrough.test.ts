import { test, expect } from 'claude-code/testing'
import { clickthrough, ECHO_MS } from '../hooks/clickthrough'

type Props = { key?: string; onPress?: () => void; label?: string }
const fakeEl = () => ({ Button: (p: Props) => ({ type: 'Button', props: p }), Text: (p: unknown) => p })

test('clickthrough: a click that takes the keyboard presses the Button drawn with that key, once only', () => {
  const c = clickthrough()
  const hits: string[] = []
  const d = c.draw(fakeEl())
  d.el.Button({ key: 'tab-files', onPress: () => hits.push('files') })
  d.el.Button({ key: 'tab-reading', onPress: () => hits.push('reading') })
  d.done()
  // The pane already had the keyboard (Tab, arrows, or a click after the first): the engine handles it itself.
  expect(c.focus('tab-files', true, 1000)).toBe(false)
  expect(hits).toEqual([])
  // It did not: the click was only a focus, so the press happens here.
  expect(c.focus('tab-files', false, 1000)).toBe(true)
  expect(hits).toEqual(['files'])
  // A press on the same element right after is the echo of the same click; after ECHO_MS it is not.
  expect(c.isEcho('tab-files', 1000 + ECHO_MS - 1)).toBe(true)
  expect(c.isEcho('tab-reading', 1001)).toBe(false)
  expect(c.isEcho('tab-files', 1000 + ECHO_MS + 1)).toBe(false)
})

test('clickthrough: no element, an unknown key or a key from an old draw presses nothing', () => {
  const c = clickthrough()
  const hits: string[] = []
  const old = c.draw(fakeEl())
  old.el.Button({ key: 'old', onPress: () => hits.push('old') })
  old.done()
  // A new finished draw replaces the keys of the previous one.
  const cur = c.draw(fakeEl())
  cur.el.Button({ key: 'new', onPress: () => hits.push('new') })
  cur.done()
  expect(c.focus(undefined, false, 0)).toBe(false)
  expect(c.focus('old', false, 0)).toBe(false)
  expect(c.focus('search', false, 0)).toBe(false)
  expect(hits).toEqual([])
  expect(c.focus('new', false, 0)).toBe(true)
  expect(hits).toEqual(['new'])
})

test('clickthrough: a draw not yet finished does not remove the buttons of the one on screen', () => {
  const c = clickthrough()
  const hits: string[] = []
  const shown = c.draw(fakeEl())
  shown.el.Button({ key: 'mem-a', onPress: () => hits.push('a') })
  shown.done()
  // Giving the keyboard to the pane makes it redraw at once: the focus arrives while the new draw is still reading
  // the state and has drawn no Button yet (an earlier bug: two clicks every time).
  c.draw(fakeEl())
  expect(c.focus('mem-a', false, 0)).toBe(true)
  expect(hits).toEqual(['a'])
  // Two overlapping draws that finish in reverse order: the one started last wins.
  const older = c.draw(fakeEl())
  const newer = c.draw(fakeEl())
  newer.el.Button({ key: 'mem-b', onPress: () => hits.push('b') })
  newer.done()
  older.el.Button({ key: 'mem-old', onPress: () => hits.push('old') })
  older.done()
  expect(c.focus('mem-old', false, 0)).toBe(false)
  expect(c.focus('mem-b', false, 0)).toBe(true)
  expect(hits).toEqual(['a', 'b'])
})
