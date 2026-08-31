---
name: ingest
description: Use when a user asks to triage the Inbox, process an inbox note, or decide where captured material belongs.
---

# Ingest

Turn raw captured material into an actionable integration proposal. This
workflow is report-only: it does not apply the proposal.

## Scope

Resolve `Inbox` through the consumer's declared capability map. If the user
names a file, analyze only that file. Otherwise inspect Markdown files in the
declared Inbox. If the role is missing or ambiguous, stop without inventing a
fallback. If the declared source is missing, report the discrepancy.

When the Inbox contains many files, start with explicitly named files or the
five most recently modified Markdown files and disclose the remaining scope.
Report non-Markdown files without attempting to interpret or move them.

## Workflow

For each selected note:

1. Identify its main topic, important entities, provenance, and whether the
   material is stable enough to integrate.
2. Search narrowly for existing related notes and declared domain sources.
   Prefer a small number of targeted filename and content searches over a broad
   workspace scan.
3. Recommend an existing destination when one fits. Propose a new note only
   when no existing authority is suitable.
4. Name suggested updates, relative Markdown links, duplicates or
   contradictions to inspect, and qualitative confidence (`high`, `medium`, or
   `low`) with a reason.

## Report

Return a concise `Ingest Report` with analyzed files, ignored files, proposed
destinations, actions, confidence, and one recommended next step. State
`Actions applied: none`.

Do not create, modify, move, rename, or delete any file. Do not update the
Inbox, a proposed destination, the capability map, memory, or Git. If the
correct destination requires human judgment, mark confidence low and leave the
material in place.
