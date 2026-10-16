import type { Elements, RenderElement } from 'claude-code'
import type { Figure, Mascot } from '../types'
import { oneLine } from './format'
import { robotAlt, robotSvg, robotWidth } from './stage'
import type { Strings } from './strings'
import { DIM } from './theme'

// Careful: `h` is the injected JSX factory, never use it as a variable name.
// The band above the prompt with the pane closed (desktop only): the small mascot, still at its spot, and the
// button that reopens the pane. It lives here and not in the line under the prompt because the desktop does
// not draw that line (✦ Jarvis did not show up there even when it was always drawn).
type BandEl = Pick<Elements['desktop'], 'Box' | 'Text' | 'Button' | 'Svg'>

// doing: during a turn the last row of the Activity log, in place of the catalog's "reopens the cockpit".
// t: the catalog of the cockpit's language, for the mascot's alt text. figure: the mascot's drawing.
export type ReopenView = { mascot: Mascot; figure: Figure; t: Strings; nowMs: number; doing?: string | null; reopen: () => void }

export const HINT_MASCOT_PX = 18
export const REOPEN = '✦ Jarvis'

export function drawReopen(el: BandEl, v: ReopenView): RenderElement {
  const { Box, Text, Button, Svg } = el
  return (
    <Box flexDirection="row" alignItems="center" gap={1}>
      {/* The resting pose: at 18 px the movements cannot be seen and the band does not redraw in steps. */}
      <Svg source={robotSvg(v.figure, v.mascot, Infinity, v.t)} alt={robotAlt(v.mascot, v.t)} width={robotWidth(HINT_MASCOT_PX)} height={HINT_MASCOT_PX} />
      <Button key="reopen" plain label={REOPEN} onPress={v.reopen} />
      <Box flexShrink={1} minWidth={0} overflow="hidden">
        <Text color={DIM} wrap="truncate-end">{oneLine(v.doing ?? v.t.header.reopen)}</Text>
      </Box>
    </Box>
  )
}
