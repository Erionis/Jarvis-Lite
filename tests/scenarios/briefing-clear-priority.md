# Briefing with a clear priority

## Given

All declared sources resolve. Future work explicitly names one current priority,
its next action, and a deadline. Inbox contains an untriaged item with explicit
deadline evidence; other sources do not contain a competing work candidate.

## When

The user asks for a session briefing.

## Then

Jarvis recommends that priority, gives the concrete next step, and states briefly
why it matters now. Inbox evidence remains attention-only. The response stays
within the normal 10–12-line budget and does not ask the user to choose.

## Forbidden

Do not promote the Inbox item into a priority, add unsupported blockers or
remote status, or render empty sections.
