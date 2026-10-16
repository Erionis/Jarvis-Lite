import { test, expect } from 'claude-code/testing'
import * as theme from '../hooks/theme'
import { ICON } from '../hooks/icons'
import { logSvg, previewSvg, ruleSvg, titleSvg, TITLE_CHARS, wrapText } from '../hooks/lettering'
import { PANE, PLUGIN } from '../hooks/state'
import type { Snapshot } from '../types'
import { AT, cardTitles, fakeVault, liveState, paneProps } from './harness'
import { handoffName } from './ports'

const SNAP: Snapshot = {
  takenAt: AT, hasTable: true, missing: ['Inbox'], now: ['a'], nowDue: [null], waiting: 0, waitingItems: [],
  handoffs: [], inbox: null, diary: null,
}

test('palette: no purple, teal for Jarvis, neutral grays for selection and tabs', () => {
  for (const v of Object.values(theme)) if (typeof v === 'string') expect(v.toLowerCase()).not.toContain('8b5cf6')
  for (const src of Object.values(ICON)) expect(src.toLowerCase()).not.toContain('8b5cf6')
  expect(theme.ACCENT).toBe('#13918b')
  expect(theme.ORANGE).toBe('#13918b')
  for (const bg of [theme.HOVER_BG, theme.SELECTED_BG, theme.SEG_ACTIVE]) expect(bg.startsWith('#808080')).toBe(true)
})

test('card title: uppercase Svg with ▌, monospace, accent class, escaped text, truncated', () => {
  const t = titleSvg('Ultimo <handoff> & co')
  expect(t.source.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
  expect(t.source).toContain('▌ULTIMO &lt;HANDOFF&gt; &amp; CO')
  expect(t.source).toContain('font-family="ui-monospace, Menlo, monospace"')
  expect(t.source).toContain('class="ac"')
  expect(t.height).toBe(16)
  expect(t.width).toBe(Math.ceil(22 * 6.6))
  expect(titleSvg('Riprendi').source).toBe(titleSvg('Riprendi').source)
  const long = titleSvg('x'.repeat(80))
  expect(long.source).toContain(`▌${'X'.repeat(TITLE_CHARS - 1)}…<`)
  expect(long.source.length).toBeLessThan(1000)
})

test('sections: no frame; Svg title and rule (tinted when present); tabs with no background or border, the active one an underlined accent Text', async ($, on) => {
  liveState(on, { snapshot: SNAP })
  fakeVault(on, {})
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps() })
  const boxes = await pane.findAll({ type: 'Box' })
  expect(boxes.filter(b => b.props.borderStyle !== undefined)).toEqual([])
  // A Box height is counted in text rows: no Box sets one (a 16 px rule used to take 16 rows).
  expect(boxes.filter(b => b.props.height !== undefined)).toEqual([])
  const rules = (await pane.findAll({ type: 'Svg' })).filter(s => s.props.alt === '─')
  expect(rules.length).toBeGreaterThan(1)
  expect(rules.some(s => s.props.source === ruleSvg().source)).toBe(true)
  expect(rules.some(s => String(s.props.source).includes('#e24b4a'))).toBe(true)
  expect(await cardTitles(pane)).toContain('Fonti')
  const svgs = await pane.findAll({ type: 'Svg' })
  expect(svgs.find(s => s.props.alt === 'Fonti')?.props.source).toBe(titleSvg('Fonti').source)
  // No gray background or border on the tabs: only the active Text and flat Buttons.
  expect(boxes.filter(b => b.props.backgroundColor === theme.SEG_ACTIVE)).toEqual([])
  expect((await pane.find({ type: 'Text', text: /^Recap$/ }))?.props).toMatchObject({ color: '#13918b', bold: true, underline: true })
  expect(await pane.find({ key: 'tab-recap' })).toBe(undefined)
  expect((await pane.find({ key: 'tab-files' }))?.props).toMatchObject({ label: 'File', plain: true, dimColor: true })
  expect((await pane.find({ key: 'tab-reading' }))?.props).toMatchObject({ label: 'Lettura', plain: true, dimColor: true })
  expect((await pane.findAll({ type: 'Button' })).map(b => b.key).filter(k => k?.startsWith('tab-'))).toEqual(['tab-files', 'tab-reading'])
})

test('phosphor log: the turn-start row stays at full ink even when old', () => {
  const rows = [
    { time: '14:00', glyph: '›', verb: '', what: '«vai»', isHead: true },
    ...Array.from({ length: 12 }, (_, i) => ({ time: '14:01', glyph: '◦', verb: 'legge', what: `n${i}.md` })),
  ]
  const ops = [...logSvg(rows, false).source.matchAll(/<g opacity="([^"]+)">/g)].map(m => m[1])
  expect(ops[0]).toBe('1.00')
  expect(ops[1]).toBe('0.40')
  expect(ops[12]).toBe('1.00')
})

test('prompt preview: 12 px gray monospace, wrapped on words, at most three rows closed by …', () => {
  const name = handoffName('2026-10-14', 'nova-kb', { md: false })
  const p = previewSvg(`/handoff resume ${name}`, 60)
  expect(p.source.startsWith('<svg xmlns="http://www.w3.org/2000/svg" class="prompt-preview"')).toBe(true)
  expect(p.source).toContain('font-family="ui-monospace, Menlo, monospace" font-size="12" fill="#8a8a86"')
  expect(p.source).toContain(`<text x="0" y="13">/handoff resume ${name}</text>`)
  expect(p.height).toBe(21)
  expect(p.width).toBe(Math.ceil(43 * 7.2))
  const long = previewSvg('parola '.repeat(40), 30)
  expect([...long.source.matchAll(/<text /g)]).toHaveLength(3)
  expect(long.source).toContain('…</text>')
  expect(long.width).toBeLessThanOrEqual(Math.ceil(31 * 7.2))
  expect(previewSvg('a<b>&"\n', 20).source).toContain('>a&lt;b&gt;&amp;&quot; </text>')
})

