---
name: jarvis-memory
description: Use when a user asks to keep, correct, forget, or consult a durable fact in Identity or Durable memory, or when a workflow surfaces a stable candidate; a time-bounded remember belongs to Future work.
---

# Jarvis Memory

Act as the semantic curator of `Identity` and `Durable memory`, not a global
gateway. Bootstrap, briefing, and ordinary work may consult declared sources
without invoking this workflow. Direct reads stay direct. Consultation is
read-only and never authorizes a change.

Resolve `Durable memory` through the consumer's declared capability map and
resolve `Identity` the same way. If a role required
for the current intent is missing, ambiguous, or points to a missing source,
stop without inventing a fallback; block only that action.

## Classify before proposing

The verb "remember" does not select the source; the horizon does. A fact with
an end date, deadline, or delivery belongs in `Future work` plus the project
note: do not propose `Durable memory`.

Search the existing content, index, and likely primary source first. Keep each
fact in one authoritative source—one authoritative home:

- behavior that should apply across every session and domain -> `Identity`;
- domains, repositories, tools, assets, or rituals -> stable local context;
- stable decisions, preferences, ownership, constraints, and traps ->
  `Durable memory`;
- knowledge specific to one body of work -> project-owned knowledge;
- unfinished actions -> `Future work`;
- completed events -> `Daily history`;
- versions, availability, and current progress -> live state or its living
  source;
- credentials, tokens, and keys -> an existing secret store or a protected
  local file.

Curate only `Identity` and `Durable memory` directly. Route every other category
to the workflow that owns its authoritative source. The governing boundary is
**do not copy live state** into durable memory. Jarvis Doctor remains read-only;
its findings become separate curation proposals, never automatic repairs.

## Preview every persistent change

An explicit request authorizes a proposal, not a write. Before every change to
`Identity` or `Durable memory`, show:

1. the semantic destination, with the path only when useful or requested;
2. the proposed text or readable diff; corrections use before/after;
3. why it belongs there, duplicates avoided, and links affected;
4. the canonical runtime choice UI with `Save`, `Edit`, or `Do not save`, or
   numbered equivalents when no choice UI exists.

There is **no write before confirmation**. Silence, refusal, or an edit request
leaves the files unchanged. For deletion, full overwrite, or deep semantic
restructuring, also apply the guardrail's impact, recovery, and double
confirmation requirements. Always **propose before semantic deletion**: name
the exact fact and its authoritative location, explain impact and recovery, and
obtain explicit approval before modifying it.

An inferred pattern is only a candidate. During ordinary work, offer at most
one high-value stable candidate at a natural boundary. When another workflow
delegates signals, evaluate at most five candidates in one compact proposal.
A pending or rejected proposal does not block the calling workflow. The caller
retains ownership of ordering, checkpoint status, the final response, and Git.
Git stays outside this skill. Do not stage, commit, push, or change Git
configuration.

## Grow structure progressively

Keep the bootstrap-loaded memory short and update facts in place. When
recurrence and durable density form a coherent topic with no better home,
propose an indexed detail note with its name, content to move, and index patch;
never create it automatically. Recurrence is evidence, not a numeric threshold.

If a project hub exists, the project hub remains authoritative. Durable memory
keeps only orientation and a pointer. Moving a general principle into Identity
is a semantic move, not a copy: keep unique triggers and exceptions in the
subordinate detail.

Raw uploads stay in `Inbox` until their destination is clear or confirmed;
preserve original files. When work reveals a customer or project, propose an
existing or approved domain location and its hub; the owning workflow performs
the move. Do not impose a universal `Projects/raw/deliverables` hierarchy.

## Apply an approved proposal safely

1. Re-read the target immediately before the patch.
2. If it changed, preserve non-overlapping changes. On semantic overlap, or if
   it changes again, reject last-writer-wins and do not write.
3. Apply the smallest approved patch to the current version. Update indexes or
   pointers only when the preview included them.
4. Re-read the result and verify every local link touched.
5. Report the semantic target, result, and verification without reopening the
   decision.

## Secrets and informed override

Warn by default and do not retain a secret in Identity or Durable memory; **do
not repeat the value**. **Do not display the value in previews, final responses,
or diagnostic commands**; never inspect a secret-bearing target with a command
or diff that prints its contents. Prefer the consumer's existing secret store
or a local destination verified as excluded from Git, then hand the approved
action to that destination's owning workflow.

If the user insists on a named tracked target, explain persistence in Git
history and future remotes, show the exact path without the value, and require
a second explicit confirmation equivalent to `save anyway` in a **separate user
turn after the warning**. The initial request cannot satisfy this second gate,
even when it already anticipates the risk or says `save anyway`. After that
informed confirmation, comply through the owning workflow. Before asking for
it, state honestly that **runtime or tool history may retain the supplied
value** because the write operation must carry it; do not promise technical-log
redaction that the runtime cannot guarantee. Keep every avoidable display and
all user-facing output redacted.
