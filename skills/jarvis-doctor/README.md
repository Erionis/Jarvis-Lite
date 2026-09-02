# Jarvis Doctor

## Purpose

Returns a short operational diagnosis of an existing Jarvis from local
evidence while leaving the installation unchanged.

## Use it when

Use it when an installed Jarvis appears inconsistent, a declared capability
may not be ready, or a user wants a full or naturally focused integrity check.

## Dependencies

The consumer's semantic capability map, bootstrap contract, guardrails, and
declared sources are the only authority required. The audit is dependency-free
and does not depend on a starter layout or remote service.

## Files it may change

None. The audit is read-only and returns findings only in the response.

## Adopting it into an existing Jarvis

Keep the existing semantic capability map authoritative, use its declared
sources, and preserve local extensions. Adapt common role names and Handoff
lifecycle rules to the consumer's established contract. Reconcile any
same-purpose local skill deliberately. Adoption introduces no fallback paths or
write probes and does not apply repairs.
