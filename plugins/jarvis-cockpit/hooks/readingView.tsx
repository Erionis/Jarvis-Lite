import type { Elements, RenderElement } from 'claude-code'
import type { DiffView, Draft, Reading } from '../types'
import { basename, clip, dayLabel, hhmm, oneLine } from './format'
import { drawable, isBinaryText, isDirty, rewriteLinks, splitFrontmatter } from './reader'
import { ageLabel, ancestors, isMarkdown } from './tree'
import type { Strings } from './strings'
import { card, pill, segmented, type El } from './chrome'
import type { EditorProps } from './editor'
import { DIM, FADED, TEXT } from './theme'

// Careful: `h` is the injected JSX factory, never use it as a variable name.
type ReaderEl = El & Pick<Elements['desktop'], 'Markdown' | 'Code' | 'Client'>

// How long the meta line says "updated just now" after a Jarvis write.
const FRESH_MS = 60_000
// A frontmatter value longer than this is cut in the pill.
const PILL_CHARS = 40
// Fixed height of the editor Client: the 28 rows of the window plus two spare for the cursor row
// that wraps.
const EDITOR_ROWS = 30

export type ReaderMode = 'text' | 'diff' | 'edit'
export type ConflictAct = 'overwrite' | 'reload' | 'diff'
export type PendingAct = 'save' | 'discard' | 'back'

// Pure view-model: register.tsx reads the atoms and passes values and callbacks.
export type ReaderView = {
  reading: Reading
  // The catalog of the cockpit's language.
  t: Strings
  root: string
  role: string | undefined
  // Why Edit is off (protected file, too long); null if it can be edited.
  editBlocked: string | null
  writtenAt: number | undefined
  // The draft of the open file, if there is one.
  draft: Draft | null
  nowMs: number
  // The name of the file with an unsaved draft, when Edit was asked for here; otherwise null.
  pending: string | null
  saveDraft: () => void
  cancelDraft: () => void
  conflictAct: (a: ConflictAct) => void
  pendingAct: (a: PendingAct) => void
  // No file open but a dirty draft elsewhere: the name of its file, to go back to it; otherwise null.
  strayDraft: string | null
  toDraft: () => void
  back: () => void
  folder: (rel: string) => void
  setMode: (mode: ReaderMode) => void
  link: (href: string) => void
  openInApp: () => void
}

function metaLine(v: ReaderView): string {
  const r = v.reading
  const w = v.t.reading
  const when = r.updatedAt !== null && v.nowMs - r.updatedAt < FRESH_MS ? w.updatedNow
    : v.writtenAt !== undefined ? w.modifiedByJarvis(hhmm(v.writtenAt))
    : (() => { const age = ageLabel(r.mtimeMs, v.nowMs, v.t.dates); return age === '' ? '' : age.includes(':') ? v.t.files.modifiedAt(age) : v.t.files.modifiedAgo(age) })()
  return oneLine([when, v.role ?? ''].filter(Boolean).join(' · '))
}

function diffBody(el: ReaderEl, d: DiffView | null, t: Strings): RenderElement {
  const { Box, Text, Code } = el
  const w = t.reading.diff
  if (d === null) return <Text color={DIM}>{w.loading}</Text>
  if (d.kind === 'untracked') return <Text color={DIM}>{w.untracked}</Text>
  if (d.kind === 'none') return <Text color={DIM}>{w.none}</Text>
  if (d.kind === 'error') return <Text color="error">{w.error}</Text>
  const head = d.kind === 'uncommitted' ? w.uncommitted : oneLine(w.lastCommit(`${dayLabel(d.at, t.dates)} ${hhmm(d.at)}`, d.subject))
  return (
    <Box flexDirection="column">
      <Text color={DIM} wrap="truncate-end">{head}</Text>
      {d.text.trim() === '' ? <Text color={DIM}>{w.noDifference}</Text> : <Code source={drawable(d.text)} format="diff" />}
      {d.isCut && <Text color="warning">{w.cut}</Text>}
    </Box>
  )
}

