import { test, expect } from 'claude-code/testing'
import type { Mascot, MascotState } from '../types'
import { stageSvg, robotSvg, WAVE_MS } from '../hooks/stage'
import { TERMINAL } from '../hooks/terminalFigure'
import { strings } from '../hooks/i18n'

const T = strings('en')
const at = (state: MascotState, more: Partial<Mascot> = {}): Mascot => ({ state, since: 0, back: 'idle', ...more })
const STATES: MascotState[] = ['idle', 'sleep', 'thinking', 'reading', 'writing', 'agent', 'done', 'error']

test('terminal: happy face at rest, prompt face at work, mini screen with a subagent', () => {
  expect(robotSvg(TERMINAL, at('idle'), Infinity, T)).toContain('M20 29l5-5 5 5M36 29l5-5 5 5')
  expect(robotSvg(TERMINAL, at('thinking'), Infinity, T)).toContain('M20 21l6 5-6 5M30 32h12')
  expect(robotSvg(TERMINAL, at('agent'), Infinity, T)).toContain('x="52" y="67" width="13" height="10"')
})

test('terminal: every pose and the waving arm share one viewBox, with 6 to spare on the left for the waves', () => {
  // The outer wave, with its stroke, reaches about x = -5.5.
  expect([...new Set([...Object.values(TERMINAL.poses), TERMINAL.talk].map(a => a?.viewBox))]).toEqual(['-6 0 72 82'])
})

test('terminal: the subagent mini screen stays inside the viewBox (right edge 66, bottom 82)', () => {
  const mini = robotSvg(TERMINAL, at('agent'), Infinity, T).match(/<rect class="ks" x="(\d+)" y="(\d+)" width="(\d+)" height="(\d+)"/)
  expect(mini).not.toBe(null)
  const [x = 0, y = 0, w = 0, hgt = 0] = (mini ?? []).slice(1).map(Number)
  expect(x + w).toBeLessThanOrEqual(66)
  expect(y + hgt).toBeLessThanOrEqual(82)
})

test('terminal: party has the big happy face and both arms up; error has grey crossed eyes; sleep has its z', () => {
  const party = robotSvg(TERMINAL, at('done', { win: true }), Infinity, T)
  expect(party).toContain('M19 30l6-7 6 7M35 30l6-7 6 7')
  expect(party).toContain('M48 53q9-3 11-13')
  expect(robotSvg(TERMINAL, at('error'), Infinity, T)).toContain('stroke="#9a9a9a" d="M21 21l7 7M28 21l-7 7M38 21l7 7M45 21l-7 7"')
  expect(robotSvg(TERMINAL, at('sleep'), Infinity, T)).toContain('>z</text>')
})

// The only colours the mascot draws: the ink and the teal of the logo, in light and dark, and a grey. No red.
const PALETTE = new Set(['#1a171b', '#ecebe6', '#007373', '#3fb7b0', '#9a9a9a'])
const colours = (svg: string): string[] => [...new Set(svg.toLowerCase().match(/#[0-9a-f]{3,8}\b/g) ?? [])]

test('terminal: only the logo colours and the grey, in every pose and on the stage', () => {
  for (const s of STATES) {
    expect(colours(stageSvg(TERMINAL, at(s, { win: true }), 300, T)).filter(c => !PALETTE.has(c))).toEqual([])
    expect(colours(robotSvg(TERMINAL, at(s), Infinity, T)).filter(c => !PALETTE.has(c))).toEqual([])
  }
  // The palette check sees colours at all.
  expect(colours(robotSvg(TERMINAL, at('error'), Infinity, T))).toContain('#9a9a9a')
})

test('stage: while talking the resting left arm hides and the raised arm waves from the shoulder', () => {
  const talk = stageSvg(TERMINAL, at('idle'), WAVE_MS / 12, T, 0)
  expect(talk).toContain('.al{display:none}')
  expect(talk).toContain('.fa{transform:rotate(-18deg)}')
  expect(talk).toContain('.fa{transform-origin:18px 53px}')
  expect(talk.indexOf('class="fa"')).toBeGreaterThan(talk.indexOf('class="bd"'))
  expect(stageSvg(TERMINAL, at('idle'), Infinity, T)).not.toContain('class="fa"')
})

test('stage: the tooltip comes from the catalog of the language', () => {
  expect(robotSvg(TERMINAL, at('idle'), Infinity, T)).toContain(`<title>${T.mascot.title.idle}</title>`)
  expect(robotSvg(TERMINAL, at('idle'), Infinity, strings('it'))).toContain(`<title>${strings('it').mascot.title.idle}</title>`)
})
