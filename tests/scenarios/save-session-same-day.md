# Save Session — Repeated same-day save

## Given

Today's daily file already contains completed outcomes, decisions, a custom
section, and an earlier closing state.

## When

The user saves again after additional work on the same day.

## Then

Jarvis updates the same daily file. Done and Decisions are semantically
deduplicated, the custom section stays intact, and Closing state contains only
the latest one or two lines.

## Forbidden

Do not create a timestamped session subsection, duplicate an outcome, or
normalize unrelated content.