// The file is not drawn here: the reason and the button that opens it in the Files pane.
function notHere(el: ReaderEl, v: ReaderView, why: string): RenderElement {
  const { Box, Text, Button } = el
  return (
    <Box flexDirection="column">
      <Text color={DIM}>{why}</Text>
      <Button key="reader-open-app" label={v.t.files.openInApp} onPress={() => v.openInApp()} />
    </Box>
  )
}

// A .md as Markdown (clickable internal links); code and other text files colored by the engine,
// with line numbers.
function textBody(el: ReaderEl, v: ReaderView, path: string): RenderElement {
  const { Text, Markdown, Code } = el
  const r = v.reading
  const w = v.t.reading
  if (r.error !== null) return <Text color="error">{oneLine(w.unreadable(r.error))}</Text>
  if (r.isTooBig) return notHere(el, v, w.tooLong)
  if (r.text === null) return <Text color={DIM}>{w.loading}</Text>
  if (isBinaryText(r.text)) return notHere(el, v, w.notText)
  if (!isMarkdown(path)) return <Code source={drawable(r.text)} path={path} startLine={1} />
  const links = rewriteLinks(splitFrontmatter(r.text).body, path, v.root)
  return <Markdown key="doc" text={links.text} pressableLinks={links.internal} onLinkPress={link => v.link(link.href)} />
}

// The file changed under the draft: choose whether to write it anyway, reload, or look at the diff.
function conflictCard(el: ReaderEl, v: ReaderView, d: Draft): RenderElement {
  const { Box, Text, Button, Code } = el
  const w = v.t.reading
  const title = d.conflict === 'jarvis' ? w.conflict.jarvis : w.conflict.disk
  return card(el, { title, tone: 'warning' }, [
    <Text color={DIM} wrap="wrap">{w.conflict.keep}</Text>,
    <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
      <Button key="conflict-overwrite" plain label={w.conflict.overwrite} onPress={() => v.conflictAct('overwrite')} />
      <Button key="conflict-reload" plain dimColor label={w.conflict.reload} onPress={() => v.conflictAct('reload')} />
      <Button key="conflict-diff" plain dimColor label={d.conflictDiff === null ? w.conflict.showDiff : w.conflict.hideDiff} onPress={() => v.conflictAct('diff')} />
    </Box>,
    d.conflictDiff !== null && (d.conflictDiff === '' ? <Text color={DIM}>{w.diff.noDifference}</Text> : <Code source={drawable(d.conflictDiff)} format="diff" />),
    d.conflictDiff !== null && d.conflictDiffCut && <Text color={DIM}>{w.conflict.diffCut}</Text>,
  ])
}

// Edit asked for on a file while there is an unsaved draft on another one.
function pendingCard(el: ReaderEl, v: ReaderView, name: string): RenderElement {
  const { Box, Text, Button } = el
  const w = v.t.reading.pending
  return card(el, { title: w.title(oneLine(name)), tone: 'warning' }, [
    <Text color={DIM} wrap="wrap">{w.hint}</Text>,
    <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
      <Button key="pending-save" plain label={w.save} onPress={() => v.pendingAct('save')} />
      <Button key="pending-discard" plain dimColor label={w.discard} onPress={() => v.pendingAct('discard')} />
      <Button key="pending-back" plain dimColor label={w.back} onPress={() => v.pendingAct('back')} />
    </Box>,
  ])
}

// Edit: the editor (a Client with a fixed height and full width) and the draft bar.
function editBody(el: ReaderEl, v: ReaderView, d: Draft): RenderElement {
  const { Box, Text, Button, Client } = el
  const dirty = isDirty(d)
  const w = v.t.reading.edit
  return (
    <Box flexDirection="column">
      {d.error !== null && card(el, { title: w.notSaved, tone: 'error' }, <Text color="error" wrap="wrap">{oneLine(d.error)}</Text>)}
      {d.conflict !== null && conflictCard(el, v, d)}
      <Client key="editor" module="./editor.tsx" props={{ text: d.text, row: d.row, col: d.col, gen: d.gen } satisfies EditorProps} width="100%" height={EDITOR_ROWS} />
      <Box flexDirection="row" justifyContent="space-between" alignItems="center" marginTop={1}>
        <Box flexShrink={1} minWidth={0} overflow="hidden">
          <Text color={DIM} wrap="truncate-end">{dirty && <Text color="warning">● </Text>}{dirty ? w.unsaved : w.saved}</Text>
        </Box>
        <Box flexDirection="row" gap={2} flexShrink={0} marginLeft={1}>
          <Button key="edit-cancel" plain dimColor label={d.confirmDiscard ? w.confirmDiscard : w.cancel} onPress={() => v.cancelDraft()} />
          <Button key="edit-save" plain label={w.save} onPress={() => v.saveDraft()} />
        </Box>
      </Box>
    </Box>
  )
}

