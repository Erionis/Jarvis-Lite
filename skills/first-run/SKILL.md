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
   declared personal source that exists and inspect the declared Inbox.
2. First run applies when the resolved identity source is absent or the exact
   `<!-- jarvis:onboarding-required -->` marker is in the profile. Treat semantic equivalents of `Start Jarvis` in any language as the same trigger. A
   `<!-- jarvis:git-pending -->` marker resumes only the Git checkpoint.
3. If the identity exists and both markers are absent, onboarding is complete.
   Exit without writes, staging, commits, or Git configuration. If only the
   Git-pending marker remains, skip personal questions and go to Local Git
   checkpoint.
4. If the marker remains, reconcile rather than guessing. Read all existing
   personal content first; preserve its wording and local customizations. Use
   already explicit language, name, and focus only when they are unambiguous;
   otherwise continue with the missing questions below.

## Conversational setup

Ask one question at a time. Do not batch questions or infer a personal value
from a vague signal.

1. Infer the preferred language only from an unambiguous user choice; otherwise
   ask which language they prefer. Confirm an inferred choice before using it.
2. Ask for the user's name.
3. Ask for their immediate focus.

Render Soul and personal content in the preferred language. Record only the
answers the user gave: patch the explicit Preferred language and Main focus
fields in the existing profile, add the stated focus to the existing memory and
future-work sections when it is not already present, and leave every other
line intact. Do not rewrite a file to make it look like the starter.

Create the resolved identity source only when it is absent, using the Soul
template with the confirmed name and language. If `jarvis/identity/SOUL.md` already exists, do not replace it. Never overwrite identity, durable memory, or
local customizations without the user's explicit approval.

Remove `<!-- jarvis:onboarding-required -->` only after the resolved identity,
durable-memory, and future-work sources are readable and the confirmed personal
values have been recorded or were already explicitly present. Preserve every non-marker line in the profile and every non-marker/custom user line in the
other personal sources. Do not remove the marker merely because the user asks
to “clean up” or because an existing Soul looks complete.

## Local Git checkpoint

After personal setup, check Git with `git --version`.

- If Git is available, run `git rev-parse --is-inside-work-tree`. Only when it
  fails, initialize the local folder with `git init -b main`. Do not recreate
  or replace an existing repository.
- Reuse an existing author returned by `git config --get user.name` and
  `git config --get user.email`. If either is absent, ask for the author name
  and then the author email, one question at a time, before setting only the
  missing repository-local values with `git config --local user.name` or
  `git config --local user.email`.
- Stage the completed local state with `git add -A`. Run
  `git diff --cached --quiet`: create exactly one baseline checkpoint only when
  it reports a staged diff, with
  `git commit -m "chore: initialize my Jarvis"`. If there are no staged changes,
  do not create an empty commit.

Never create a remote, authenticate with GitHub, or push. A local commit is a
recovery checkpoint, not a remote backup.

## Git unavailable

Git is optional for beginning work. If `git --version` fails, add
`<!-- jarvis:git-pending -->` to the profile without changing any non-marker
line, then continue with Jarvis normally. Ask which operating system the user
uses if it is not already known, and provide only the matching official guide:

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
