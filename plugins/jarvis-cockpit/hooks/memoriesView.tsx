import type { RenderElement } from 'claude-code'
import type { MemoriesState, Memory, MemoryGroup } from '../types'
import { card, pill, type El } from './chrome'
import { keyText, oneLine } from './format'
import { egoSvg, graphWidth } from './memgraph'
import { memoryGroups, shortName } from './memories'
import type { Strings } from './strings'
import { ACCENT, DIM, FADED, TEXT } from './theme'

// Careful: `h` is the injected JSX factory, never use it as a variable name.
// The Memories tab, read-only: the list by group and the view of one memory, with the linked ones in a column
// and the small graph at the bottom.
// What to read in the files is decided by memories.ts, when to read them again by register.tsx; to change a
// memory you ask Jarvis.

const SHOWN = 3

// A name the panel does not know (the atom outlives a reload: an older version may have saved other ones) draws
// nothing, never "undefined".
const named = (names: Readonly<Record<string, string>>, key: string | null): string =>
  key !== null && Object.prototype.hasOwnProperty.call(names, key) ? names[key] ?? '' : ''

export type MemoriesView = {
  memories: MemoriesState
  // The catalog of the cockpit's language.
  t: Strings
  columns: number
  // From the list: opens the view, with no stack. follow: from one view to another, with the return stack.
  open: (file: string) => void
  follow: (file: string) => void
  // To the previous memory, or to the list if the stack is empty.
  back: () => void
  toggleGroup: (group: MemoryGroup) => void
  read: (file: string) => void
  ask: (m: Memory) => void
}

const freshPill = (el: El, v: MemoriesView, m: Memory): RenderElement | null => {
  const label = named(v.t.memories.fresh, m.fresh)
  return label === '' ? null : pill(el, label, m.fresh === 'new' ? ACCENT : DIM)
}

function row(el: El, v: MemoriesView, m: Memory, first: boolean): RenderElement {
  const { Box, Text, Button } = el
  const name = oneLine(m.name)
  const fresh = freshPill(el, v, m)
  return (
    <Box flexDirection="column" marginTop={first ? 0 : 1}>
      <Button key={`mem-${keyText(m.file)}`} plain label={name} onPress={() => v.open(m.file)}>
        <Text color={TEXT} wrap="truncate-end"><Text bold>{name}</Text>{fresh !== null && ' '}{fresh}</Text>
      </Button>
      {m.description !== '' && <Text color={DIM} wrap="truncate-end">{oneLine(m.description)}</Text>}
    </Box>
  )
}

function list(el: El, v: MemoriesView, all: readonly Memory[]): RenderElement[] {
  const { Box, Button } = el
  return memoryGroups(all).map(g => {
    const isOpen = v.memories.expanded.includes(g.group)
    const items = isOpen ? g.items : g.items.slice(0, SHOWN)
    const hidden = g.items.length - SHOWN
    const count = v.t.memories.count(g.items.length, g.fresh)
    return card(el, { title: named(v.t.memories.groups, g.group), count }, [
      ...items.map((m, i) => row(el, v, m, i === 0)),
      hidden > 0 && <Box marginTop={1}><Button key={`mem-more-${g.group}`} plain dimColor label={isOpen ? v.t.memories.less : v.t.memories.more(hidden)} onPress={() => v.toggleGroup(g.group)} /></Box>,
    ])
  })
}

// A linked memory: the short name to click, the group in gray on the right.
function linkRow(el: El, v: MemoriesView, x: Memory): RenderElement {
  const { Box, Text, Button } = el
  const name = oneLine(shortName(x.file))
  return (
    <Box flexDirection="row" justifyContent="space-between">
      <Box flexShrink={1} minWidth={0} overflow="hidden">
        <Button key={`mem-link-${keyText(x.file)}`} plain label={name} onPress={() => v.follow(x.file)}><Text color={TEXT} wrap="truncate-end">{name}</Text></Button>
      </Box>
      <Box flexShrink={0} marginLeft={1}><Text color={DIM}>{named(v.t.memories.groups, x.group)}</Text></Box>
    </Box>
  )
}

// From the top: the way back, name and description, two buttons, the linked memories, the graph.
function single(el: El, v: MemoriesView, m: Memory, byFile: ReadonlyMap<string, Memory>): RenderElement {
  const { Box, Text, Button, Svg } = el
  const linked = m.links.flatMap(f => byFile.get(f) ?? [])
  const w = v.t.memories
  const g = linked.length === 0 ? null : egoSvg(m, linked, graphWidth(v.columns), v.t)
  const prev = v.memories.back.length === 0 ? undefined : byFile.get(v.memories.back[v.memories.back.length - 1] ?? '')
  const backLabel = `‹ ${oneLine(prev?.name ?? w.title)}`
  const fresh = freshPill(el, v, m)
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginTop={1} paddingX={1} overflow="hidden">
        <Button key="mem-back" plain label={backLabel} onPress={v.back}><Text color={ACCENT} wrap="truncate-end">{backLabel}</Text></Button>
      </Box>
      <Box flexDirection="column" marginTop={1} paddingX={1}>
        <Text color={TEXT}><Text bold>{oneLine(m.name)}</Text>{fresh !== null && ' '}{fresh}</Text>
        <Text color={FADED}>{named(w.groups, m.group)}</Text>
        {m.description !== '' && <Box marginTop={1}><Text color={TEXT}>{oneLine(m.description)}</Text></Box>}
      </Box>
      <Box flexDirection="row" flexWrap="wrap" columnGap={2} marginTop={1} paddingX={1}>
        <Button key="mem-open" plain label={w.openInReading} onPress={() => v.read(m.file)} />
        <Button key="mem-ask" plain label={w.askChange} onPress={() => v.ask(m)} />
      </Box>
      {linked.length > 0 && card(el, { title: w.linked, count: `${linked.length}` }, linked.map(x => linkRow(el, v, x)))}
      {g !== null && card(el, { title: w.map }, [<Box marginTop={1}><Svg source={g.source} alt={oneLine(g.alt)} width={g.width} height={g.height} /></Box>])}
    </Box>
  )
}

export function drawMemories(el: El, v: MemoriesView): RenderElement {
  const { Box, Text } = el
  const s = v.memories
  const w = v.t.memories
  const footer = <Box marginTop={1} paddingX={2}><Text color={DIM}>{w.footer}</Text></Box>
  const status = (text: string, color = DIM) => <Box flexDirection="column"><Box marginTop={1} paddingX={2}><Text color={color}>{oneLine(text)}</Text></Box>{footer}</Box>
  if (s.error !== null) return status(w.unreadable(s.dir, s.error), 'error')
  if (s.list === null) return status(w.loading)
  if (s.list.length === 0) return status(w.none(s.dir))
  const byFile = new Map(s.list.map(m => [m.file, m]))
  const m = s.open === null ? undefined : byFile.get(s.open)
  // In the view the ask-for-a-change button already says what the line at the bottom says, so there is no footer.
  if (m !== undefined) return single(el, v, m, byFile)
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" paddingX={1}>{list(el, v, s.list)}</Box>
      {footer}
    </Box>
  )
}
