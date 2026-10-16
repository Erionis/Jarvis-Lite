import type { Color, Elements, RenderChildren, RenderElement } from 'claude-code'
import type { Figure } from '../types'
import { ICON, type IconName } from './icons'
import { hhmm, oneLine } from './format'
import { ruleSvg, speechSvg, titleSvg } from './lettering'
import type { Mascot } from './mascot'
import { isTyped, type Bubble } from './bubble'
import { BOT_H, STAGE_PX, STAGE_W, robotAlt, robotSvg, robotWidth, stageSvg, wordmarkSvg } from './stage'
import type { Strings } from './strings'
import { ACCENT, DIM, PILL_BG } from './theme'

// Careful: `h` is the injected JSX factory, never use it as a variable name.
// The shared UI pieces; only the desktop draws them (pane.tsx gives the one-line fallback elsewhere).
export type El = Pick<Elements['desktop'], 'Box' | 'Text' | 'Button' | 'Svg'>

// `alt`: what the icon says to someone who cannot see it (the catalog's files.icons).
export function icon(el: El, name: IconName, alt: string): RenderElement {
  const { Svg } = el
  return <Svg source={ICON[name]} alt={alt} width={16} height={16} />
}

// Pill: short text on a neutral, transparent background.
export function pill(el: El, text: string, color: Color = DIM, bold = false): RenderElement {
  const { Text } = el
  return <Text color={color} backgroundColor={PILL_BG} bold={bold}>{` ${text} `}</Text>
}

export function dot(el: El, color: Color): RenderElement {
  const { Text } = el
  return <Text color={color}>●</Text>
}

export type CardHead = { title: string; count?: string; tone?: Color; countColor?: Color }

// Section tones inside the Svgs (which cannot see the theme): the rule takes the color of the notice.
const RULE_TONE: Partial<Record<string, string>> = { error: '#e24b4a', warning: '#ba7517' }

// Full-width terminal-style rule (the Svg is cut by its container). No `height` on the Box: there it is
// measured in text rows, not pixels (each rule came out 16 empty rows tall).
export function rule(el: El, tone?: Color): RenderElement {
  const { Box, Svg } = el
  const r = ruleSvg(tone === undefined ? undefined : RULE_TONE[tone])
  return (
    <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
      <Svg source={r.source} alt="─" width={r.width} height={r.height} />
    </Box>
  )
}

// Terminal-style section, no frame: `▌TITLE` in teal fixed-width lettering (Svg, `alt` = the title), a thin
// rule up to the edge (in the tone, if there is one) and the count on the right, gray (or `countColor`);
// the content below.
export function card(el: El, head: CardHead, body: RenderChildren): RenderElement {
  const { Box, Text, Svg } = el
  const t = titleSvg(head.title)
  return (
    <Box flexDirection="column" paddingX={1} marginTop={1}>
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Box flexShrink={0}>
          <Svg source={t.source} alt={oneLine(head.title)} width={t.width} height={t.height} />
        </Box>
        {rule(el, head.tone)}
        {head.count !== undefined && <Box flexShrink={0}><Text color={head.countColor ?? DIM}>{head.count}</Text></Box>}
      </Box>
      {body}
    </Box>
  )
}

export type Segment<T extends string> = { id: T; label: string }

// Item selector: no background or border. The active item is a teal Text, bold and underlined; the others
// are flat gray Buttons, one for each item, in a row. With `wrap`, the items that do not fit go to the next row
// instead of being cut off.
export function segmented<T extends string>(el: El, keyOf: (id: T) => string, items: readonly Segment<T>[], active: T, pick: (id: T) => void, wrap = false): RenderElement {
  const { Box, Text, Button } = el
  const row = wrap ? { flexWrap: 'wrap', columnGap: 2, rowGap: 0 } as const : { flexWrap: 'nowrap', gap: 2, overflow: 'hidden' } as const
  return (
    <Box flexDirection="row" {...row}>
      {items.map(s => (
        s.id === active
          ? <Text color={ACCENT} bold underline>{s.label}</Text>
          : <Button key={keyOf(s.id)} plain dimColor label={s.label} onPress={() => pick(s.id)} />
      ))}
    </Box>
  )
}

export type HeaderView = {
  mascot: Mascot
  // The mascot's drawing: the stage nests it in its own box.
  figure: Figure
  // The catalog of the cockpit's language: the mascot's tooltip and alt come from it.
  t: Strings
  working: boolean
  turnAt: number | null
  nowMs: number
  // What the mascot is saying, if it speaks, and what its button and the × do.
  bubble?: Bubble | null
  bubbleAct?: (b: Bubble) => void
  bubbleClose?: (b: Bubble) => void
}

