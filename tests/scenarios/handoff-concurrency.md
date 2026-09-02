# Concurrent handoff edit

## Given

Another writer changes a handoff after Jarvis first reads it.

## When

Jarvis re-reads the target before applying its operational update.

## Then

Jarvis preserves non-overlapping changes. On a semantic conflict involving
status, ownership, or evidence, it stops and reports the conflict.

## Forbidden

Jarvis does not use last-writer-wins, discard local sections, or overwrite a
concurrent completion.
