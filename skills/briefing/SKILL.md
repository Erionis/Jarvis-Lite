---
name: briefing
description: Use when a user asks for a session briefing or a start-of-session overview.
---

# Briefing

Give a concise session-start view from the declared authoritative sources. The
briefing is read-only and must not manufacture an order of importance.

## Workflow

1. Read `PROFILE.md` and resolve the declared Identity, Durable memory, Future
   work, and Inbox capability paths by semantic role. Do not use filesystem
   discovery, substitute a starter or other location, or invent a fallback.
   For every role whose declaration is missing, ambiguous, or points to a
   missing source, name that role and report it as unresolved; do not
   substitute another location or silently omit the role.
2. Read each resolved source only. Read Identity for context, the active
   Durable memory for retained commitments, and Future work for live work.
   Inspect Inbox only to identify untriaged input; do not process it.
3. Build the grounded priority candidate set:
   - Retain explicit `current`, `now`, or `priority` evidence as a candidate
     rule.
   - A non-placeholder work or focus item under the declared `Future work`
     source's `## Active` section is an active candidate.
   - A non-placeholder work or focus item under `Durable memory`'s `## Active
     Memory` section is an active candidate. Stable preferences, references,
     and facts that do not describe work, focus, or a commitment are not
     priority candidates merely because they appear in active memory.
   - Empty placeholders such as `- [ ]` are not candidates. The same semantic
     focus repeated in both sources is one distinct candidate.

   Durable memory and Future work are candidate-bearing sources. If either
   role is unresolved, do not claim a unique current priority because
   uniqueness cannot be verified. Surface any candidate found in the resolved
   source only as partial evidence.
4. Report these fields:
   - **Current priority:** Exactly one distinct grounded candidate may be
     reported as the current priority. Quote or link the supporting source. If
     two or more distinct candidates are explicitly marked and the sources do
     not order them, say that no single current priority is grounded; surface
     the competing candidate titles and their source roles. Two or more
     distinct unordered candidates produce no single current
     priority: surface them without ranking. Do not rank or choose one. If no
     item has grounded candidate evidence, say that no current priority is
     grounded in the declared sources; do not rank by guesswork, age, item
     count, or assumed impact.
   - **Blockers:** list only dependencies, constraints, or waiting states
     explicitly stated by a declared source. An explicit dependency,
     constraint, or waiting statement in Inbox may be reported as a blocker;
     identify Inbox as the evidence source. Do not infer a blocker from an
     Inbox idea. If Inbox is unresolved, say that Inbox status is unverifiable
     and do not claim that blocker coverage is complete. If all relevant
     sources are resolved and none state a blocker, say so.
   - **Inbox:** state whether declared Inbox material needs triage, without
     moving, classifying, or summarizing it into another source. Never
     classify, move, integrate, or mutate Inbox content. If Inbox is
     unresolved, report that its status is unverifiable.

Do not edit, create, rename, move, delete, stage, commit, configure Git, or
process Inbox items. The entire workflow remains read-only.
