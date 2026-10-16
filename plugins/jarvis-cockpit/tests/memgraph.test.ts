import { test, expect } from 'claude-code/testing'
import { strings } from '../hooks/i18n'
import { GRAPH_H, egoSvg, graphAlt, graphWidth } from '../hooks/memgraph'
import type { Memory, MemoryGroup } from '../types'

const IT = strings('it')

const GROUPS: MemoryGroup[] = ['people', 'projects', 'preferences', 'references', 'other']
const mem = (file: string, group: MemoryGroup, links: string[] = []): Memory => ({ file, name: file, description: '', group, links, fresh: null })
const many = (n: number): Memory[] => Array.from({ length: n }, (_, i) => mem(`project_voce_numero_${String(i).padStart(2, '0')}_lunga.md`, GROUPS[i % 5] ?? 'other'))

// Tags opened and closed in order, with no duplicate attributes.
function isWellFormed(src: string): boolean {
  const stack: string[] = []
  for (const m of src.matchAll(/<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g)) {
    const [, close, name = '', attrs = '', self] = m
    const names = [...attrs.matchAll(/\s([a-zA-Z:-]+)=/g)].map(a => a[1])
    if (new Set(names).size !== names.length) return false
    if (self === '/') continue
    if (close === '/') { if (stack.pop() !== name) return false } else stack.push(name)
  }
  return stack.length === 0
}

test('memgraph: well-formed Svg, under the size limit, dark theme, colors by group; same data gives the same string', () => {
  const nb = many(20)
  const center = mem('project_nova_chat.md', 'projects', nb.map(m => m.file))
  for (const w of [280, 400, 520]) {
    const g = egoSvg(center, nb, w, IT)
    expect(isWellFormed(g.source)).toBe(true)
    expect(g.source.length).toBeLessThan(131072)
    expect(g.source).toContain('@media (prefers-color-scheme: dark)')
    expect(g.source).not.toMatch(/animation|@keyframes|<animate/)
    expect(g).toMatchObject({ width: w, height: GRAPH_H })
    expect(g.source).toBe(egoSvg(center, nb, w, IT).source)
  }
  expect(egoSvg(center, nb, 520, IT).source).toContain('.p{fill:#7F77DD}')
})

test('memgraph: more than 12 linked memories draw 12; the first at top center; the alt carries the total', () => {
  const nb = many(20)
  const center = mem('project_nova_chat.md', 'projects', nb.map(m => m.file))
  const g = egoSvg({ ...center, name: 'NOVA Chat' }, nb, 520, IT)
  expect([...g.source.matchAll(/r="5\.5"/g)]).toHaveLength(12)
  expect(g.source).toContain('<circle cx="260.0" cy="30.0" r="5.5" class="p"/><text x="260.0" y="21.0" text-anchor="middle" class="ink">voce numero 00 lu…</text>')
  expect(g.alt).toBe('NOVA Chat e 20 memorie collegate')
  expect(graphAlt(mem('x.md', 'other', ['a.md']), IT)).toBe('x.md e 1 memoria collegata')
  expect(g.source).toContain('<title>NOVA Chat e 20 memorie collegate</title>')
})

test('memgraph: names at the sides point outward, cut to the space left; names with < & " are safe', () => {
  const nb = [mem('a.md', 'people'), mem('reference_<b>&"c".md', 'references'), mem('c.md', 'other'), mem('user_un_nome_davvero_molto_lungo.md', 'people')]
  const g = egoSvg(mem('x.md', 'people', nb.map(m => m.file)), nb, 280, IT)
  // Four linked memories: top, right, bottom, left (clockwise from the top).
  expect(g.source).toContain('text-anchor="start" class="ink">&lt;b&gt;&amp;&quot;c&quot;</text>')
  expect(g.source).toContain('y="187.0" text-anchor="middle" class="ink">c</text>')
  expect(g.source).toMatch(/x="71\.0" y="104\.0" text-anchor="end" class="ink">un nome da…<\/text>/)
  expect(isWellFormed(g.source)).toBe(true)
})

test('memgraph: width is 8.7 px for each column minus the border, between 280 and 520', () => {
  expect(graphWidth(20)).toBe(280)
  expect(graphWidth(44)).toBe(348)
  expect(graphWidth(90)).toBe(520)
})
