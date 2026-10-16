import type { RenderElement } from 'claude-code'
import type { DiaryDay, Snapshot } from '../types'
import type { RecapView } from './recap'
import { card, pill, type El } from './chrome'
import { previewSvg } from './lettering'
import { clip, dayMs, keyText, longDay, oneLine, relDay } from './format'
import { diaryLine, firstLine } from './diary'
import { STALE_COUNTER_DAYS, ageText, resumeCommand, todayRows, type NowRow, type WaitingRow } from './recapModel'
import { lastSession, nowPrompt, pickNext, sessionFacts, sessionResume, sessionWhen, topicOf, type Closing, type LastSession } from './sessionModel'
import { DIM, TEXT } from './theme'

// Careful: `h` is the injected JSX factory, never use it as a variable name.
// The opening face of the Recap: Today, Last session and Next step, from the top. Each section is a
// `card` with no number, with a short piece of information to the right of the title (the date, the times, the
// source). What to show is decided by recapModel.ts and sessionModel.ts; here only the drawing.

const TOPIC_DRAW_CHARS = 90
const OTHER_CHARS = 40

// A Now item that is overdue or due today: the whole title in bold (wrapped if long), the deadline on the right.
// The click prepares its resume text in the prompt.
function dueRow(el: El, s: Snapshot, v: RecapView, r: NowRow): RenderElement {
  const { Box, Text, Button } = el
  const title = oneLine(r.title)
  return (
    <Box flexDirection="row" justifyContent="space-between">
      <Box flexShrink={1} minWidth={0}>
        <Button key={`today:${r.key}`} plain label={title} onPress={() => v.send(nowPrompt(s, r.index, v.t))}><Text color={TEXT} bold wrap="wrap">{title}</Text></Button>
      </Box>
      {r.due.text !== '' && <Box flexShrink={0} marginLeft={1}><Text color={r.due.color}>{r.due.text}</Text></Box>}
    </Box>
  )
}

// A wait that has been stuck for too long: a click opens the To Do tab.
function staleRow(el: El, v: RecapView, r: WaitingRow): RenderElement {
  const { Box, Text, Button } = el
  return (
    <Box flexDirection="row" justifyContent="space-between">
      <Box flexShrink={1} minWidth={0} overflow="hidden"><Button key={`today-wait:${r.key}`} plain label={oneLine(r.title)} onPress={v.openTodo} /></Box>
      <Box flexShrink={0} marginLeft={1}><Text color="warning">{v.t.recap.today.waitingSince(r.age)}</Text></Box>
    </Box>
  )
}

// "3 in Now · 2 waiting": each piece opens the To Do tab; a count of zero stays, in grey. A missing Now
// section is reported in place of its count.
function countsRow(el: El, s: Snapshot, v: RecapView): RenderElement {
  const { Box, Text, Button } = el
  const now = s.now?.length ?? 0
  return (
    <Box flexDirection="row" flexWrap="wrap" marginTop={1}>
      {s.now === null
        ? <Text color={DIM}>{v.t.recap.today.noNow}</Text>
        : <Button key="count-now" plain dimColor={now === 0} label={oneLine(v.t.recap.today.inNow(now, s.nowLabel ?? 'Now'))} onPress={v.openTodo} />}
      <Text color={DIM}> · </Text>
      <Button key="count-waiting" plain dimColor={s.waiting === 0} label={v.t.recap.today.waiting(s.waiting)} onPress={v.openTodo} />
    </Box>
  )
}

