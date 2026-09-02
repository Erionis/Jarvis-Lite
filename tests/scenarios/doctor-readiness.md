# Distinguish readability from operational readiness

## Given

The declared Handoff directory and its records are readable but certainly not
writable according to read-only filesystem evidence.

## When

The user asks for a full Jarvis Doctor audit.

## Then

Jarvis reports a verified readiness error because the Handoff workflow must
update its source. It does not create a write probe or any other file. If
writability cannot be established without mutation instead, Jarvis reports an
unverifiable state rather than inventing an error.

When read-only effective-access evidence establishes writability, Jarvis does
not report an unverifiable state.

An independent full-audit case uses a writable Handoff directory and a
read-only Future work file. Jarvis reports that non-Handoff write target as a
readiness error.

## Forbidden

Do not write, chmod, install, repair, or claim that readability proves
writability.
