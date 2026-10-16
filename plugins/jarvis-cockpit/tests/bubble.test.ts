import { test, expect, type FoundElement } from 'claude-code/testing'
import type { Activity } from '../types'
import { CHEER_MS, NO_TALK, SAVE_FILES, SAVE_TURNS, dismiss, expire, greet, helloText, holdTyping, noteWrites, onPrompt, onTurnEnd, replay, setup, talkMs, visible } from '../hooks/bubble'
import { strings } from '../hooks/i18n'
import { TYPE_DELAY_MS, speechSvg, typingMs } from '../hooks/lettering'
import { userName } from '../hooks/sources'
import { BUTTON_ROW_PX } from '../hooks/chrome'
import { BOT_H, STAGE_PX } from '../hooks/stage'
import { PANE, PLUGIN } from '../hooks/state'
import { AT, ITALIAN_HEADING, ROOT, fakeGit, fakeVault, liveState, paneProps } from './harness'

const act = (path: string, more: Partial<Activity> = {}): Activity =>
  ({ at: AT, verb: 'edit', path, isProtected: false, isApprox: false, count: 1, turn: 1, ...more }) as Activity
const end = { win: false, failed: false, nowMs: AT }
const T = strings('it')

test('bubble: the greeting says Hello with the first name, or a bare Hello without one; once, until the first turn ends', () => {
  expect(helloText('Alex Rivera', T)).toBe('Hello, Alex!')
  expect(helloText('  ', T)).toBe('Hello!')
  expect(helloText(null, T)).toBe('Hello!')
  const t = greet(NO_TALK, 'Alex Rivera', T)
  expect(t.bubble).toMatchObject({ kind: 'hello', text: 'Hello, Alex!' })
  expect(t.bubble?.until).toBe(undefined)
  expect(greet(dismiss(t, t.bubble?.id ?? 0), 'Alex', T).bubble).toBe(null)
  // A prompt does not close it; the end of the first turn does.
  expect(onPrompt(t, 'ciao').bubble?.kind).toBe('hello')
  expect(onTurnEnd(onPrompt(t, 'ciao'), end, T).bubble).toBe(null)
})

test('bubble: a new memory or a created handoff is announced at turn end with a button; the memory wins', () => {
  const t = noteWrites(NO_TALK, [act('99 - Jarvis/handoffs/h.md', { verb: 'create', role: 'handoff' }), act('99 - Jarvis/memory/MEMORY.md', { role: 'memoria' })], T)
  expect(t.bubble).toBe(null)
  const said = onTurnEnd(t, end, T)
  expect(said.bubble).toMatchObject({ kind: 'memory', text: 'Ho imparato una cosa nuova', action: { label: 'Vedi', open: '99 - Jarvis/memory/MEMORY.md' } })
  expect(said.pending).toBe(null)
  const ended = onTurnEnd(noteWrites(NO_TALK, [act('99 - Jarvis/handoffs/h.md', { verb: 'create', role: 'handoff' })], T), end, T)
  expect(ended.bubble).toMatchObject({ kind: 'handoff', action: { label: 'Apri', open: '99 - Jarvis/handoffs/h.md' } })
  // Editing an existing handoff is not a new handoff; reads do not count.
  expect(noteWrites(NO_TALK, [act('99 - Jarvis/handoffs/h.md', { role: 'handoff' }), act('x.md', { verb: 'read' })], T).pending).toBe(null)
  // A new message closes an action bubble.
  expect(onPrompt(said, 'altro').bubble).toBe(null)
})

