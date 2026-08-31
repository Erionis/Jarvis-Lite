# Handoff

## Purpose

Preserves the minimum evidence needed to continue a task in another session.

## Use it when

The user asks to create, resume, or list a handoff, or long-running work needs a
clean continuation point.

## Dependencies

A semantic capability map declaring a readable and writable `Handoff` source.

## Files it may change

Only handoff records inside the declared `Handoff` source. It does not change
other capabilities or Git and never deletes a handoff as a side effect.

## Adopting it into an existing Jarvis

Map `Handoff` to the consumer's existing continuity directory and preserve its
local archive conventions. Do not create a parallel directory or duplicate an
existing same-purpose workflow.
