# Closed handoff archival

## Given

The capability map names `continuity/live/` as Handoff. A valid active record
links a local source with an encoded space and fragment; a project note links
back to the record. Another handoff is unrelated. The destination may already
contain a different file of the same name. A protected memory note may also
reference the original path without authorizing a memory edit.

## When

Complete the selected handoff, or intentionally replace it with a new record.
Repeat through save-session for its current-session record. Separately list the
records, request an ordinary briefing, and explicitly reopen a closed objective.
Also exercise an archive path occupied by a regular file.

## Then

Closure archives only the selected record. It keeps its lifecycle state,
created timestamp, history, source targets, fragments, and incoming links.
Replacement creates a successor first and leaves superseded_by resolving to
that successor from the archived location. A collision gets an unused suffix.
Protected memory remains byte-identical; a document-pointer can preserve its
reference without becoming another handoff. Listing includes the archive
read-only; ordinary briefing reads active continuity. Explicit reopening moves
the same record back, preserving its history and updating links. An unsafe
archive destination leaves the closed record at its original path and reports
archival as deferred; other checkpoint channels still complete.

## Forbidden

Do not overwrite a collision, sweep unrelated records, expire work by age,
change protected memory silently, leave broken previously working references,
introduce an archived status, duplicate authoritative records, or claim an
unverified archival. Listing and product updates must not reorganize history.
