// Client module of the Reading tab's editor: it draws the raw Markdown and receives keys and clicks.
// It runs in the app's drawing thread: no `$`, no setState in the drawing, no drawn value that depends on
// surface.columns or surface.rows (only the click handler uses them).
// Careful: `h` and `Fragment` belong to the environment, do not use them as names.
import type { ClientModule } from 'claude-code'
import { CURSOR_CLIP, GUTTER, LINE_CLIP, VIEW, fromText, pointAt, reduce, toText, type Ed } from './edit'

// The props the mod passes: the draft text, the cursor and the generation of the text.
export type EditorProps = { text: string; row: number; col: number; gen: number }
// What the editor sends to the mod on every edit, move or click (`save`/`paste` for cmd+s and cmd+v).
export type EditorPost = { gen: number; text: string; row: number; col: number; save?: true; paste?: true }
type Local = Ed & { gen: number }

// Same values as theme.ts (ACCENT, SELECTED_BG): this module imports only edit.ts.
const ACCENT = '#13918b'
const CURSOR_BG = '#8080802e'

// The engine rejects control characters in a Text (except tab and newline): a line with a \x1b made the editor
// unmount. A � is drawn in their place (same length, so the same cursor columns); the text of the draft, and
// what gets saved, stays that of the file.
// The character class repeats that of `drawable` (format.ts) and must be kept identical: it is repeated here
// because this Client module imports only edit.ts. One code unit becomes a single �: the lengths and the
// cursor columns do not change.
const shown = (line: string): string => line.replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, '\uFFFD')

const Editor: ClientModule<EditorProps, Local> = (props, surface) => {
  const { Box, Text } = surface.elements
  // The local state holds until the mod sends a new text (a different gen): then it starts again from the
  // props, with no setState in the drawing.
  const current = (): Local => {
    const s = surface.state
    return s !== undefined && s.gen === props.gen ? s : { ...fromText(props.text, props.row, props.col), gen: props.gen }
  }
  const send = (ed: Ed, extra: { save?: true; paste?: true } = {}): void => {
    const out: EditorPost = { gen: props.gen, text: toText(ed), row: ed.row, col: ed.col, ...extra }
    surface.post(out)
  }

  surface.onKey(ev => {
    const cur = current()
    const out = reduce(cur, ev)
    if (out.act === 'none') return
    if (out.act === 'save') return send(cur, { save: true })
    if (out.act === 'paste') return send(cur, { paste: true })
    surface.setState({ ...out.ed, gen: cur.gen })
    send(out.ed)
  })

  surface.onPointer(ev => {
    if (ev.type !== 'down' || (ev.button ?? 'left') !== 'left') return
    const cur = current()
    const next = pointAt(cur, ev.x, ev.y, surface.columns)
    if (next.row === cur.row && next.col === cur.col) return
    surface.setState({ ...next, gen: cur.gen })
    send(next)
  })

  const s = current()
  const end = Math.min(s.lines.length, s.top + VIEW)
  const rows = []
  for (let i = s.top; i < end; i++) {
    const line = shown(s.lines[i] ?? '')
    const isHead = /^#{1,6} /.test(line)
    const color = isHead ? ACCENT : undefined
    const num = <Box width={GUTTER} flexShrink={0}><Text color="inactive">{String(i + 1).padStart(GUTTER - 1)}</Text></Box>
    if (i !== s.row) {
      rows.push(
        <Box flexDirection="row">
          {num}
          <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
            <Text color={color} bold={isHead} wrap="truncate-end">{line.slice(0, LINE_CLIP) || ' '}</Text>
          </Box>
        </Box>,
      )
      continue
    }
    // The cursor's line wraps in full, with the cursor as an inverted character.
    const fit = line.slice(0, CURSOR_CLIP)
    const c = Math.min(s.col, fit.length)
    rows.push(
      <Box flexDirection="row" backgroundColor={CURSOR_BG}>
        {num}
        <Box flexGrow={1} flexShrink={1} minWidth={0}>
          <Text color={color} bold={isHead} wrap="wrap">{fit.slice(0, c)}<Text inverse>{fit[c] ?? ' '}</Text>{fit.slice(c + 1)}</Text>
        </Box>
      </Box>,
    )
  }
  return <Box flexDirection="column" overflow="hidden">{rows}</Box>
}

export default Editor
