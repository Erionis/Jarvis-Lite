# Jarvis Memory

## Purpose

Provides predictable, safe consultation and curation of the semantic
`Durable memory` capability while keeping changing operational data in its
living source.

## Use it when

A user wants to consult durable memory or explicitly add, correct, consolidate,
or forget a retained fact.

## Dependencies

The consumer's declared capability map and the source it resolves for the
semantic `Durable memory` role. No consumer-specific filesystem layout is
required.

## Files it may change

Consultation is read-only. Approved curation may change only the declared
`Durable memory` source; it does not mutate Identity, Future work, Inbox, or Git.

## Adopting it into an existing Jarvis

Use the `adopt-capability` semantic adoption workflow to reconcile this
contract with the consumer's declared capability map and any existing
same-purpose skill. Do not blindly copy it over an existing memory skill;
compare behavior, preserve local extensions, and adopt the resolved semantic
contract deliberately.