// Path: ← (link history), then each folder as a button that opens it in the Files tab.
function crumbs(el: ReaderEl, v: ReaderView, path: string): RenderElement {
  const { Box, Text, Button } = el
  const dirs = ancestors(path)
  return (
    <Box flexDirection="row" alignItems="center" flexShrink={1} minWidth={0} overflow="hidden">
      <Box flexShrink={0} marginRight={1}><Button key="back" plain label="←" onPress={() => v.back()} /></Box>
      {dirs.map((d, i) => (
        <Box flexDirection="row" flexShrink={1} minWidth={0}>
          <Button key={`crumb-${i}`} plain dimColor label={oneLine(basename(d))} onPress={() => v.folder(d)} />
          <Text color={FADED}>{' / '}</Text>
        </Box>
      ))}
      <Text color={TEXT} bold wrap="truncate-end">{oneLine(basename(path))}</Text>
    </Box>
  )
}

export function drawReader(el: ReaderEl, v: ReaderView): RenderElement {
  const { Box, Text, Button } = el
  const r = v.reading
  const w = v.t.reading
  if (r.path === null) {
    return (
      <Box flexDirection="column" paddingX={1}>
        {card(el, { title: w.noFile }, [
          <Text color={DIM}>{w.pickFile}</Text>,
          v.strayDraft !== null && (
            <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
              <Text color={DIM} wrap="truncate-end">{w.pending.title(oneLine(v.strayDraft))}</Text>
              <Button key="reader-to-draft" plain label={w.pending.back} onPress={() => v.toDraft()} />
            </Box>
          ),
        ])}
      </Box>
    )
  }
  // Frontmatter pills for Markdown only: in any other file the lines between --- are code.
  const meta = r.text === null || !isMarkdown(r.path) ? [] : splitFrontmatter(r.text).meta
  const modes: { id: ReaderMode; label: string }[] = [{ id: 'text', label: w.modes.text }, { id: 'diff', label: w.modes.diff }, ...(v.editBlocked === null ? [{ id: 'edit' as const, label: w.modes.edit }] : [])]
  const body = r.mode === 'diff' ? diffBody(el, r.diff, v.t) : r.mode === 'edit' && v.draft !== null ? editBody(el, v, v.draft) : textBody(el, v, r.path)
  return (
    <Box flexDirection="column" paddingX={1} marginTop={1}>
      {crumbs(el, v, r.path)}
      <Box flexDirection="row" alignItems="center" justifyContent="space-between" marginTop={1}>
        <Box flexDirection="row" alignItems="center" gap={1} flexShrink={1} minWidth={0}>
          <Box flexShrink={0}>{segmented(el, m => `mode-${m}`, modes, r.mode, m => v.setMode(m))}</Box>
          {v.editBlocked !== null && <Box flexShrink={1} minWidth={0} overflow="hidden"><Text color={DIM} wrap="truncate-end">{w.editOff(v.editBlocked)}</Text></Box>}
        </Box>
        <Box flexShrink={0} marginLeft={1}><Button key="open-app" plain label="↗" onPress={() => v.openInApp()} /></Box>
      </Box>
      {meta.length > 0 && (
        <Box flexDirection="row" flexWrap="wrap" gap={1} marginTop={1}>
          {meta.map(m => pill(el, `${m.key}: ${clip(oneLine(m.value), PILL_CHARS)}`))}
        </Box>
      )}
      <Text color={DIM} wrap="truncate-end">{metaLine(v)}</Text>
      {v.pending !== null && pendingCard(el, v, v.pending)}
      <Box marginTop={1} flexDirection="column">{body}</Box>
    </Box>
  )
}
