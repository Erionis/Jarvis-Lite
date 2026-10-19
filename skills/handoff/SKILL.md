---
name: handoff
description: Use when asked to create, update, resume, complete, supersede, or list a handoff, or when work needs a new session.
---

# Handoff

Keep one living cross-session record.
Own the records in the declared `Handoff` source and its archive. Outside that
source, change only verified references needed by a move, subject to the
consumer's protection rules. Never mutate Git.

## Preflight

Resolve `Handoff` through the consumer's declared capability map. A missing or
ambiguous role makes the workflow unavailable. Its source must be a readable
and writable directory; otherwise report the discrepancy.
Do not create a fallback directory.

Read every candidate. The valid states are `active`, `completed`, and
`superseded`. A missing or unknown state is not active; report a discrepancy.
Re-read before patching; preserve non-overlapping changes and local sections,
and stop on a semantic conflict.

## Lifecycle

- `active`: unfinished work.
- `completed`: evidenced completion.
- `superseded`: intentional replacement.

Preserve `created:` and refresh `updated:`. Transitions add
`resumed:`, `completed:`, or `superseded:`; `superseded_by:` links a replacement.
Resume is not a state. Closing a record includes the archival procedure below;
do not add an `archived` status. Never expire work by age or delete records
automatically.

## Create or update

For `/handoff` or `/handoff [topic]`:

1. Use the supplied or evidenced topic; ask only if ambiguous.
2. Compare every record relevant to this work, including archived records.
   The same work requires the same authoritative
   reference — issue, pull request, note, or path — or an identical objective.
   A similar filename is insufficient.
3. If an authoritative match has a missing or unknown status, report the
   discrepancy and stop without writing.
4. For one certain `active` match, update the active record in place; preserve
   `created:`, refresh `updated:`, and rewrite the snapshot. For multiple
   candidates, use the runtime choice UI or numbered options. For a closed
   match, do not reopen it implicitly; ask whether to reopen the same objective
   or create a handoff for the new scope. Do not write before a choice.
   An explicitly approved reopening moves the record back to the operational
   directory using the same reference checks as archival, then sets `active`.
   Preserve its history and earlier closure timestamps.
5. Otherwise create `handoff-YYYY-MM-DD-topic-slug.md` in the declared source.
   Add a numeric suffix only for an unrelated filename collision:

```markdown
---
type: handoff
status: active
created: YYYY-MM-DD HH:mm
updated: YYYY-MM-DD HH:mm
topic: Topic
tags:
  - handoff
---

# Handoff — Topic

## Context and goal

## Current state

## Evidence and relevant files

## Next action
```

Add only useful decisions, constraints, failed approaches, or questions.
Confirm path and resume command.

## Resume

For `/handoff resume`, filter `status: active`. Use one relevant record; for
multiple candidates use the runtime choice UI or numbered options, never name
or recency. If there is no relevant `active` record, say so. For a closed
record, do not reopen it implicitly; ask whether to reopen the same objective
or create a handoff for the new scope.

Read critical evidence and re-read the record. Update `resumed:` and `updated:`,
keep `status: active`, and summarize context, state, and next action briefly.

Ordinary resume does not traverse `archive/`. Read an archived record when it
is named or needed to distinguish an already closed objective.

## Complete and supersede

For `/handoff complete`, choose only when needed, then set
`status: completed`, `completed:`, and `updated:`. For an intentional
replacement, create the replacement first; then set `status: superseded`,
`superseded:`, `updated:`, and `superseded_by:` on the old record. Keep both.
Automatically archive only the record just completed or superseded.

## Archive on closure

Archival belongs to completion, replacement, and the current-record closure
in `save-session`; it needs no separate routine approval or scheduled job.
Use `archive/` inside the declared `Handoff` directory, creating it on first
use. An explicitly declared consumer archive takes precedence; never infer
one from a similarly named folder.

- Re-read the record and verify closure and concurrency. Keep its status,
  `created:`, other timestamps, and history. Move it without leaving a second
  authoritative copy. Invalid records and `type: document-pointer` files are
  not archival candidates.
- Before moving, inspect destination collisions and incoming and outgoing
  references, including `superseded_by:` and local attachments. Preserve
  relative-link destinations, fragments, and space encoding. Change only
  verified references. Use an unused suffix on collision; never overwrite.
- Respect protected-source ownership and approval rules. Do not silently
  change Identity or Durable memory. If a reference cannot be updated, retain
  a small `type: document-pointer` at the old path with a relative link to the
  archived record, without copying its contents. Do not build pointer chains
  or count a pointer as a separate handoff.
- Verify the destination, references, and any successor before reporting
  success. If a consistent move cannot be ensured, retain the closed record
  at its original path and report archival as deferred. A failure must not
  lose a record or break a previously working link. Report the actual final
  path.

Only the record closed by this workflow is archived automatically. Bootstrap,
updates, briefing, and listing never sweep old records; historical cleanup is
a separate user request.

## List

`/handoff list` groups records as `active`, `completed`, `superseded`, then
invalid, including archived records with their paths. It changes nothing.
Follow a `document-pointer` only for an explicit read; do not count it twice.
