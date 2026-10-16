import type { Elements, RenderElement } from 'claude-code'
import type { Tab } from '../types'
import { segmented, stage, type El, type HeaderView } from './chrome'
import { clip, oneLine } from './format'
import type { Strings } from './strings'
import { DIM } from './theme'

// Careful: `h` is the injected JSX factory, never use it as a variable name.
// The container: the mascot's stage, the six tabs (Recap, Diary, To Do, Files, Reading and Memories; Diary,
// To Do and Memories only if their sources are declared; the active one is an underlined Text, and if they
// do not fit they wrap), the active tab. The status sits under the JARVIS lettering. register.tsx reads the
// atoms and passes plain values.
export type PaneView = {
  columns: number
  header: HeaderView
  // The catalog of the cockpit's language: the tab labels come from it.
  t: Strings
  // The tabs that exist, in order (Diary, To Do and Memories only if their sources are declared).
  tabs: readonly Tab[]
  tab: Tab
  setTab: (t: Tab) => void
  // The label of the To Do tab: the name of the Future work file ("To Do" for `To Do.md`).
  todoLabel: string
  // An unsaved draft in the editor: the Reading tab shows it with ●.
  hasDraft: boolean
  // The active tab, drawn by recap.tsx, diaryView.tsx, files.tsx, readingView.tsx, todo.tsx or memoriesView.tsx.
  body: RenderElement
}

const OLD_TABS: Readonly<Record<string, Tab>> = { stato: 'recap', diario: 'diary', file: 'files', lettura: 'reading', memorie: 'memories' }
const TABS: readonly Tab[] = ['recap', 'diary', 'files', 'reading', 'todo', 'memories']
// A tab saved by an older version keeps working: Italian ids map to the English ones.
export function migrateTab(saved: unknown): Tab | null {
  if (typeof saved !== 'string') return null
  const tab = OLD_TABS[saved] ?? saved
  return (TABS as readonly string[]).includes(tab) ? (tab as Tab) : null
}

// Outside the desktop (terminal, mobile, VS Code) the pane is a single line.
export function drawElsewhere(el: Pick<Elements['terminal'], 'Text'>, t: Strings): RenderElement {
  const { Text } = el
  return <Text color={DIM}>{t.pane.elsewhere}</Text>
}

// The pane drawing threw. A minimal card, only Box, Text and Button (nothing that could throw again), with the
// short message; the reload button goes back to the Recap (recoverPane in register.tsx).
const FAULT_CHARS = 160
export function drawFault(el: Pick<Elements['desktop'], 'Box' | 'Text' | 'Button'>, message: string, reload: () => void, t: Strings): RenderElement {
  const { Box, Text, Button } = el
  return (
    <Box flexDirection="column" marginTop={1} paddingX={2}>
      <Text bold>{t.pane.faultTitle}</Text>
      <Text color={DIM} wrap="truncate-end">{clip(oneLine(message), FAULT_CHARS)}</Text>
      <Box flexDirection="row" marginTop={1}><Button key="fault-reload" variant="secondary" label={t.pane.faultReload} onPress={reload} /></Box>
    </Box>
  )
}

export function drawPane(el: El, v: PaneView): RenderElement {
  const { Box } = el
  // The To Do tab takes the Future work file's name; the others come from the catalog.
  const label = (tab: Tab): string => {
    const w = v.t.tabs
    switch (tab) {
      case 'recap': return w.recap
      case 'diary': return w.diary
      case 'files': return w.files
      case 'todo': return oneLine(v.todoLabel)
      case 'memories': return w.memories
      case 'reading': return v.hasDraft ? w.readingDraft : w.reading
    }
  }
  return (
    <Box flexDirection="column" width={v.columns}>
      {stage(el, v.header, v.columns)}
      <Box paddingX={1}>{segmented(el, t => `tab-${t}`, v.tabs.map(t => ({ id: t, label: label(t) })), v.tab, t => v.setTab(t), true)}</Box>
      {v.body}
    </Box>
  )
}
