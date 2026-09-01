---
name: briefing
description: Use when a user asks for a session briefing or a start-of-session overview.
---

# Briefing — Quick Start

Give a local, read-only, dependency-free briefing grounded in evidence.

## What to do

### Step 1 — Gather context

Resolve through the local capability map:

1. `Identity` supplies preferences.
2. `Durable memory` supplies retained commitments. Stable preferences,
   references, and facts are not work candidates.
3. `Future work` supplies current work and next actions. Ignore empty
   placeholders such as `- [ ]`.
4. `Daily history` supplies recent unfinished work or an explicit next action.
   Use the latest relevant entry.
5. `Handoff` supplies continuation. A Handoff is active only when its
   frontmatter contains `status: active`. Treat each distinct active Handoff
   with an unfinished next action as a candidate. Do not select between
   multiple active Handoffs by recency alone.
6. `Inbox` supplies untriaged item names plus explicit deadlines, dependencies,
   constraints, or waiting states. Inbox is attention-only and never a
   priority candidate. An unresolved Inbox limits only attention and triage
   coverage. Do not process it.

Use only rituals declared in the local profile. If a role's declaration is
missing, ambiguous, or points to a missing source, mark it unresolved and
continue from verified sources. Do not discover or substitute another path.

### Step 2 — Select the focus

Deduplicate the same semantic focus across sources. Recommend one candidate
only when direct evidence distinguishes it: an explicit priority, an explicit
deadline, a dependency or unblock, or an unequivocal continuation with a
stated next action.

Give one concrete next step and why it matters now. Do not rank by guessed
impact, age, counts, source order, or assumed urgency.

If candidates remain materially equivalent, no unique priority is grounded.
Do not invent a ranking. Request one decision under the canonical interaction
rule with at most three concrete candidates and next steps. If more exist, say
so without demoting omitted items.

`Durable memory`, `Future work`, `Daily history`, and `Handoff` are
candidate-bearing roles. If any candidate-bearing role is unresolved, do not
claim a unique priority; show resolved candidates as partial evidence.

### Step 3 — Generate the briefing

Use only the useful parts:

- `Priority`: one recommendation, concrete next step, and why it matters now;
  or the bounded choice.
- `Continuity`: At most one visible `Continuity` line from relevant Daily
  history or Handoff evidence. Do not repeat the same focus.
- `Attention`: Include `Attention` only for verified deadlines, blockers,
  Inbox material, or other explicit friction.
- `Context incomplete`: one compact `Context incomplete` line naming unresolved
  roles and the practical limitation.

Omit empty sections. Use about five lines when signal is low and normally no
more than 10–12 lines. With no work or friction, say so and ask what to work on.

## Rules

- Be direct and friendly.
- Use declared local sources; require no remote service, network, script, or
  Git state.
- Do not edit, create, rename, move, delete, stage, commit, configure Git, or
  process Inbox items. The entire workflow remains read-only.
