# Get started with Jarvis Lite

Jarvis Lite is a complete local workspace folder used through a compatible AI
agent runtime. Keep the folder together: hidden runtime directories and visible
Markdown files are both part of the package.

Choose a new or empty location for the personal workspace. Do not extract or
build the package over an existing Jarvis or another directory with user files.

## Choose an acquisition path

| Path | Current state | Requirements |
| --- | --- | --- |
| Release ZIP | Recommended | Compatible agent runtime and filesystem access |
| Source build | Contributor and technical fallback | Runtime, Git, and Python 3 |

### Download the release ZIP

1. Download the ready-to-use
   [`Jarvis-Lite.zip`](https://github.com/Erionis/Jarvis-Lite/releases/latest/download/Jarvis-Lite.zip).
2. Extract it into a new location. The archive already contains one complete
   `Jarvis-Lite` folder.
3. Open that folder in your agent runtime and continue with
   [Say `Start Jarvis`](#say-start-jarvis).

Do not extract over an existing Jarvis installation or another folder that
contains personal files. Normal ZIP extraction preserves the hidden runtime
directories included inside the package.

#### Optional checksum verification

The checksum confirms that the downloaded ZIP matches the official release
asset. Download
[`Jarvis-Lite.zip.sha256`](https://github.com/Erionis/Jarvis-Lite/releases/latest/download/Jarvis-Lite.zip.sha256)
into the same directory as the ZIP.

On macOS:

```bash
shasum -a 256 -c Jarvis-Lite.zip.sha256
```

On Linux:

```bash
sha256sum -c Jarvis-Lite.zip.sha256
```

On Windows PowerShell:

```powershell
$expected = (Get-Content .\Jarvis-Lite.zip.sha256).Split()[0]
$actual = (Get-FileHash .\Jarvis-Lite.zip -Algorithm SHA256).Hash.ToLower()
$actual -eq $expected
```

The result should be `OK` on macOS or Linux and `True` on Windows. If it is not,
delete both files and download them again from the official release page.

### Build from source

```bash
git clone https://github.com/Erionis/Jarvis-Lite.git
cd Jarvis-Lite
python3 scripts/build_starter.py --output dist
```

On Windows, use `py -3` when that is the installed Python launcher. The
canonical builder is [`scripts/build_starter.py`](../scripts/build_starter.py).
Open `dist/Jarvis-Lite/`, not the source repository, for personal use.

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

Use your preferred language. First run presents four visible decisions in a
small number of coherent interactions. When the active runtime supports it,
the first interactive control can collect the two independent setup choices —
Use domain and Starting point — together. Use domain accepts more than one
answer; Starting point remains a single choice. A text fallback preserves the
same meaning when those controls are unavailable.

1. **Use domain** — work, study, personal life, or a combination.
2. **Starting point** — Current priorities (recommended), Full map, or Learn while working.
3. **Identity** — the small amount of explicit context needed to collaborate.
4. **Collaboration style** — use the default or state concrete differences.

Identity, context that needs explanation, and nuanced decisions stay in normal
conversation. The interactive controls help the dialogue; they do not turn
onboarding into a form.

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
only templates justified by an explicitly recurring output. When two or more
selected domains each have confirmed continuing context, the recap proposes a
separate folder for each by default; **Start lighter** removes them without an
extra structure interview. A progressive setup adds no domain folders and no
templates. First run never creates a fixed project taxonomy merely to fill the
workspace.

## Local restore point

After personal setup verifies successfully, Jarvis creates a local restore
point when the Lite package is demonstrably fresh. This is already covered by
the setup recap you approved: there is no second technical decision to make.
The restore point helps Jarvis compare and recover local changes, but it is not
a backup. It does not create an online repository or publish your files.

Behind the scenes, this feature uses Git, a widely used open source tool for
keeping local history. You do not need to know Git to use Jarvis Lite. If the
component is missing, Jarvis names it, explains what it will install, and asks
your permission before changing the computer. Git itself creates no account and
does not publish or send your documents online.

After you agree, Jarvis first tries the official installation for your operating
system. If a password, system dialog, or runtime limitation requires you to take
over, it guides you one step at a time. On macOS, Jarvis also warns that Apple
may install the broader Apple Command Line Tools package. The guide keeps raw
terminal commands hidden unless you ask for technical details.

Declining or being unable to install Git does not undo the personal setup:
Jarvis marks only the restore point as pending. An existing repository or
unexpected pre-existing files are never silently included in a new history.

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
- Say `Check the Jarvis installation` for a read-only bounded audit; it does
  not repair files. Where recognized, `/jarvis-doctor` is an optional alias.
- Missing Git limits source acquisition or the local restore point, not ordinary
  Markdown work.
- Missing Python 3 blocks source builds and updates, not ordinary Markdown work.

See the canonical [`jarvis-doctor`](../skills/jarvis-doctor/SKILL.md) contract
for diagnostic boundaries, or return to the [Jarvis Lite overview](../README.md).
