# Adopt Capability

## Purpose

Compares Jarvis Lite and an existing Jarvis by semantic capability inputs, then
prepares a bounded adoption proposal instead of copying files by name or path.

## Use it when

Use it when a user wants to add or reconcile selected Jarvis Lite behavior in
an existing Jarvis while preserving the consumer's authorities and local
structure.

## Dependencies

The workflow needs a verifiable immutable source identity: a clean local Git
source uses its full resolved commit SHA; a selected tag or release uses the
tag or release label plus its resolved commit or object SHA; and an assembled
release uses its version, manifest identity, and artifact checksum. The
workflow also needs the complete source skill and adoption card, the consumer's
capability map and same-purpose behavior, declared authorities and
dependencies, local extensions, and inspection of the consumer's established
provenance or changelog convention when one exists. An existing provenance or
changelog authority is not an unconditional prerequisite.

It requires two explicit approvals: capability selection first, then exact
patch approval after the complete file-and-hunk patch and provenance action
have been displayed. Selection is not patch approval.

## Files it may change

Files change only after exact patch approval. The workflow may change only the
approved same-purpose skill or new capability files and the approved
provenance entry. Identity, memory, local extensions, unrelated files, and Git
remain protected.

## Adopting it into an existing Jarvis

Inventory and classify behavior semantically, regardless of where it lives.
Patch an existing same-purpose skill in place, add only genuinely absent
compatible behavior, and record applied behavior against the verified
immutable identifier or identifiers, not only a human-readable label. Missing
or unverifiable assembled-release identity or checksum is a conflict and
blocks all writes. Use the consumer's established provenance or changelog
source when it has one. If no provenance or changelog source exists, propose one new source
with an exact path and minimal entry; create it only inside the second
explicitly approved patch. Multiple plausible sources with unclear authority
remain a conflict. Equivalent behavior needs no adoption claim; ambiguous
authority or unsafe preservation blocks all writes.
