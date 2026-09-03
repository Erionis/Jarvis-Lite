# jarvis-update

## Purpose

Update a Jarvis Lite consumer from a verified release artifact without
silently replacing local behavior.

## Use it when

The user asks to check for updates, install a Lite release, or roll back the
last update.

## Dependencies

- Python 3 standard library;
- a local official release ZIP and its published SHA-256 file;
- readable installed-state and release-manifest evidence when present.

## Files it may change

Only release-managed paths, an explicitly approved migration overlay, and
`.jarvis-update/state.json`. Recovery copies stay under
`.jarvis-update/recovery/`. It never changes consumer Git.

## Adopting it into an existing Jarvis

For a Lite consumer without this skill, verify and extract an official release
outside the consumer, then run the target artifact helper. Existing identity,
memory, Diary, work, local extensions, and history stay authoritative.
