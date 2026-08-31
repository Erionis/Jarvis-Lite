# Session handoff

## Given

The capability map declares a writable Handoff directory with no colliding
record for the current topic.

## When

The user asks to hand the current task to a new session.

## Then

Jarvis creates one active handoff in the declared source with evidenced
context, current state, decisions, relevant files, next steps, and open
questions. A later resume marks only that record as resumed.

## Forbidden

Do not write outside the declared source, overwrite a collision, invent facts,
delete a handoff, or mutate Git.
