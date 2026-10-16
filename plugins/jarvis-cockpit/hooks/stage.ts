import type { Figure, FigureArt, Mascot, Pose } from '../types'
import { spot } from './mascot'
import type { Strings } from './strings'

// The stage: where the mascot lives, and everything about it that is not its drawing. The figure (a `Figure`,
// the Terminal by default, see terminalFigure.ts) supplies one drawing for each scene; the stage nests it in a
// 66×82 box and adds the theme, the moves (hop, beat, shake, step, wave), the walk, the confetti and the
// wordmark. Only plain Svg strings here; chrome.tsx and hint.tsx draw them.
//
// No frame: an isInteractive frame reloads, and flickers, at every redraw of the pane, even with the same
// source. So the mascot is always a still image
// computed for the instant: while it moves (walk, hop, party, shake, wave) register.tsx redraws the pane in
// small steps for as long as `motionMs` says, then stops. The drawing has one pose for each scene, not for each state
// (at work it is a single one, whatever the tool). The walk is a translateX in px on a stage of fixed width.

// Ink and teal of the logo; in the dark theme the ink lightens and the teal lights up.
export const INK = '#1A171B'
export const TEAL = '#007373'
const INK_DARK = '#ecebe6'
const TEAL_DARK = '#3fb7b0'

// The box of the figure: the body in 0..60, up to 66 on the right the room for a subagent's mini screen.
const VB_W = 66
const VB_H = 82
// The stage in the header (px): as wide as the stretch the mascot walks, next to the wordmark.
export const STAGE_W = 200
export const STAGE_PX = 96
export const BOT_H = 88
const BOT_TOP = 7
export const robotWidth = (height: number): number => Math.round((height * VB_W) / VB_H)
const BOT_W = (BOT_H * VB_W) / VB_H
// The walk: a little over a second, one step every 0.3 s.
const WALK_MS = 1200

const THEME = `.k{fill:${INK}}.ks{stroke:${INK}}.t{fill:${TEAL}}.ts{stroke:${TEAL}}`
  + `@media (prefers-color-scheme: dark){.k{fill:${INK_DARK}}.ks{stroke:${INK_DARK}}.t{fill:${TEAL_DARK}}.ts{stroke:${TEAL_DARK}}}`

// The one rule of what the stage draws itself: the confetti turn around their own centre.
const BASE = '.fx{transform-box:fill-box;transform-origin:50% 50%}'

// The pose drawn, one for each scene: thinking, reading and writing are all "at work"; party instead of `done`
// when a test or a commit went through.
export function poseOf(m: Mascot): Pose {
  switch (m.state) {
    case 'thinking': case 'reading': case 'writing': return 'work'
    case 'done': return m.win === true ? 'party' : 'done'
    default: return m.state
  }
}

// The tooltip on hover, and the text for someone who cannot see it (the same within a scene): both come from
// the catalog. A title is "short text: detail"; the alt is the short text.
export const robotTitle = (m: Mascot, t: Strings): string => t.mascot.title[poseOf(m)]
export const robotAlt = (m: Mascot, t: Strings): string => robotTitle(m, t).split(':')[0] ?? ''

const fmt = (n: number): string => String(Math.round(n * 100) / 100)

// --- The moves, computed for the instant ---
// A move is a cycle of `ms` repeated `times` times; [q, v]: at q (0..1) of the cycle the value is v, eased
// between points. Before and after it is the first point (at rest).
type Move = { keys: readonly (readonly [number, number])[]; ms: number; times: number }
const HOP: Move = { keys: [[0, 0], [0.4, -6], [1, 0]], ms: 500, times: 1 }
const BEAT: Move = { keys: [[0, 1], [0.5, 1.3], [1, 1]], ms: 600, times: 3 }
const SHAKE: Move = { keys: [[0, 0], [0.2, -1.4], [0.4, 1.4], [0.6, -1.4], [0.8, 1.4], [1, 0]], ms: 400, times: 3 }
const STEP: Move = { keys: [[0, 0], [0.5, -2], [1, 0]], ms: WALK_MS / 4, times: 4 }
const WAVE: Move = { keys: [[0, 0], [0.25, -18], [0.75, 14], [1, 0]], ms: 550, times: 3 }
const lasts = (mv: Move): number => mv.ms * mv.times
const ease = (x: number): number => x * x * (3 - 2 * x)
const clamp01 = (x: number): number => Math.min(Math.max(x, 0), 1)

function valueAt(mv: Move, t: number): number {
  const rest = mv.keys[0]?.[1] ?? 0
  if (!(t > 0 && t < lasts(mv))) return rest
  const q = (t % mv.ms) / mv.ms
  let prev = mv.keys[0] ?? [0, rest]
  for (const k of mv.keys) {
    if (q <= k[0]) return k[0] === prev[0] ? k[1] : prev[1] + (k[1] - prev[1]) * ease((q - prev[0]) / (k[0] - prev[0]))
    prev = k
  }
  return rest
}

