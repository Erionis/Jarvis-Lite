# Local restore point

Use this reference only after personal setup has verified, including a
Git-only resume where personal onboarding was already completed. Git provides
the local history, but the normal user-facing term is **local restore point**.
It is not a remote backup. Never create a remote, authenticate with GitHub, or
push.

## Authorization model

The approved setup card authorizes the local restore-point outcome only for a
verified fresh Lite package. In that branch, configuration, initialization,
staging, and the first local commit need no separate checkpoint or
baseline-inventory approval.

That authorization lives in the session that displayed the card. A later
session needs the restore-point question below.

Software installation changes the host and always needs its own explicit
approval. An existing repository or unexpected content is outside the fresh
package authorization and follows the conservative branches below.

## Keep pending state internal

The approved local restore-point outcome covers adding or retaining exactly one
`<!-- jarvis:git-pending -->` marker in the resolved local profile. Do not ask
for marker-only approval. Preserve every non-marker line.

- The default starter ships the marker. Personal setup verification keeps it,
  or adds it when the profile lacks one, in the same edit that removes the
  onboarding marker, so it is in place before the first Git mutation.
- On a Git-only resume, preserve the existing single marker without reopening
  the personal interview.
- An explicit decline of local restore points, in the recap or at the
  restore-point question, removes every Git-pending marker and makes no Git
  mutation. A later request for restore points adds one marker back and
  resumes this reference.
- Failure or deferral retains or restores exactly one
  `<!-- jarvis:git-pending -->` marker.
- A successful commit contains no Git-pending marker and leaves no marker-only
  worktree change.
- More than one marker is ambiguous recovery state. Report the exact count and
  request recovery approval before reducing it; make no Git mutation first.

The marker is implementation state. In the normal journey, report only whether
local protection is ready or still pending.

## If Git is missing

`git --version`: exit 0 means Git is available; command-not-found means Git is
missing. Any other execution error enters failure recovery. Missing Git never
blocks personal onboarding or ordinary Jarvis work.

After personal setup verifies, Name Git and explain it before asking for an
installation decision. The explanation says that Git is a widely used open
source tool that keeps a local history of file changes; it will come from an
official source, creates no account, and does not publish or send the user's
documents online. Name any broader system package before approval. Use the
user's language and ask one plain-language question.

Use this shape:

> To create local restore points I need Git, a widely used open source tool
> that keeps a history of changes to your files. I will install it from an
> official source. It creates no account and does not publish or send your
> documents online. May I install it?

Select one verified platform path:

- macOS: `xcode-select --install` — https://git-scm.com/install/mac. State
  before approval that Apple's official route installs **Apple Command Line
  Tools**, a broader developer-tool package that includes Git.
- Windows with WinGet: `winget install --id Git.Git -e --source winget` —
  https://git-scm.com/install/windows.
- Debian or Ubuntu: `sudo apt-get install git` —
  https://git-scm.com/install/linux.
- Fedora: `sudo dnf install git` — https://git-scm.com/install/linux.
- Arch Linux: `sudo pacman -S git` — https://git-scm.com/install/linux.
- openSUSE: `sudo zypper install git` — https://git-scm.com/install/linux.
- Alpine: `sudo apk add git` — https://git-scm.com/install/linux.

Before the question, verify the candidate without changing the system:

- On Windows run `winget --version`; without WinGet use only the official
  Windows guide.
- On Linux resolve `/etc/os-release` and confirm that the matching package
  manager command exists; otherwise use only the official Linux guide.
- On macOS confirm that `xcode-select` exists; otherwise use only the official
  macOS guide.

Ask for explicit installation approval without displaying the raw command by
default. Offer technical details on request. After approval, attempt the
verified official command yourself. Installation approval authorizes only that
displayed software or system package; the approved setup card separately owns
the verified-fresh restore point.

If a password, system dialog, or runtime boundary prevents direct completion,
guide the user one step at a time and wait for confirmation. Re-run
`git --version` after the installer returns or the user confirms completion.
Only an exit-0 availability check continues to repository inspection.

If installation is declined, fails, or is unsupported, keep one pending marker
and continue normally. Say that the workspace is ready but local restore points
are not active yet. Put the exact command, error, and technical state behind an
offer to show details rather than leading with them. A plain no is a deferral:
the restore-point question in a later session offers the permanent opt-out.

## Inspect repository state

Once Git is available, run these read-only checks:

- `git rev-parse --is-inside-work-tree`: exit 0 with `true` means an existing
  worktree. Only exit 128 with an explicit not-a-repository error is the
  expected missing-repository state.
- `git config --get user.name`, `git config --get user.email`, and
  `git config --get core.hooksPath`: exit 0 with a nonempty value means
  configured. Exit 1 with empty output and no error means missing. Any other
  result enters failure recovery.
- In an existing repository, `git diff --cached --name-only` returns the full
  staged path set. Any nonzero result enters failure recovery.

Never recreate or replace an existing repository.

## Verify a fresh Lite package

Use this branch only for the expected not-a-repository state. Before `git init`,
verify all of the following:

1. The installed `99 - Jarvis/system/release-manifest.json` and
   `.jarvis-update/state.json` form a coherent Jarvis Lite release manifest
   and seed state. Use their actual JSON keys:
   - Compare `schema_version`, `product`, `source_commit`, and
     `contract_revision` for equality in both files. Require
     `product` to be `jarvis-lite`. Compare manifest `release_version`
     with state `accepted_release`. The package `jarvis-lite.json` must
     agree on product, release version, and source commit too.
   - Compute SHA-256 over the raw bytes of the manifest file and compare its
     lowercase hex digest with state `manifest_sha256`.
   - Require manifest `managed_files` to have unique, safe relative
     `path` values. Compare state `baseline` with the map formed by each
     managed-file entry keyed by its `path`; compare complete entry objects,
     not only filenames or hashes.
   The seed state does not use keys named `manifest_hash` or
   `managed_baseline`. Their absence is not a failure; a missing or
   mismatched actual key is.
