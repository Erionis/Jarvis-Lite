# Jarvis Doctor

## Purpose

Audits an existing Jarvis from local evidence while leaving the installation
unchanged.

## Use it when

Use it when an installed Jarvis appears inconsistent, a declared source may be
missing, or a user wants a bounded integrity check.

## Dependencies

The consumer's semantic capability map and its declared sources are the only
authority required. The audit does not depend on a starter layout or remote
service.

## Files it may change

None. The audit is read-only and returns findings only in the response.

## Adopting it into an existing Jarvis

Keep the existing semantic capability map authoritative, use its declared
sources, and preserve local extensions. Reconcile any same-purpose local skill
deliberately. Adoption introduces no fallback paths and does not apply repairs.