// The role of an activity is stored as the localized label, so the bubble has to look for the label of the catalog it is given.
test('English: the activities carry English role names and still raise the memory and handoff bubbles', () => {
  const en = strings('en')
  const memory = act('99 - Jarvis/memory/MEMORY.md', { role: 'memory' })
  const identity = act('99 - Jarvis/memory/soul.md', { role: 'identity' })
  const handoff = act('99 - Jarvis/handoffs/h.md', { verb: 'create', role: 'handoff' })
  expect(onTurnEnd(noteWrites(NO_TALK, [memory], en), end, en).bubble).toMatchObject({ kind: 'memory', action: { open: '99 - Jarvis/memory/MEMORY.md' } })
  expect(onTurnEnd(noteWrites(NO_TALK, [identity], en), end, en).bubble).toMatchObject({ kind: 'memory', action: { open: '99 - Jarvis/memory/soul.md' } })
  expect(onTurnEnd(noteWrites(NO_TALK, [handoff], en), end, en).bubble).toMatchObject({ kind: 'handoff', action: { open: '99 - Jarvis/handoffs/h.md' } })
  // The memory still wins over the handoff, whichever came first.
  expect(onTurnEnd(noteWrites(NO_TALK, [handoff, memory], en), end, en).bubble?.kind).toBe('memory')
  expect(onTurnEnd(noteWrites(NO_TALK, [memory, handoff], en), end, en).bubble?.kind).toBe('memory')
  // An edit to an existing handoff is not a new one.
  expect(noteWrites(NO_TALK, [act('99 - Jarvis/handoffs/h.md', { role: 'handoff' })], en).pending).toBe(null)
  // The labels are the catalog's: the Italian name under the English catalog (and the other way round) is just a file.
  expect(noteWrites(NO_TALK, [act('99 - Jarvis/memory/MEMORY.md', { role: 'memoria' })], en).pending).toBe(null)
  expect(noteWrites(NO_TALK, [memory, identity], T).pending).toBe(null)
})

test('bubble: after enough files or turns it offers to save, once until the next save; then it says thanks', () => {
  const files = Array.from({ length: SAVE_FILES }, (_, i) => act(`n${i}.md`))
  const t = onTurnEnd(noteWrites(NO_TALK, files, T), end, T)
  expect(t.bubble).toMatchObject({ kind: 'save', text: 'Bel lavoro. Salviamo la sessione?', action: { label: 'Salva', send: '/save-session' } })
  // It does not repeat.
  expect(onTurnEnd(onPrompt(t, 'ancora'), end, T).bubble).toBe(null)
  // Few files: nothing, until the turns add up.
  let few = noteWrites(NO_TALK, files.slice(0, 2), T)
  for (let i = 0; i < SAVE_TURNS - 1; i++) few = onTurnEnd(few, end, T)
  expect(few.bubble).toBe(null)
  expect(onTurnEnd(few, end, T).bubble?.kind).toBe('save')
  // A failed turn does not ask to save.
  expect(onTurnEnd(noteWrites(NO_TALK, files, T), { ...end, failed: true }, T).bubble).toBe(null)
  // /save-session resets the count, and at turn end it thanks with a phrase that disappears on its own.
  const saving = onPrompt(t, '/save-session')
  expect(saving).toMatchObject({ writes: [], turns: 0, isSaving: true })
  const thanks = onTurnEnd(saving, end, T)
  expect(thanks.bubble).toMatchObject({ kind: 'cheer', until: AT + CHEER_MS })
  expect(thanks.said).not.toContain('save')
  expect(visible(thanks, AT + CHEER_MS - 1)).not.toBe(null)
  expect(visible(thanks, AT + CHEER_MS)).toBe(null)
})

test('bubble: onPrompt returns the same object when nothing changes', () => {
  const t = greet(NO_TALK, 'Alex', T)
  expect(onPrompt(t, 'ciao')).toBe(t)
  expect(onPrompt(NO_TALK, 'ciao')).toBe(NO_TALK)
  const said = onTurnEnd(noteWrites(NO_TALK, [act('99 - Jarvis/memory/MEMORY.md', { role: 'memoria' })], T), end, T)
  expect(onPrompt(said, 'altro')).not.toBe(said)
})

test('bubble: a cheer said while the robot walks starts when it arrives: absent before, then it lasts its full time', () => {
  const cheer = { ...NO_TALK, bubble: { id: 1, kind: 'cheer' as const, text: 'Evvai!', at: AT, until: AT + CHEER_MS }, seq: 1 }
  const held = holdTyping(cheer, AT, AT + 1200)
  expect(held.bubble).toMatchObject({ at: AT + 1200, until: AT + 1200 + CHEER_MS })
  expect(visible(held, AT + 1199)).toBe(null)
  expect(visible(held, AT + 1200)).not.toBe(null)
  // Already held, no walk, or already finished before the robot sets off: it stays as it is.
  expect(holdTyping(held, AT + 100, AT + 1200)).toBe(held)
  expect(holdTyping(cheer, AT, null)).toBe(cheer)
  expect(holdTyping(cheer, AT + talkMs('Evvai!'), AT + 5000)).toBe(cheer)
  // A bubble with a button is not typed out: it appears whole, even during the walk.
  const save = { ...NO_TALK, bubble: { id: 2, kind: 'save' as const, text: 'Bel lavoro. Salviamo la sessione?', action: { label: 'Salva', send: '/save-session' } }, seq: 2 }
  expect(holdTyping(save, AT, AT + 1200)).toBe(save)
  expect(visible(save, AT)).toBe(save.bubble)
})

