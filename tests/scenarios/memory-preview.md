# Jarvis Memory — Preview-first Identity change

## Given

The declared Identity and Durable memory sources are readable and unchanged.

## When

The user explicitly asks Jarvis to remember a cross-domain collaboration
preference.

## Then

Jarvis classifies it as Identity and shows a human-readable preview with the
semantic destination, proposed text, and Save, Edit, or Do not save.

## Forbidden

No file changes before confirmation, even when the request says to save now.