// "5 in Inbox, oldest 23d", in yellow beyond STALE_COUNTER_DAYS: the text opens the folder in the Files tab.
// Only if the source exists and has notes.
function inboxRow(el: El, s: Snapshot, v: RecapView): RenderElement | null {
  const { Box, Text, Button } = el
  const inbox = s.inbox
  if (inbox === null || inbox.count === 0) return null
  const label = v.t.recap.today.inbox(inbox.count, inbox.oldestDays === null ? null : ageText(inbox.oldestDays, v.t))
  const color = inbox.oldestDays !== null && inbox.oldestDays > STALE_COUNTER_DAYS ? 'warning' as const : DIM
  const open = (): void => { const dir = v.roles.Inbox; if (dir !== undefined) v.openFolder(dir) }
  return (
    <Box flexDirection="row">
      <Box flexShrink={1} minWidth={0}>
        <Button key="inbox-open" plain label={label} onPress={open}><Text color={color} wrap="truncate-end">{label}</Text></Button>
      </Box>
    </Box>
  )
}

// Today: the deadlines (Now items overdue or due today, and stuck waits), the counts and the Inbox.
function todayCard(el: El, s: Snapshot, v: RecapView): RenderElement {
  const { Text } = el
  const { due, stale } = todayRows(s, v.nowMs, v.t)
  return card(el, { title: v.t.recap.today.title, count: v.t.recap.today.date(longDay(v.nowMs, v.t.dates)) }, [
    ...due.map(r => dueRow(el, s, v, r)),
    ...stale.map(r => staleRow(el, v, r)),
    due.length === 0 && stale.length === 0 && <Text color={DIM}>{v.t.recap.today.none}</Text>,
    countsRow(el, s, v),
    inboxRow(el, s, v),
  ])
}

// A green `✓` and a diary line, with `Diary ›` on the right, which opens that note in the Diary tab.
function savedRow(el: El, v: RecapView, dayIso: string, line: string | null): RenderElement {
  const { Box, Text, Button } = el
  return (
    <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
      <Box flexDirection="row" gap={1} flexShrink={1} minWidth={0}>
        {line !== null && <Box flexShrink={0}><Text color="success">✓</Text></Box>}
        {line !== null && <Box flexShrink={1} minWidth={0}><Text color={TEXT} wrap="wrap">{oneLine(line)}</Text></Box>}
      </Box>
      <Box flexShrink={0} marginLeft={1}><Button key="last-diary" plain label={v.t.recap.last.diaryButton} onPress={() => v.openDiary(dayIso)} /></Box>
    </Box>
  )
}

// The closing of a session of the registry: saved (✓ and the diary line) or the "not saved" pill, with
// `Resume this ›` if it wrote at least one file.
function closingRow(el: El, v: RecapView, closing: Closing, resumeText: string | null): RenderElement {
  const { Box, Text, Button } = el
  if (closing.isSaved) return savedRow(el, v, closing.day, closing.line)
  return (
    <Box flexDirection="row" justifyContent="space-between" marginTop={1}>
      <Box flexDirection="row" gap={1} flexShrink={1} minWidth={0}>
        <Box flexShrink={0}>{pill(el, v.t.recap.last.unsaved, 'warning')}</Box>
        <Box flexShrink={1} minWidth={0}><Text color={DIM} wrap="truncate-end">{v.t.recap.last.notInDiary}</Text></Box>
      </Box>
      {resumeText !== null && <Box flexShrink={0} marginLeft={1}><Button key="last-resume" plain label={v.t.recap.last.resumeThis} onPress={() => v.send(resumeText)} /></Box>}
    </Box>
  )
}

// Last session: from the registry (when, on what, the facts, the closing and the session before it on the same
// day in one line) or from the diary alone (the first Focus entry and the closing). No section without a note or a registry.
function lastCard(el: El, s: Snapshot, v: RecapView, last: LastSession): RenderElement {
  const { Text } = el
  if (last.kind === 'diary') return diaryCard(el, v, last.note)
  const { rec, closing, before } = last
  const resumeText = rec.fileCount > 0 ? sessionResume(rec, v.nowMs, v.t, s.handoffs) : null
  const short = (c: Closing): string => (c.isSaved ? `✓ ${c.line}` : v.t.recap.last.unsaved)
  return card(el, { title: v.t.recap.last.title, count: sessionWhen(rec, v.nowMs, v.t) }, [
    <Text color={TEXT} bold wrap="truncate-end">{clip(oneLine(topicOf(rec, v.t, s.handoffs)), TOPIC_DRAW_CHARS)}</Text>,
    <Text color={DIM} wrap="truncate-end">{sessionFacts(rec, v.t)}</Text>,
    closingRow(el, v, closing, resumeText),
    before !== null && <Text color={DIM} wrap="truncate-end">{oneLine(v.t.recap.last.before(topicOf(before.rec, v.t, s.handoffs), short(before.closing)))}</Text>,
  ])
}

