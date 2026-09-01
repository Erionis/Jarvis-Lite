---
name: first-run
description: Use when the declared identity source is missing, an onboarding or Git-pending marker is present, or a user begins onboarding naturally, including “Start Jarvis” in any language.
---

# First run

Complete the smallest useful personal setup, verify it, and leave the consumer
ready for ordinary work. The capability map in the local profile is
authoritative. Never create a second manifest or substitute starter paths.

## Read-only preflight

Before the interview, inspect the consumer without changing it:

1. Read the local profile (`CLAUDE.md` in the default starter) and resolve the
   Identity, Durable memory, Future work, Inbox, and Soul template paths from
   the consumer contract.
2. Read every resolved source that exists, inspect the declared Inbox, and
   count the exact onboarding and Git-pending markers.
3. Before asking any interview question, run `git --version`. Detect the
   operating system automatically from runtime platform metadata or a safe
   read-only system query. Do not ask the user which operating system they use
   when it can be detected. These preflight checks are read-only and require no
   consent. They do not authorize installation, Git configuration, staging, or
   a commit.

If the capability map is missing or ambiguous, stop and report the exact
problem. Do not fall back to a conventional path.

## Resolve first-run state

- If Identity exists and neither marker exists, onboarding is complete. Exit
  with zero questions, zero writes, zero staged changes, and zero commits.
- If Identity exists, onboarding-required is absent, and Git-pending exists,
  skip the personal interview and resume only Local Git checkpoint.
- If Identity is absent or onboarding-required exists, complete or reconcile
  personal onboarding first, even when Git-pending also exists.

Treat semantic equivalents of `Start Jarvis` in any language as the same
trigger. For the default starter, if `99 - Jarvis/memory/soul.md` already
exists, do not replace it.

## Personal interview

Read and follow [interview.md](interview.md) for the full visible journey. Ask
one question at a time and present one decision at a time. Use only direct
answers or explicitly confirmed choices; never infer personal facts from vague
signals, free-form memory, or unrelated notes.

Make no personalized filesystem write before the user approves the final
visible recap. Approval covers only the literal personal paths, content
summary, folders, and templates displayed in that recap. A request to change
the recap invalidates the previous proposal; revise it and ask again.

## One authoritative home per fact

Route name, preferred language, and explicit collaboration preferences only to
Identity. Route stable role, use domains, sources, tools, and recurring local
context only to `CLAUDE.md`. Route current priorities and next actions only to
the declared `Future work` source.

Do not populate `Durable memory` merely to make onboarding look complete. It
may remain nearly empty. If first run reveals a distinct durable preference,
constraint, or long-lived model with no better home, present it separately as a
`jarvis-memory` candidate. That optional memory proposal is not part of
first-run completion and never receives live state.

## Apply the approved personal setup

Apply the recap as one approved unit. Preserve all existing custom text unless
the recap explicitly identifies a narrow addition.

### Identity

If Identity is absent, render the complete Soul template in the confirmed
language, replace `[NAME]` and `[LANGUAGE]`, and apply only explicit
collaboration differences approved in the recap. Do not leave template tokens
or shorten the template into a profile card.

Never replace or patch an existing Soul during first run. Its current bytes are
authoritative even when onboarding-required remains. Later Identity evolution
belongs to `jarvis-memory`.

### Local context and future work

Replace only approved placeholder entries in the stable-context sections of
`CLAUDE.md`; preserve the capability map and all non-placeholder text. For a
progressive start, use plain final statements such as `To be learned
progressively`, `None declared`, or `No active overrides` instead of bracketed
placeholders.

Write approved current priorities and next actions to the active section of
the declared Future work source. Deduplicate an existing matching item. A
progressive start must not invent a task merely to fill the file.

### Visible structure

Create `98 - Archive/README.md` in every approved path. Create at most four
approved numbered domain folders. Every created folder receives a short
`README.md` that states its purpose without inventing user facts. Create a
template only for an explicitly recurring output. A progressive start creates
no domain folder and no template.

Never create `PROFILE.md`, `JARVIS.md`, a second Soul, or a second capability
manifest.

## Reconciliation and resume

When onboarding-required remains, reconcile against the filesystem instead of
starting over:

- If Identity exists, preserve it byte for byte and complete only the missing
  approved scope. Do not mine it or another file for unconfirmed answers.
- If interruption happened before recap approval, no partial answers were
  persisted; restart the interview from the first unresolved decision.
- If interruption happened after approved writes began, re-read the actual
  files, show a missing-only recap, and require approval for that remaining
  literal scope. Do not rewrite completed items.

The acceptance behavior is a missing-only resume: existing Soul bytes stay
unchanged, completed items are not rewritten, and any failed verification
keeps onboarding visibly pending.

## Verify personal completion

Re-read every approved personal file and every created README or template.
Verify that Identity, Durable memory, and Future work resolve and are readable;
that the capability map is intact; that the approved visible structure matches
the recap; and verify that no onboarding placeholder remains.

Remove `<!-- jarvis:onboarding-required -->` only after every verification
passes. Preserve every non-marker line. Re-read `CLAUDE.md` and prove that the
onboarding marker count is zero before reporting completion.

A failed or incomplete verification retains exactly one onboarding marker.
Report the exact missing or mismatched path and make no blind rewrite. Do not
claim that the workspace is ready.

## Close personal setup

Only after verification, say that personal setup is ready. State that Git is
optional and does not block ordinary Jarvis work. Continue to Local Git
checkpoint before offering the First trial.

## Local Git checkpoint

Git is optional. The checkpoint is a local recovery point, not a remote backup.
Never create a remote, authenticate with GitHub, or push.

### If Git is missing

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
`<!-- jarvis:git-pending -->` marker, report the exact command and result, and
continue normally. Re-run `git --version` after the installer returns. Only a
successful availability check may continue to checkpoint inspection.

When an installer continues in a system dialog or another interactive process,
wait for the user to confirm that installation finished before re-running the
availability check.

For an unsupported or ambiguous platform, show https://git-scm.com/install/
and do not guess a command. Declining installation does not block personal
setup. If the user intentionally defers Git, treat it as a deferred checkpoint.

### Inspect checkpoint state

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
exactly one `<!-- jarvis:git-pending -->` marker without staging it, defer the
checkpoint, and permit normal Jarvis work.

### Approve the mutation scope

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

### Initialize and configure

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

### Approve and stage exact content

For a freshly initialized Jarvis directory, run `git status --short`, display
the complete inventory, and require the user to explicitly approve the
displayed full baseline. Only that fresh baseline approval authorizes
`git add -A`. Withheld or declined baseline approval means no `git add -A` and no
commit; retain Git-pending and continue normal work.

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

### Commit only a verified checkpoint

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

### Git failure recovery

Report the exact failed command or staged-path mismatch and preserve completed
personal setup. Immediately run and display `git status --short`. Preserve the
existing index; never blindly unstage, and stop further Git mutations. Restore
or retain `<!-- jarvis:git-pending -->` without staging it. If that changes the
worktree, display status again. Explain the exact staged and unstaged state and
offer only an explicit user-approved recovery step. Normal Jarvis work may
continue.

## Safety check

Before ending, re-read the resolved personal files and local profile. Confirm that
the existing Soul was retained when present, only explicit fields and marker
lines changed, onboarding is either safely complete or visibly pending, and no
remote, authentication, or push was attempted.

After Git is completed, deferred, unavailable, or safely failed, continue with
the First trial and Continuity guide from the interview reference.
