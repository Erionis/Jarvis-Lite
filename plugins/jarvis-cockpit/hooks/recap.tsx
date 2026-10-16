import type { RenderElement } from 'claude-code'
import type { Activity, AgentRun, RecapFace, SessionRecord, Snapshot, TurnEnd, TurnPrompt } from '../types'
import { card, type El } from './chrome'
import { oneLine } from './format'
import { recapMoment } from './recapModel'
import type { SourceRole, Strings } from './strings'
import { drawOpen } from './recapOpen'
import { drawWork } from './recapWork'
import { DIM } from './theme'

// Careful: `h` is the injected JSX factory, never use it as a variable name.
// The Recap has two faces: the opening (recapOpen.tsx) until a prompt starts in the session, then the
// session (recapWork.tsx), with a button at the bottom that shows the opening again until the next prompt.
// It summarizes and leads to the tabs (To Do, Diary, Files), which have the full text. Here: the view-model,
// the Sources card (at the top in both faces) and the choice of face.
type RecapEl = El

// Pure view-model: register.tsx reads the atoms and passes values and callbacks.
export type RecapView = {
  snapshot: Snapshot | null
  // The catalog of the cockpit's language.
  t: Strings
  feed: readonly Activity[]
  // The start of every turn (atom prompts): from the first one the Recap is on the session face.
  prompts: readonly TurnPrompt[]
  // The record of the current session (atom session), which Last session skips.
  session: SessionRecord | null
  // The choice of the show-overview button (atom recapView), which holds until the next prompt.
  face: RecapFace
  showOpen: () => void
  showWork: () => void
  // The files written in the session (path → time), to open under the log.
  written: Readonly<Record<string, number>>
  // Subagents started in the session (atom agentRuns).
  runs: Readonly<Record<string, AgentRun>>
  // The turn ends (atom ends) and whether a turn is running, for Now and the log.
  ends: readonly TurnEnd[]
  working: boolean
  // When the current turn started (atom turnAt), for Now.
  turnAt: number | null
  // The declared sources (role → relative path), for the Recap clicks.
  roles: Readonly<Record<string, string>>
  nowMs: number
  // Width of the panel in columns (the app's code font): the log fits inside it.
  columns: number
  openFile: (rel: string) => void
  openFolder: (rel: string) => void
  // The To Do tab (if the source is declared).
  openTodo: () => void
  // That day's note in the Diary tab.
  openDiary: (day: string) => void
  // The Activity log open (the last ACTIVITY_ROWS rows) or closed (the last LOG_SHORT).
  logOpen: boolean
  toggleLog: () => void
  send: (text: string) => void
}

// The Sources card: the capability table is missing, or a declared source is. The four sources the panel names
// get the name of the catalog; any other is shown as the user declared it.
function sources(el: RecapEl, s: Snapshot, t: Strings): RenderElement | null {
  const { Text } = el
  if (s.hasTable && s.missing.length === 0) return null
  const named = (role: string): string => (Object.prototype.hasOwnProperty.call(t.recap.sources.names, role) ? t.recap.sources.names[role as SourceRole] : role)
  return card(el, { title: t.recap.sources.title, tone: 'error' }, [
    !s.hasTable && <Text color="error">{t.recap.sources.noTable}</Text>,
    ...s.missing.map(r => <Text color="error">{oneLine(t.recap.sources.missing(named(r)))}</Text>),
  ])
}

export function drawRecap(el: RecapEl, v: RecapView): RenderElement {
  const { Box, Text } = el
  const s = v.snapshot
  const isWork = recapMoment(v.prompts.length, v.face) === 'work'
  return (
    <Box flexDirection="column" paddingX={1}>
      {s === null ? <Box marginTop={1}><Text color={DIM}>{v.t.recap.loading}</Text></Box> : [
        sources(el, s, v.t),
        ...(isWork ? drawWork(el, s, v) : drawOpen(el, s, v)),
      ]}
    </Box>
  )
}