function diaryCard(el: El, v: RecapView, note: DiaryDay): RenderElement {
  const { Text } = el
  const focus = firstLine(note, 'focus')
  return card(el, { title: v.t.recap.last.title, count: `${relDay(dayMs(note.day), v.nowMs, v.t.dates)} · ${v.t.recap.last.fromDiary}` }, [
    focus !== null && <Text color={TEXT} bold wrap="wrap">{oneLine(focus)}</Text>,
    savedRow(el, v, note.day, firstLine(note, 'closing')),
  ])
}

// Next step: one thing only, with the exact text of the prompt as a preview before the click. `Resume ›` prepares
// it, `Briefing` prepares /briefing; below, the other open handoffs. Nothing planned: it says so and Briefing stays.
function nextCard(el: El, s: Snapshot, v: RecapView): RenderElement {
  const { Box, Text, Button, Svg } = el
  const t = v.t.recap.next
  const n = pickNext(s, v.nowMs, v.t)
  const briefing = <Button key="briefing" plain label={t.briefing} onPress={() => v.send('/briefing')} />
  if (n === null) {
    return card(el, { title: t.title }, [
      <Text color={DIM} wrap="wrap">{t.nothing}</Text>,
      <Box flexDirection="row" marginTop={1}>{briefing}</Box>,
    ])
  }
  const room = Math.max(8, v.columns - 4)
  const d = diaryLine(n.detail)
  const detail = `${d.lead}${d.rest}`.trim()
  const preview = previewSvg(n.prompt, room)
  return card(el, { title: t.title, count: oneLine(n.source), countColor: n.sourceColor }, [
    <Text color={TEXT} bold wrap="wrap">{oneLine(n.title)}</Text>,
    detail !== '' && <Text color={DIM} wrap="wrap">{clip(oneLine(detail), 2 * room)}</Text>,
    <Box marginTop={1} overflow="hidden">
      <Svg source={preview.source} alt={oneLine(n.prompt)} width={preview.width} height={preview.height} />
    </Box>,
    <Box flexDirection="row" gap={2} marginTop={1}>
      <Button key="next" variant="primary" label={t.resume} onPress={() => v.send(n.prompt)} />
      {briefing}
    </Box>,
    n.others.length > 0 && (
      <Box flexDirection="row" flexWrap="wrap" columnGap={2} marginTop={1}>
        <Text color={DIM}>{t.others}</Text>
        {n.others.map(ho => <Button key={`next-other:${keyText(ho.file)}`} plain dimColor label={clip(oneLine(ho.topic), OTHER_CHARS)} onPress={() => v.send(resumeCommand(ho.file))} />)}
        {n.more > 0 && <Text color={DIM}>+{n.more}</Text>}
      </Box>
    ),
  ])
}

// The whole face, under the Sources card; during a session, at the bottom, `Back to the session`.
export function drawOpen(el: El, s: Snapshot, v: RecapView): (RenderElement | null)[] {
  const { Box, Button } = el
  const last = lastSession(s, v.session, v.t)
  return [
    todayCard(el, s, v),
    last === null ? null : lastCard(el, s, v, last),
    nextCard(el, s, v),
    v.prompts.length > 0 ? <Box flexDirection="row" marginTop={1} paddingX={1}><Button key="see-work" plain label={v.t.recap.next.backToWork} onPress={v.showWork} /></Box> : null,
  ]
}