// Confetti of the party: they fall once from above, around the top of the figure, each with its own delay (ms).
const FALL_MS = 1600
const CONFETTI: readonly (readonly [number, string, number])[] = [[6, TEAL, 0], [16, INK, 150], [26, TEAL, 300], [36, TEAL, 50], [46, INK, 250], [56, TEAL, 400], [12, INK, 500], [50, INK, 100]]
const CONFETTI_MS = FALL_MS + Math.max(...CONFETTI.map(c => c[2]))
function confetti(t: number): string {
  return CONFETTI.map(([x, c, d]) => {
    // Accelerating, like something falling.
    const q = clamp01((t - d) / FALL_MS) ** 2
    return q >= 1 ? '' : `<rect class="cf fx" x="${x}" y="2" width="3" height="3" fill="${c}" style="transform:translateY(${fmt(-14 + 44 * q)}px) rotate(${fmt(200 * q)}deg);opacity:${fmt(1 - q)}"/>`
  }).join('')
}

// It walks when the new scene has its spot away from the previous one.
const isWalking = (m: Mascot): boolean => m.from !== undefined && m.from !== spot(m)

// How long it moves after a change of scene (ms): register.tsx redraws in steps until then. Without
// `canWalk` (the narrow pane, where the mascot stands still) the walk does not count.
export function motionMs(m: Mascot, canWalk = true): number {
  const own: Record<Pose, number> = { idle: 0, sleep: 0, work: 0, agent: 0, done: lasts(HOP), party: Math.max(2 * HOP.ms, lasts(BEAT), CONFETTI_MS), error: lasts(SHAKE) }
  return Math.max(own[poseOf(m)], canWalk && isWalking(m) ? WALK_MS : 0)
}
// When it arrives, if the scene walks (and the walk is seen); otherwise null.
export const walkEnd = (m: Mascot, canWalk = true): number | null => (canWalk && isWalking(m) ? m.since + WALK_MS : null)
// How long it waves its arm when it starts to talk.
export const WAVE_MS = lasts(WAVE)

// The Css rules of the step at `t` ms from the change of scene; none at rest.
function moves(p: Pose, t: number): string {
  const lift = (y: number): string => (y === 0 ? '' : `.bd{transform:translateY(${fmt(y)}px)}`)
  switch (p) {
    case 'sleep': return ''
    case 'done': return lift(valueAt(HOP, t))
    case 'party': {
      const s = valueAt(BEAT, t)
      return lift(valueAt({ ...HOP, times: 2 }, t)) + (s === 1 ? '' : `.heart{transform:scale(${fmt(s)})}`)
    }
    case 'error': {
      const x = valueAt(SHAKE, t)
      return x === 0 ? '' : `.bd{transform:translateX(${fmt(x)}px)}`
    }
    default: return ''
  }
}

// A drawing of the figure in the 66×82 box, bottom-centred whatever its own viewBox.
const nest = (a: FigureArt): string =>
  `<svg viewBox="${a.viewBox}" width="${VB_W}" height="${VB_H}" preserveAspectRatio="xMidYMax meet" overflow="visible">${a.body}</svg>`

// The figure in one pose, in `.bd` (the group that hops and shakes), the waving arm over it while it talks.
function figure(fig: Figure, m: Mascot, t: number, isTalking: boolean, tt: Strings): string {
  const p = poseOf(m)
  const talk = isTalking && fig.talk !== null ? nest(fig.talk) : ''
  return `<g class="bot"><title>${robotTitle(m, tt)}</title><g class="bd">${nest(fig.poses[p])}${talk}</g>${p === 'party' ? confetti(t) : ''}</g>`
}

// `talkAt`: the time it started to talk (null if silent). `still`: where it stands when still, for
// "Reduce motion", which shows the final pose at once. While it talks the resting arm (`al`) is hidden and
// the raised one (`fa`, drawn by `fig.talk`) turns from the shoulder.
function style(fig: Figure, m: Mascot, nowMs: number, talkAt: number | null, walk = '', still = ''): string {
  const r = talkAt === null ? 0 : valueAt(WAVE, nowMs - talkAt)
  const arm = talkAt === null || fig.talk === null ? '' : '.al{display:none}' + (r === 0 ? '' : `.fa{transform:rotate(${fmt(r)}deg)}`)
  return `<style>${THEME}${BASE}${fig.css}${moves(poseOf(m), nowMs - m.since)}${walk}${arm}`
    + `@media (prefers-reduced-motion: reduce){.bd,.wk,.fa,.heart{transform:none!important}.cf{display:none}${still}}</style>`
}

