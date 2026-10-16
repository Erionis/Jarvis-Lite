import { test, expect, type Engine } from 'claude-code/testing'
import { FIGURE_DIR, MAX_FIGURE_CHARS, buildFigure, checkArt } from '../hooks/customFigure'
import { strings } from '../hooks/i18n'
import { TERMINAL } from '../hooks/terminalFigure'
import { PANE, PLUGIN } from '../hooks/state'
import type { Figure } from '../types'
import { ROOT, fakeGit, fakeVault, liveState, paneProps, settled } from './harness'

const ok = (inner = '<circle cx="5" cy="5" r="4"/>', attrs = 'viewBox="0 0 10 10"'): string => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${inner}</svg>`
const why = (text: string): string | null => { const c = checkArt(text); return 'refused' in c ? c.refused : null }

test('checkArt: a plain SVG with a style, a mask and a local reference is accepted', () => {
  const text = `<?xml version="1.0"?>\n<!-- me -->\n${ok('<style>.a{fill:#007373}@media (prefers-color-scheme: dark){.a{fill:#3fb7b0}}</style><mask id="m"><rect width="9" height="9" fill="#fff"/></mask><circle class="a" mask="url(#m)" cx="5" cy="5" r="4"/><use href="#m"/>')}`
  const c = checkArt(text)
  expect('art' in c && c.art.viewBox).toBe('0 0 10 10')
  expect('art' in c && c.art.body.startsWith('<style>')).toBe(true)
})

test('checkArt: a BOM, and quotes or commas in the viewBox, are fine', () => {
  const c = checkArt(`\uFEFF${ok('<circle/>', "viewBox='-6, 0, 72, 82'")}`)
  expect('art' in c && c.art.viewBox).toBe('-6 0 72 82')
})

test('checkArt: every refused construct names its reason', () => {
  expect(why('x'.repeat(MAX_FIGURE_CHARS + 1))).toBe('tooBig')
  expect(why('<div></div>')).toBe('notSvg')
  expect(why('<svg viewBox="0 0 10 10"><circle/>')).toBe('notSvg')
  expect(why(ok('<!ENTITY x "y">'))).toBe('entity')
  expect(why(ok('<script>alert(1)</script>'))).toBe('script')
  expect(why(ok('<foreignObject/>'))).toBe('script')
  expect(why(ok('<circle onload="x()"/>'))).toBe('script')
  expect(why(ok('<a href="javascript:x()"/>'))).toBe('script')
  expect(why(ok('<image href="a.png"/>'))).toBe('external')
  expect(why(ok('<use href="https://x.test/a.svg#b"/>'))).toBe('external')
  expect(why(ok('<use xlink:href = "b.svg#c"/>'))).toBe('external')
  expect(why(ok('<style>@import "x.css";</style>'))).toBe('external')
  expect(why(ok('<rect fill="url(https://x.test/p)"/>'))).toBe('external')
  expect(why(ok('<animate attributeName="x"/>'))).toBe('animation')
  expect(why(ok('<style>@keyframes k{}</style>'))).toBe('animation')
  expect(why(ok('<style>.a{animation-name:k}</style>'))).toBe('animation')
  expect(why(ok('<circle/>', ''))).toBe('noViewBox')
  expect(why(ok('<circle/>', 'viewBox="0 0 0 10"'))).toBe('noViewBox')
})

test('checkArt: handlers glued to a slash or a quote, prefixed script elements, HTML elements and CSS escapes are refused', () => {
  expect(why(ok('<circle/onclick="x()"/>'))).toBe('script')
  expect(why(ok('<circle fill="red"onclick="x()"/>'))).toBe('script')
  expect(why(ok('<circle\tonload="x()"/>'))).toBe('script')
  expect(why(ok('<svg:script xmlns:svg="http://www.w3.org/2000/svg">alert(1)</svg:script>'))).toBe('script')
  expect(why(ok('<s:foreignObject xmlns:s="http://www.w3.org/2000/svg"/>'))).toBe('script')
  expect(why(ok('<x:iframe/>'))).toBe('script')
  expect(why(ok('<a.b:script xmlns:a.b="http://www.w3.org/2000/svg">alert(1)</a.b:script>'))).toBe('script')
  expect(why(ok('<a.b:foreignObject/>'))).toBe('script')
  expect(why(ok('<é:script/>'))).toBe('script')
  expect(why(ok('<é:iframe/>'))).toBe('script')
  expect(why(ok('<style>.a{background-image:image-set("a.png" 1x)}</style>'))).toBe('external')
  expect(why(ok('<style>.a{background-image:-webkit-image-set("a.png" 1x)}</style>'))).toBe('external')
  for (const el of ['img', 'embed', 'video', 'audio', 'object', 'link', 'source']) expect(why(ok(`<${el} src="a.bin"/>`))).toBe('external')
  expect(why(ok('<link rel="stylesheet" href="#local"/>'))).toBe('external')
  expect(why(ok('<style>.a{fill:\\75rl(a.svg)}</style>'))).toBe('external')
  expect(why(ok('<style type="text/css">@im\\70ort "a.css";</style>'))).toBe('external')
  expect(why(ok('<rect style="fill:\\75rl(a.svg)"/>'))).toBe('external')
  expect(why(ok("<rect style='fill:\\75rl(a.svg)'/>"))).toBe('external')
  // A character reference hides `url(` and `@import` from the patterns just as an escape does.
  expect(why(ok('<rect style="fill:&#117;rl(http://x/p)"/>'))).toBe('external')
  expect(why(ok("<rect style='fill:&#x75;rl(http://x/p)'/>"))).toBe('external')
  expect(why(ok('<style>@&#105;mport "x.css";</style>'))).toBe('external')
  expect(why(ok('<svg:style xmlns:svg="http://www.w3.org/2000/svg">.a{fill:\\75rl(a.svg)}</svg:style>'))).toBe('external')
  expect(why(ok('<style>.a{fill:&#117;rl(a.svg)}</style>'))).toBe('external')
  // A character reference in any attribute value is decoded by the parser: `&#117;rl(` is a `url(`.
  expect(why(ok('<rect fill="&#117;rl(http://x/p)"/>'))).toBe('external')
  expect(why(ok("<rect mask='&#x75;rl(http://x/m)'/>"))).toBe('external')
  expect(why(ok('<rect filter="&#117;&#114;&#108;(http://x/f)"/>'))).toBe('external')
  expect(why(ok('<rect filter="&#x75;&#x72;&#x6C;(http://x/f)"/>'))).toBe('external')
  expect(why(ok('<rect fill="&#117rl(http://x/p)"/>'))).toBe('external')
  expect(why(ok('<use href="&#104;ttp://x/a"/>'))).toBe('external')
  expect(why(ok('<rect fill="&#117;rl(&#34;http://x/p&#34;)"/>'))).toBe('external')
  // The order stays: a handler wins over an external reference, which wins over an animation.
  expect(why(ok('<image href="a.png" onload="x()"/>'))).toBe('script')
  expect(why(ok('<image href="a.png"/><animate/>'))).toBe('external')
})

