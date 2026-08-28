---
name: briefing
description: Use when a user asks for a session briefing or a start-of-session overview.
---

# Briefing

Give a concise session-start view from the declared authoritative sources. The
briefing is read-only and must not manufacture an order of importance.

## Workflow

1. Read `PROFILE.md` and resolve the declared Identity, Durable memory, Future
   work, and Inbox capability paths. Do not substitute a starter or other
   location.
2. Read Identity for context, the active Durable memory for retained
   commitments, and Future work for live work. Inspect Inbox only to identify
   untriaged input; do not process it.
3. Report these fields:
   - **Current priority:** exactly one item only when a declared source
     explicitly identifies it as current, now, or priority. Quote or link the
     supporting source. If no one item has that evidence, say that no current
     priority is grounded in the declared sources; do not rank by guesswork,
     age, item count, or assumed impact.
   - **Blockers:** list only dependencies, constraints, or waiting states
     explicitly stated by a declared source. If none are stated, say so.
   - **Inbox:** state whether declared Inbox material needs triage, without
     moving, classifying, or summarizing it into another source.

Do not edit, create, rename, move, delete, stage, commit, configure Git, or
process Inbox items. The entire workflow remains read-only.
