import { test, expect } from 'claude-code/testing'
import type { Mascot, MascotState } from '../hooks/mascot'
import type { Figure } from '../types'
import { strings } from '../hooks/i18n'
import { INK, STAGE_PX, STAGE_W, TEAL, WAVE_MS, motionMs, robotAlt, robotSvg as robotOf, robotTitle, robotWidth, stageSvg as stageOf, wordmarkSvg } from '../hooks/stage'
import { TERMINAL } from '../hooks/terminalFigure'

const T = strings('it')

// The Terminal on the stage, as the cockpit draws it by default.
const robotAt = (m: Mascot, nowMs: number, talkAt: number | null = null): string => robotOf(TERMINAL, m, nowMs, T, talkAt)
const stageAt = (m: Mascot, nowMs: number, talkAt: number | null = null): string => stageOf(TERMINAL, m, nowMs, T, talkAt)
// At rest: every movement is over.
const robotSvg = (m: Mascot): string => robotAt(m, Infinity)
const stageSvg = (m: Mascot): string => stageAt(m, Infinity)

const STATES: MascotState[] = ['idle', 'sleep', 'thinking', 'reading', 'writing', 'agent', 'done', 'error']
const at = (state: MascotState, more: Partial<Mascot> = {}): Mascot => ({ state, since: 0, back: 'idle', ...more })

// Tags opened and closed in order, with no repeated attributes: enough to say the source is well-formed XML.
function isWellFormed(src: string): boolean {
  const stack: string[] = []
  for (const m of src.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    const [, close, name = '', attrs = '', self] = m
    const names = [...attrs.matchAll(/\s([a-zA-Z:-]+)=/g)].map(a => a[1])
    if (new Set(names).size !== names.length) return false
    if (self === '/') continue
    if (close === '/') { if (stack.pop() !== name) return false } else stack.push(name)
  }
  return stack.length === 0
}

test('stage: every pose and the stage are well-formed Svg, stable, under the limit and with the dark theme', () => {
  const seen = new Set<string>()
  for (const s of STATES) {
    // At rest and halfway through every move (walk, party, wave of the arm).
    const moving = at(s, { from: 0, win: true })
    for (const src of [stageSvg(at(s)), robotSvg(at(s)), stageAt(moving, 600, 400), robotAt(moving, 700, 600)]) {
      expect(isWellFormed(src)).toBe(true)
      expect(src.length).toBeLessThan(131072)
      expect(src).toContain(`.k{fill:${INK}}`)
      expect(src).toContain('@media (prefers-color-scheme: dark)')
      // The macOS "Reduce motion" shows the final pose at once.
      expect(src).toContain('@media (prefers-reduced-motion: reduce){.bd,.wk,.fa,.heart{transform:none!important}')
    }
    expect(stageSvg(at(s))).toBe(stageSvg(at(s)))
    seen.add(robotSvg(at(s)))
  }
  // Thinking, reading and writing are the same scene, "at work".
  expect(seen.size).toBe(STATES.length - 2)
  expect(stageSvg(at('idle'))).toContain(`width="${STAGE_W}" height="${STAGE_PX}"`)
  expect(robotWidth(18)).toBe(14)
})

test('stage: no Css or Smil animation, ever (an image does not move: the pane redraws the steps)', () => {
  for (const s of STATES) {
    for (const t of [0, 150, 600, 1500, Infinity]) {
      expect(stageAt(at(s, { from: 0, win: true }), t, 0)).not.toMatch(/animation|@keyframes|<animate|:hover/)
    }
  }
})

test('stage: how long each scene moves; after that the same image as at rest, before it not', () => {
  expect(motionMs(at('idle'))).toBe(0)
  expect(motionMs(at('reading', { from: 100 }))).toBe(0)
  expect(motionMs(at('thinking', { from: 0 }))).toBe(1200)
  expect(motionMs(at('done', { from: 100 }))).toBe(500)
  expect(motionMs(at('done', { from: 100, win: true }))).toBe(2100)
  expect(motionMs(at('error'))).toBe(1200)
  for (const m of [at('thinking', { from: 0 }), at('idle', { from: 100 }), at('done', { from: 100 }), at('done', { win: true }), at('error')]) {
    expect(stageAt(m, motionMs(m))).toBe(stageAt(m, Infinity))
    expect(stageAt(m, motionMs(m) * 0.3)).not.toBe(stageAt(m, Infinity))
  }
})

test('stage: the teal of the logo, the tooltip and the alt from the catalog', () => {
  const idle = robotSvg(at('idle'))
  expect(idle).toContain(`.t{fill:${TEAL}}`)
  expect(idle).toContain('<title>Jarvis in attesa</title>')
  expect(robotTitle(at('reading'), T)).toBe('Jarvis al lavoro')
  expect(robotAlt(at('sleep'), T)).toBe('Jarvis dorme')
  expect(robotTitle(at('done', { win: true }), T)).toMatch(/festeggia/)
  expect(robotTitle(at('reading'), strings('en'))).toBe('Jarvis at work')
  expect(robotAlt(at('sleep'), strings('en'))).toBe('Jarvis asleep')
})

test('stage: at work one pose only, whatever the tool', () => {
  const work = robotSvg(at('thinking'))
  expect(robotSvg(at('reading'))).toBe(work)
  expect(robotSvg(at('writing'))).toBe(work)
  expect(stageSvg(at('reading', { from: 100 }))).toBe(stageSvg(at('writing', { from: 100 })))
  expect(robotSvg(at('agent'))).not.toBe(work)
})

