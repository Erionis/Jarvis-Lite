---
name: handoff
description: Use when asked to create, update, resume, complete, supersede, or list a handoff, or when work needs a new session.
---

# Handoff

Keep one living cross-session record.
Write only inside the declared `Handoff` source; link other authorities without
changing them. Never mutate Git.

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
Resume is not a state. Never delete, archive, or expire a handoff automatically.

## Create or update

For `/handoff` or `/handoff [topic]`:

1. Use the supplied or evidenced topic; ask only if ambiguous.
2. Compare every record. The same work requires the same authoritative
   reference — issue, pull request, note, or path — or an identical objective.
   A similar filename is insufficient.
3. If an authoritative match has a missing or unknown status, report the
   discrepancy and stop without writing.
4. For one certain `active` match, update the active record in place; preserve
   `created:`, refresh `updated:`, and rewrite the snapshot. For multiple
   candidates, use the runtime choice UI or numbered options. For a closed
   match, do not reopen it implicitly; ask whether to reopen the same objective
   or create a handoff for the new scope. Do not write before a choice.
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

## Complete and supersede

For `/handoff complete`, choose only when needed, then set
`status: completed`, `completed:`, and `updated:`. For an intentional
replacement, create the replacement first; then set `status: superseded`,
`superseded:`, `updated:`, and `superseded_by:` on the old record. Keep both.

## List

`/handoff list` groups records as `active`, `completed`, `superseded`, then
invalid. It changes nothing.
