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

Only handoff records inside the declared `Handoff` source. It does not change
other capabilities or Git. Closed records remain readable; no handoff is
deleted, archived, or expired automatically.

## Adopting it into an existing Jarvis

Map `Handoff` to the consumer's existing continuity directory. Reconcile the
same authoritative work in place and preserve local conventions. Do not create
a parallel directory or duplicate a same-purpose workflow.
