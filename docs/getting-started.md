# Get started with Jarvis Lite

Jarvis Lite is a complete local workspace folder used through a compatible AI
agent runtime. Keep the folder together: hidden runtime directories and visible
Markdown files are both part of the package.

Choose a new or empty location for the personal workspace. Do not extract or
build the package over an existing Jarvis or another directory with user files.

## Choose an acquisition path

| Path | Current state | Requirements |
| --- | --- | --- |
| Release ZIP | Intended zero-terminal path; pending issue [#5](https://github.com/Erionis/Jarvis-Lite/issues/5) | Compatible agent runtime and filesystem access |
| Source build | Available and verifiable now | Runtime, Git, and Python 3 |

### Build from source now

```bash
git clone https://github.com/Erionis/Jarvis-Lite.git
cd Jarvis-Lite
python3 scripts/build_starter.py --output dist
```

On Windows, use `py -3` when that is the installed Python launcher. The
canonical builder is [`scripts/build_starter.py`](../scripts/build_starter.py).
Open `dist/Jarvis-Lite/`, not the source repository, for personal use.

### Use the release ZIP when it is published

When issue #5 publishes the first release:

1. Download `Jarvis-Lite.zip` and its checksum from the official release.
2. Verify the checksum using that release's instructions.
3. Extract the complete folder without dropping hidden files.

The latest-release link is not presented as available before publication.

## Open the complete workspace

Open the extracted or built `Jarvis-Lite` directory in Codex, Claude Code,
OpenCode, or another compatible runtime. Preserve `.agents` and `.claude`:
they contain physical skill mirrors for runtime discovery.

After extraction or a source build, the top level contains:

```text
Jarvis-Lite/
├── .agents/
├── .claude/
├── .githooks/
├── .gitignore
├── .jarvis-update/
├── 00 - Inbox/
├── 01 - Diary/
├── 99 - Jarvis/
├── AGENTS.md
├── CLAUDE.md
├── START-HERE.md
└── To Do.md
```

- `00 - Inbox` keeps material whose authoritative destination is not clear yet.
- `01 - Diary` stores curated daily history.
- `To Do.md` is the short radar for current and near-future work.
- `99 - Jarvis` contains memory, handoffs, shared behavior, and internal support
  files. Normal use should go through Jarvis rather than manual maintenance.
- The hidden runtime and update directories make skills discoverable and keep
  release metadata; they are part of the package.

## Say `Start Jarvis`

Use your preferred language. First run presents four visible decisions, one at
a time:

1. **Use domain** — work, study, personal life, or a combination.
2. **Identity** — the small amount of explicit context needed to collaborate.
3. **Starting depth** — progressive or a fuller initial map.
4. **Collaboration style** — use the default or state concrete differences.

Jarvis shows the exact personal files, folders, and templates it proposes
before any personalized write. Review that recap and approve it, revise it, or
stop. Silence is not approval.

The full behavioral contract lives in [`first-run`](../skills/first-run/SKILL.md),
and the visible questions live in the
[`first-run` interview](../skills/first-run/interview.md).

## What first run adds

After an approved and verified personal setup, these additions are guaranteed:

```text
Jarvis-Lite/
├── 98 - Archive/
│   └── README.md
└── 99 - Jarvis/
    └── memory/
        └── soul.md
```

`98 - Archive` is the visible home for material intentionally retired from
active work. `soul.md` is the declared Identity source.

A fuller approved setup may also add at most four numbered domain folders and
only templates justified by an explicitly recurring output. A progressive
setup adds no domain folders and no templates. First run never creates a fixed
project taxonomy merely to fill the workspace.

## Optional local Git checkpoint

After personal setup verifies successfully, Jarvis can establish a local Git
checkpoint through its own approval. Git is optional for daily work. A local
commit helps compare and recover changes, but it is not a backup; first run
does not create a remote or push.

If Git is missing, Jarvis can explain the official installation path for the
detected operating system. Installation and checkpoint creation remain separate
decisions.

## Try one real item

Use one small, non-sensitive item: ask Jarvis to summarize it, place it in the
right authoritative source, or identify what would change before writing. You
can also stop immediately with a ready workspace.

Continue with [daily use](daily-use.md). Read [updates and adoption](updates.md)
before changing Jarvis itself.

## If setup does not complete

- An incomplete or failed verification keeps onboarding visibly pending.
- Jarvis reports the exact missing or mismatched path instead of claiming the
  workspace is ready.
- `/jarvis-doctor` performs a read-only bounded audit; it does not repair files.
- Missing Git limits source acquisition or the optional checkpoint, not ordinary
  Markdown work.
- Missing Python 3 blocks source builds and updates, not ordinary Markdown work.

See the canonical [`jarvis-doctor`](../skills/jarvis-doctor/SKILL.md) contract
for diagnostic boundaries, or return to the [Jarvis Lite overview](../README.md).