test('bubble: a prompt that does not change the bubble does not rewrite it', async ($, on) => {
  const state = liveState(on, { opened: true, talk: greet(NO_TALK, 'Alex', T) })
  on('prompt.submit', (_$, e) => ({ text: e.text }) as never)
  await $.prompt.submit({ text: 'ciao' } as never)
  expect(state.sets.talk).toBe(undefined)
})

test('bubble: a write to an already counted file keeps the same object, even with a memory pending', () => {
  const t = noteWrites(NO_TALK, [act('a.md'), act('99 - Jarvis/memory/MEMORY.md', { role: 'memoria' })], T)
  expect(t.writes).toEqual(['a.md', '99 - Jarvis/memory/MEMORY.md'])
  expect(noteWrites(t, [act('a.md')], T)).toBe(t)
  expect(noteWrites(t, [act('99 - Jarvis/memory/MEMORY.md', { role: 'memoria' })], T)).toBe(t)
  // A new file, or a different memory, changes the bubble.
  expect(noteWrites(t, [act('b.md')], T)).not.toBe(t)
  expect(noteWrites(t, [act('99 - Jarvis/memory/altra.md', { role: 'memoria' })], T).pending).toMatchObject({ action: { open: '99 - Jarvis/memory/altra.md' } })
})

test('bubble: two writes to the same Jarvis file rewrite the bubble only once', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': '# Jarvis\n', 'x.md': 'a' })
  on('agent.list', () => ({ value: [] }))
  on('ui.status', () => ({ value: undefined }) as never)
  on('tool.call', () => ({ result: 'ok' }) as never)
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/x.md`, old_string: 'a', new_string: 'b' })
  expect(state.sets.talk).toBe(1)
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/x.md`, old_string: 'b', new_string: 'c' })
  expect(state.sets.talk).toBe(1)
  await $.tool.call({ tool: 'Edit', file_path: `${ROOT}/y.md`, old_string: 'b', new_string: 'c' })
  expect(state.sets.talk).toBe(2)
})

test('bubble: a passed test or commit cheers with rotating phrases; the first launch invites the user to set up', () => {
  const a = onTurnEnd(NO_TALK, { ...end, win: true }, T)
  const b = onTurnEnd(a, { ...end, win: true }, T)
  expect(a.bubble?.kind).toBe('cheer')
  expect(a.bubble?.action).toBe(undefined)
  expect(a.bubble?.text).not.toBe(b.bubble?.text)
  expect(onTurnEnd(NO_TALK, { ...end, win: true, failed: true }, T).bubble).toBe(null)
  expect(setup(NO_TALK, T, 'Anna Rossi').bubble).toMatchObject({ kind: 'setup', text: 'Hello, Anna! Configuriamo Jarvis?', action: { label: 'Inizia', send: '/first-run' } })
  expect(setup(setup(NO_TALK, T), T).seq).toBe(1)
})

test('pane: a bubble with a button appears whole and the robot keeps its arm down; the button acts and closes it', async ($, on) => {
  const bubble = { id: 3, kind: 'save', text: 'Bel lavoro. Salviamo la sessione?', action: { label: 'Salva', send: '/save-session' }, at: AT }
  const state = liveState(on, { talk: { ...NO_TALK, bubble, seq: 3 } })
  const filled: string[] = []
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }) as never)
  on('prompt.fill', (_$, e) => { filled.push(e.text); return { isFilled: true } })
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps(80) })
  const said = (await pane.findAll({ type: 'Svg' })).find(n => n.props.alt === 'Bel lavoro. Salviamo la sessione?')
  // Whole at once, no typing and no arm: no step while the user moves the mouse to Save.
  expect(said?.props.isInteractive).toBe(undefined)
  expect(String(said?.props.source)).not.toContain('clip-path')
  expect(String(said?.props.source)).not.toContain('class="ac cur"')
  // No boxes: it is text next to the robot.
  expect((await pane.findAll({ type: 'Box' })).filter(b => b.props.borderStyle !== undefined)).toEqual([])
  const robot = (await pane.findAll({ type: 'Svg' })).find(n => String(n.props.source).includes('class="bot"'))
  expect(String(robot?.props.source)).not.toContain('class="fa"')
  expect((await pane.find({ key: 'bubble-act' }))?.props).toMatchObject({ variant: 'primary', label: 'Salva' })
  await pane.press({ key: 'bubble-act' })
  await state.until('talk', v => (v as { bubble: unknown }).bubble === null)
  expect(filled).toEqual(['/save-session'])
  await pane.redraw()
  expect(await pane.find({ key: 'bubble-act' })).toBe(undefined)
})