// The stage: STAGE_W × STAGE_PX, the figure at its spot (`spot`, as a percentage of the stretch). Just
// after the scene changes it walks from where it was, with a step every quarter of the walk.
export function stageSvg(fig: Figure, m: Mascot, nowMs: number, t: Strings, talkAt: number | null = null): string {
  const dt = nowMs - m.since
  const px = (p: number): number => (p / 100) * (STAGE_W - BOT_W)
  const to = px(spot(m))
  const from = isWalking(m) ? px(m.from ?? spot(m)) : to
  const x = from + (to - from) * ease(clamp01(dt / WALK_MS))
  const y = from === to ? 0 : valueAt(STEP, dt)
  const walk = `.mv{transform:translateX(${fmt(x)}px)}` + (y === 0 ? '' : `.wk{transform:translateY(${fmt(y)}px)}`)
  const robot = `<svg y="${BOT_TOP}" width="${fmt(BOT_W)}" height="${BOT_H}" viewBox="0 0 ${VB_W} ${VB_H}" overflow="visible">${figure(fig, m, dt, talkAt !== null, t)}</svg>`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${STAGE_W}" height="${STAGE_PX}" viewBox="0 0 ${STAGE_W} ${STAGE_PX}">`
    + `${style(fig, m, nowMs, talkAt, walk, `.mv{transform:translateX(${fmt(to)}px)!important}`)}<g class="mv"><g class="wk">${robot}</g></g></svg>`
}

// The figure alone (the narrow pane, the band above the prompt): same poses, no stage. The band is not
// redrawn in steps: the pose at rest is enough for it (`nowMs` Infinity).
export function robotSvg(fig: Figure, m: Mascot, nowMs: number, t: Strings, talkAt: number | null = null): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB_W} ${VB_H}" overflow="visible">${style(fig, m, nowMs, talkAt)}${figure(fig, m, nowMs - m.since, talkAt !== null, t)}</svg>`
}

// The JARVIS lettering of the Jarvis Lite logo: Jost outlines, the A and the I in teal, without "LITE". Still.
const WORD_PATHS: readonly [string, boolean][] = [
  ['M319.5 227.4Q321.45 229.65 324.675 231.075Q327.9 232.5 331.5 232.5Q334.8 232.5 338.1 229.725Q341.4 226.95 341.4 219.9V111H363.9V224.4Q363.9 233.85 359.775 239.7Q355.65 245.55 348.675 248.25Q341.7 250.95 333 250.95Q325.05 250.95 318.3 248.25Q311.55 245.55 307.95 242.85Z', false],
  ['M464.65 216L453.7 192.15H417.55L406.6 216H382.45L435.7 104.85L488.95 216ZM435.7 145.05L422.65 175.2H448.75Z', true],
  ['M507.35 111H542.6Q561.05 111 571.4 120.225Q581.75 129.45 581.75 144.45Q581.75 155.55 575.975 163.65Q570.2 171.75 559.55 175.35L588.05 216H562.7L538.1 177.9H528.8V216H507.35ZM541.25 129.3H528.8V160.8H541.25Q549.65 160.8 554.675 156.675Q559.7 152.55 559.7 145.05Q559.7 137.55 554.675 133.425Q549.65 129.3 541.25 129.3Z', false],
  ['M649.35 179.4L677.7 111H702.6L649.35 222.15L596.1 111H620.85Z', false],
  ['M721 111H742.75V216H721Z', true],
  ['M781.55 180.75Q786.5 189.6 793.025 194.85Q799.55 200.1 807.95 200.1Q814.4 200.1 818.45 196.8Q822.5 193.5 822.5 187.8Q822.5 183 820.025 179.925Q817.55 176.85 812.675 174.525Q807.8 172.2 800.75 169.5Q796.85 168.15 792.05 165.825Q787.25 163.5 782.9 159.825Q778.55 156.15 775.7 150.75Q772.85 145.35 772.85 138Q772.85 129 777.425 122.475Q782 115.95 789.875 112.425Q797.75 108.9 807.5 108.9Q817.4 108.9 824.75 112.275Q832.1 115.65 836.975 120.825Q841.85 126 844.55 131.55L827.75 140.85Q824.45 135.15 819.575 131.175Q814.7 127.2 807.5 127.2Q801.2 127.2 798.05 130.125Q794.9 133.05 794.9 136.95Q794.9 142.8 800.75 146.7Q806.6 150.6 818.45 154.65Q825.2 157.05 831.275 161.1Q837.35 165.15 841.175 171.375Q845 177.6 845 186.6Q845 196.8 839.75 204Q834.5 211.2 826.1 215.025Q817.7 218.85 808.25 218.85Q798.65 218.85 790.325 215.1Q782 211.35 775.85 205.2Q769.7 199.05 766.25 191.55Z', false],
]
// The letters run from x 307 to 845 and from y 104 (tip of the A) to 251 (tail of the J).
const WORD_BOX = { x: 306, y: 103, w: 540, h: 149 }
export const WORD_PX = 28
export type Wordmark = { source: string; width: number; height: number }
export function wordmarkSvg(): Wordmark {
  const paths = WORD_PATHS.map(([d, isTeal]) => `<path class="${isTeal ? 't' : 'k'}" d="${d}"/>`).join('')
  const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${WORD_BOX.x} ${WORD_BOX.y} ${WORD_BOX.w} ${WORD_BOX.h}">`
    + `<style>${THEME}</style>${paths}</svg>`
  return { source, width: Math.round((WORD_PX * WORD_BOX.w) / WORD_BOX.h), height: WORD_PX }
}
