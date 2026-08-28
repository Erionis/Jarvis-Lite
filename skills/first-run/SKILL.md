---
name: first-run
description: Use when the declared identity source is missing, an onboarding or Git-pending marker is present, or a user begins onboarding naturally, including “Start Jarvis” in any language.
---

# First run

Complete only the minimum personal setup needed to start safely. The profile's
capability table is authoritative: resolve its paths before acting and do not
create another manifest or substitute starter paths.

## Preflight and completion check

1. Read `jarvis/PROFILE.md`, resolve the Identity, Durable memory, Future work,
   and Inbox paths from its table, then read the Soul template. Read each
   declared personal source that exists and inspect the declared Inbox. The
   resolved Identity capability source is the only authoritative identity. A
   non-authoritative starter Soul is legacy content: preserve it, but never use
   it as a second identity or to decide onboarding is complete. For the default
   starter this means: If `jarvis/identity/SOUL.md` already exists, do not replace it.
2. First run applies when the resolved identity source is absent or the exact
   `<!-- jarvis:onboarding-required -->` marker is in the profile. Treat semantic equivalents of `Start Jarvis` in any language as the same trigger. If the resolved Identity source is absent, run personal onboarding first even when a Git-pending marker exists. Git-only resume applies only when the resolved Identity source exists and the onboarding marker is absent.
3. If the resolved Identity source exists and both markers are absent,
   onboarding is complete. Exit without writes, staging, commits, or Git
   configuration. If the resolved Identity source exists, the onboarding marker
   is absent, and only Git-pending remains, skip personal questions and go to
   Local Git checkpoint.
4. If the onboarding marker remains, reconcile rather than guessing. Read all
   existing personal content first and preserve its wording and customizations.
   Candidate values are only non-placeholder `Preferred language:` and `Main focus:` profile fields, plus a recognized identity name field in the
   resolved Identity capability source. A recognized identity name field is a
   `user_name:` YAML field or the template's owner-name sentence in `## Who I
   am`; free-form memory, future-work, and legacy content are never candidates.
   Ask one explicit confirmation for each candidate read from files before
   using it. A direct answer needs no duplicate confirmation.

## Conversational setup

Ask one question at a time. Do not batch questions or infer a personal value
from a vague signal.

1. Infer the preferred language only from an unambiguous user choice; otherwise
   ask which language they prefer. Confirm an inferred choice before using it.
2. Ask for the user's name.
3. Ask for their immediate focus.

Render Soul and personal content in the preferred language only when that text
is newly created or newly added. Only newly created or newly added personal text is rendered in the preferred language. Record only direct answers or
confirmed candidates. If `Preferred language:` or `Main focus:` is absent, show the smallest exact proposed addition under an existing `## Current context`; if that section is absent, propose adding `## Current context` at the end with only the missing field lines. For example, under an existing section propose only `- Preferred language: <confirmed language>` and/or `- Main focus: <confirmed focus>`; without that section, propose exactly that heading followed by only those missing lines. Apply it only after explicit approval. Preserve every existing line. Patch an existing explicit field only with the same care, then add the stated focus to the existing memory and future-work sections when it is not already present. Preserve existing custom text verbatim unless the user separately approves a semantic rewrite. Do not rewrite a file to make it look like the starter.

Create the resolved Identity capability source only when it is absent, using
the Soul template with the confirmed name and language. Never replace an
existing identity. When an existing identity has a recognized identity name
field and the user directly supplies a name, request explicit approval to patch only that field before writing it. When it has no recognized identity name
field, show a narrow proposed patch in the identity's existing style and location: one added owner-name line or one identified identity sentence, never a
replacement document. Require explicit approval before applying it. If the user
declines, make no identity write, keep onboarding pending, and state that
ordinary Jarvis work may continue. Never overwrite identity, durable memory, or
local customizations without the user's explicit approval.

Remove `<!-- jarvis:onboarding-required -->` only after the resolved identity,
durable-memory, and future-work sources are readable and the confirmed personal
values have been recorded from direct answers or confirmed candidates. Preserve every non-marker line in the profile and every non-marker/custom user line in
the other personal sources. Do not remove the marker merely because the user
asks to “clean up” or because an existing Soul looks complete.

## Local Git checkpoint

After personal setup, offer the local checkpoint and wait for explicit acceptance before any Git mutation: `git init -b main, author configuration, staging, or commit`. Explicit checkpoint acceptance authorizes adding or retaining exactly one `<!-- jarvis:git-pending -->` marker before `git --version`, every other Git probe or mutation, and the displayed `git status --short` inventory. Preserve every non-marker Profile line when making the marker count exactly one. The approved scope therefore already includes that marker. A declined or deferred checkpoint adds or retains exactly one `<!-- jarvis:git-pending -->` marker, performs no Git mutation, and permits normal work. If the user intentionally defers Git, treat it as a deferred checkpoint. `git --version` is only a read-only availability check after acceptance.

Classify Git results exactly; do not treat every nonzero result as permission to
initialize or reconfigure:

- `git --version`: exit 0 means Git is available; command-not-found means Git is missing. Any other execution error enters Git failure recovery.
- `git rev-parse --is-inside-work-tree`: exit 0 with output `true` means existing worktree. Only exit 128 whose error explicitly says `not a git repository` is the expected not-a-repository result; only the expected not-a-repository result may lead to `git init -b main`. Any other output or error enters Git failure recovery.
- `git config --get user.name` / `git config --get user.email`: exit 0 with nonempty output means configured. Exit 1 with empty output and no error is the expected missing-value state; the expected missing-value state means ask before repository-local configuration. Any other error enters Git failure recovery.
- `git diff --cached --name-only`: exit 0 means the command produced the
  complete staged-path list, which may be empty. Any nonzero exit enters Git
  failure recovery.