test('pane: a cheer just said is typed out and the little robot raises its arm', async ($, on) => {
  liveState(on, { talk: { ...NO_TALK, bubble: { id: 1, kind: 'cheer', text: 'Well done!', until: AT + CHEER_MS, at: AT }, seq: 1 } })
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps(80) })
  const said = (await pane.findAll({ type: 'Svg' })).find(n => n.props.alt === 'Well done!')
  // Just said: an image with the cursor at the start; the letters arrive in steps (never an interactive frame, it flickers).
  expect(said?.props.isInteractive).toBe(undefined)
  expect(String(said?.props.source)).toContain('class="ac cur"')
  const robot = (await pane.findAll({ type: 'Svg' })).find(n => String(n.props.source).includes('class="bot"'))
  expect(String(robot?.props.source)).toContain('class="fa"')
  // Even while waving its arm it is an image.
  expect(robot?.props.isInteractive).toBe(undefined)
})

// The keys of the children of a found element (the children are descriptions, the key lives in the props).
const keysOf = (n: FoundElement | undefined): unknown[] => (n?.children ?? []).map(c => (c as { props?: { key?: unknown } }).props?.key)

test('pane: in a narrow pane the bubble replaces the lettering, with nothing under the stage and text and buttons within the robot height', async ($, on) => {
  const text = 'Bel lavoro. Salviamo la sessione?'
  liveState(on, { talk: { ...NO_TALK, bubble: { id: 3, kind: 'save', text, action: { label: 'Salva', send: '/save-session' } }, seq: 3 } })
  fakeVault(on, {})
  // 30 columns: the robot alone; 46: the wide stage, but the text does not fit beside it.
  for (const columns of [30, 46]) {
    const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps(columns) })
    const svgs = await pane.findAll({ type: 'Svg' })
    expect(svgs.some(n => n.props.alt === 'JARVIS')).toBe(false)
    expect(await pane.find({ type: 'Text', text: /^in attesa$/ })).toBe(undefined)
    // A single row: the robot and, in place of the lettering, the bubble with its buttons.
    const row = (await pane.findAll({ type: 'Box' })).find(n => keysOf(n).includes('robot'))
    expect(keysOf(row)).toEqual(['robot', 'said'])
    expect((await pane.findAll({ key: 'speech-3' })).length).toBe(1)
    expect(await pane.find({ key: 'bubble-act' })).toBeDefined()
    const said = svgs.find(n => n.props.alt === text)
    const robot = svgs.find(n => String(n.props.source).includes('class="bot"'))
    expect(Number(said?.props.height) + BUTTON_ROW_PX).toBeLessThanOrEqual(Number(robot?.props.height))
    // With buttons, two lines at most, then the ellipsis.
    expect(said?.props.height).toBe(2 * 20 + 4)
    if (columns === 30) expect(String(said?.props.source)).toContain('…')
    await pane.unmount()
  }
})

