import type { Color, Elements, RenderElement } from 'claude-code'
import type { DiaryNote, DiaryState } from '../types'
import { rule, type El } from './chrome'
import { diaryTitle, stepDay } from './diary'
import { oneLine } from './format'
import { titleSvg } from './lettering'
import { rewriteLinks, splitFrontmatter } from './reader'
import type { Strings } from './strings'
import { DIM, FADED } from './theme'

// Careful: `h` is the injected JSX factory, never use it as a variable name.
// The Diary tab: a whole diary note, with the app's Markdown as in Reading (sentences wrap, internal links can
// be pressed). At the top the date, with ‹ and › for the note before and after, up to today. Read-only: the
// diary is protected. Which notes exist and which to show is decided by diary.ts, the reading by register.tsx.

type DiaryEl = El & Pick<Elements['desktop'], 'Markdown'>

export type DiaryTabView = {
  diary: DiaryState
  // The catalog of the cockpit's language.
  t: Strings
  root: string
  nowMs: number
  // Shows the note of that day.
  show: (day: string) => void
  link: (href: string) => void
  // The note in Reading (too big for the tab).
  read: (path: string) => void
}

function message(el: DiaryEl, text: string, color: Color = DIM): RenderElement {
  const { Box, Text } = el
  return <Box marginTop={1} paddingX={2}><Text color={color}>{oneLine(text)}</Text></Box>
}

// The note: the whole file without frontmatter, or why it is not shown.
function noteBody(el: DiaryEl, v: DiaryTabView, note: DiaryNote): RenderElement {
  const { Box, Text, Button, Markdown } = el
  const d = v.diary
  const t = v.t.diary
  if (d.error !== null) return <Text color="error">{oneLine(t.readNote(note.path, d.error))}</Text>
  if (d.isTooBig) {
    return (
      <Box flexDirection="column">
        <Text color={DIM}>{t.tooBig}</Text>
        <Box marginTop={1}><Button key="diary-read" plain label={t.openInReading} onPress={() => v.read(note.path)} /></Box>
      </Box>
    )
  }
  if (d.text === null) return <Text color={DIM}>{t.loading}</Text>
  const links = rewriteLinks(splitFrontmatter(d.text).body, note.path, v.root)
  return <Markdown key="diary-doc" text={links.text} pressableLinks={links.internal} onLinkPress={link => v.link(link.href)} />
}

export function drawDiary(el: DiaryEl, v: DiaryTabView): RenderElement {
  const { Box, Text, Button, Svg } = el
  const d = v.diary
  if (d.notes === null) return d.error !== null ? message(el, v.t.diary.readDiary(d.error), 'error') : message(el, v.t.diary.loading)
  const note = d.notes.find(n => n.day === d.day)
  if (note === undefined) return message(el, v.t.diary.empty)
  const title = diaryTitle(note.day, v.nowMs, v.t)
  const t = titleSvg(title)
  // Without a note before or after, the arrow stays, faint, in its place: the title does not move.
  const arrow = (key: string, label: string, day: string | null): RenderElement =>
    day === null ? <Text color={FADED}>{label}</Text> : <Button key={key} plain label={label} onPress={() => v.show(day)} />
  return (
    <Box flexDirection="column" paddingX={1}>
      <Box flexDirection="row" alignItems="center" gap={1} marginTop={1} paddingX={1}>
        <Box flexShrink={0}>{arrow('diary-prev', '‹', stepDay(d.notes, note.day, -1))}</Box>
        <Box flexShrink={0}><Svg source={t.source} alt={title} width={t.width} height={t.height} /></Box>
        {rule(el)}
        <Box flexShrink={0}>{arrow('diary-next', '›', stepDay(d.notes, note.day, 1))}</Box>
      </Box>
      <Box flexDirection="column" marginTop={1} paddingX={1}>{noteBody(el, v, note)}</Box>
    </Box>
  )
}
