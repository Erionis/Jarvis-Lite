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

Personal improvements use the source's explicit catalog and the consumer's
authorized writer. `jarvis-memory` is optional: an equivalent local workflow
or a narrow approved direct edit can be used when local rules allow it. The
scoped recovery helper needs Python 3; an equivalent local recovery mechanism
may be used. Without recovery, inspection and proposals remain available but
application stops.

It requires two explicit approvals: capability selection first, then exact
patch approval after the complete file-and-hunk patch and provenance action
have been displayed. Selection is not patch approval.

## Files it may change

Files change only after exact patch approval. The workflow may change only the
approved same-purpose skill or new capability files and the approved
provenance entry. Identity, memory, local extensions, unrelated files, and Git
remain protected.

A separately previewed personal-improvement patch may update its authoritative
destination through the authorized writer. The approved scope also includes
the single decision/provenance record and original copies under
`.jarvis-adoption/recovery/<operation-id>/`. The updater's release state does
not own personal decisions.

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

See [personal adoption](../jarvis-update/personal-adoption.md) for the exact
preview, missing-curator path, refusal handling and recovery procedure.
Interrupted changes are inspected before a new proposal or rollback; a repeated
completed adoption is verified without duplicate writes. Recovery is retained
locally until the user approves cleanup and must not enter public artifacts.