test('pane: in a narrow pane a cheer has no buttons and takes three lines; when it is quiet the lettering and the status return', async ($, on) => {
  const state = liveState(on, { talk: { ...NO_TALK, bubble: { id: 1, kind: 'cheer', text: 'Salvato. Bel lavoro! Tutto annotato e al sicuro', until: AT + CHEER_MS, at: AT - 10_000 }, seq: 1 } })
  fakeVault(on, {})
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps(30) })
  const said = (await pane.findAll({ type: 'Svg' })).find(n => n.props.alt?.toString().startsWith('Salvato.'))
  // Said a while ago: the text is already all there, an image with no animation.
  expect(said?.props.isInteractive).toBe(undefined)
  expect(String(said?.props.source)).not.toContain('clip-path')
  expect(said?.props.height).toBe(3 * 20 + 4)
  expect(Number(said?.props.height)).toBeLessThanOrEqual(BOT_H)
  expect(await pane.find({ key: 'bubble-close' })).toBe(undefined)
  expect(await pane.find({ key: 'bubble-act' })).toBe(undefined)
  expect((await pane.findAll({ type: 'Svg' })).some(n => n.props.alt === 'JARVIS')).toBe(false)
  state.values.talk = NO_TALK
  await pane.redraw()
  expect((await pane.findAll({ type: 'Svg' })).some(n => n.props.alt === 'JARVIS')).toBe(true)
  expect(await pane.find({ type: 'Text', text: /^in attesa$/ })).toBeDefined()
})

test('pane: in a wide pane the bubble with buttons fits within the stage height', async ($, on) => {
  const text = 'Ho lasciato il punto per riprendere, con tutto quello che serve per domani mattina'
  liveState(on, { talk: { ...NO_TALK, bubble: { id: 2, kind: 'handoff', text, action: { label: 'Apri', open: 'h.md' } }, seq: 2 } })
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps(80) })
  const said = (await pane.findAll({ type: 'Svg' })).find(n => n.props.alt === text)
  expect(Number(said?.props.height) + BUTTON_ROW_PX).toBeLessThanOrEqual(STAGE_PX)
  expect((await pane.findAll({ type: 'Svg' })).some(n => n.props.alt === 'JARVIS')).toBe(true)
})

test('pane: between 44 and 49 columns the stage is wide but the text does not fit beside it: two lines with buttons, then the ellipsis', async ($, on) => {
  const text = 'Ho lasciato il punto per riprendere, con tutto quello che serve per domani mattina'
  liveState(on, { talk: { ...NO_TALK, bubble: { id: 2, kind: 'handoff', text, action: { label: 'Apri', open: 'h.md' } }, seq: 2 } })
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps(46) })
  const svgs = await pane.findAll({ type: 'Svg' })
  // The stage is the wide one (96 px) and the text has taken the place of the lettering: the cap is the robot height (88), not the stage height.
  expect(svgs.find(n => String(n.props.source).includes('class="bot"'))?.props.height).toBe(STAGE_PX)
  expect(svgs.some(n => n.props.alt === 'JARVIS')).toBe(false)
  const said = svgs.find(n => n.props.alt === text)
  expect(said?.props.height).toBe(2 * 20 + 4)
  expect(Number(said?.props.height) + BUTTON_ROW_PX).toBeLessThanOrEqual(BOT_H)
  expect(String(said?.props.source)).toContain('…')
})

test('bubble: the greeting is said again when the pane opens, then expires; a stale expiry does not remove it', () => {
  const t = greet(NO_TALK, 'Alex', T)
  const again = replay(t, AT)
  expect(again.bubble).toMatchObject({ kind: 'hello', at: AT, until: AT + CHEER_MS })
  expect(expire(again, AT + CHEER_MS - 1).bubble).not.toBe(null)
  expect(expire(again, AT + CHEER_MS).bubble).toBe(null)
  // Said again later: the time of the first one does not remove it.
  expect(expire(replay(again, AT + 4000), AT + CHEER_MS).bubble).not.toBe(null)
  expect(replay(setup(NO_TALK, T), AT)).toEqual(setup(NO_TALK, T))
})

test('sources: the user\'s name comes from CLAUDE.md, then from the identity (Lite or Italian); a placeholder does not count', () => {
  expect(userName('## Chi sono\n\n- Nome: Alex Rivera\n- Ruolo: x\n', '')).toBe('Alex Rivera')
  expect(userName('', "My name is **Jarvis**. I am Anna Rossi's AI collaborator: I think")).toBe('Anna Rossi')
  expect(userName('', 'Mi chiamo **Jarvis**. Sono il collaboratore di Alex: penso')).toBe('Alex')
  expect(userName('', "---\ndescription: Identity for Jarvis when collaborating with Sara.\n---\n")).toBe('Sara')
  expect(userName('', "I am [NAME]'s AI collaborator: I think")).toBe(null)
  expect(userName('# x\n', '')).toBe(null)
})