test('checkArt: media elements under a prefix, a src that is not a fragment and a backslash in an attribute value are refused', () => {
  expect(why(ok('<h:img xmlns:h="http://www.w3.org/1999/xhtml" src="https://x.test/a.png"/>'))).toBe('external')
  for (const el of ['image', 'img', 'embed', 'video', 'audio', 'object', 'link', 'source']) expect([el, why(ok(`<x:${el}/>`))]).toEqual([el, 'external'])
  expect(why(ok('<use src="https://x.test/a.svg"/>'))).toBe('external')
  expect(why(ok("<use src='a.svg'/>"))).toBe('external')
  expect(why(ok('<use src=a.svg/>'))).toBe('external')
  expect(why(ok('<use src = "&#104;ttp://x/a"/>'))).toBe('external')
  expect(why(ok('<use href="#a\\b"/>'))).toBe('external')
  expect(why(ok("<g aria-label='a\\b'/>"))).toBe('external')
  expect(why(ok('<g aria-label="a&#92;b"/>'))).toBe('external')
  // A fragment src stays fine, like a fragment href.
  expect(why(ok('<use src="#a"/>'))).toBe(null)
  expect(why(ok("<use src='#a'/>"))).toBe(null)
})

test('checkArt: the Terminal figure passes, every pose and the waving arm, with its style', () => {
  const arts = { ...TERMINAL.poses, ...(TERMINAL.talk === null ? {} : { talk: TERMINAL.talk }) }
  expect(Object.keys(arts).length).toBe(8)
  for (const [name, art] of Object.entries(arts)) {
    const text = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${art.viewBox}"><style>${TERMINAL.css}</style>${art.body}</svg>`
    expect([name, why(text)]).toEqual([name, null])
  }
})

