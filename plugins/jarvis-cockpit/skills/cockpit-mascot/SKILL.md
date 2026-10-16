---
name: cockpit-mascot
description: Use when the user asks to change, draw, replace, or reset the Jarvis cockpit's mascot (the little robot at the top of the cockpit panel).
---

# Cockpit mascot

The cockpit draws the Terminal, Jarvis Lite's robot, unless the workspace has its own mascot. A
custom mascot is a set of SVG files in `99 - Jarvis/mascot/`, inside the workspace folder that holds
`CLAUDE.md`. It is a cockpit convention, not a Jarvis capability: do not declare it in `CLAUDE.md`.

## Files

| File | When it shows |
|---|---|
| `idle.svg` | Waiting. Required: without a usable `idle.svg` the Terminal comes back. |
| `work.svg` | Thinking, reading, writing. |
| `agent.svg` | A subagent is working. |
| `done.svg` | A turn just ended. |
| `party.svg` | A turn ended with a passing test or commit. |
| `sleep.svg` | No turn for fifteen minutes. |
| `error.svg` | A turn was interrupted or failed. |
| `talk.svg` | Drawn over the current pose while Jarvis greets: only the waving arm. |

A missing or refused pose uses `idle.svg`. The cockpit moves the whole figure itself: it walks
between places, hops on done, bounces on party, and shakes on error.

## Drawing

- Use a `viewBox`; `0 0 66 82` with the feet at the bottom matches the stage best. Other boxes are
  scaled into it, bottom-centred.
- Give `talk.svg` the same `viewBox` as the poses, so the arm lands on the shoulder.
- Optional classes the cockpit animates:
  - `al`: the resting arm, hidden while `talk.svg` is shown;
  - `fa`: the waving part of `talk.svg`; set its `transform-origin` (the shoulder) in your `<style>`;
  - `heart`: beats during the party.
- Do not style `bd`, `mv`, or `wk`: the stage moves them.
- The stage shares its class names with the mascot: `k` and `t` fill, `ks` and `ts` stroke, with the
  stage's ink and teal (and follow light and dark). Use them on purpose, or prefix your own classes
  (`me-arm`). A `<style>` rule applies to the whole drawing, not just to its own file.
- Use `href`, not `xlink:href`: the root `<svg>` tag and its namespace declarations are dropped, so
  the `xlink:` prefix would be undefined.
- Use the colours you like. For dark mode, add `@media (prefers-color-scheme: dark) { ... }` inside
  the file's `<style>`.
- Use ids that are unique across files (`idle-mask`, not `m`): a pose and `talk.svg` share one drawing.

## Refused files

Check every file before delivering it. The cockpit ignores a file, shows a notice once per session,
and falls back as above when the file:

- is larger than 16 KB, is not an `<svg>` document, or has no valid `viewBox`;
- contains `<!DOCTYPE` or `<!ENTITY`;
- contains `<script>`, `<foreignObject>`, `<iframe>` (also under a prefix, such as `<svg:script>`), an
  `on…=` attribute, or `javascript:`;
- contains `<image>` or an HTML media element (`<img>`, `<embed>`, `<video>`, `<audio>`, `<object>`,
  `<link>`, `<source>`), also under a prefix (such as `<h:img>`), an `href` or a `src` that does not
  start with `#`, `@import`, `image-set(`, or a `url(...)` that does not start with `#` (numeric
  character references are read first, so `&#117;rl(http://…)` counts as a `url(`);
- has a backslash in any attribute value, or a backslash or a `&#` character reference inside CSS
  (a `<style>` or a `style` attribute): write attribute values and CSS without escapes;
- animates (`<animate…>`, `<set>`, `@keyframes`, `animation…:`): the panel redraws the mascot step by
  step, so the cockpit moves it instead.

## Changes

- The cockpit rereads the folder when a file in it is written during the session, and at every
  session start.
- To go back to the Terminal, propose renaming the folder (for example `mascot-off`). Delete the files
  only after the user explicitly says so: they are the user's files.
