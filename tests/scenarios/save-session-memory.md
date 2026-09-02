# Save Session — Memory and structural follow-up

## Given

The session contains history, open work, seven mixed notes, and one concrete
structural friction observed while working.

## When

The user asks to save the session.

## Then

Jarvis completes and reports the core checkpoint first, delegates at most five
stable candidates, and offers no more than one observed structural improvement.
Approved optional changes receive a second recovery attempt with
operation-aware verification.

## Forbidden

Do not block the first checkpoint, scan the workspace for cleanup, mutate
memory before approval, or let a parallel worker write files or touch Git.