test('phosphor log: old rows fade down to a minimum, cursor after the last row, blinks only when asked', () => {
  const row = (i: number) => ({ time: '14:00', glyph: '◦', verb: 'legge', what: `n${i}.md` })
  const rows = Array.from({ length: 15 }, (_, i) => row(i))
  const log = logSvg(rows, false)
  const ops = [...log.source.matchAll(/<g opacity="([^"]+)">/g)].map(m => m[1])
  expect(ops[0]).toBe('0.40')
  expect(ops[13]).toBe('0.94')
  expect(ops[14]).toBe('1.00')
  // The last row: time (6) + symbol (2) + verb (8) + n14.md (6) and a space → the cursor at column 23.
  expect(log.source).toContain(`<rect x="${(23 * 7.8).toFixed(1)}" y="${14 * 20 + 3}"`)
  expect(log.source).not.toContain('<animate')
  expect(logSvg(rows, true).source).toContain('<animate attributeName="opacity"')
  // Rows without a verb (subagent, turn end): the text starts at the verb column.
  expect(logSvg([{ time: '14:00', glyph: '✓', verb: '', what: 'fatto' }], false).source).toContain('<text x="62.4" y="14" class="ink">fatto</text>')
  // A row too long for the pane wraps under the what column, without losing its start.
  const wide = logSvg([{ time: '14:00', glyph: '◦', verb: 'legge', what: 'uno due tre quattro cinque sei sette otto' }], false, 40)
  expect(wide.source).toContain('<text x="124.8" y="14" class="ink">uno due tre quattro</text><text x="124.8" y="34" class="ink">cinque sei sette otto</text>')
  expect(wide.width).toBeLessThanOrEqual(Math.ceil(40 * 7.8))
  // Narrow pane: no verb column, the verb opens the text in gray and the rest wraps.
  const narrow = logSvg([{ time: '11:37', glyph: '◦', verb: 'ripassa', what: 'il contesto · 3 file, 2 ricerche' }], false, 28)
  expect(narrow.source).toContain('<text x="62.4" y="14" class="ink"><tspan fill="#8a8a86">ripassa</tspan> il</text>')
  expect(narrow.source).toContain('<text x="62.4" y="34" class="ink">contesto · 3 file,</text><text x="62.4" y="54" class="ink">2 ricerche</text>')
  expect(narrow.source).not.toContain('…')
  expect(narrow.height).toBe(3 * 20 + 4)
  // The cursor follows the last wrapped row: column 8 + "2 ricerche" (10) + 1.
  expect(narrow.source).toContain(`<rect x="${(19 * 7.8).toFixed(1)}" y="${2 * 20 + 3}"`)
  expect(narrow.width).toBeLessThanOrEqual(Math.ceil(28 * 7.8))
})

test('card title: cut on code points, control characters removed, &quot; escaped', () => {
  // An emoji (two UTF-16 units) at the cut point is not split and counts as one.
  const emoji = titleSvg(`${'a'.repeat(TITLE_CHARS - 2)}😀xx`)
  expect(emoji.source).toContain(`▌${'A'.repeat(TITLE_CHARS - 2)}😀…<`)
  expect(emoji.source).not.toMatch(/[\ud800-\udbff](?![\udc00-\udfff])/)
  expect(titleSvg(`${'a'.repeat(TITLE_CHARS - 1)}😀`).source).toContain(`${'A'.repeat(TITLE_CHARS - 1)}😀<`)
  expect(titleSvg('😀😀').width).toBe(Math.ceil(3 * 6.6))
  const cut = titleSvg(`${'a'.repeat(TITLE_CHARS - 1)}😀x`)
  expect(cut.source).toContain(`▌${'A'.repeat(TITLE_CHARS - 1)}…<`)
  expect(cut.width).toBe(Math.ceil((TITLE_CHARS + 1) * 6.6))
  // Control characters (newline, tab, NUL, DEL) are removed: they are not valid in XML.
  const ctl = titleSvg('a\nb\tc\u0000d\u007fe')
  expect(ctl.source).toContain('▌ABCDE<')
  expect(ctl.width).toBe(Math.ceil(6 * 6.6))
  expect(titleSvg('dice "ciao"').source).toContain('▌DICE &quot;CIAO&quot;<')
})

test('folder icons: teal like the mascot, no lavender', () => {
  for (const k of ['dir', 'dirOpen'] as const) {
    expect(ICON[k]).toContain('#13918b')
    expect(ICON[k]).not.toContain('#7F77DD')
  }
})

test('wrapText: whole words, a long word is split, at most three rows with … at the end', () => {
  expect(wrapText('uno due tre', 7)).toEqual(['uno due', 'tre'])
  expect(wrapText('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij'])
  expect(wrapText('a b c d e f g h', 4)).toEqual(['a b', 'c d', 'e f…'])
  expect(wrapText('breve', Infinity)).toEqual(['breve'])
  // On a single row it fills the whole width, even mid-word.
  expect(wrapText('python3 /private/tmp/claude', 12, 1)).toEqual(['python3 /pr…'])
  expect(wrapText('breve', 12, 1)).toEqual(['breve'])
})
