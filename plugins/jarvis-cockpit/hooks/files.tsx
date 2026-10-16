import type { Color, Elements, RenderElement } from 'claude-code'
import type { FileOp, GitView, Numstat, Tree, TreeNode } from '../types'
import { basename, dirname, hhmm, keyText, oneLine } from './format'
import { fileIcon, type IconName } from './icons'
import { formatSize } from './sizes'
import { ageLabel, dirCounts, visibleRows } from './tree'
import type { Strings } from './strings'
import { card, dot, icon, pill, rule, type El } from './chrome'
import { DIM, FADED, HOVER_BG, ORANGE, PILL_BG, SEG_ACTIVE, SELECTED_BG } from './theme'

// Careful: `h` is the injected JSX factory, never use it as a variable name.
// The Files tab: Box rows with hover, Svg icon, name as a flat Button, actions on mouse hover.
type FilesEl = El & Pick<Elements['desktop'], 'Input'>

// Beyond these rows the tree is cut: the rest is found with the filter.
export const MAX_ROWS = 200

// Pure view-model: register.tsx reads the atoms and passes values and callbacks.
export type FilesView = {
  tree: Tree
  // The catalog of the cockpit's language.
  t: Strings
  // The filter text as the user is typing it; the results follow tree.query.
  query: string
  git: GitView | null
  numstat: Numstat | null
  // Folder sizes from `du`: absent = being computed, null = failed.
  sizes: Readonly<Record<string, number | null>>
  written: Readonly<Record<string, number>>
  nowMs: number
  press: (id: string) => void
  copy: (id: string) => void
  openInApp: (id: string) => void
  // A key in the filter: the search starts shortly after the last key.
  typeQuery: (text: string) => void
  // Enter in the filter: the search starts at once.
  search: (query: string) => void
  toggleHidden: () => void
  toggleSizes: () => void
  collapseAll: () => void
  unselect: () => void
  // Trash or move in progress on the selected file.
  op: FileOp | null
  // The text of the Move field as the user is typing it.
  moveText: string
  // Actions on the selected file; null for a protected file or one outside the vault (then the footer has no actions).
  ops: FileOps | null
}

export type FileOps = {
  start: (kind: FileOp['kind']) => void
  duplicate: () => void
  confirmTrash: () => void
  // A key in the Move field: it only updates the text, with no redraw.
  moveInput: (text: string) => void
  moveSubmit: (text: string) => void
  cancel: () => void
}

export type FileRow = {
  id: string
  name: string
  // In a search: the result's folder, in gray before the name.
  dir: string
  depth: number
  kind: 'dir' | 'file'
  isOpen: boolean
  isBroken: boolean
  icon: IconName
  // File: 1 if written by Jarvis in the session; closed folder: how many written files are under it.
  written: number
  // Closed folder: modified, uncommitted files under it.
  changed: number
  add: number
  del: number
  // Size with Σ, otherwise age; '' if there is nothing to say.
  right: string
}

function rightText(v: FilesView, node: TreeNode | undefined, kind: 'dir' | 'file', id: string): string {
  if (kind === 'dir') {
    if (!v.tree.showSizes) return ''
    if (!(id in v.sizes)) return '…'
    const n = v.sizes[id]
    return n === null || n === undefined ? '—' : formatSize(n, v.t.files.decimalMark)
  }
  if (node === undefined) return ''
  return v.tree.showSizes ? formatSize(node.size, v.t.files.decimalMark) : ageLabel(node.mtimeMs, v.nowMs, v.t.dates)
}

function toRow(v: FilesView, node: TreeNode | undefined, id: string, depth: number, isOpen: boolean, dir: string): FileRow {
  const kind = node?.kind ?? 'file'
  // The name as it is drawn: macOS's `Icon\r` made the whole pane get rejected.
  const name = oneLine(node?.name ?? basename(id))
  const isLink = node?.isLink ?? false
  const ns = v.numstat?.[id]
  const closedDir = kind === 'dir' && !isOpen
  const c = closedDir ? dirCounts(id, Object.keys(v.written), Object.keys(v.git?.changed ?? {})) : { written: 0, changed: 0 }
  return {
    id, name, dir, depth, kind, isOpen,
    isBroken: v.tree.broken.includes(id),
    icon: fileIcon(name, kind, isOpen, isLink),
    written: kind === 'file' ? (v.written[id] !== undefined ? 1 : 0) : c.written,
    changed: c.changed,
    add: ns?.add ?? 0,
    del: ns?.del ?? 0,
    right: rightText(v, node, kind, id),
  }
}

