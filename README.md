# Jarvis Lite

Easy to start. Yours to evolve.

Jarvis Lite is a small, public, harness-agnostic starting point for a personal
AI collaborator. It gives an agent a durable identity, memory, task radar,
daily history, safe local Git checkpoints, and a focused set of reusable
skills—all as readable Markdown.

## Start in three steps

1. Download `Jarvis-Lite.zip` from the [latest release](https://github.com/Erionis/Jarvis-Lite/releases/latest).
2. Extract the complete `Jarvis-Lite` folder, including the hidden `.claude`
   and `.agents` directories.
3. Open that folder in Codex, Claude Code, or OpenCode and say `Start Jarvis`.

The first public release has not been published yet. Until it is available,
use the source build below. First run uses four short decision moments and can
start progressively or from a fuller map. It keeps identity, stable local
context, current work, and durable memory in separate authoritative sources.
It also checks Git and the operating system automatically, then offers optional
platform-specific installation help and a separately approved local baseline.
It never creates a remote or pushes automatically.

## What is included

The starter includes seven installed skills. Six use only the shared
Markdown/filesystem contract; `jarvis-update` additionally uses the Python 3
standard library for deterministic verification and recovery:

- `briefing` — a grounded start-of-session view;
- `first-run` — safe, conversational onboarding and an optional Git baseline;
- `save-session` — a core Diary, future-work, handoff, and local-recovery
  checkpoint followed by optional memory and workspace maintenance;
- `handoff` — living continuity records that stay visible until work closes;
- `jarvis-memory` — preview-first Identity and durable-memory curation;
- `jarvis-doctor` — a read-only installation and contract audit;
- `jarvis-update` — release-aware updates that preserve or negotiate local
  customizations and always create scoped recovery before changing managed
  files.

Inbox organization is normal Jarvis work. It stays available without a
separate command and can be offered after a successful session checkpoint.
Raw files remain in Inbox until their destination is clear or approved; Lite
does not impose a fixed project hierarchy.

`adopt-capability` remains available in the source repository for people who
already have a Jarvis and want to compare capabilities safely. `defuddle` and
`playwright-cli` are under evaluation because they introduce external tools or
provenance work; they are not bundled in the starter.

## Runtime compatibility

The release contains physical copies of the same installed skills in both
runtime discovery locations:

- `.agents/skills/` for Codex;
- `.claude/skills/` for Claude Code;
- both locations are understood by OpenCode.

There are no symlinks, so the package survives normal ZIP extraction on macOS
and Windows. The Jarvis behavior itself lives in
`99 - Jarvis/system/core-instructions.md`; runtime files are thin adapters.

## Build from source

You need Git and Python 3. Clone the repository and assemble the user package:

```bash
git clone https://github.com/Erionis/Jarvis-Lite.git
cd Jarvis-Lite
python3 scripts/build_starter.py --output dist
```

Open `dist/Jarvis-Lite/` in your agent. On Windows, run the same command with
`py -3` if that is how Python is installed.

The repository's `skills/` directory is the canonical catalog. The builder
copies only the installed allowlist into the release; generated mirrors are
never edited by hand.

## Updating Jarvis Lite

Say `/jarvis-update`. Jarvis shows the installed release identity, the newer
official release, and its practical changes before asking for approval. A
read-only preflight verifies the ZIP checksum and manifest, compares each
managed component with its accepted baseline, and ignores unrelated workspace
health.

The common path needs one confirmation. If a release overlaps a customized
functional skill, Jarvis discusses one conflict at a time and lets you keep and
adapt, replace, merge, or postpone it. Control-plane files such as the updater,
Doctor, and system guardrails become canonical after their previous bytes are
saved in recovery. Consumer-owned identity, memory, work, Diary, handoffs,
Inbox, local extensions, and Git history are never release-managed.

The update records a scoped local recovery point, applies only the approved
plan, and runs a focused verification without invoking Doctor. You can then ask
to roll back that update. Rollback stops before mutation if an in-scope file
has changed again since the update, so a newer local edit is not silently
overwritten. If Python 3 is unavailable, updating is blocked with no consumer
change; normal Jarvis work remains available.

For an older Lite without `jarvis-update`, download the official ZIP and
checksum, verify and extract them outside the current workspace, then point
your agent at the target artifact's `jarvis-update` skill. That first adoption
establishes the managed baseline without replacing consumer-owned content. It
proceeds only when the existing profile, Lite core marker, and both physical
runtime mirrors identify a real Lite installation.

## Already have a Jarvis?

For a non-Lite Jarvis, point your agent at an immutable Jarvis Lite release or
commit and ask it to compare capabilities semantically. Review the proposed `add`, `adapt`,
`already present`, or `conflict` classification, then approve an exact patch
only for the capabilities you want. Existing identity, memory, paths, local
extensions, and Git history stay authoritative.

## Development

Changes follow issue → short-lived branch → pull request → CI → squash merge.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the complete public workflow and
[docs/provenance.md](docs/provenance.md) for the reuse boundary.

## License

Jarvis Lite is released under the [MIT License](LICENSE).
