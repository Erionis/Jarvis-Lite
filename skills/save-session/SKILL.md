---
name: save-session
description: Use when a user asks to save the current session or create a session checkpoint.
---

# Save Session

Create an evidence-based checkpoint without absorbing unrelated user work or
assuming that Git or a remote is available.

## Workflow

1. **Resolve persistence capabilities.** Read the consumer capability map.
   Resolve `Daily history`, `Future work`, and `Durable memory` through the
   consumer's declared capability map, by semantic role rather than by a
   familiar path. Do not hard-code a starter path or create a fallback file.
   A missing or ambiguous role disables only that persistence channel; report
   the limitation and continue every other part of the checkpoint that remains
   safe. Do not invent a second history source.
2. **Build the checkpoint inventory.** Use evidence from the current session
   to identify completed outcomes, explicit future items, stable signals,
   files actually changed in the session, and the current Git boundary. Do not
   manufacture decisions, infer follow-ups that were not stated, or claim
   completion without evidence.
3. **Write the daily checkpoint.** Persist completed chronology only in the
   declared `Daily history` source. Unless that source declares another local
   convention, use one file per local calendar day at
   `YYYY/MM/YYYY-MM-DD.md`. Create only the required year and month directories
   and the current day's file. Re-read the target immediately before writing,
   then append or update one compact session entry without overwriting
   unrelated entries. Include only evidenced outcomes, decisions, and the
   next explicit step. Do not invent a second history source or copy the full
   conversation.
4. **Route future work narrowly.** Deduplicate and route only explicit
   unresolved follow-ups to the declared `Future work` source. A direct
   save-session request authorizes a narrow append or update of session-owned
   future items, but never deletion, reordering, or rewriting of unrelated
   entries. If ownership or target is unclear, show a proposal and wait for
   approval instead of changing the source.
5. **Delegate durable-memory decisions.** Route stable signals through
   `jarvis-memory`. Do not write `Durable memory` directly. Let that skill
   decide whether a candidate is stable, a bounded snapshot, or a pointer and
   apply its conflict and approval rules. Live state and ordinary history must
   not be promoted as durable facts.
6. **Establish the Git boundary.** Git is optional. Before any Git mutation,
   run `git status --short`, inspect the staged diff separately from unstaged
   and untracked changes, and record the initial index. Identify the exact
   session-owned paths from the session evidence. If Git is unavailable or
   the working directory is not a repository, finish the content checkpoint
   and report that no local Git checkpoint was made.
7. **Commit only a provably safe scope.** A local commit is useful only when
   the initial index is empty, every path to stage belongs to this session, no
   target path mixes pre-existing user changes with session changes, and the
   diff is meaningful. Stage exact session-owned paths only, using an
   exact-path command such as `git add -- <path>`. Never use `git add -A` or
   `git add .`. Verify the staged path set before committing, for example with
   `git diff --cached --name-only`, and commit only when it exactly matches the
   intended scope.
8. **Stop on unsafe attribution.** If the initial index is non-empty,
   attribution is uncertain, a path mixes ownership, or staged verification
   differs from the intended scope, do not mutate the index and do not commit.
   Report the exact reason and leave pre-existing work and every unrelated
   path untouched. A save-session request does not authorize absorbing work
   that predates this session.
9. **Disclose the result and any failure state.** After a successful commit,
   report its hash and run `git status --short` again. If staging or commit
   fails, do not reset, discard, or rewrite user work; disclose the resulting
   index and worktree state, and give a recovery path limited to paths this
   workflow staged. Do not change other paths while recovering.
10. **Keep the checkpoint local.** A checkpoint is local only: never push,
    create a remote, change Git configuration, force, reset, amend unrelated
    history, or claim that a local commit is an off-device backup.

## Checkpoint response

Report the evidenced completed outcome, the `Daily history` path or limitation,
any `Future work` update or limitation, the result of `jarvis-memory` routing,
and the final Git state. Name every source or path changed and explicitly
distinguish a content checkpoint from a local Git checkpoint.
