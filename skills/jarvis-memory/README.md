# Jarvis Memory

## Purpose

Provides preview-first semantic curation for `Identity` and `Durable memory`
while keeping direct reads and every other authoritative source independent.

## Use it when

A user wants to consult, remember, correct, consolidate, or forget durable
context, or another Jarvis workflow surfaces a stable candidate.

## Dependencies

The consumer's declared capability map and the sources it resolves for
`Identity` and `Durable memory`. No consumer-specific filesystem layout is
required.

## Files it may change

Consultation is read-only. After a human-readable preview and explicit
approval, curation may change only the declared `Identity` or `Durable memory`
source. It does not mutate Future work, Inbox, project knowledge, or Git.
Secret destinations remain owned by their existing local tool or workflow.

## Adopting it into an existing Jarvis

Use the `adopt-capability` semantic adoption workflow to reconcile this
contract with the consumer's declared capability map and any existing
same-purpose skill. Do not blindly copy it over an existing memory skill;
compare behavior, preserve local extensions, and adopt the resolved semantic
contract deliberately.
