# Regenerate the cockpit previews

These are documentation previews, not captured Claude Code desktop sessions.
The renderer imports the existing `drawPane`, `drawRecap`, `drawTodo`, and
`drawMemories` functions, their English catalog, the default Terminal mascot,
and the memory graph from the plugin. `demo.json` supplies fictional inputs.
The surrounding chat and window frame in `shell.html` are illustrative.

`render.cjs` maps the desktop element vocabulary to browser HTML. Text metrics,
Markdown rendering, and controls can differ slightly from the desktop app;
the browser wrapper does not reproduce the Claude engine or perform workspace
actions. Only the three documented tabs switch in the preview. This adapter is
maintainer tooling, outside the starter, plugin, and release builds.

## Capture all four images

Use Node.js, Python 3, an installed Playwright CLI, and its browser. The
TypeScript loader uses the Babel transform bundled with Playwright CLI; no
additional package is installed by these scripts. With a global CLI install:

```bash
bash docs/cockpit-preview/capture.sh
```

For a different installation layout, set `PLAYWRIGHT_BABEL_BUNDLE` to that
installation's `playwright/lib/transform/babelBundle.js` before running the
command. This is an optional development dependency on Playwright's internal
transpiler; if its API changes, update the loader before regenerating.

The script uses a fresh temporary directory and an isolated browser session.
It serves only the generated preview on `127.0.0.1`, fixes the light theme and
fixture clock, and writes four PNGs under `docs/images/`. It closes its own
browser and server on exit, leaving its temporary HTML and logs for inspection.
It never reads a personal workspace or makes a model call.

The committed images were captured on macOS at CSS-pixel scale: 1456 × 847
for the overview and 616 pixels wide for the detail views. System fonts can
change exact pixels on other hosts. Inspect every exported image for clipping,
legibility, and consistency with the current plugin before committing it.

Change demo content in `demo.json`, cockpit behavior in the plugin source, and
only the browser mapping or illustrative frame here. The product guide is
[Cockpit](../cockpit.md).
