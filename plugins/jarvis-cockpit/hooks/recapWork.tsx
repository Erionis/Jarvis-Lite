import type { RenderElement } from 'claude-code'
import type { Snapshot } from '../types'
import type { RecapView } from './recap'
import { card, pill, type El } from './chrome'
import { logSvg } from './lettering'
import { basename, hhmm, keyText, oneLine } from './format'
import { LOG_SHORT, WRITTEN_ALL, WRITTEN_ROWS, activityRows, doing, writtenFiles } from './recapModel'
import { liveFacts, savedAt, topicOf } from './sessionModel'
import { ACCENT, DIM, TEXT } from './theme'

// Careful: `h` is the injected JSX factory, never use it as a variable name.
// The session face of the Recap, from the first prompt: This session, Now, What happened, Written and
// the footer, from the top. No counters that advance: the times are those of the events. What to show is
// decided by recapModel.ts and sessionModel.ts; here only the drawing.

// This session: since what time, on what and the facts, with the errors in red. Without a record (the prompt has
// just started and the record is not there yet) the time and the topic come from the first prompt.
function sessionCard(el: El, s: Snapshot, v: RecapView): RenderElement {
  const { Text } = el
  const rec = v.session
  const first = v.prompts[0]
  const start = rec?.startAt ?? first?.at
  const topic = rec !== null ? topicOf(rec, v.t, s.handoffs) : first !== undefined && first.text !== '' ? first.text : v.t.session.untitled
  const f = liveFacts(
    rec?.prompts ?? v.prompts.length,
    Object.keys(v.written).length,
    rec?.subagents ?? Object.values(v.runs).filter(r => r.type !== '').length,
    rec?.errors ?? v.ends.filter(e => e.reason !== 'answer' && e.reason !== 'aborted').length,
    v.t,
  )
  return card(el, { title: v.t.recap.work.title, ...(start === undefined ? {} : { count: v.t.recap.work.since(hhmm(start)) }) }, [
    <Text color={TEXT} bold wrap="truncate-end">{oneLine(topic)}</Text>,
    <Text color={DIM} wrap="truncate-end">{f.text}{f.errors !== null && <Text color="error">{` · ${f.errors}`}</Text>}</Text>,
  ])
}

// Now: one line of text, not an Svg (it changes at every activity and a reloaded image flickered).
function nowCard(el: El, v: RecapView): RenderElement {
  const { Text } = el
  const d = doing(v.feed, v.runs, v.ends, v.working, v.turnAt, v.t)
  return card(el, { title: v.t.recap.now.title, count: d.label, countColor: v.working ? ACCENT : DIM }, [
    d.line !== null && <Text color={d.color} wrap="truncate-end">{oneLine(d.line)}</Text>,
  ])
}

// What happened: the log as a phosphor terminal (Svg in fixed font, not clickable), divided by turn by the prompt
// row, the most recent at the bottom with the block cursor still. Each action on a single row, closed by `…` if
// it goes on; closed, the last LOG_SHORT, with "N more ›" to open it.
const LOG_MIN_CHARS = 28
function logCard(el: El, v: RecapView): RenderElement | null {
  const { Box, Svg, Button } = el
  const rows = activityRows(v.feed, v.runs, v.ends, v.t, v.prompts)
  if (rows.length === 0) return null
  const shown = v.logOpen ? rows : rows.slice(-LOG_SHORT)
  // The log is in 13 px fixed font, a little wider than the app column: a margin.
  const log = logSvg(shown, false, Math.max(LOG_MIN_CHARS, Math.floor((v.columns - 4) * 0.9)), 1)
  return card(el, { title: v.t.recap.work.logTitle }, [
    <Box marginTop={1} overflow="hidden">
      <Svg source={log.source} alt={v.t.recap.work.logAlt(shown.length)} width={log.width} height={log.height} />
    </Box>,
    rows.length > LOG_SHORT && (
      <Box flexDirection="row">
        <Button key="log-toggle" plain dimColor label={v.logOpen ? v.t.recap.work.logLess : v.t.recap.work.logMore(rows.length - shown.length)} onPress={v.toggleLog} />
      </Box>
    ),
  ])
}

// Written: the files written in the session, the most recent first outside the turn. During the turn the row
// keeps its order and a new file goes last; at the start of a turn it goes back to the most recent first. A
// click opens them (a text file in Reading, an image or a PDF in the Files tab). `+N ›` shows them all together
// with the whole log, "less" closes it. No section without files.
function writtenCard(el: El, v: RecapView): RenderElement | null {
  const { Box, Text, Button } = el
  const { files, more } = writtenFiles(v.written, v.logOpen ? WRITTEN_ALL : WRITTEN_ROWS, v.working)
  if (files.length === 0) return null
  const isCut = Object.keys(v.written).length > WRITTEN_ROWS
  return card(el, { title: v.t.recap.work.writtenTitle }, [
    <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
      {files.map(f => <Button key={`written:${keyText(f)}`} plain label={`${oneLine(basename(f))} ›`} onPress={() => v.openFile(f)} />)}
      {more > 0 && (v.logOpen ? <Text color={DIM}>+{more}</Text> : <Button key="written-more" plain dimColor label={`+${more} ›`} onPress={v.toggleLog} />)}
      {v.logOpen && isCut && <Button key="written-less" plain dimColor label={v.t.recap.work.writtenLess} onPress={v.toggleLog} />}
    </Box>,
  ])
}

// The footer: the diary of the session (saved at HH:MM, or the pill and `Save session ›`), `Handoff ›` and
// `Show overview`.
function footer(el: El, v: RecapView): RenderElement {
  const { Box, Text, Button } = el
  const at = savedAt(v.session, v.nowMs)
  return (
    <Box flexDirection="row" flexWrap="wrap" alignItems="center" columnGap={2} rowGap={1} marginTop={1} paddingX={1}>
      {at !== null ? <Text color="success">{v.t.recap.work.saved(hhmm(at))}</Text> : pill(el, v.t.recap.last.unsaved, 'warning')}
      {at === null && <Button key="save" plain label={v.t.recap.work.save} onPress={() => v.send('/save-session')} />}
      <Button key="handoff" plain label={v.t.recap.work.handoff} onPress={() => v.send('/handoff')} />
      <Button key="see-open" plain label={v.t.recap.work.seeOpen} onPress={v.showOpen} />
    </Box>
  )
}

// The whole face, under the Sources card.
export function drawWork(el: El, s: Snapshot, v: RecapView): (RenderElement | null)[] {
  return [sessionCard(el, s, v), nowCard(el, v), logCard(el, v), writtenCard(el, v), footer(el, v)]
}