- `git diff --cached --quiet`: exit 0 means empty; exit 1 means changes. Any other exit code enters Git failure recovery.

For a Git-unavailable or declined checkpoint, retain or add `<!-- jarvis:git-pending -->`.

- For the expected not-a-repository result only, initialize the local folder
  with `git init -b main`. Do not recreate or replace an existing repository.
- Reuse an existing author returned by `git config --get user.name` and
  `git config --get user.email`. For only an expected missing value, ask for
  the author name and then the author email, one question at a time, before
  setting only the missing repository-local values with `git config --local
  user.name` or `git config --local user.email`.
- A successful `git init -b main` makes this a freshly initialized Jarvis directory. Run `git status --short`, display its complete scope, and use
  `git add -A` only after the user explicitly approves the displayed full baseline. Withheld or declined baseline approval means no `git add -A` and no commit; retain or add Git-pending and continue normal work.
- In an existing repository, do not use `git add -A`; stage only explicitly approved onboarding sources or defer checkpointing. Before any onboarding staging or commit in an existing repository, run `git diff --cached --name-only`
  and display its complete output separately from `git status --short`. If the initial staged-path output contains any entry, display every staged path, do not alter the index, do not stage, and do not commit. Instead, retain or add exactly one `<!-- jarvis:git-pending -->` marker without staging it, defer the checkpoint and permit normal Jarvis work. Only when the initial staged-path output is empty may you stage the exact explicitly approved onboarding source paths. First display `git status --short`, obtain source-specific approval for a literal path list, and use only explicit path arguments such as `git add -- <approved-path>...`; never derive paths automatically from status output. After staging, run `git diff --cached --name-only` again, display it, and verify that the staged path set contains no path outside the explicitly approved onboarding source paths. A staged-path mismatch enters the index-preserving Git failure recovery/defer path: do not automatically unstage or commit, retain or restore exactly one Git-pending marker without staging it, defer the checkpoint, and permit normal Jarvis work.
- The shared staging rule is to stage the approved scope while Git-pending remains exactly once: use the accepted `git add -A` only for the fresh baseline,
  or the verified explicit path arguments only for the existing repository. Then run `git diff --cached
  --quiet`. If the staged diff is empty, retain Git-pending, report that no checkpoint was made, and continue normal work. If it has changes, remove the Git-pending marker and re-stage the resolved Profile. Repeat this staged-path comparison after re-staging the resolved Profile and before commit in an existing repository; this comparison is the first part of the recheck, and any mismatch follows the same recovery/defer path. Finish the recheck with `git diff --cached --quiet`; only its non-empty result may authorize `git commit -m "chore: initialize my Jarvis"`. This is the required sequence: remove the Git-pending marker, re-stage the resolved Profile, recheck, then commit. Remove the Git-pending marker before staging that resolved Profile, so the successful checkpoint contains the clean profile state and leaves no marker-removal change afterward. Only a non-empty rechecked staged diff may create the checkpoint. Decline, an empty staged diff, or any Git failure retains or restores exactly one Git-pending marker.
- After a successful commit, run and display `git status --short`. Only empty output is evidence of a clean checkpoint. If the output is nonempty, report the exact remaining state, make no automatic cleanup or extra commit, do not claim a clean checkpoint, and require explicit approval before any recovery. If this status command errors, enter Git failure recovery.

Git failure recovery applies to `git init -b main`, either repository-local author configuration command, staging, staged-path inspection or comparison, either staged-diff check, commit, and the final post-commit status command. On failure, report the exact failed command or staged-path mismatch and preserve completed personal setup. Immediately run and display `git status --short`. Preserve the existing index; never blindly unstage, and stop further Git mutations. Failure handling must restore or retain `<!-- jarvis:git-pending -->` without staging it; when restoration changes the worktree, display `git status --short` again. The report must explain the exact staged and unstaged state, and offer only an explicit user-approved recovery step. Normal Jarvis work may continue.

Never create a remote, authenticate with GitHub, or push. A local commit is a
recovery checkpoint, not a remote backup.

## Git unavailable

Git is optional for beginning work. If `git --version` is command-not-found,
report the exact failed command, add `<!-- jarvis:git-pending -->` to the
profile without changing any non-marker line, then continue with Jarvis
normally. Any other `git --version` execution error follows Git failure
recovery. If the user
does not answer the operating-system question, keep the Git-pending marker,
complete personal onboarding, and do not block on a follow-up question. Offer operating-system guidance later only on request. When the user requests it,
ask the operating system if unknown and provide only the matching official
guide:

- Windows: https://git-scm.com/download/win
- macOS: https://git-scm.com/download/mac

Do not guess an operating system or run installation commands. On a later run,
remove the Git-pending marker only after Git is available and the local
checkpoint branch above has completed; preserve every other profile line.

## Safety check

Before ending, re-read the resolved personal files and profile. Confirm that
the existing Soul was retained when present, only explicit fields and marker
lines changed, onboarding is either safely complete or visibly pending, and no
remote, authentication, or push was attempted.
