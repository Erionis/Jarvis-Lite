import type { Elements, RenderElement } from 'claude-code'
import type { TodoState } from '../types'
import { card, type El } from './chrome'
import { oneLine } from './format'
import { rewriteLinks } from './reader'
import type { Strings } from './strings'
import { findHead, parseTodo, type TodoBlock, type TodoItem } from './todoModel'
import { ACCENT, DIM, FADED } from './theme'

// Careful: `h` is the injected JSX factory, never use it as a variable name.
// The To Do tab: the whole open file, in the order it is written. Each `##` is a card, each
// `###` a subtitle; each whole item, with the app's Markdown (it wraps, internal links can be pressed), with the
// checkbox on the left (one click checks it) and ✕ on the right (two clicks delete it); the whole prose, in grey;
// "+ Add" at the end of the sections. What to write is decided by todoModel.ts, when by todoFlow.ts. The keys of the
// buttons are the text of the item or of the heading: a click presses the thing that was seen even if a new line
// shifts the others.

type TodoEl = El & Pick<Elements['desktop'], 'Input' | 'Markdown'>
type Head = { line: number; raw: string }

export type TodoView = {
  todo: TodoState
  // The catalog of the cockpit's language.
  t: Strings
  // The name of the tab (the Future work file's name, "To Do"), for the messages.
  label: string
  // The vault root: relative links become file:// as in Reading.
  root: string
  // The text typed in the add field (a module variable, not an atom).
  entry: string
  toggle: (item: TodoItem) => void
  // The first click on ✕: the item (by key) asks to confirm the deletion.
  confirm: (key: string) => void
  // The second click, on the confirmation.
  remove: (item: TodoItem) => void
  link: (href: string) => void
  startAdd: (head: Head) => void
  // A key in the field: it updates only the text, with no redraw.
  type: (text: string) => void
  submit: (head: Head, text: string) => void
  // The cancel button in the field and the discard button on the not-added card.
  cancelAdd: () => void
  // The Reading editor on the file.
  edit: () => void
  // The file in Reading (too big for the tab).
  read: () => void
}

// A piece of the file in the app's Markdown: relative links become file:// and the pane handles them.
function md(el: TodoEl, v: TodoView, key: string, text: string, dim: boolean): RenderElement {
  const { Markdown } = el
  const links = rewriteLinks(text, v.todo.path ?? '', v.root)
  return <Markdown key={key} text={links.text} dimColor={dim} pressableLinks={links.internal} onLinkPress={link => v.link(link.href)} />
}

function itemRow(el: TodoEl, v: TodoView, it: TodoItem): RenderElement {
  const { Box, Text, Button } = el
  const done = it.box === 'done'
  // Done: the first line struck through, the indented lines are only grey.
  const [first = '', ...rest] = it.md.split('\n')
  const text = done && first.trim() !== '' ? [`~~${first}~~`, ...rest].join('\n') : it.md
  // The question that replaces ✕: the column is as wide as it is.
  const sure = v.t.todo.confirmDelete
  return (
    <Box flexDirection="row" gap={1}>
      <Box flexShrink={0}>
        <Button key={`todo-box-${it.key}`} plain label={done ? '☑' : '☐'} onPress={() => v.toggle(it)}><Text color={done ? ACCENT : DIM}>{done ? '☑' : '☐'}</Text></Button>
      </Box>
      <Box flexGrow={1} flexShrink={1} minWidth={0}>{md(el, v, `todo-md-${it.key}`, text, done)}</Box>
      {/* ✕ and the confirmation in the same column, as wide as the confirmation: the item does not change width. */}
      <Box flexShrink={0} width={sure.length} flexDirection="row" justifyContent="flex-end">
        {v.todo.confirm === it.key
          ? <Button key={`todo-del-yes-${it.key}`} plain label={sure} onPress={() => v.remove(it)}><Text color="warning">{sure}</Text></Button>
          : <Button key={`todo-del-${it.key}`} plain dimColor label="✕" onPress={() => v.confirm(it.key)} />}
      </Box>
    </Box>
  )
}

