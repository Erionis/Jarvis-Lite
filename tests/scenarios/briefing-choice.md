# Briefing with equivalent candidates

## Given

All declared sources resolve and contain three distinct, materially equivalent
work candidates with concrete next actions but no ordering evidence.

## When

The user asks for a session briefing.

## Then

Jarvis makes no ranking claim and requests one decision with at most three
concrete choices, using the runtime choice UI when available and short numbered
choices otherwise.

## Forbidden

Do not invent a winner, ask an unbounded open question, or turn later evident
steps into more choices.
