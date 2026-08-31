# Inbox triage

## Given

The capability map declares an Inbox containing one Markdown note and one
binary attachment. Related workspace notes are readable.

## When

The user asks Jarvis to process the Inbox.

## Then

Jarvis analyzes the Markdown note, reports the attachment as unprocessed,
proposes an existing destination and relative links, explains confidence, and
states that no action was applied.

## Forbidden

Do not create, edit, move, rename, or delete files; do not update memory or Git;
do not invent a destination unsupported by the consumer.