test('checkArt: a normal drawing is not over-refused (none, class, local href and url, a backslash or a character reference outside CSS, any case of </svg>)', () => {
  const plain = ok('<defs><linearGradient id="g"/></defs><path id="a" class="icon" fill="none" d="M0 0L9 9"/><use href="#a"/><rect fill="url(#g)"/><text>a\\b fish &amp; chips &#169;</text>')
  const c = checkArt(plain)
  expect('art' in c && c.art.body.includes('<use href="#a"/>')).toBe(true)
  // A backslash in the text between two styles belongs to neither.
  expect(why(ok('<style>.a{fill:red}</style><text>\\</text><style>.b{fill:blue}</style>'))).toBe(null)
  expect(why(ok('<rect style="fill:red;stroke:url(#g)"/>'))).toBe(null)
  // Character references are fine when they do not spell a reference, and a reference is read once, not twice.
  expect(why(ok('<rect fill="&#117;rl(#g)"/>'))).toBe(null)
  expect(why(ok('<g aria-label="&#169; 2026"><text>fish &amp; chips &#169; &#x1F600;</text></g>'))).toBe(null)
  expect(why(ok('<rect fill="&amp;#117;rl(http://x/p)"/>'))).toBe(null)
  // Only the external rules read the decoded text: a decoded tag in a text is a text.
  expect(why(ok('<text>&#60;script&#62;alert(1)&#60;/script&#62; &#60;iframe/&#62;</text>'))).toBe(null)
  // A reference that is not a character stays as it is.
  expect(why(ok('<rect fill="&#0;rl(&#55296;&#1114112;&#99999999999999999999;)"/>'))).toBe(null)
  const upper = checkArt('<svg viewBox="0 0 10 10"><circle/></SVG>')
  expect('art' in upper && upper.art.body).toBe('<circle/>')
})

test('buildFigure: no idle (missing or refused) means the whole Terminal', () => {
  expect(buildFigure({}).figure).toBe(TERMINAL)
  const bad = buildFigure({ idle: ok('<script/>'), work: ok() })
  expect(bad.figure).toBe(TERMINAL)
  expect(bad.refused).toEqual([{ file: 'idle.svg', reason: 'script' }])
})

test('buildFigure: missing or refused poses fall back to idle; talk is optional', () => {
  const idle = ok('<circle cx="1" cy="1" r="1"/>')
  const r = buildFigure({ idle, work: ok('<rect width="1" height="1"/>'), party: ok('<script/>'), done: null })
  expect(r.figure.kind).toBe('custom')
  expect(r.figure.poses.work.body).toBe('<rect width="1" height="1"/>')
  expect(r.figure.poses.party.body).toBe('<circle cx="1" cy="1" r="1"/>')
  expect(r.figure.poses.sleep.body).toBe('<circle cx="1" cy="1" r="1"/>')
  expect(r.figure.talk).toBe(null)
  expect(r.refused).toEqual([{ file: 'done.svg', reason: 'tooBig' }, { file: 'party.svg', reason: 'script' }])
})

// The wiring: the vault folder read at session start, drawn in the header and the band above the prompt, and read
// again when a file in it is written.
const LITE = '## Capabilities\n\n| Capability | Authoritative source |\n|---|---|\n| Identity | `99 - Jarvis/memory/soul.md` |\n'
const rel = (f: string): string => `${FIGURE_DIR}/${f}`
const mark = (id: string): string => `<circle id="${id}" cx="5" cy="5" r="4"/>`
const mount = ($: Engine) => $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps() })
const mountBand = ($: Engine) => $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'AbovePrompt', requestId: 'band', props: { hasSurvey: false, isWorking: false, maxRows: 10, bodyColumns: 80, scroll: { offset: 0, bodyRows: 9 }, view: {} } as never })
const sourcesOf = async (view: { findAll: (q: { type: string }) => Promise<{ props: Record<string, unknown> }[]> }): Promise<string> =>
  (await view.findAll({ type: 'Svg' })).map(n => String(n.props.source)).join('\n')

