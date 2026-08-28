# First run

## Purpose

Creates the smallest safe personal starting point for a new Jarvis and records
an optional local Git recovery checkpoint.

## Use it when

The declared identity is missing, an onboarding or Git-pending marker remains
in the profile, or the user naturally starts Jarvis in their own language.

## Dependencies

The profile capability table, Soul template, and writable declared personal
sources are required. Git is optional and is never a prerequisite for using
Jarvis.

## Files it may change

The capability paths declared in `PROFILE.md`, limited to creating a missing
Soul, explicit profile/memory/future-work fields, and onboarding or Git-pending
markers. It never replaces an existing Soul or other custom content.

## Adopting it into an existing Jarvis

Keep the existing capability table and personal sources. Run only when an
identity is missing or an onboarding/Git-pending marker intentionally remains;
completed installations exit without writes or a new commit.