2. The manifest's `package_paths` is a sorted, duplicate-free list of safe
   relative regular-file paths and includes both metadata files.
3. Build the actual regular-file inventory below the workspace, excluding only
   `.git` and harmless operating-system metadata already excluded by the
   shipped `.gitignore`.
4. Every actual path is in the shipped package paths plus the literal personal
   paths approved during onboarding. Approved directory creation contributes
   only its displayed README or template paths; it is not a wildcard.

When the identity checks pass but unexpected paths exist, such as a note the
user asked for during the interview, ask the restore-point question below and
list those paths. Its approval adds exactly the displayed paths to the verified
union.

If any identity check fails or an unexpected path exists without that
approval, do not run `git init`, configure Git, stage, or commit. Preserve all
content. Explain in plain language that files outside the new Jarvis setup
need review before they can enter the restore point, and offer technical
inventory only on request. Ordinary Jarvis work may continue.

## Create the verified fresh restore point

Only this verified fresh-package branch may use `git add -A` automatically.
The setup-card approval is already sufficient; do not expose author values,
hook configuration, status output, or another Git choice in the normal journey.

1. Ensure exactly one Git-pending marker, then run `git init -b main`.
2. Reuse an existing nonempty repository-local or inherited author name and
   email. Set only a missing local name to the confirmed Identity name. Set
   only a missing local email to `jarvis@vault.local`.
3. If `.githooks/pre-commit` exists and hooksPath is missing, run
   `git config --local core.hooksPath .githooks`. Reuse `.githooks` when already
   configured. Preserve any other nonempty custom hook path and report, in plain
   language, that the Lite large-file guard was not activated.
4. Run `git status --short` internally and confirm every candidate path remains
   within the verified union. Run `git add -A` only after that check.
5. Run `git diff --cached --name-only` and verify the staged set is nonempty
   and contains nothing outside the same union. A mismatch enters failure
   recovery without unstaging.
6. Remove the Git-pending marker, re-stage only the local profile, repeat the
   staged-path check, and run `git diff --cached --quiet`: exit 1 authorizes the
   commit; exit 0 means there is nothing to save; every other exit enters
   failure recovery.
7. Commit with `git commit -m "chore: initialize my Jarvis"`.

## Existing repository

The setup-card approval does not authorize changes to an existing repository.
Never use `git add -A` in this branch.

If the initial staged-path set is nonempty, leave the index byte-for-byte
unchanged, stage and commit nothing, retain the pending marker, and defer the
restore point. Say in plain language that another save operation is already in
progress and was left untouched. Show raw Git state only on request.

With an empty initial index, continue only when the worktree changes consist of
literal approved onboarding paths or, on a Git-only resume, of the paths the
restore-point question displays. Present those paths as the files Jarvis can
include in a local restore point and request one explicit approval. After
approval, use `git add -- <approved-path>...`, verify that the staged set equals
the approved literal set, remove the pending marker, re-stage the local profile
when it is in that set, verify again, and commit only a nonempty matching diff.
Any unrelated or mismatched path defers the restore point without index cleanup.

## Restore-point question

Ask this one plain-language question when a restore point needs paths that no
current approval covers: unexpected paths in a fresh folder, or any Git-only
resume. Run the read-only checks first, so the question names only what can
actually happen. Say that local restore points are not active yet, then offer:

1. **Create it now** — recommended. Name in plain language the files outside
   the shipped package that it will include, grouped by folder when the list
   is long. When Git is missing, also give the explanation and any broader
   package from If Git is missing.
2. **Not now** — keep it pending; it returns in a later session.
3. **Don't use restore points** — stop asking; the user can ask for them
   later.

**Create it now** approves exactly the displayed software and paths, and the
matching branch above continues with them. **Not now** keeps exactly one
marker. **Don't use restore points** removes every Git-pending marker,
preserves every non-marker line, and makes no Git mutation. When no branch can
proceed, because a package identity check fails, installation is unsupported,
or the existing index is not empty, say so in one line, offer the reason on
request, and offer only **Not now** and **Don't use restore points**.

## Resume in a later session

A Git-only resume starts when Identity exists, the onboarding marker is absent,
and Git-pending remains. The setup card belonged to an earlier session and
does not authorize Git mutations here. Repeat the read-only checks, including
Git availability, the operating system, repository state, and the actual file
inventory, then ask the restore-point question. Its displayed paths replace
the onboarding paths in the fresh-package union or the approved literal set
of an existing repository.

## Verify success

After a commit, run `git status --short`. Empty output is evidence of a clean
restore point. Report simply that the local restore point is ready. Offer the
commit and status details only when requested.

Nonempty output or a status error means the restore point is not clean. Report
the affected paths in plain language, make no automatic cleanup or extra
commit, and require explicit approval before recovery.

## Failure recovery

Preserve completed personal setup. Stop further Git mutations, run
`git status --short` when a repository now exists, and preserve the existing
index; never blindly unstage. Failure or deferral retains or restores exactly
one `<!-- jarvis:git-pending -->` marker without staging that recovery write.

Tell the user first that local protection is pending and ordinary work can
continue. Offer exact commands, staged and unstaged state, and one bounded
recovery action as technical details. Never create a remote, authenticate, or
push during recovery.
