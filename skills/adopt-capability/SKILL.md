---
name: adopt-capability
description: Use when adopting a Jarvis Lite capability into an existing Jarvis.
---

# Adopt Capability

Inspect a selected Jarvis Lite source and help a consumer adopt compatible
behavior deliberately. This is a semantic migration workflow, not a file-copy
workflow.

## Source and evidence boundary

The user supplies or selects the Jarvis Lite repository or release. Resolve an
immutable source release identifier before proposing adoption. A clean local
Git source records the full resolved commit SHA. A selected Git tag or release
records its human-readable label and its resolved commit or object SHA. A tag
name alone is insufficient. An assembled release records its version, manifest
identity, and artifact checksum such as SHA-256. A branch name may locate a
revision, but a moving branch name is not the recorded identifier.

A dirty source tree, moving branch name without a resolved commit, missing
identifier, or unverifiable source card blocks adoption and produces no write.
If any required assembled-release identity or checksum is missing or
unverifiable, classify adoption as `conflict` and perform no write.
Do not require a remote or GitHub account. A clean local repository at a
resolved commit is sufficient.

Read the selected source skill's complete `SKILL.md` and human adoption card.
Do not import private files or history. Preserve all public license and
provenance obligations carried by the selected release.

## Semantic inventory

Compare capabilities semantically, not by filename, folder, command, or skill
name alone. Inventory both systems before assigning a label:

- For the source, record purpose, triggers, dependencies, authoritative roles,
  mutation scope, safety and approval gates, and adoption notes.
- For the consumer, record its consumer capability map, same-purpose behavior
  wherever it lives, declared authoritative sources, adapters, local
  extensions, and existing provenance or changelog convention.

Read every candidate skill card completely before classification. Do not infer
equivalence or absence from a path or skill name.

## Classification contract

Each fully inspected candidate gets exactly one label:

- `add`: no same-purpose behavior exists, and every dependency can be
  satisfied without a second authority or protected-source rewrite.
- `adapt`: same-purpose behavior exists or the consumer structure differs, and
  compatible source behavior can be integrated in place while preserving
  local extensions and authorities.
- `already present`: consumer behavior already satisfies the source contract
  and dependencies, so no capability patch or source-adoption claim is needed.
- `conflict`: an incompatible safety or authority contract, unresolved
  dependency, unreadable candidate, dirty or unpinned source, or protected or
  local behavior would have to be overwritten. Conflict is a stop state, not
  permission to choose a winner.

Do not force a classification from incomplete evidence. An incomplete
candidate is a `conflict` only when the unresolved evidence itself prevents
safe adoption; name the missing evidence.

## Classified proposal

For every candidate, display all of these fields before asking for selection:

- `Semantic capability and exact label`
- `Source release or commit`
- `Immutable source identifier(s)`
- `Consumer equivalent, regardless of path`
- `Benefit`
- `Dependencies and whether each is satisfied`
- `Exact affected consumer files`
- `Local extensions to preserve`
- `Conflicts or unresolved evidence`
- `Intended provenance action`

For the source and provenance action, display the immutable identifier or
identifiers, not only a human-readable label.

## Approval gates

Do not modify anything before explicit approval. There are two separate gates,
and both must complete in order.

### Gate 1 — Capability selection

Wait for the user to explicitly select one or more candidates from the
classified inventory. A general request to inspect the repository is not
selection. A direct request that names a capability may satisfy only this first
gate.

No selection means zero filesystem changes.

### Gate 2 — Exact patch approval

For every selected non-conflict candidate, show the exact file and hunk patch,
preservation decisions, and provenance update. Then wait for a second explicit
approval of that displayed patch. Selection is never patch approval.

Selection without exact patch approval also means zero filesystem changes,
including no provenance write and no Git mutation. Conflict candidates cannot
advance until the conflict is resolved and reclassified.

## Apply only the approved patch

After exact patch approval:

- Change only the approved paths and hunks for selected candidates.
- For `adapt`, patch the existing same-purpose skill in place rather than
  adding a duplicate under the Lite path.
- For `add`, create only the approved capability files.
- For `already present`, make no capability write.
- Never overwrite, redirect, or curate identity or memory content as part of
  capability adoption.
- Preserve local extensions, adapters, unrelated files,
  authoritative-source declarations, and user formatting unless the exact
  approved patch contains a compatible and safe adapter change.

Re-read every affected file and verify the approved patch scope. On partial
failure, stop, disclose the exact state, and do not reset or discard unrelated
work. Do not stage, commit, push, create a remote, or change Git configuration.

## Provenance

For an applied `add` or `adapt`, record the immutable source release or commit
and semantic capability in the consumer's one clearly established existing
provenance or changelog source. The provenance entry must record the displayed
immutable identifier or identifiers, alongside any human-readable version,
tag, or release label. The provenance entry is part of the exact patch shown
at the second gate, so the user sees those immutable identifiers before
approval.

Do not claim source adoption for independently equivalent `already present`
behavior.

If no provenance or changelog source exists, propose one new source with an
exact path and minimal entry; create it only inside the second approved patch.
If multiple possible sources exist or authority is unclear, adoption is
blocked as `conflict` until the user identifies the authoritative record.
Never write a second provenance authority by guesswork.
