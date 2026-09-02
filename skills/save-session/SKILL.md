---
name: save-session
description: Use when a user asks to save the current session or create an end-of-session checkpoint.
---

# Save Session

Preserve what matters before doing optional housekeeping. A complete content
checkpoint and a local Git recovery point are separate outcomes: failure of the
second never erases the first.

## 1. Resolve sources and evidence

Read the consumer capability map. Resolve `Daily history`, `Future work`,
`Durable memory`, and `Inbox` through the consumer's declared capability map,
by semantic role rather than a familiar path. Do not hard-code a starter path
or create a fallback file. Do not invent a second history source.

An intentionally unavailable optional role disables only its feature. A
declared source that is missing or ambiguous makes the checkpoint partial;
name the affected role and continue every other safe channel.

Use the workspace's local date and timezone. From current-session evidence,
separate:

- completed outcomes;
- decisions actually made;
- explicit unresolved work;
- at most five genuinely stable memory candidates;
- optional cleanup candidates.

Do not manufacture decisions, infer tasks the user did not leave open, or copy
the conversation.

Before content writes, inspect Git read-only so its initial state remains
distinguishable from this checkpoint. Use `git --version`, repository checks,
`git status --short`, and `git diff --cached --name-only`. Also check for an
active Git operation and the effective large-file guard. This inspection never
blocks safe content writes.

## 2. Save Daily history first

Persist completed chronology only in the declared `Daily history` source. Use
one file per local calendar day at `YYYY/MM/YYYY-MM-DD.md`, unless that source
explicitly declares another local convention. Create only the required year
and month directories and today's file.

A new daily file contains `## Done`, `## Decisions`, and `## Closing state`.
Headings and public paths stay English; entries use the user's preferred
language.

For repeated saves on the same day:

- update the same file;
- semantically deduplicate `Done` and `Decisions` instead of matching wording
  mechanically;
- rewrite `Closing state` to the latest one or two lines;
- keep future work in `Future work`, not the Diary;
- preserve frontmatter, custom sections, and unrelated content;
- add a short relative link to an authoritative issue, file, or artifact when
  it materially improves recovery.

Do not add per-session timestamps or subsections. Re-read the daily file
immediately before and after editing. If an existing structure is ambiguous,
leave it unchanged, mark only this channel partial, and continue the other safe
channels. Never normalize the file by assumption.

## 3. Update Future work narrowly

Use only evidenced current work. In the declared `Future work` source:

- close an existing item only when completion is evidenced;
- add only explicit unresolved follow-ups;
- update changed state or context in place;
- Do not add completed work retroactively; its outcome belongs in Daily
  history;
- support the local representation, including plain bullets and checkboxes;
- preserve sections, ordering, formatting, and unrelated entries;
- keep one short actionable item per line, roughly a one-week slice;
- link the authoritative source when useful.

Do not automatically remove or reorder entries. Semantically deduplicate each
change. Re-read the target immediately before and after editing. If ownership
or placement remains unclear, defer that item as an optional proposal.

## 4. Delegate Durable memory

Delegate at most five stable candidates to `jarvis-memory`. Do not write
`Durable memory` directly. Live status, ordinary history, and current tasks are
not durable candidates.

An explicit request to remember something follows `jarvis-memory` authority.
Inferred, conflicting, corrective, consolidating, or destructive changes remain
approval-only proposals. Approval-only memory proposals remain pending until
after the core checkpoint and never block it.

Use a parallel worker when the runtime supports it; otherwise use an inline
fallback that follows the same `jarvis-memory` contract. A delegated memory
worker must not touch Git or unrelated files. The parent workflow owns content
status, Git, and the final response.

After every immediately authorized content write finishes, re-read every
modified target. Any failed verification makes the content result partial and
must name the exact role that was not verified.

## 5. Create the local recovery point

Jarvis Lite treats the consumer as a dedicated personal workspace. After Git
was set up and accepted during first run, invoking `save-session` authorizes a
whole-workspace local recovery point. It is not an off-device backup.

Skip only the Git recovery point when Git or the repository is unavailable,
the first-run Git-pending marker remains, the initial staged index is
non-empty, a merge, rebase, cherry-pick, revert, bisect, or another Git
operation is in progress, repository state is ambiguous, or the shipped 5 MiB
large-file guard is missing or inactive. Do not alter the existing index.
Content status remains whatever its own verification proved.

When every Git gate passes:

1. Run `git add -A` for the dedicated workspace.
2. Inspect the staged diff. If the staged diff is empty, do not create an empty
   commit; report that no new local recovery point was needed.
3. Otherwise commit as `save-session: YYYY-MM-DD <focus>`, using a short evidenced focus
   or `checkpoint` when none is distinguishable.
4. Verify the commit hash and final `git status --short`.

Do not initialize Git, install it, or change Git configuration. Never push or
create a remote, authenticate, force, amend unrelated history, or describe the
local recovery point as a backup.

If staging, the guard, or the commit fails, never reset, discard, or blindly
unstage. Report the exact index and worktree state. Concurrent changes left
after the commit stay outside that recovery point; report them and do not stage
them again.

## 6. Report before optional maintenance

Report the core checkpoint before offering optional maintenance. Lead with the
content result in plain language:

- complete: `Done, I saved the session. I updated the Diary and your open
  activities.`
- partial: state what succeeded first, then what could not be completed, and
  add `Nothing was deleted.`
- Git created: add `I also created a local restore point.`
- Git unavailable: keep the content result intact and say the restore point can
  be fixed later.

Do not show commit hashes, staging terminology, or internal state labels in a
normal success. Show technical detail only when the user asks or recovery
requires it. Never claim full conversational memory.

## 7. Offer bounded maintenance

Only after the core result is visible:

- offer at most five obvious `Future work` cleanup candidates;
- surface at most five non-hidden, non-README Inbox items;
- propose a destination only for an item tied to the current session or whose
  destination is evident from existing context;
- leave every other Inbox item as `to organize`;
- present approval-only memory proposals returned by `jarvis-memory`.

For a real choice, use the runtime choice UI when available and short numbered
choices otherwise. Inbox actions are Move, Keep, or Delete. No move or deletion
happens without explicit confirmation. Silence is not approval. No response
leaves the completed checkpoint and its recovery point valid.

Apply only approved changes and re-read their targets. If content changed and
the Git gates still pass, create a second local recovery point named
`save-session: YYYY-MM-DD maintenance`. A maintenance or second-commit failure
does not invalidate the first checkpoint.