test('lettering: typed text wraps at a space with the cursor at the end; the robot goes first, then the letters appear in steps', () => {
  const text = 'Bel lavoro. Salviamo la sessione?'
  const done = speechSvg(text, 20)
  expect(done.source).toContain('>Bel lavoro. Salviamo</text>')
  expect(done.source).toContain('>la sessione?</text>')
  expect(done.source).not.toContain('clip-path')
  expect(done.height).toBe(2 * 20 + 4)
  // Before the delay there is no letter, the cursor at the start.
  const before = speechSvg(text, 20, TYPE_DELAY_MS - 1)
  expect(before.source).toContain('<clipPath id="l0"><rect x="0" y="0" width="0.0" height="20"/>')
  expect(before.source).toContain('<rect x="0.0" y="3" width="7.8" height="15" class="ac cur"/>')
  // After one second, 28 letters: the first line (20) and 8 of the second; the measures are already the final ones.
  const mid = speechSvg(text, 20, TYPE_DELAY_MS + 1000)
  expect(mid).toMatchObject({ width: done.width, height: done.height })
  expect(mid.source).not.toContain('clip-path="url(#l0)"')
  expect(mid.source).toContain(`<clipPath id="l1"><rect x="0" y="20" width="${(8 * 7.8).toFixed(1)}"`)
  expect(mid.source).toContain(`<rect x="${(8 * 7.8).toFixed(1)}" y="23" width="7.8" height="15" class="ac cur"/>`)
  // "Reduce motion" shows everything at once.
  expect(mid.source).toContain('@media (prefers-reduced-motion: reduce){text{clip-path:none}')
  // When the time is up, the same image as the fully written text.
  expect(speechSvg(text, 20, typingMs(text))).toEqual(done)
  expect(speechSvg('Hello, Alex!', 30).source).toContain(`<rect x="${(13 * 7.8).toFixed(1)}" y="3"`)
})

test('hook: on start, Hello with the CLAUDE.md name; with no capability table the invitation to set up follows', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': `<!-- jarvis:onboarding-required -->\n# Jarvis\n\n- Nome: Alex Rivera\n\n${ITALIAN_HEADING}` })
  fakeGit(on, { config: 'Altro Nome\n' })
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('session.start', () => ({ cwd: ROOT }) as never)
  const said = state.until('talk', v => (v as { said?: string[] } | undefined)?.said?.includes('setup') === true)
  await $.session.start({ cwd: ROOT } as never)
  await said
  const talk = state.values.talk as { said: string[]; bubble: { kind: string; text: string } }
  expect(talk.said).toEqual(['hello', 'setup'])
  expect(talk.bubble).toMatchObject({ kind: 'setup', text: 'Hello, Alex! Configuriamo Jarvis?' })
})

test('hook: a CLAUDE.md name with a control character still draws the greeting, and the Svg alt has U+FFFD', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': "# Jarvis\n\n- Nome: Al\x1bex\n\n## Capacita' Jarvis\n\n| Capacita' | Fonte autorevole |\n|---|---|\n| Futuro operativo | `Da fare.md` |\n" })
  fakeGit(on, {})
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('session.start', () => ({ cwd: ROOT }) as never)
  const said = state.until('talk', v => (v as { said?: string[] } | undefined)?.said?.includes('hello') === true)
  await $.session.start({ cwd: ROOT } as never)
  await said
  const pane = await $.ui.mount({ plugin: PLUGIN, surface: 'desktop', component: 'Pane', requestId: PANE, props: paneProps(80) })
  expect(await pane.find({ text: /^Il cockpit ha avuto un problema$/ })).toBe(undefined)
  expect((await pane.findAll({ type: 'Svg' })).map(n => n.props.alt)).toContain('Hello, Al�ex!')
})

// The same bubbles in English: the phrases, the buttons and the prompts they send come from the catalog.
const E = strings('en')

