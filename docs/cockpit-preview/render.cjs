#!/usr/bin/env node
'use strict';

// Documentation only. The cockpit views and SVGs come from the plugin. This
// adapter maps the small desktop element vocabulary to browser HTML; it does
// not load register.tsx, the plugin engine, a real workspace, or a model.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
// The fixture has a fixed local day and clock, independent of the host.
process.env.TZ = 'Europe/Rome';

const args = process.argv.slice(2);
const at = args.indexOf('--output');
if (at < 0 || !args[at + 1] || !process.env.PLAYWRIGHT_BABEL_BUNDLE) {
  console.error('Usage: PLAYWRIGHT_BABEL_BUNDLE=/path/to/playwright/lib/transform/babelBundle.js node docs/cockpit-preview/render.cjs --output /tmp/cockpit-preview');
  process.exit(2);
}
const output = path.resolve(args[at + 1]);
const root = path.resolve(__dirname, '../..');
if (output === root || output.startsWith(root + path.sep) || fs.existsSync(path.join(output, 'index.html'))) {
  throw new Error('Choose a fresh output directory; existing previews are not overwritten.');
}
const { babelTransform } = require(path.resolve(process.env.PLAYWRIGHT_BABEL_BUNDLE));
const jsx = (type, props, key) => ({ type, props: { ...props, key } });
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === 'react/jsx-runtime') return { jsx, jsxs: jsx, Fragment: 'Fragment' };
  return originalLoad.call(this, request, parent, isMain);
};
for (const ext of ['.ts', '.tsx']) {
  Module._extensions[ext] = (mod, filename) => {
    if (!filename.startsWith(path.join(root, 'plugins/jarvis-cockpit/'))) throw new Error('Unexpected TypeScript source');
    const result = babelTransform(fs.readFileSync(filename, 'utf8'), filename, false, [], []);
    if (!result) throw new Error(`Cannot transpile ${filename}`);
    mod._compile(result.code, filename);
  };
}
const hooks = path.join(root, 'plugins/jarvis-cockpit/hooks');
const { drawPane } = require(path.join(hooks, 'pane.tsx'));
const { drawRecap } = require(path.join(hooks, 'recap.tsx'));
const { drawTodo } = require(path.join(hooks, 'todo.tsx'));
const { drawMemories } = require(path.join(hooks, 'memoriesView.tsx'));
const { TERMINAL } = require(path.join(hooks, 'terminalFigure.ts'));
const { EN } = require(path.join(hooks, 'strings.en.ts'));
const demo = JSON.parse(fs.readFileSync(path.join(__dirname, 'demo.json'), 'utf8'));
const nowMs = Date.parse(demo.now);
const noop = () => {};
const el = Object.fromEntries(['Box', 'Text', 'Button', 'Svg', 'Markdown', 'Input'].map(k => [k, k]));
const columns = 66;
const note = {
  day: '2026-10-18', path: '01 - Diary/2026/10/2026-10-18.md',
  parts: [
    { part: 'focus', lines: [{ lead: 'Atlas launch', rest: ' — compare the rollout options' }], more: 0 },
    { part: 'closing', lines: [{ lead: '', rest: 'Two options compared. Ready for review.' }], more: 0 },
  ],
};
const session = {
  v: 1, id: 'demo-previous',
  startAt: Date.parse('2026-10-18T16:10:00+02:00'), lastAt: Date.parse('2026-10-18T16:32:00+02:00'), endAt: Date.parse('2026-10-18T16:32:00+02:00'),
  prompts: 4, firstPrompt: 'Compare the rollout options for Atlas.', resumeOf: null,
  files: ['Atlas/Launch brief.md', 'To Do.md', note.path], fileCount: 3,
  handoff: { file: demo.handoff.file, topic: demo.handoff.topic, status: 'active' },
  diaryDay: note.day, diaryAt: Date.parse('2026-10-18T16:32:00+02:00'), subagents: 0, errors: 0,
};
const snapshot = {
  takenAt: nowMs, hasTable: true, missing: [],
  now: ['Atlas launch brief', 'October reading notes'], nowLabel: 'Now',
  nowTitles: ['Atlas launch brief', 'October reading notes'],
  nowDetails: ["Choose the rollout option before today's review.", 'Turn the three takeaways into a short note.'],
  nowDue: ['2026-10-19', null], waiting: 1, waitingItems: [{ title: 'Launch illustrations', ageDays: 2 }],
  handoffs: [demo.handoff], inbox: { count: 2, oldestDays: 2 },
  diary: { hasToday: false, last: note.day }, lastDiary: note, diaryDays: [note], sessions: [session],
};
const recap = drawRecap(el, {
  snapshot, t: EN, feed: [], prompts: [], session: null, face: 'open', written: {}, runs: {}, ends: [],
  working: false, turnAt: null, roles: demo.roles, nowMs, columns, logOpen: false,
  showOpen: noop, showWork: noop, openFile: noop, openFolder: noop, openTodo: noop, openDiary: noop, toggleLog: noop, send: noop,
});
const todo = drawTodo(el, {
  todo: { path: 'To Do.md', text: demo.todo, mtimeMs: nowMs, size: Buffer.byteLength(demo.todo), isTooBig: false, error: null, confirm: null, adding: null, note: null },
  t: EN, label: 'To Do', root: '/demo-workspace', entry: '', toggle: noop, confirm: noop, remove: noop, link: noop,
  startAdd: noop, type: noop, submit: noop, cancelAdd: noop, edit: noop, read: noop,
});
const memories = drawMemories(el, {
  memories: { dir: '99 - Jarvis/memory', list: demo.memories, error: null, open: 'project_atlas.md', back: [], expanded: [] },
  t: EN, columns, open: noop, follow: noop, back: noop, toggleGroup: noop, read: noop, ask: noop,
});
const esc = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const colors = { text: '#282725', inactive: '#73716b', subtle: '#88857d', success: '#41815b', warning: '#a57020', error: '#bf4242' };
const color = value => colors[value] ?? value;
function style(p) {
  const css = [];
  const set = (name, value) => { if (value !== undefined) css.push(`${name}:${value}`); };
  for (const name of ['flexDirection', 'alignItems', 'justifyContent', 'flexWrap', 'overflow', 'flexGrow', 'flexShrink']) {
    set(name.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`), p[name]);
  }
  const dimension = (name, value) => set(name, typeof value === 'number' ? `${value * 8.7}px` : value);
  dimension('width', p.width); dimension('min-width', p.minWidth); dimension('max-width', p.maxWidth);
  for (const name of ['padding', 'margin']) {
    for (const [suffix, sides, unit] of [
      ['X', ['left', 'right'], 8.7], ['Y', ['top', 'bottom'], 22],
      ['Left', ['left'], 8.7], ['Right', ['right'], 8.7], ['Top', ['top'], 22], ['Bottom', ['bottom'], 22],
    ]) for (const side of sides) if (p[name + suffix] !== undefined) set(`${name}-${side}`, `${p[name + suffix] * unit}px`);
  }
  if (p.gap !== undefined) set('gap', `${p.gap * (p.flexDirection === 'column' ? 22 : 8.7)}px`);
  if (p.columnGap !== undefined) set('column-gap', `${p.columnGap * 8.7}px`);
  if (p.rowGap !== undefined) set('row-gap', `${p.rowGap * 22}px`);
  if (p.color) set('color', color(p.color));
  if (p.backgroundColor) set('background-color', color(p.backgroundColor));
  if (p.bold) set('font-weight', '600');
  if (p.underline) set('text-decoration', 'underline');
  if (p.wrap === 'truncate-end') css.push('overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0');
  if (p.wrap === 'wrap') css.push('white-space:normal;overflow-wrap:anywhere');
  return esc(css.join(';'));
}
function markdown(text) {
  // Only the small inline vocabulary used by this fictional To Do fixture.
  return esc(text).replace(/\[([^\]]+)\]\([^)]+\)/g, '<span class="md-link">$1</span>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/~~([^~]+)~~/g, '<del>$1</del>').replace(/\n/g, '<br>');
}
function render(node, inText = false) {
  if (node === null || node === undefined || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(n => render(n, inText)).join('');
  if (typeof node !== 'object') return esc(node);
  const { type, props: p } = node;
  if (typeof type === 'function') return render(type(p), inText);
  if (type === 'Fragment') return render(p.children, inText);
  if (type === 'Box') return `<div class="box" style="${style(p)}">${render(p.children)}</div>`;
  if (type === 'Text') return `<span class="text" style="${style(p)}">${render(p.children, true)}</span>`;
  if (type === 'Svg') return `<img class="svg" alt="${esc(p.alt)}" width="${p.width}" height="${p.height}" src="data:image/svg+xml;base64,${Buffer.from(p.source).toString('base64')}">`;
  if (type === 'Markdown') return `<div class="markdown${p.dimColor ? ' dim' : ''}">${markdown(p.text)}</div>`;
  if (type === 'Button') {
    const children = p.children !== undefined ? render(p.children, true) : esc(p.label ?? '');
    const action = typeof p.key === 'string' && p.key.startsWith('tab-') ? ` data-tab="${esc(p.key.slice(4))}"` : '';
    return `<button class="button ${p.plain ? 'plain' : p.variant ?? 'secondary'}${p.dimColor ? ' dim' : ''}"${action} style="${style(p)}">${children}</button>`;
  }
  if (type === 'Input') return `<input readonly placeholder="${esc(p.placeholder ?? '')}" value="${esc(p.value ?? '')}">`;
  throw new Error(`Unhandled desktop element: ${type}`);
}
const panes = Object.entries({ recap, todo, memories }).map(([tab, body]) => {
  const pane = drawPane(el, {
    columns, header: { mascot: { state: 'idle', since: nowMs, back: 'idle' }, figure: TERMINAL, t: EN, working: false, turnAt: null, nowMs },
    t: EN, tabs: ['recap', 'diary', 'todo', 'files', 'reading', 'memories'], tab, setTab: noop, todoLabel: 'To Do', hasDraft: false, body,
  });
  return `<section data-pane="${tab}"${tab === 'recap' ? '' : ' hidden'}>${render(pane)}</section>`;
}).join('\n');
const shell = fs.readFileSync(path.join(__dirname, 'shell.html'), 'utf8');
fs.mkdirSync(output, { recursive: true });
fs.writeFileSync(path.join(output, 'index.html'), shell.replace('<!-- COCKPIT_VIEWS -->', panes));
console.log(`Preview written to ${path.join(output, 'index.html')}`);