// How many characters of spoken text fit to the left of the stage (mascot and lettering, ~340 px; a pane
// column is ~8.7 px, a text character 7.8 px). Below SPEECH_MIN the text takes the place of the lettering.
const SPEECH_MIN = 12
const besideRoom = (columns: number): number => Math.floor((columns * 8.7 - 340) / 7.8)
// Room in place of the lettering, next to the mascot: the pane width minus the mascot, the margins and the two cursor cells.
const sideRoom = (columns: number, botWidth: number): number => Math.max(4, Math.floor((columns * 8.7 - botWidth - 26) / 7.8) - 2)
// The height of a row of desktop buttons (px): the bubble and the buttons fit in the mascot's height.
export const BUTTON_ROW_PX = 28

// What the mascot says: the text (Svg) and, if it asks for something, the button and the × below. All within
// the mascot's height `botH`: with buttons the text has fewer rows, the last one closed by `…`.
function speech(el: El, hv: HeaderView, b: Bubble, room: number, botH: number): RenderElement {
  const { Box, Svg, Button } = el
  const typed = isTyped(b)
  // A nice phrase is typed out in steps from when it was said; a bubble with a button appears whole.
  // Always an image (an interactive frame flickers on every redraw).
  const s = speechSvg(b.text, room, typed && b.at !== undefined ? hv.nowMs - b.at : null, botH - (typed ? 0 : BUTTON_ROW_PX))
  return (
    <Box key={`speech-${b.id}`} flexDirection="column" alignItems="flex-end" flexShrink={1} minWidth={0}>
      <Svg source={s.source} alt={oneLine(b.text)} width={s.width} height={s.height} />
      {!typed && (
        <Box flexDirection="row" alignItems="center" columnGap={1}>
          {b.action !== undefined && <Button key="bubble-act" variant="primary" label={b.action.label} onPress={() => hv.bubbleAct?.(b)} />}
          <Button key="bubble-close" plain dimColor label="×" onPress={() => hv.bubbleClose?.(b)} />
        </Box>
      )}
    </Box>
  )
}

// Below this pane width (columns) the stretch for walking does not fit: the mascot stays still at its spot,
// next to the lettering; while it speaks the lettering makes room and the bubble takes the row.
export const WALK_MIN_COLUMNS = 44

// The stage, the top row: on the right, next to the JARVIS lettering of the logo (still), the STAGE_W px
// stretch on which the mascot walks: a still image for every step (register.tsx redraws in steps while it
// moves). Fixed width and height: it does not change size when the pane widens. In the narrow pane, the
// figure alone, still at its spot (no walk), and the lettering.
// When it says a nice phrase, the mascot raises its arm and next to it, on the left, the text appears
// typed as on a terminal (a bubble with a button appears whole, mascot still). In the narrow pane the
// text takes the place of the lettering and of the status, and the height of the header does not change.
// Under the lettering the short status (waiting, at work): next to the tabs it looked like one more tab.
export function stage(el: El, hv: HeaderView, columns: number): RenderElement {
  const { Box, Text, Svg } = el
  const word = wordmarkSvg()
  const b = hv.bubble ?? null
  // Raises the arm only for a nice phrase: with a button the mascot stays still.
  const talkAt = b !== null && isTyped(b) ? (b.at ?? 0) : null
  const beside = besideRoom(columns)
  const isBeside = columns >= WALK_MIN_COLUMNS && beside >= SPEECH_MIN
  const bot = columns >= WALK_MIN_COLUMNS
    ? { source: stageSvg(hv.figure, hv.mascot, hv.nowMs, hv.t, talkAt), width: STAGE_W, height: STAGE_PX }
    : { source: robotSvg(hv.figure, hv.mascot, hv.nowMs, hv.t, talkAt), width: robotWidth(BOT_H), height: BOT_H }
  // In place of the lettering the height cap is the mascot's (BOT_H), even with the wide stage (44-49 columns): with buttons, two rows.
  return (
    <Box flexDirection="row" alignItems="center" justifyContent="flex-end" paddingX={1}>
      {b !== null && isBeside && speech(el, hv, b, beside, bot.height)}
      <Box key="robot" flexShrink={0}><Svg source={bot.source} alt={robotAlt(hv.mascot, hv.t)} width={bot.width} height={bot.height} /></Box>
      {b !== null && !isBeside
        ? <Box key="said" flexShrink={1} minWidth={0} marginLeft={1}>{speech(el, hv, b, sideRoom(columns, bot.width), BOT_H)}</Box>
        : (
          <Box key="word" flexDirection="column" alignItems="flex-end" flexShrink={0} marginLeft={1}>
            <Svg source={word.source} alt="JARVIS" width={word.width} height={word.height} />
            <Text color={DIM}>{workText(hv)}</Text>
          </Box>
        )}
    </Box>
  )
}

// The short status under the JARVIS lettering: waiting, or at work with the start time of the turn (still: a
// seconds counter redrew the pane, and reloaded the mascot's image, every second).
export const workText = (hv: HeaderView): string =>
  hv.working ? (hv.turnAt === null ? hv.t.header.working : hv.t.header.workingSince(hhmm(hv.turnAt))) : hv.t.header.waiting
