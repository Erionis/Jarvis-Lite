# Save Session

## Purpose

Creates an approachable end-of-session checkpoint across completed history,
future work, durable signals, and an optional local recovery point.

## Use it when

A user asks to save the current session, preserve explicit follow-ups, or close
a meaningful work block.

## Dependencies

The capability map supplies `Identity`, `Daily history`, `Future work`,
`Durable memory`, `Handoff`, and optional `Inbox`. Durable candidates go through
`jarvis-memory`. Git is optional; save-session uses it only when first run
already made it available and configured.

## Files it may change

Completed chronology goes only to the declared `Daily history` source, in one
local-day file that preserves frontmatter, custom sections, and unrelated
entries. The skill may patch evidenced items in the declared `Future work`
source, refresh or complete only the handoff used in this session, and
checkpoint the whole dedicated workspace in a local Git recovery point. Only
after that core result may it route stable signals through `jarvis-memory` and
offer optional Inbox maintenance or observed structural maintenance. Memory
and Identity writes remain preview-first.

It must not write a second or undeclared history source. It must never push,
create a remote, install or configure Git, discard user work, or call a local
commit a backup.

## Adopting it into an existing Jarvis

Map the six semantic roles to existing authoritative sources and preserve
their local structure. Adopt the whole-workspace recovery model only when the
consumer is a dedicated personal workspace with an active large-file guard.
Reconcile same-purpose behavior in place instead of creating another history,
task, memory, handoff authority, or Inbox source.