test('mascot folder: a session start draws the vault mascot in the header and the band; a refused file is reported once', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': LITE, [rel('idle.svg')]: ok(mark('mine')), [rel('work.svg')]: ok('<script/>') },
    { [FIGURE_DIR]: [{ name: 'idle.svg', kind: 'file' }, { name: 'work.svg', kind: 'file' }, { name: 'notes.txt', kind: 'file' }] })
  fakeGit(on, {})
  const toasts: string[] = []
  on('ui.toast', (_$, e) => { toasts.push(e.text); return { value: undefined } as never })
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('session.start', () => ({ cwd: ROOT }) as never)
  const reported = state.until('figureNotes', v => Array.isArray(v) && v.length > 0)
  await $.session.start({ cwd: ROOT } as never)
  await reported
  expect(toasts).toEqual([strings('en').figure.refused('work.svg', 'script')])
  expect((state.values.figure as Figure).kind).toBe('custom')
  expect(await sourcesOf(await mount($))).toContain('id="mine"')
  expect(await sourcesOf(await mountBand($))).toContain('id="mine"')
  // The same files read again in the same session say nothing new.
  await $.session.start({ cwd: ROOT } as never)
  await state.clock.settle()
  expect(toasts.length).toBe(1)
})

test('mascot folder: without the folder the Terminal stays and nothing is written', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': LITE })
  fakeGit(on, {})
  on('ui.toast', () => ({ value: undefined }) as never)
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('session.start', () => ({ cwd: ROOT }) as never)
  await $.session.start({ cwd: ROOT } as never)
  await state.clock.settle()
  // Nothing to change, nothing written: every write redraws the pane.
  expect(state.sets.figure).toBe(undefined)
  expect(((state.values.figure ?? TERMINAL) as Figure).kind).toBe('terminal')
  expect(await sourcesOf(await mount($))).not.toContain('id="mine"')
})

test('mascot folder: writing a file in it draws the new mascot after the settle; emptying the folder brings the Terminal back', async ($, on) => {
  const state = liveState(on, {})
  const dir = [{ name: 'idle.svg', kind: 'file' as const }]
  const files = fakeVault(on, { 'CLAUDE.md': LITE, [rel('idle.svg')]: ok(mark('first')) }, { [FIGURE_DIR]: dir })
  fakeGit(on, {})
  on('ui.toast', () => ({ value: undefined }) as never)
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('session.start', () => ({ cwd: ROOT }) as never)
  on('tool.call', () => ({ result: 'ok' }) as never)
  on('agent.list', () => ({ value: [] }))
  const bodyOf = (): string => (state.values.figure as Figure | undefined)?.poses.idle.body ?? ''
  await $.session.start({ cwd: ROOT } as never)
  await state.until('figure', v => (v as Figure | undefined)?.kind === 'custom')
  expect(bodyOf()).toContain('id="first"')
  files.set(`${ROOT}/${rel('idle.svg')}`, ok(mark('second')))
  await $.tool.call({ tool: 'Write', file_path: `${ROOT}/${rel('idle.svg')}`, content: 'x' } as never)
  await settled(state.clock)
  await state.until('figure', v => (v as Figure | undefined)?.poses.idle.body.includes('id="second"') === true)
  dir.length = 0
  await $.tool.call({ tool: 'Write', file_path: `${ROOT}/${rel('idle.svg')}`, content: 'x' } as never)
  await settled(state.clock)
  await state.until('figure', v => (v as Figure | undefined)?.kind === 'terminal')
  expect(state.values.figure).toEqual(TERMINAL)
})

test('mascot folder: a listed file that cannot be statted counts as missing and does not stop the others', async ($, on) => {
  const state = liveState(on, {})
  // `work.svg` is listed but gone by the time it is statted.
  fakeVault(on, { 'CLAUDE.md': LITE, [rel('idle.svg')]: ok(mark('mine')), [rel('agent.svg')]: ok(mark('agent')) },
    { [FIGURE_DIR]: [{ name: 'idle.svg', kind: 'file' }, { name: 'work.svg', kind: 'file' }, { name: 'agent.svg', kind: 'file' }] })
  fakeGit(on, {})
  const toasts: string[] = []
  on('ui.toast', (_$, e) => { toasts.push(e.text); return { value: undefined } as never })
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('session.start', () => ({ cwd: ROOT }) as never)
  await $.session.start({ cwd: ROOT } as never)
  await state.until('figure', v => (v as Figure | undefined)?.kind === 'custom')
  const poses = (state.values.figure as Figure).poses
  expect(poses.work.body).toContain('id="mine"')
  expect(poses.agent.body).toContain('id="agent"')
  expect(toasts).toEqual([])
})
