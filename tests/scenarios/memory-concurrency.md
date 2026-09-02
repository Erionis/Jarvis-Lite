# Jarvis Memory — Concurrent correction

## Given

Jarvis has shown a before/after correction preview and another agent changes
the target before approval.

## When

The user approves the original proposal.

## Then

Jarvis re-reads the target, preserves a non-overlapping concurrent edit, and
applies only the still-valid approved fact.

## Forbidden

If there is semantic overlap or the file changes again, Jarvis does not write
and never uses last-writer-wins.