// `open`: the heading row with the field open, found again in the current text; null if none.
function addRow(el: TodoEl, v: TodoView, b: Head & { title: string; key: string }, open: number | null): RenderElement {
  const { Box, Text, Button, Input } = el
  const w = v.t.todo
  if (open !== b.line) {
    return <Box paddingLeft={2}><Button key={`todo-add-${b.key}`} plain dimColor label={w.add} onPress={() => v.startAdd(b)} /></Box>
  }
  return (
    <Box flexDirection="column" paddingLeft={2}>
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Box flexGrow={1} flexShrink={1} minWidth={0}>
          <Input key={`todo-input-${b.key}`} label="+ " placeholder={w.newItemIn(oneLine(b.title))} value={v.entry} autoFocus onInput={v.type} onSubmit={text => v.submit(b, text)} />
        </Box>
        <Box flexShrink={0}><Button key="todo-cancel" plain dimColor label={w.cancel} onPress={v.cancelAdd} /></Box>
      </Box>
      <Text color={FADED}>{w.enterToAdd}</Text>
    </Box>
  )
}

function block(el: TodoEl, v: TodoView, b: TodoBlock, first: boolean, open: number | null): RenderElement | null {
  const { Box, Text } = el
  switch (b.kind) {
    case 'item': return itemRow(el, v, b)
    case 'add': return addRow(el, v, b, open)
    case 'prose': return md(el, v, `todo-prose-${b.line}`, b.md, true)
    case 'sub': return <Box marginTop={first ? 0 : 1}><Text color={FADED} bold>{oneLine(b.title)}</Text></Box>
    default: return null
  }
}

// The blocks split by `##`: those before the first group go on top, without a card.
function groups(blocks: readonly TodoBlock[]): { title: string | null; blocks: TodoBlock[] }[] {
  const out: { title: string | null; blocks: TodoBlock[] }[] = [{ title: null, blocks: [] }]
  for (const b of blocks) {
    if (b.kind === 'group') out.push({ title: b.title, blocks: [] })
    else out[out.length - 1]?.blocks.push(b)
  }
  return out.filter(g => g.title !== null || g.blocks.length > 0)
}

export function drawTodo(el: TodoEl, v: TodoView): RenderElement {
  const { Box, Text, Button } = el
  const t = v.todo
  const w = v.t.todo
  const note = t.note !== null && <Box marginTop={1} paddingX={1}><Text color="warning">{oneLine(t.note)}</Text></Box>
  if (t.error !== null) {
    return <Box flexDirection="column" paddingX={1}>{note}<Box marginTop={1} paddingX={1}><Text color="error">{oneLine(w.unreadable(t.path ?? v.label, t.error))}</Text></Box></Box>
  }
  if (t.isTooBig) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginTop={1} paddingX={1}><Text color={DIM}>{w.tooBig(oneLine(v.label))}</Text></Box>
        <Box marginTop={1} paddingX={1}><Button key="todo-read" plain label={w.openInReading} onPress={v.read} /></Box>
      </Box>
    )
  }
  if (t.text === null) return <Box marginTop={1} paddingX={2}><Text color={DIM}>{w.loading}</Text></Box>
  const blocks = parseTodo(t.text)
  // The open field is found again by its heading. If the heading is gone, duplicated or no longer has its Add button,
  // the text written stays in the not-added card, and the next Add button picks it up again.
  const at = t.adding === null ? null : findHead(t.text, t.adding)
  const open = blocks.some(b => b.kind === 'add' && b.line === at) ? at : null
  const lost = t.adding !== null && open === null && v.entry.trim() !== '' && card(el, { title: w.notAdded }, [
    <Box marginTop={1}><Text>{v.entry}</Text></Box>,
    <Box flexDirection="row" marginTop={1}><Button key="todo-lost-discard" plain dimColor label={w.discard} onPress={v.cancelAdd} /></Box>,
  ])
  return (
    <Box flexDirection="column" paddingX={1}>
      {note}
      {lost}
      {groups(blocks).map(g => {
        const body = g.blocks.map((b, i) => block(el, v, b, i === 0, open))
        return g.title === null ? <Box flexDirection="column" marginTop={1} paddingX={1}>{body}</Box> : card(el, { title: g.title }, body)
      })}
      <Box flexDirection="row" marginTop={1} paddingX={1}><Button key="todo-edit" plain label={w.editFile} onPress={v.edit} /></Box>
    </Box>
  )
}
