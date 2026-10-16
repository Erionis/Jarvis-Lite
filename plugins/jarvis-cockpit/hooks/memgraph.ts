// The small graph of a memory's view: the memory in the center, the linked ones on an ellipse from the top,
// clockwise, in the order they arrive (group and name). A pure Svg image: same data, same string; no motion,
// no flashes.
import type { Memory, MemoryGroup } from '../types'
import { oneLine } from './format'
import { GRAY } from './lettering'
import { shortName } from './memories'
import type { Strings } from './strings'

export const GRAPH_MAX = 12
export const GRAPH_H = 200
const RY = 70
// Room at the sides for the names (18 characters at about 6 px); on a narrow pane the ellipse stays 60 wide.
const SIDE = 110
const MIN_RX = 60
const LABEL_PX = 10.5
const CHAR_PX = 6
const SANS = '-apple-system, system-ui, sans-serif'

// Colors for each group, light and dark; the projects group is the Jarvis teal.
const CLASS: Readonly<Record<MemoryGroup, string>> = { people: 'p', projects: 'j', preferences: 'f', references: 'r', other: 'a' }
const STYLE = '<style>.ink{fill:#1f1e1d}.p{fill:#7F77DD}.j{fill:#13918b}.f{fill:#D85A30}.r{fill:#888780}.a{fill:#B4B2A9}'
  + '@media (prefers-color-scheme: dark){.ink{fill:#ecebe6}.p{fill:#AFA9EC}.f{fill:#F0997B}.r{fill:#B4B2A9}.a{fill:#888780}}</style>'

export type Graph = { source: string; width: number; height: number; alt: string }

const esc = (s: string): string => oneLine(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n1 = (x: number): string => x.toFixed(1)
const cut = (s: string, chars: number): string => { const c = [...s]; return c.length > chars ? `${c.slice(0, Math.max(1, chars - 1)).join('')}…` : s }

// As wide as the pane (8.7 px for each column, minus the border), between 280 and 520 px.
export const graphWidth = (columns: number): number => Math.min(520, Math.max(280, Math.round((columns - 4) * 8.7)))

export const graphAlt = (center: Memory, t: Strings): string => t.memories.mapAlt(center.name, center.links.length)

export function egoSvg(center: Memory, neighbors: readonly Memory[], width: number, t: Strings): Graph {
  const shown = neighbors.slice(0, GRAPH_MAX)
  const cx = width / 2
  const cy = GRAPH_H / 2
  const rx = Math.max(MIN_RX, cx - SIDE)
  const edges: string[] = []
  const nodes: string[] = []
  shown.forEach((m, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / shown.length
    const cos = Math.cos(a)
    const x = cx + rx * cos
    const y = cy + RY * Math.sin(a)
    edges.push(`<line x1="${n1(cx)}" y1="${n1(cy)}" x2="${n1(x)}" y2="${n1(y)}"/>`)
    // At the top and bottom the name sits above or below the point; at the sides it goes outward, cut to the space that is left.
    const isSide = Math.abs(cos) > 0.25
    const anchor = !isSide ? 'middle' : cos > 0 ? 'start' : 'end'
    const lx = !isSide ? x : x + (cos > 0 ? 9 : -9)
    const ly = !isSide ? (y < cy ? y - 9 : y + 17) : y + 4
    const room = !isSide ? 2 * Math.min(x, width - x) : cos > 0 ? width - lx : lx
    const label = cut(shortName(m.file), Math.min(18, Math.floor(room / CHAR_PX)))
    nodes.push(`<circle cx="${n1(x)}" cy="${n1(y)}" r="5.5" class="${CLASS[m.group]}"/>`
      + `<text x="${n1(lx)}" y="${n1(ly)}" text-anchor="${anchor}" class="ink">${esc(label)}</text>`)
  })
  const k = CLASS[center.group]
  const alt = graphAlt(center, t)
  const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${GRAPH_H}" width="${width}" height="${GRAPH_H}">${STYLE}`
    + `<title>${esc(alt)}</title>`
    + `<ellipse cx="${n1(cx)}" cy="${n1(cy)}" rx="${n1(rx)}" ry="${RY}" fill="none" stroke="${GRAY}" stroke-opacity=".25" stroke-dasharray="2 3"/>`
    + `<g stroke="${GRAY}" stroke-opacity=".45" stroke-width="1">${edges.join('')}</g>`
    + `<circle cx="${n1(cx)}" cy="${n1(cy)}" r="15" class="${k}" fill-opacity=".2"/><circle cx="${n1(cx)}" cy="${n1(cy)}" r="9" class="${k}"/>`
    + `<g font-family="${SANS}" font-size="${LABEL_PX}">${nodes.join('')}</g></svg>`
  return { source, width, height: GRAPH_H, alt }
}
