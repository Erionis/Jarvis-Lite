# Local Git checkpoint

Use this reference only after personal setup has verified, including a Git-only
resume where personal onboarding was already completed. Git is optional. The
checkpoint is a local recovery point, not a remote backup. Never create a
remote, authenticate with GitHub, or push.

## If Git is missing

`git --version`: exit 0 means Git is available; command-not-found means Git is
missing. Any other execution error enters Git failure recovery. Missing Git
never blocks personal onboarding or ordinary Jarvis work.

After verified personal setup, explain the detected platform and show exactly
one matching installation command from the official Git guidance:

- macOS: `xcode-select --install` — https://git-scm.com/install/mac
- Windows with WinGet: `winget install --id Git.Git -e --source winget` —
  https://git-scm.com/install/windows
- Debian or Ubuntu: `sudo apt-get install git` —
  https://git-scm.com/install/linux
- Fedora: `sudo dnf install git` — https://git-scm.com/install/linux
- Arch Linux: `sudo pacman -S git` — https://git-scm.com/install/linux
- openSUSE: `sudo zypper install git` — https://git-scm.com/install/linux
- Alpine: `sudo apk add git` — https://git-scm.com/install/linux

Before showing the Windows command, run `winget --version` as a read-only
check. If WinGet is unavailable, show only the official Windows installation
guide and do not invent another command. For Linux, resolve `/etc/os-release`
and verify that the matching package-manager command exists with a read-only
command lookup. If the detected package manager does not match the
distribution, show only the official Linux installation guide. On macOS,
verify that `xcode-select` exists before displaying its command; otherwise show
only the official macOS guide.

Ask for explicit installation approval before executing it. Installation
approval does not authorize any Git mutation. If installation is declined,
fails, or cannot run in the current environment, retain or add exactly one
`<!-- jarvis:git-pending -->` marker in the resolved local profile, report the
exact command and result, and continue normally. Re-run `git --version` after
the installer returns. Only a successful availability check may continue to
checkpoint inspection.

When an installer continues in a system dialog or another interactive process,
wait for the user to confirm that installation finished before re-running the
availability check.

For an unsupported or ambiguous platform, show https://git-scm.com/install/
and do not guess a command. Declining installation does not block personal
setup. If the user intentionally defers Git, treat it as a deferred checkpoint.

## Inspect checkpoint state

Once Git is available, perform these read-only checks before requesting any Git
mutation:

- `git rev-parse --is-inside-work-tree`: exit 0 with output `true` means an
  existing worktree. Only exit 128 with an explicit not-a-repository error is
  the expected missing-repository state; only the expected not-a-repository
  result may lead to `git init -b main`.
- `git config --get user.name`, `git config --get user.email`, and
  `git config --get core.hooksPath`: exit 0 with nonempty output means
  configured. Exit 1 with empty output and no error is the expected
  missing-value state. Any other result enters Git failure recovery.
- In an existing repository, run `git diff --cached --name-only`. Exit 0
  provides the complete staged-path list, including an empty list. Any nonzero
  result enters Git failure recovery.

If the initial staged-path output contains any entry, display every staged
path, do not alter the index, do not stage, and do not commit. Retain or add
exactly one `<!-- jarvis:git-pending -->` marker in the resolved local profile
without staging it, defer the checkpoint, and permit normal Jarvis work.

## Approve the mutation scope

Offer the local checkpoint and wait for explicit acceptance before any Git
mutation: `git init -b main`, author configuration, hook-path configuration,
staging, or commit. Include local hook-path configuration in the displayed
checkpoint scope.

Reuse an existing nonempty repository-local or inherited author name and
email. For an expected missing name, set only the missing repository-local
author name to the confirmed Identity name with `git config --local user.name`.
On a Git-only resume where no confirmed name is available, ask one narrow Git
author-name question without reopening personal onboarding. For an expected
missing email, set only the missing repository-local email to
`jarvis@vault.local` with `git config --local user.email`. Display these exact
local values before requesting checkpoint approval.

Explicit checkpoint acceptance authorizes adding or retaining exactly one
`<!-- jarvis:git-pending -->` marker before the first Git mutation and the
displayed `git status --short` inventory. The approved scope therefore already
includes that marker. Preserve every non-marker local-profile line. A declined
or deferred checkpoint performs no Git mutation, retains or adds the marker,
and permits normal work.

## Initialize and configure

- For only the expected not-a-repository state, run `git init -b main`. Never
  recreate or replace an existing repository.
- Apply only the missing repository-local author values displayed in the
  approved scope.
- If `.githooks/pre-commit` exists and hooksPath is missing, run
  `git config --local core.hooksPath .githooks`. Reuse `.githooks` when it is
  already configured. If another nonempty hook path is configured, preserve it
  and do not overwrite custom Git configuration. Report that the Lite
  large-file guard was not activated. If the shipped hook is missing, do not
  configure a nonexistent path.

## Approve and stage exact content

For a freshly initialized Jarvis directory, run `git status --short`, display
the complete inventory, and require the user to explicitly approve the
displayed full baseline. Only that fresh baseline approval authorizes
`git add -A`. Withheld or declined baseline approval means no `git add -A` and
no commit; retain Git-pending and continue normal work.

In an existing repository, do not use `git add -A`; stage only explicitly
approved onboarding sources or defer checkpointing. Before any onboarding
staging or commit in an existing repository, run
`git diff --cached --name-only`. Only when the initial staged-path output is
empty may you stage the exact explicitly approved onboarding source paths.
Display `git status --short`, obtain approval for a literal path list, and use
only `git add -- <approved-path>...`. Because marker mutation is in the
checkpoint scope, the local profile must appear explicitly in that path list
whenever its marker changes.

After staging, run `git diff --cached --name-only` again and verify that it
contains no path outside the explicitly approved onboarding source paths.
Repeat this staged-path comparison after re-staging the local profile and
before commit. A mismatch means: do not automatically unstage or commit;
preserve the index and enter Git failure recovery.

## Commit only a verified checkpoint

Stage the approved scope while Git-pending remains exactly once, then run
`git diff --cached --quiet`: exit 0 means empty; exit 1 means changes. Any other
exit code enters Git failure recovery. If the staged diff is empty, retain
Git-pending, report that no checkpoint was made, and continue normal work.

For a nonempty approved diff, remove the Git-pending marker before staging the
local profile again. This ensures the successful checkpoint contains the clean
profile state and leaves no marker-removal change afterward. Then remove the
Git-pending marker, re-stage the local profile, recheck, then commit. Only a
nonempty rechecked staged diff authorizes
`git commit -m "chore: initialize my Jarvis"`. Decline, an empty staged diff,
or any Git failure retains or restores exactly one Git-pending marker.

After a successful commit, run and display `git status --short`. Only empty
output is evidence of a clean checkpoint. Otherwise report the exact remaining
state, make no automatic cleanup or extra commit, do not claim a clean
checkpoint, and require explicit approval before any recovery. If this status
command errors, enter Git failure recovery.

## Git failure recovery

Report the exact failed command or staged-path mismatch and preserve completed
personal setup. Immediately run and display `git status --short`. Preserve the
existing index; never blindly unstage, and stop further Git mutations. Restore
or retain `<!-- jarvis:git-pending -->` in the resolved local profile without
staging it. If that changes the worktree, display status again. Explain the
exact staged and unstaged state and offer only an explicit user-approved
recovery step. Normal Jarvis work may continue.
