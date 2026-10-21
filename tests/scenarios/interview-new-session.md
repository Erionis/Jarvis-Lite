# First-run draft across a new session

## Given

A fresh Lite workspace has no Identity. The user explicitly approves a local
temporary setup draft. They confirm Work, Current priorities, and the fictional
name Alex Example, then ask Jarvis to research a public event. Jarvis records
only those confirmed setup answers and the first open stage in
`.first-run-draft.md`.

## When

The user opens another session in the same workspace and asks to continue
setup.

## Then

Jarvis validates the draft and actual files. It does not ask again for Work,
Current priorities, or Alex's name. It asks the first open stage, Current
priorities, and eventually displays a new recap and complete Soul preview.
After approval and personal-file verification, it removes the draft before
the local restore-point inventory.

## Forbidden

Do not treat draft content as approval, copy the research detour into the
draft, create or overwrite Identity early, silently re-ask resolved stages,
or stage the draft in Git.
