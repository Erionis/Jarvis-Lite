---
name: jarvis-update
description: Use when a user asks to check for or install a Jarvis Lite update.
---

# Jarvis Update

Update release-managed behavior without taking ownership of the user's Jarvis.
The normal path is short; customization detail appears only when an affected
component overlaps the release.

## Runtime dependency

The deterministic helper uses the Python 3 standard library. If Python 3 is
unavailable, report the update as blocked without changing the consumer; the
rest of Jarvis remains operational.

## 1. Resolve release evidence

Read the local update state when it exists and the installed release manifest.
Resolve an immutable target release from the public Jarvis Lite repository.
Obtain both `Jarvis-Lite.zip` and `Jarvis-Lite.zip.sha256`; a moving branch or
an unverified directory is not an update source.

Run `scripts/update_lite.py --help` from the current skill. For a pre-updater
Lite, first verify the official checksum with an available local checksum tool,
extract outside the consumer, and use the target artifact's helper. Never
execute artifact code before its published checksum matches. First adoption
continues only when the local profile, Lite core marker, and both physical
runtime mirrors form a recognizable Lite identity; an ambiguous workspace is
blocked.

Stage outside the consumer. The helper must verify checksum, one archive root,
product, version, commit identity, manifest schema, safe paths, and every
managed-file hash before continuing.

## 2. Explain, then preflight

Explain the release before asking for approval: installed version, target
version, practical changes, and release impact. Then run the read-only
preflight. It may write only to the external staging area and report file.

Classify affected components from manifest and installed baseline evidence:

- `safe`: unchanged release-managed behavior can advance automatically;
- `preserve`: a local extension does not overlap this release;
- `decision`: local and release changes overlap;
- `blocked`: recovery or a coherent result cannot be proven.

`jarvis-update`, `jarvis-doctor`, system guardrails, migration helpers, and
runtime adapters are `control-plane`: preserve a collision in recovery, then
install the canonical release component. Other shipped skills are
`functional` and may be verticalized. Identity, durable memory, future work,
Daily history, handoffs, Inbox, local profile content, Git history, and
unrelated files are consumer-owned.

Treat both runtime mirrors as one component. Divergence is evidence, never a
reason to choose one copy silently. Do not invoke `jarvis-doctor`; ignore an
unrelated finding unless it prevents this release or affected bootstrap.

## 3. Negotiate only real conflicts

With no decisions, summarize the exact plan and ask for one confirmation. With
functional overlap, discuss one conflict at a time and recommend one outcome:

- `keep and adapt`: retain the local behavior in a compatible reviewed overlay;
- `replace`: take the release behavior;
- `merge`: use one exact reviewed overlay containing both compatible behaviors;
- `postpone`: defer the component or the whole update.

A keep or merge overlay must be prepared outside the consumer, shown exactly,
and keep both runtime mirrors coherent. Never improvise a semantic merge inside
the apply step.

Partial adoption is valid only for an isolated functional component or an
explicit compatibility overlay. If a user retains Daily plus Session Log, keep
the complete compatible functional writer set; otherwise postpone the
incompatible update as a whole. Surface a remembered decision again only when
the release touches that component or invalidates a dependency.

## 4. Approve and apply

Use the helper's report to build the exact decision file. Run its planning
validation before showing the final scope: target release, every create,
replace, preserve, delete, overlay, migration, and recovery location.

No consumer write starts before explicit approval of the exact plan. After
approval, run the helper's apply command. It must recheck current hashes,
create a scoped recovery point, mutate only approved paths, stop after the
first failure, and advance installed state only after focused verification.
Never stage, commit, reset, push, create a remote, or alter consumer Git.

## 5. Verify and report

Focused verification checks release identity, canonical control-plane hashes,
approved functional results, selected migrations, preserved overrides, and
both runtime mirrors. It does not perform a whole-workspace audit.

Report exactly one outcome: updated, updated with preserved overrides,
postponed, blocked, or rolled back. Name the effective version, retained
customizations, postponed items, verification result, recovery point, and any
external staging directory that can now be removed.

If apply stops after a partial write, installed state does not advance. Report
the exact partial scope and offer rollback from the scoped recovery point.
Rollback restores all in-scope paths and prior update state without touching
consumer-owned or Git data. Before restoring anything, it verifies every
in-scope path against the recorded pre-update or post-update hash. If a path
was edited after the update, stop without mutation and ask how the user wants
to preserve that newer edit.

## Common mistakes

| Mistake | Required response |
|---|---|
| Treating all local edits as errors | Classify only overlap with this release. |
| Copying one runtime mirror | Plan and verify both runtime mirrors together. |
| Updating before the decision | Stop: approval follows the exact final plan. |
| Running Doctor after update | Run focused verification only. |
| Deleting a changed obsolete path | Preserve or negotiate; automatic deletion requires the baseline hash. |
