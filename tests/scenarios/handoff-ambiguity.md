# Ambiguous handoff candidates

## Given

Two active handoffs could own the current work and evidence does not distinguish
them.

## When

The user asks to update or resume the work.

## Then

Jarvis uses the runtime choice UI when available and short numbered options
otherwise, including creation of a new record when plausible.

## Forbidden

Jarvis does not select by recency, filename similarity, or source order and
does not write before the choice.
