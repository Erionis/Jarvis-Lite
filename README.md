# Jarvis Lite

<p align="center">
  <img src="assets/brand/logo.svg" alt="Jarvis Lite" width="640">
</p>

Easy to start. Yours to evolve.

Jarvis Lite is a readable local-workspace foundation for a personal AI
collaborator. It gives a compatible agent runtime durable identity, memory,
current-work context, daily continuity, safe local restore points, and a small set
of reusable skills—all as files you own.

## Is it for you?

Jarvis Lite fits people who want a useful starting point without adopting a
hosted knowledge system or a fixed way to organize projects. It can begin with
almost no personal structure and evolve only from explicit needs.

It is not a standalone app, hosted service, sync or backup system, AI model, or
universal project taxonomy. You use it through Codex, Claude Code, OpenCode, or
another compatible agent runtime.

## Try it safely

The first public release has not been published yet. The source build is the
currently verifiable path.

### Build from source now

You need Git and Python 3:

```bash
git clone https://github.com/Erionis/Jarvis-Lite.git
cd Jarvis-Lite
python3 scripts/build_starter.py --output dist
```

Open `dist/Jarvis-Lite/` in your agent and say `Start Jarvis` in your language.
On Windows, use `py -3` when that is the installed Python launcher.

### Release ZIP path

When issue [#5](https://github.com/Erionis/Jarvis-Lite/issues/5) publishes the
first release, the zero-terminal path will be:

1. Download `Jarvis-Lite.zip` and its checksum from the official release.
2. Verify the checksum and extract the complete folder, including hidden files.
3. Open that folder in your agent and say `Start Jarvis`.

See [Get started with Jarvis Lite](docs/getting-started.md) for both acquisition
paths, the exact staged workspace tree, and the four first-run decisions.

## What appears in the workspace

```text
Jarvis-Lite/
├── 00 - Inbox/       material without a confirmed destination
├── 01 - Diary/       curated daily history
├── 99 - Jarvis/      memory, continuity, and system support
├── CLAUDE.md         local context and capability map
└── To Do.md          current and near-future work
```

Runtime and update support also live in hidden package directories. First run
adds Identity and Archive; optional domain folders appear only when explicitly
approved. The [getting-started guide](docs/getting-started.md) shows the complete
pre- and post-first-run shape.

## A day with Jarvis

| You say | Jarvis does | Local sources that may change |
| --- | --- | --- |
| `/briefing` | Reads declared evidence and recommends one grounded focus. | None; briefing is read-only. |
| “Work on this decision note.” | Resolves and edits the task's authoritative source. | Only the named or confirmed task source. |
| “Remember this preference.” | Classifies it, previews the exact change, and waits for approval. | None before confirmation; then only the approved Identity or Durable memory patch. |
| `/save-session` | Records the result, future work, involved handoff, and available local restore point in the defined order. | Confirmed session sources and local Git history when available. |
| `/handoff` | Creates or updates one living continuation record. | Only the selected handoff; listing remains read-only. |

The [daily-use guide](docs/daily-use.md) explains the full start, work, close,
handoff, and diagnostic journey.

## Included and deliberately omitted

The starter includes exactly seven installed skills:

- `briefing` — grounded, read-only session orientation;
- `first-run` — conversational onboarding and a verified local restore point;
- `save-session` — Diary, future-work, handoff, and local-recovery closure;
- `handoff` — living continuity across sessions;
- `jarvis-memory` — preview-first Identity and durable-memory curation;
- `jarvis-doctor` — a read-only contract and readiness audit;
- `jarvis-update` — release-aware updates with scoped recovery.

Inbox organization is normal Jarvis work and needs no separate skill. Lite does
not install `ingest`, impose a fixed project hierarchy, or silently add optional
extensions. `adopt-capability` remains repository-only for existing non-Lite
Jarvis installations; the public [updates guide](docs/updates.md) explains that
boundary. The [external references](docs/extensions.md) page names optional
projects without treating them as installation, compatibility, or trust
decisions.

## Local-first safety

Identity, memory, work, history, handoffs, Inbox, local extensions, and Git
history remain owned by the consumer workspace. Jarvis previews protected
memory changes and asks before important, destructive, installation, or
external actions. Updates create scoped recovery before changing managed files.

A local restore point supports comparison and recovery; it is not a backup.
Jarvis uses Git behind the scenes for this local history, but does not create an
online repository or publish your files. If Git is missing, Jarvis explains what
it is and asks before trying to install it. Local files do not imply local model
inference: that depends on the runtime and model provider you use.

## Compatibility and prerequisites

The generated package contains physical copies of installed skills in
`.agents/skills/` for Codex and `.claude/skills/` for Claude Code; OpenCode
understands both locations. There are no symlinks, so ordinary ZIP extraction
works across macOS and Windows.

- Markdown/filesystem read and write access is the daily minimum.
- The source builder and update helpers use the Python 3 standard library.
- Git is required only for the source-build path. For the release ZIP path,
  Jarvis handles local restore-point setup during first run.

## Choose your path

| You are | Continue with |
| --- | --- |
| New to Jarvis Lite | [Getting started](docs/getting-started.md) |
| Using Lite day to day | [Daily use](docs/daily-use.md) |
| Updating Lite or bringing a capability to another Jarvis | [Updates and adoption](docs/updates.md) |
| Exploring optional tools | [Extensions and external references](docs/extensions.md) |
| Contributing | [Contribution workflow](CONTRIBUTING.md) |
| Maintaining the repository or acting as a coding agent | [Architecture](docs/architecture.md) and [maintainer guide](AGENTS.md) |

## Development, provenance, and license

Changes follow issue → short-lived branch → pull request → CI → squash merge.
See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow,
[provenance](docs/provenance.md) for the reuse boundary, and the
[MIT License](LICENSE) for licensing terms.

Brand assets and their minimal usage notes live in
[`assets/brand/`](assets/brand/README.md).
