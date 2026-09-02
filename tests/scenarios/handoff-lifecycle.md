# Living handoff end-to-end

## Given

One valid active handoff owns the current work and has an evidenced next action.

## When

Jarvis follows `resume -> briefing -> save-session -> briefing` once with work
still open and once after certain completion evidence.

## Then

On the open path, resume keeps the record active, save-session refreshes it,
and it remains visible as active continuity. On the completed path,
save-session marks the same record completed and it no longer appears as active
continuity in briefing.

## Forbidden

Do not create a duplicate, introduce a resumed status, close from ambiguous
evidence, or show a completed record as active.
