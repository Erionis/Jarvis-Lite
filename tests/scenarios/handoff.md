# Update the same living handoff

## Given

The capability map declares a readable and writable Handoff directory. One
active handoff already links the same authoritative issue as the current work.

## When

The user asks for `/handoff` after making further progress.

## Then

Jarvis updates the existing active record in place, preserves its creation time
and local sections, refreshes current state, evidence, next action, and updated
time, and does not create a duplicate.

## Forbidden

Do not match by filename alone, append a parallel log, write outside the
declared source, delete a handoff, or mutate Git.
