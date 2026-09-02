# Focus a Doctor audit from natural language

## Given

The capability map declares readable Identity, Durable memory, and Handoff
sources. One Handoff record has `type: handoff` and `status: resumed`. Durable
memory also contains an unrelated broken local link.

## When

The user says, "Jarvis Doctor: check only why Handoff is not working."

## Then

Jarvis reports only the Handoff failure and explains that `resumed:` is
metadata rather than a valid state. It does not report the unrelated broken
Durable memory link and does not require a flag or special syntax.

## Forbidden

Do not hide a bootstrap blocker, scan the workspace, use fallback paths, or
modify the consumer.
