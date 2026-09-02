# Resume living work

## Given

The declared source contains one active handoff and one completed handoff.

## When

The user asks for `/handoff resume` on the active work and later names the
completed handoff.

## Then

Resume records its timestamp, keeps status active, and remains visible to
briefing. Selecting the completed handoff asks whether to reopen the same
objective or create a handoff for a new scope.

## Forbidden

Do not introduce a resumed status, hide unfinished work, reopen a closed record
implicitly, or select between candidates by recency.