test('stage: party only with a successful test or commit, in teal and ink confetti; error shakes', () => {
  const party = robotAt(at('done', { win: true }), 700)
  expect(party).toContain('class="cf fx"')
  expect([...new Set([...party.matchAll(/class="cf fx"[^>]*fill="([^"]+)"/g)].map(m => m[1]))].sort()).toEqual([INK, TEAL].sort())
  expect(party).toMatch(/\.heart\{transform:scale\(1\.\d+\)\}/)
  expect(party).toContain('.bd{transform:translateY(-6px)}')
  // Once the party is over: no confetti, the body and the beat still.
  expect(robotSvg(at('done', { win: true }))).not.toMatch(/class="cf|\.heart\{transform:scale|\.bd\{transform:translate/)
  const done = robotAt(at('done'), 200)
  expect(done).not.toContain('class="cf')
  expect(done).toContain('.bd{transform:translateY(-6px)}')
  expect(robotAt(at('error'), 80)).toContain('.bd{transform:translateX(-1.4px)}')
  expect(robotSvg(at('error'))).not.toContain('.bd{transform')
})

test('stage: STAGE_W px wide; just after the scene changes it walks in px from where it was, in steps, then stands still at its spot', () => {
  // At the start of a turn: from the left (0) to the work spot, next to the lettering.
  const go = at('thinking', { from: 0 })
  expect(stageAt(go, 0)).toContain('.mv{transform:translateX(0px)}')
  expect(stageAt(go, 0)).not.toMatch(/x="[^"]*%"/)
  // Halfway there at half the stretch, with a foot up at every step.
  expect(stageAt(go, 600)).toContain('.mv{transform:translateX(64.59px)}')
  expect(stageAt(go, 150)).toContain('.wk{transform:translateY(-2px)}')
  expect(stageAt(go, 1200)).toContain('.mv{transform:translateX(129.17px)}')
  expect(stageAt(go, 1200)).not.toContain('.wk{transform')
  // "Reduce motion": arrived at once.
  expect(stageAt(go, 0)).toContain('.mv{transform:translateX(129.17px)!important}')
  // done stays where it was working, without walking; back to waiting it walks back.
  expect(stageAt(at('done', { from: 100 }), 0)).toContain('.mv{transform:translateX(129.17px)}')
  expect(stageAt(at('idle', { from: 100 }), 0)).toContain('.mv{transform:translateX(129.17px)}')
  expect(stageAt(at('idle', { from: 100 }), 1200)).toContain('.mv{transform:translateX(0px)}')
})

test('JARVIS lettering: the outlines of the logo, A and I in teal, without LITE, still', () => {
  const w = wordmarkSvg()
  expect([...w.source.matchAll(/<path class="(\w)"/g)].map(m => m[1]).join('')).toBe('ktkktk')
  expect(w.source).not.toContain('M728.588')
  expect(w.source).not.toMatch(/animation|<animate/)
  expect(isWellFormed(w.source)).toBe(true)
  expect(w).toMatchObject({ width: 101, height: 28 })
})

test('stage: it waves the raised arm three times only as it starts to talk, then the arm stays up', () => {
  const talk = stageAt(at('idle'), WAVE_MS / 12, 0)
  expect(talk).toContain('class="fa"')
  expect(talk).toContain('.fa{transform:rotate(-18deg)}')
  expect(isWellFormed(talk)).toBe(true)
  // The arm is inside the body group (it hops with it).
  expect(talk.indexOf('class="fa"')).toBeGreaterThan(talk.indexOf('class="bd"'))
  expect(talk.indexOf('class="fa"')).toBeLessThan(talk.indexOf('</svg></g>'))
  const later = stageAt(at('idle'), WAVE_MS, 0)
  expect(later).toContain('class="fa"')
  expect(later).toContain('.al{display:none}')
  expect(later).not.toContain('.fa{transform:rotate')
  expect(stageSvg(at('idle'))).not.toContain('class="fa"')
  expect(stageSvg(at('idle'))).not.toContain('.al{display:none}')
  expect(robotAt(at('idle'), 0, 0)).toContain('class="fa"')
})

// A custom figure: one art for every pose, a different viewBox, no waving arm.
const WIDE = { viewBox: '0 0 100 50', body: '<circle cx="50" cy="25" r="20"/>' }
const custom: Figure = { kind: 'custom', css: '', poses: { idle: WIDE, work: WIDE, agent: WIDE, done: WIDE, party: WIDE, sleep: WIDE, error: WIDE }, talk: null }

test('stage: any figure is nested in the robot box, bottom-centred, inside the hopping group', () => {
  const svg = robotOf(custom, { state: 'idle', since: 0, back: 'idle' }, Infinity, strings('en'))
  expect(svg).toContain('<g class="bd"><svg viewBox="0 0 100 50" width="66" height="82" preserveAspectRatio="xMidYMax meet" overflow="visible"><circle')
  expect(isWellFormed(svg)).toBe(true)
})

test('stage: a figure without a waving arm keeps its resting one while the mascot talks', () => {
  const talk = stageOf(custom, { state: 'idle', since: 0, back: 'idle' }, WAVE_MS / 12, strings('en'), 0)
  expect(talk).not.toContain('.al{display:none}')
  expect(talk).not.toContain('.fa{transform')
  expect(talk).not.toContain('class="fa"')
})
