# Save Session

## Purpose

Creates an evidence-based end-of-session checkpoint while separating completed
outcomes, future work, durable signals, and optional local Git state.

## Use it when

A user asks to save the current session, preserve explicit follow-ups, or make
a safe local checkpoint of session-owned work.

## Dependencies

The consumer's capability map supplies the semantic `Future work` and `Durable
memory` roles. Durable candidates are handled through `jarvis-memory`. Git is
optional.

## Files it may change

The skill may narrowly append or update session-owned items in the declared
`Future work` source. It may route approved stable facts through
`jarvis-memory`, which owns any change to `Durable memory`, and may create a
safe local Git commit containing only verified session-owned paths.

It must not write an undeclared history source, mutate unrelated files or index
entries, or absorb pre-existing user changes. It must never push, create a
remote, or change Git configuration.

## Adopting it into an existing Jarvis

Map the semantic `Future work` and `Durable memory` roles to the consumer's
already-declared capabilities. Preserve any existing chronology convention
only when an appropriate semantic capability is explicitly declared and its
source already exists. Reconcile an existing same-purpose skill deliberately;
do not introduce path assumptions, duplicate authoritative sources, or a new
history file.
