#!/usr/bin/env bash
set -euo pipefail

# Optional maintainer tooling; nothing here is shipped in the starter.
preview_sources="$(cd "$(dirname "$0")" && pwd)"
repo_dir="$(cd "$preview_sources/../.." && pwd)"
preview_dir="$(mktemp -d "${TMPDIR:-/tmp}/jarvis-cockpit-docs.XXXXXX")"
preview_session="jarvis-docs-$$"
server_pid=""
cleanup() {
  (cd "$preview_dir" && playwright-cli -s="$preview_session" close >/dev/null 2>&1) || true
  if [[ -n "$server_pid" ]]; then kill "$server_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT

command -v node >/dev/null
command -v python3 >/dev/null
command -v playwright-cli >/dev/null
if [[ -z "${PLAYWRIGHT_BABEL_BUNDLE:-}" ]]; then
  PLAYWRIGHT_BABEL_BUNDLE="$(npm root -g)/@playwright/cli/node_modules/playwright/lib/transform/babelBundle.js"
fi
export PLAYWRIGHT_BABEL_BUNDLE
node "$preview_sources/render.cjs" --output "$preview_dir"
python3 - "$preview_dir" <<'PY' >"$preview_dir/server.log" 2>&1 &
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import sys
root = Path(sys.argv[1])
server = ThreadingHTTPServer(('127.0.0.1', 0), partial(SimpleHTTPRequestHandler, directory=str(root)))
(root / 'port').write_text(str(server.server_port))
server.serve_forever()
PY
server_pid="$!"
for attempt in {1..40}; do
  [[ -s "$preview_dir/port" ]] && break
  kill -0 "$server_pid" 2>/dev/null || { cat "$preview_dir/server.log" >&2; exit 1; }
  sleep 0.1
done
[[ -s "$preview_dir/port" ]] || { echo 'Preview server did not start.' >&2; exit 1; }
preview_url="http://127.0.0.1:$(cat "$preview_dir/port")"
cd "$preview_dir"
playwright-cli -s="$preview_session" open about:blank >/dev/null
playwright-cli -s="$preview_session" run-code 'async page => { await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" }); }' >/dev/null
playwright-cli -s="$preview_session" resize 700 980 >/dev/null
mkdir -p "$repo_dir/docs/images"
for tab in recap todo memories; do
  playwright-cli -s="$preview_session" goto "$preview_url/?detail&tab=$tab" >/dev/null
  playwright-cli -s="$preview_session" screenshot '#cockpit' --filename="$repo_dir/docs/images/cockpit-$tab.png" >/dev/null
done
playwright-cli -s="$preview_session" resize 1520 940 >/dev/null
playwright-cli -s="$preview_session" goto "$preview_url" >/dev/null
playwright-cli -s="$preview_session" screenshot '#overview' --filename="$repo_dir/docs/images/cockpit-overview.png" >/dev/null
echo 'Updated the four cockpit PNGs in docs/images/.'
echo "Temporary preview and browser logs: $preview_dir"
