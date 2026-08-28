# Adopt Capability

## Purpose

Compares Jarvis Lite and an existing Jarvis by semantic capability inputs, then
prepares a bounded adoption proposal instead of copying files by name or path.

## Use it when

Use it when a user wants to add or reconcile selected Jarvis Lite behavior in
an existing Jarvis while preserving the consumer's authorities and local
structure.

## Dependencies

The workflow needs an immutable source release or commit, the complete source
skill and adoption card, the consumer's capability map and same-purpose
behavior, declared authorities and dependencies, local extensions, and its
existing provenance or changelog authority.

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
compatible behavior, and record applied behavior against the immutable source
release in the consumer's single established provenance record. Equivalent
behavior needs no adoption claim; ambiguous authority or unsafe preservation
is a conflict and blocks all writes.
