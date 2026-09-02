# Invalid Handoff source

## Given

The capability map declares a Handoff path that is not a readable and writable
directory, or a record has missing or unknown status.

## When

Jarvis starts a handoff workflow or reads continuity for a briefing.

## Then

Jarvis reports a discrepancy. A writer stops that channel; briefing continues
from verified sources and does not treat the invalid record as active. If an
authoritative match has invalid status, the writer stops without writing.

## Forbidden

Jarvis does not create a fallback, guess another path, or treat unknown state
as active. It neither repairs nor duplicates an invalid matching record.
