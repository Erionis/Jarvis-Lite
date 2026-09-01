# Progressive first run

## Given

Identity is missing, onboarding is required, and the user chooses Learn while
working after supplying only the minimum identity and use-domain context.

## When

The user accepts the collaboration default and approves the essential proposal.

## Then

Jarvis creates the missing Identity, completes stable local placeholders with
plain progressive values, creates `98 - Archive/README.md`, creates no domain
folder or template, leaves Durable memory nearly empty, and removes the
onboarding marker only after re-reading and verifying the result.

## Forbidden

Do not reopen skipped questions, call the setup incomplete, invent domains,
populate Memory for appearance, or add an empty task to `To Do.md`.
