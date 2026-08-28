---
name: jarvis-memory
description: Use when a user asks about durable memory or requests durable-memory curation.
---

# Jarvis Memory

Curate the stable model that should guide future sessions. Keep each fact in
**one authoritative source** and preserve the boundary between durable memory
and operational state.

## Workflow

1. **Resolve the target.** Resolve `Durable memory` through the consumer's
   declared capability map and show the resolved target before proposing or
   applying a change. Never assume a consumer-specific path. If the role is
   missing, ambiguous, or points to a missing source, stop without inventing a
   fallback.
2. **Identify the intent.** Support read-only consultation and the explicit
   curation intents add, correct, consolidate, and forget. For consultation,
   answer from the resolved source and identify where the answer came from;
   make no changes.
3. **Classify the candidate.** Treat durable material as one of:
   - a timeless or currently stable fact;
   - a dated snapshot, which must include its date, source, scope, and an
     explicit limit on what it establishes;
   - a pointer to a living authoritative source that owns changing state.
4. **Find the existing home.** Search the resolved Durable memory source before
   adding anything. If the fact already exists, update that authoritative home
   rather than creating a duplicate. If another source owns the fact, preserve
   that ownership and use a pointer only when durable guidance needs one.
5. **Apply the approval rule.** A direct, narrowly scoped user instruction is
   approval for the named addition or for a verifiable correction. Show the
   resolved target and keep that patch minimal. For an inferred candidate, a
   conflict, broader consolidation, or any materially different change, show
   the proposed patch and wait for explicit approval.
6. **Verify the result.** After a write, re-read the affected section and report
   what changed, including the authoritative location.

## Durable boundary

The governing rule is **do not copy live state** into Durable memory. Live
status, future work, and history remain in their living sources. Promote only
the stable model that should guide future sessions. If the useful truth changes
with operations or time, leave it where it lives or retain only a pointer to
that authoritative source.

## Corrections and conflicts

Patch a verifiable correction in the existing fact's home. State the evidence
that makes the correction verifiable and change only the affected fact.

Do not silently choose between conflicting claims. Show the claims, their
locations, and the available evidence. If the conflict cannot be verified, ask
the user which model is authoritative before changing either claim.

## Consolidation and forgetting

Consolidation preserves one authoritative source. Show the proposed destination
and references affected, and obtain explicit approval before any consolidation
that moves content, changes meaning, or removes a duplicate.

Always **propose before semantic deletion** or restructuring. A forgetting
proposal must name the exact fact and its authoritative location, explain its
impact and recovery, and receive explicit approval before modifying the source.
The initial request to forget starts this proposal; it does not bypass the
approval gate. Never delete or rewrite unrelated memory content.

## Mutation boundary

Write only to the resolved Durable memory source and only within the approved
scope. Do not modify Identity, Future work, Inbox, or history as a side effect.
Do not stage, commit, push, or change Git configuration as part of this skill.
