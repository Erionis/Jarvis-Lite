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
   - **Current priority:** exactly one item only when exactly one distinct
     candidate is explicitly identified as current, now, or priority by a
     declared source. Quote or link the supporting source. If two or more
     distinct candidates are explicitly marked and the sources do not order
     them, say that no single current priority is grounded; surface the
     competing candidate titles and their source roles. Do not rank or choose
     one. If no item has that evidence, say that no current priority is
     grounded in the declared sources; do not rank by guesswork, age, item
     count, or assumed impact.
   - **Blockers:** list only dependencies, constraints, or waiting states
     explicitly stated by a declared source. An explicit dependency,
     constraint, or waiting statement in Inbox may be reported as a blocker;
     identify Inbox as the evidence source. Do not infer a blocker from an
     Inbox idea. If none are stated, say so.
   - **Inbox:** state whether declared Inbox material needs triage, without
     moving, classifying, or summarizing it into another source. Never
     classify, move, integrate, or mutate Inbox content.

Do not edit, create, rename, move, delete, stage, commit, configure Git, or
process Inbox items. The entire workflow remains read-only.