// The rows to draw (at most MAX_ROWS) and how many are left out.
export function fileRows(v: FilesView): { rows: FileRow[]; more: number } {
  const t = v.tree
  const byId = new Map(t.nodes.map(n => [n.id, n]))
  const all: FileRow[] = t.query.trim() !== ''
    ? t.hits.map(id => toRow(v, byId.get(id), id, 0, false, dirname(id)))
    : visibleRows(t, new Set(v.git?.ignored ?? [])).map(r => toRow(v, r.node, r.node.id, r.depth, r.open, ''))
  return { rows: all.slice(0, MAX_ROWS), more: Math.max(0, all.length - MAX_ROWS) }
}

function rowView(el: FilesEl, v: FilesView, r: FileRow): RenderElement {
  const { Box, Text, Button } = el
  const isActive = v.tree.cursor === r.id
  return (
    <Box key={`row:${keyText(r.id)}`} flexDirection="row" alignItems="center" gap={1} paddingLeft={r.depth * 2} backgroundColor={isActive ? SELECTED_BG : undefined} hover={{ backgroundColor: isActive ? SELECTED_BG : HOVER_BG }}>
      <Box width={1} flexShrink={0}>
        {r.kind === 'dir' ? <Button key={`t:${keyText(r.id)}`} plain dimColor label={r.isOpen ? '▾' : '▸'} onPress={() => v.press(r.id)} /> : <Text> </Text>}
      </Box>
      <Box flexShrink={0}>{icon(el, r.icon, v.t.files.icons[r.icon])}</Box>
      <Box flexDirection="row" flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden">
        {r.dir !== '' && <Text color={FADED} wrap="truncate-start">{`${oneLine(r.dir)}/`}</Text>}
        <Button key={`r:${keyText(r.id)}`} plain label={r.name} onPress={() => v.press(r.id)} />
      </Box>
      <Box flexDirection="row" gap={1} flexShrink={0} display="none" hover={{ display: 'flex' }}>
        <Button key={`app:${keyText(r.id)}`} plain dimColor label={v.t.files.openInApp} onPress={() => v.openInApp(r.id)} />
        <Button key={`cp:${keyText(r.id)}`} plain dimColor label={v.t.files.copyPath} onPress={() => v.copy(r.id)} />
      </Box>
      <Box flexDirection="row" gap={1} flexShrink={0}>
        {r.isBroken && <Text color="warning">⚠</Text>}
        {r.written > 0 && (r.kind === 'dir' ? <Text color={ORANGE}>{`● ${r.written}`}</Text> : dot(el, ORANGE))}
        {r.changed > 0 && pill(el, `M:${r.changed}`)}
        {r.add > 0 && pill(el, `+${r.add}`, 'success')}
        {r.del > 0 && pill(el, `−${r.del}`, 'error')}
        {r.right !== '' && <Text color={DIM}>{r.right}</Text>}
      </Box>
    </Box>
  )
}

// Flat toggle of the bar: faint gray background when it is on.
function toggle(el: FilesEl, key: string, label: string, isOn: boolean, onPress: () => void): RenderElement {
  const { Box, Button } = el
  return (
    <Box flexShrink={0} paddingX={1} backgroundColor={isOn ? SEG_ACTIVE : undefined}>
      <Button key={key} plain label={label} onPress={onPress} />
    </Box>
  )
}

// "modified at 14:31" for today, "modified 3d ago" before that; nothing if unknown.
function ago(mtimeMs: number, nowMs: number, t: Strings): string {
  const label = ageLabel(mtimeMs, nowMs, t.dates)
  if (label === '') return ''
  return label.includes(':') ? t.files.modifiedAt(label) : t.files.modifiedAgo(label)
}

// Pill-shaped button of the footer: faint gray background, darker under the mouse.
function chip(el: FilesEl, key: string, label: string, onPress: () => void, color?: Color): RenderElement {
  const { Box, Text, Button } = el
  return (
    <Box key={`chip:${key}`} flexShrink={0} paddingX={1} backgroundColor={PILL_BG} hover={{ backgroundColor: SEG_ACTIVE }}>
      <Button key={key} plain label={label} onPress={onPress}><Text color={color}>{label}</Text></Button>
    </Box>
  )
}

