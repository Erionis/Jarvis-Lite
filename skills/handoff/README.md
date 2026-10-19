# Handoff

## Purpose

Preserves one living record with the minimum evidence needed to continue a task
in another session.

## Use it when

The user asks to create, update, resume, complete, supersede, or list a handoff,
or long-running work needs a clean continuation point.

## Dependencies

A semantic capability map declaring a readable and writable `Handoff` source.

## Files it may change

Handoff records and their archive inside the declared `Handoff` source, plus
verified link targets affected by a move where protection rules allow it.
Other capability content stays unchanged; the skill never mutates Git. Completion
and replacement archive the selected record automatically; closed records stay
readable. Work never expires by age and records are never deleted automatically.
The canonical [closure procedure](SKILL.md#archive-on-closure) defines collision,
protected-reference, and deferred-archival handling.

## Adopting it into an existing Jarvis

Map `Handoff` to the consumer's existing continuity directory. Reconcile the
same authoritative work in place and preserve local conventions. Do not create
a parallel directory or duplicate a same-purpose workflow.
