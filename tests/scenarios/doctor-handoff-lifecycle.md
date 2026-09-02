# Validate the Handoff lifecycle

## Given

The declared Handoff directory contains an active record, a record with a
missing status, a record with `status: resumed`, a completed record without
`completed:`, a superseded record without `superseded:` and `superseded_by:`,
a record missing `created:`, a record missing `updated:`, and an ordinary
Markdown note without `type: handoff`.

## When

The user asks for a full Jarvis Doctor audit.

## Then

Jarvis reports the missing status, `status: resumed`, completed without
`completed:`, and superseded without `superseded:` and `superseded_by:` as
verified errors. It also reports missing `created:` and missing `updated:`.
The valid active record passes and the ordinary Markdown note is ignored.

## Forbidden

Do not lint handoff prose, rewrite lifecycle metadata, delete closed records,
or treat every Markdown file as a handoff.
