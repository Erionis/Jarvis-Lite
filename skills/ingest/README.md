# Ingest

## Purpose

Produces a focused, report-only proposal for integrating captured material.

## Use it when

The user asks to process the declared Inbox or decide where one captured note
belongs.

## Dependencies

A semantic capability map declaring `Inbox`, plus readable candidate notes and
any related sources needed for a narrow comparison.

## Files it may change

None. Ingest is read-only and does not mutate files or Git.

## Adopting it into an existing Jarvis

Map the semantic `Inbox` role to the consumer's existing source. Preserve local
taxonomy and destinations; the skill proposes integration without creating a
second inbox or applying changes.
