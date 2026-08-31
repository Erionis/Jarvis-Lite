# First run

## Purpose

Creates the smallest safe personal starting point for a new Jarvis and records
an optional local Git recovery checkpoint.

## Use it when

The declared identity is missing, an onboarding or Git-pending marker remains
in the profile, or the user naturally starts Jarvis in their own language.

## Dependencies

The profile capability table, Soul template, and writable declared Profile,
Identity, and Future work sources are required. The declared Durable memory
source must exist and be readable, but that does not authorize first run to
mutate it. Git is optional and is never a prerequisite for using Jarvis.

## Files it may change

The Profile and the Identity and Future work paths declared there, limited to
creating a missing Soul, explicit Profile current-context fields, the declared
`Future work` active section, and onboarding or Git-pending markers. It does not write
`Durable memory` directly and never replaces an existing Soul or other custom
content. A distinct stable signal is a separate `jarvis-memory` candidate, not
live onboarding state.

## Adopting it into an existing Jarvis

Keep the existing capability table and personal sources. Run only when an
identity is missing or an onboarding/Git-pending marker intentionally remains;
completed installations exit without writes or a new commit.