// Footer: a thin rule, then the selected file as a card. Icon and name with a × on the right; below, size,
// age and who wrote it; then the pill actions (move, duplicate, trash). Trash asks for confirmation in their
// place; move becomes a field with the path.
function footer(el: FilesEl, v: FilesView): RenderElement {
  const { Box, Text, Button, Input } = el
  const sel = v.tree.selected
  const t = v.t
  if (sel === '') return <Text color={DIM}>{t.files.noSelection}</Text>
  const ops = v.ops
  const op = v.op?.path === sel ? v.op : null
  const node = v.tree.nodes.find(n => n.id === sel)
  const w = v.written[sel]
  const selIcon = fileIcon(basename(sel), 'file', false, node?.isLink === true)
  const meta = [oneLine(dirname(sel)), node === undefined ? '' : formatSize(node.size, t.files.decimalMark), w !== undefined ? t.files.writtenByJarvis(hhmm(w)) : ago(node?.mtimeMs ?? 0, v.nowMs, t)].filter(Boolean)
  const actions = ops === null ? null
    : op?.kind === 'trash' ? (
      <Box flexDirection="row" alignItems="center" gap={1} flexWrap="wrap">
        <Text color="warning">{t.files.trashAsk}</Text>
        {chip(el, 'trash-yes', t.files.trashYes, ops.confirmTrash, 'error')}
        {chip(el, 'trash-no', t.files.cancel, ops.cancel)}
      </Box>
    )
    : op?.kind === 'move' ? (
      <Box flexDirection="column">
        <Box flexDirection="row" alignItems="center" gap={1}>
          <Box flexGrow={1} flexShrink={1} minWidth={0}>
            <Input key="move" label="→ " value={v.moveText} onInput={ops.moveInput} onSubmit={ops.moveSubmit} />
          </Box>
          {chip(el, 'op-cancel', t.files.cancel, ops.cancel)}
        </Box>
        <Text color={FADED} wrap="truncate-end">{t.files.moveHint}</Text>
      </Box>
    )
    : (
      <Box flexDirection="row" gap={1} flexWrap="wrap">
        {chip(el, 'op-move', t.files.move, () => ops.start('move'))}
        {chip(el, 'op-copy', t.files.duplicate, ops.duplicate)}
        {chip(el, 'op-trash', t.files.trash, () => ops.start('trash'))}
      </Box>
    )
  return (
    <Box flexDirection="column">
      <Box flexDirection="row">{rule(el)}</Box>
      <Box flexDirection="row" alignItems="center" gap={1} marginTop={1}>
        <Box flexShrink={0}>{icon(el, selIcon, t.files.icons[selIcon])}</Box>
        <Box flexGrow={1} flexShrink={1} minWidth={0} overflow="hidden"><Text bold wrap="truncate-end">{oneLine(basename(sel))}</Text></Box>
        <Box flexShrink={0}><Button key="unselect" plain dimColor label="×" onPress={() => v.unselect()} /></Box>
      </Box>
      {meta.length > 0 && <Box paddingLeft={3}><Text color={DIM} wrap="truncate-end">{meta.join(' · ')}</Text></Box>}
      {actions !== null && <Box paddingLeft={3} marginTop={1}>{actions}</Box>}
    </Box>
  )
}

export function drawFiles(el: FilesEl, v: FilesView): RenderElement {
  const { Box, Text, Input } = el
  const t = v.tree
  const words = v.t.files
  const isSearching = t.query.trim() !== ''
  const { rows, more } = fileRows(v)
  const body = t.error !== null ? card(el, { title: words.unreadableTitle, tone: 'error' }, <Text color="error">{oneLine(words.unreadable(t.error))}</Text>)
    : isSearching && t.hits.length === 0 ? <Box marginTop={1}><Text color={DIM}>{words.noMatch(t.query.trim())}</Text></Box>
    : (
      <Box flexDirection="column" marginTop={1}>
        {rows.map(r => rowView(el, v, r))}
        {more > 0 && <Text color={DIM}>{words.moreRows(more)}</Text>}
      </Box>
    )
  return (
    <Box flexDirection="column" paddingX={1} marginTop={1}>
      <Box flexDirection="row" alignItems="center" gap={1}>
        <Box flexGrow={1} flexShrink={1} minWidth={0}>
          <Input key="q" label="⌕ " placeholder={words.filter} value={v.query} onInput={v.typeQuery} onSubmit={v.search} />
        </Box>
        {toggle(el, 'hidden', '.', t.showHidden, v.toggleHidden)}
        {toggle(el, 'sizes', 'Σ', t.showSizes, v.toggleSizes)}
        {toggle(el, 'collapse', '⊟', false, v.collapseAll)}
      </Box>
      {body}
      <Box marginTop={1}>{footer(el, v)}</Box>
    </Box>
  )
}