test('English: the greeting, the invitation to set up and the end-of-turn phrases come from the catalog', () => {
  expect(helloText('Anna Rossi', E)).toBe('Hello, Anna!')
  expect(helloText(null, E)).toBe('Hello!')
  expect(greet(NO_TALK, 'Anna Rossi', E).bubble).toMatchObject({ kind: 'hello', text: 'Hello, Anna!' })
  expect(setup(NO_TALK, E, 'Anna Rossi').bubble).toMatchObject({ kind: 'setup', text: 'Hello, Anna! Shall we set up Jarvis?', action: { label: 'Start', send: '/first-run' } })
  const memory = act('99 - Jarvis/memory/MEMORY.md', { role: 'memory' })
  const handoff = act('99 - Jarvis/handoffs/h.md', { verb: 'create', role: 'handoff' })
  expect(onTurnEnd(noteWrites(NO_TALK, [memory], E), end, E).bubble).toMatchObject({ kind: 'memory', text: 'I learned something new', action: { label: 'View', open: '99 - Jarvis/memory/MEMORY.md' } })
  expect(onTurnEnd(noteWrites(NO_TALK, [handoff], E), end, E).bubble).toMatchObject({ kind: 'handoff', text: 'I left a handoff to resume from', action: { label: 'Open', open: '99 - Jarvis/handoffs/h.md' } })
  const files = Array.from({ length: SAVE_FILES }, (_, i) => act(`n${i}.md`))
  expect(onTurnEnd(noteWrites(NO_TALK, files, E), end, E).bubble).toMatchObject({ kind: 'save', text: 'Nice work. Save the session?', action: { label: 'Save', send: '/save-session' } })
  // The cheers rotate through the catalog's list, and the thanks after a save through the other one.
  const win = onTurnEnd(NO_TALK, { ...end, win: true }, E)
  expect(E.bubble.wins).toContain(win.bubble?.text)
  const saving = onTurnEnd(onPrompt(NO_TALK, '/save-session'), end, E)
  expect(E.bubble.saved).toContain(saving.bubble?.text)
  expect(E.bubble.wins).toHaveLength(T.bubble.wins.length)
  expect(E.bubble.saved).toHaveLength(T.bubble.saved.length)
})

test('English: the catalog phrases never repeat on a rotation, and none is empty', () => {
  for (const t of [T, E]) {
    for (const list of [t.bubble.wins, t.bubble.saved]) {
      expect(list.every(s => s.trim() !== '')).toBe(true)
      expect(new Set(list).size).toBe(list.length)
    }
  }
})

test('hook in English: a vault with no capability table greets and invites to set up in English', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': '<!-- jarvis:onboarding-required -->\n# Jarvis\n\n- Name: Anna Rossi\n' })
  fakeGit(on, { config: 'Another Name\n' })
  on('command.register', () => ({ value: { isRegistered: true } }) as never)
  on('session.start', () => ({ cwd: ROOT }) as never)
  const said = state.until('talk', v => (v as { said?: string[] } | undefined)?.said?.includes('setup') === true)
  await $.session.start({ cwd: ROOT } as never)
  await said
  const talk = state.values.talk as { said: string[]; bubble: { kind: string; text: string; action: { label: string; send: string } } }
  expect(talk.bubble).toMatchObject({ kind: 'setup', text: E.bubble.setup(E.bubble.hello('Anna')), action: { label: E.bubble.setupAction, send: '/first-run' } })
  expect(talk.bubble.text).toBe('Hello, Anna! Shall we set up Jarvis?')
})

test('hook in English: the memory bubble at the end of a turn comes from the catalog of the vault language', async ($, on) => {
  const state = liveState(on, {})
  fakeVault(on, { 'CLAUDE.md': '## Capabilities\n\n| Capability | Authoritative source |\n|---|---|\n| Durable memory | `99 - Jarvis/memory/MEMORY.md` |\n', '99 - Jarvis/memory/MEMORY.md': '# m\n' })
  on('tool.call', () => ({ result: 'ok' }) as never)
  on('turn.complete', () => ({ text: '' }))
  on('agent.list', () => ({ value: [] }))
  on('ui.status', () => ({ value: undefined }) as never)
  await $.tool.call({ tool: 'Write', file_path: `${ROOT}/99 - Jarvis/memory/MEMORY.md`, content: 'x' })
  await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as never)
  await state.until('talk', v => (v as { bubble?: { kind: string } | null } | undefined)?.bubble?.kind === 'memory')
  expect((state.values.talk as { bubble: unknown }).bubble).toMatchObject({ text: E.bubble.memory, action: { label: E.bubble.memoryAction, open: '99 - Jarvis/memory/MEMORY.md' } })
})
