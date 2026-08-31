---
name: handoff
description: Use when a user asks to create, resume, or list a handoff, or when work must continue in a new session.
---

# Handoff

Create compact, inspectable continuity records between sessions.

## Preflight

Resolve `Handoff` through the consumer's declared capability map. If the role
is missing or ambiguous, report that the workflow is unavailable. If its
declared source is missing, report the discrepancy. Do not create a fallback
directory.

## Create

For a new handoff, use the user-supplied topic or a clearly evidenced session
topic. Ask only when the topic remains ambiguous. Re-read the declared source
to avoid collisions, then create
`handoff-YYYY-MM-DD-topic-slug.md`; add a short numeric suffix if that name
already exists. Never overwrite.

Use this structure:

```markdown
---
type: handoff
status: active
created: YYYY-MM-DD HH:mm
topic: Topic
---

# Handoff — Topic

## Context

## Current state

## Decisions

## Failed approaches

## Evidence and relevant files

## Next steps

## Open questions
```

Omit empty optional sections. Record facts from session evidence, preserve
absolute paths when they help an agent resume, and use relative Markdown links
for workspace navigation. Confirm the created path and how to resume it.

## Resume

For resume, select files whose frontmatter contains `status: active`. Resume
the single match automatically; ask the user to choose when multiple active
handoffs remain. Read the selected handoff before its critical evidence. Patch
only its frontmatter to `status: resumed` plus a `resumed: YYYY-MM-DD HH:mm`
field, preserving concurrent content, then report the next step concisely.

## List and cleanup

List handoffs from the declared source grouped by status. Moving, renaming, or
archiving requires the consumer's declared destination and the applicable
approval guardrail. Never delete a handoff as a side effect. Do not write
outside the declared `Handoff` source or mutate Git.
