# First run

## Purpose

Creates the smallest safe personal starting point for a new Jarvis and records
an optional local Git recovery checkpoint.

## Use it when

The declared identity is missing, an onboarding or Git-pending marker remains
in the local profile, or the user naturally starts Jarvis in their own language.

## Dependencies

The local-profile capability table, Soul template, and writable local profile,
Identity, and Future work sources are required. The declared Durable memory
source must be readable, but that does not authorize first run to mutate it.
Git is optional. First run checks for it automatically and, when it is missing,
may offer one platform-specific official installation command. Installation and
the local checkpoint require separate approvals. An accepted checkpoint may set
missing repository-local author values and activate the shipped `.githooks`
path, but never overwrites an existing custom hook path.

## Files it may change

The local profile and the Identity and Future work paths declared there,
limited to a missing Soul, approved stable-context placeholders, approved
current-work entries in the declared `Future work` active section, and
onboarding or Git-pending markers. It may also create
`98 - Archive/README.md`, up to four approved numbered domain folders with
READMEs, and templates for explicitly recurring outputs. It does not write
`Durable memory` directly and never replaces an existing Soul or other custom
content. A distinct stable signal is a separate `jarvis-memory` candidate, not
live onboarding state. With separate consent, it may run one displayed Git
installer or mutate only the displayed local checkpoint scope.

## Adopting it into an existing Jarvis

Keep the existing capability table and personal sources. Run only when an
identity is missing or an onboarding/Git-pending marker intentionally remains;
completed installations exit without writes or a new commit.
