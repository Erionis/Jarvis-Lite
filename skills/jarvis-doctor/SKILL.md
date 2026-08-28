---
name: jarvis-doctor
description: Use when an existing Jarvis appears inconsistent or needs a local safety check.
---

# Jarvis Doctor

Audit an existing Jarvis using local evidence only. The entire audit is
read-only: inspect the declared installation and explain findings without
changing it.

## Mutation boundary

You may inspect the consumer profile, its declared capability sources,
declared filesystem targets, and local Markdown links. Do not use remote
services as evidence.

Do not edit, create, rename, move, delete, or install anything. Do not generate
a report file. Do not stage, commit, push, or configure Git. You may propose a
next step in the response, but never perform repair as a side effect.

## Bootstrap gate

Follow the canonical bootstrap before Doctor. When Identity is missing or the
onboarding marker is present, do not bypass first run. Doctor starts only after
ordinary work is available.

Once ordinary work is available, report a missing non-Identity capability as
observed. Its absence does not authorize a fallback source.

## Audit workflow

1. **Resolve the declared map.** Resolve every capability role from the
   consumer's declared capability map. Do not use starter paths, filesystem
   discovery, or guessed fallbacks. Preserve local extensions outside the
   common contract. Do not normalize or remove them.
2. **Inventory declarations and targets.** For every role, determine whether
   its declaration is unique, missing or ambiguous, and whether each declared
   target exists and is readable. A declared missing target is evidence; do
   not silently create it. A missing optional capability is not automatically
   an error.
3. **Inspect readable declared Markdown sources.** Limit content checks to the
   sources made authoritative by the declared map:
   - **Stale dated claims:** A past date alone is not stale. Mark a
     current-state claim `unverifiable` only when its own date or freshness
     statement no longer supports present-tense use, or when the declared
     evidence cannot establish it. Do not invent a universal age threshold.
   - **Contradictions:** Confirm a contradiction only from two mutually
     incompatible claims about the same subject with compatible scope and
     time. Different dates or scopes are not automatically contradictions. If
     scope cannot be resolved, label the finding `unverifiable`, not `error`.
   - **Broken links:** Ignore external URLs and fragment-only anchors. Resolve
     each local relative Markdown link relative to its declaring source. When
     the target is missing, retain the literal link and the resolved missing
     target as evidence.
4. **Render every finding completely.** Use the finding fields below and keep
   each location tight enough for the user to inspect directly.
5. **Verify the audit summary.** Report inspected scope and count findings only
   after verifying what was read. If there are no findings, state which roles,
   sources, and link scope were checked. Do not claim the whole installation
   is healthy beyond that evidence.

## Finding contract

Every finding contains all of these fields:

- `Label`: Use exactly one label: `error`, `unverifiable`, or `optional evolution`.
- `Capability role`: Name the semantic role when applicable; otherwise state
  that the finding is not role-specific.
- `Source path and location`: Give the path and a tight line or section
  location.
- `Observed evidence`: State the local fact that was actually observed.
- `Expected contract or verification limit`: State the broken requirement or
  why the evidence cannot support a reliable conclusion.
- `Proposed next step`: Give one concrete response-only suggestion and mark it
  explicitly not applied.

Use the labels consistently:

- `error`: a mechanically verified contract break, such as an ambiguous
  authoritative declaration, a declared missing or unreadable required target,
  a confirmed contradictory current claim, or a broken local relative link.
- `unverifiable`: insufficient, stale, conflicting-scope, or unavailable
  evidence prevents a reliable conclusion.
- `optional evolution`: a non-required improvement or optional capability,
  never a disguised failure.
