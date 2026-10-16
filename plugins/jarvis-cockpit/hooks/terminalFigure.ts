import type { Figure, FigureArt } from '../types'

// The Terminal, Jarvis Lite's default mascot: a screen for a face (`^ ^` when happy, `>_` at work) on a
// small body with two wheels, drawn in a 72×82 viewBox: 6 to spare on the left for the waves of the waving
// hand (the stage fits it into its 66×82 box, bottom-centred). It uses the stage's theme classes (`k`/`t`
// fill with ink/teal, `ks`/`ts` stroke with them), so light and dark follow the stage. `ln` is its line.

const VIEW = '-6 0 72 82'
const GREY = '#9a9a9a'
const FONT = 'font-weight="700" font-family="ui-sans-serif, system-ui, sans-serif"'
const CSS = '.ln{fill:none;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}.fa{transform-origin:18px 53px}'

const ink = (d: string, more = ''): string => `<path class="ks ln" d="${d}"${more}/>`
const teal = (d: string, more = ''): string => `<path class="ts ln" d="${d}"${more}/>`

// Ears, screen, neck, body with its panel line, two wheels.
const BODY = '<rect class="k" x="6" y="20" width="5" height="12" rx="2"/><rect class="k" x="55" y="20" width="5" height="12" rx="2"/>'
  + '<rect class="ks ln" x="11" y="10" width="44" height="32" rx="7"/>'
  + ink('M33 42v6') + ink('M20 48h26l4 18H16z') + ink('M24 57h18', ' style="stroke-width:2"')
  + '<circle class="ks ln" cx="23" cy="74" r="5"/><circle class="ks ln" cx="43" cy="74" r="5"/>'

const HAPPY = teal('M20 29l5-5 5 5M36 29l5-5 5 5')
const PROMPT = teal('M20 21l6 5-6 5M30 32h12')
const JOY = teal('M19 30l6-7 6 7M35 30l6-7 6 7')
const ASLEEP = ink('M20 27h10M36 27h10', ' opacity=".55"')
const CROSSED = `<path class="ln" stroke="${GREY}" d="M21 21l7 7M28 21l-7 7M38 21l7 7M45 21l-7 7"/>`
const SHAKES = `<path class="ln" stroke="${GREY}" style="stroke-width:2" d="M2 12l3 3M2 20l3-1M64 12l-3 3M64 20l-3-1"/>`
const ZZ = `<text class="t" x="50" y="8" font-size="9" ${FONT}>z</text><text class="t" x="57" y="5" font-size="7" ${FONT}>z</text>`
const SHADOW = '<ellipse class="k" cx="33" cy="80" rx="13" ry="2.5" opacity=".2"/>'
// The small screen of a subagent: bottom right, beside the main wheels, with its own prompt and wheels.
const MINI = '<rect class="ks" x="52" y="67" width="13" height="10" rx="2" fill="none" stroke-width="2"/>'
  + '<path class="ts" fill="none" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" d="M55.5 70l3 2-3 2"/>'
  + '<circle class="ks" cx="55.5" cy="79" r="1.5" fill="none" stroke-width="1.4"/><circle class="ks" cx="61.5" cy="79" r="1.5" fill="none" stroke-width="1.4"/>'

// The resting left arm is `al`: the stage hides it while the raised arm (TALK) waves.
const ARMS_DOWN = '<path class="ks ln al" d="M18 55q-5 3-6 9"/>' + ink('M48 55q5 3 6 9')
const ARMS_UP = '<path class="ks ln al" d="M18 53q-9-3-11-13"/>' + ink('M48 53q9-3 11-13')
// The waving arm: raised from the shoulder (18,53), a hand, two teal waves; the stage turns `fa`.
const TALK = '<g class="fa">' + ink('M18 53q-9-3-11-13') + '<circle class="k" cx="6" cy="37" r="3"/>'
  + teal('M0 31q-2 4 0 8M-3 29q-3 6 0 12', ' style="stroke-width:2"') + '</g>'

const art = (body: string): FigureArt => ({ viewBox: VIEW, body })

export const TERMINAL: Figure = {
  kind: 'terminal',
  css: CSS,
  poses: {
    idle: art(BODY + HAPPY + ARMS_DOWN),
    work: art(BODY + PROMPT + ARMS_DOWN),
    agent: art(BODY + PROMPT + ARMS_DOWN + MINI),
    // Lifted by 6 above its shadow; the stage's hop adds the jump.
    done: art(`<g transform="translate(0 -6)">${BODY}${HAPPY}${ARMS_DOWN}</g>${SHADOW}`),
    party: art(BODY + JOY + ARMS_UP),
    sleep: art(BODY + ASLEEP + ARMS_DOWN + ZZ),
    error: art(BODY + CROSSED + ARMS_DOWN + SHAKES),
  },
  talk: art(TALK),
}
