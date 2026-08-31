# Guardrails

## Protected sources

The sources declared for Identity, durable memory, future work, and daily
history are protected, as are `CLAUDE.md` and local customizations.

Identity, durable memory, and local customizations require explicit approval
before overwriting them. Prefer narrow patches. A rename, complete rewrite, or
deletion requires a clear impact summary and recovery path before approval.

## Destructive changes

- Summarize the impact and obtain explicit approval before deleting three or
  more files.
- Never perform a destructive change to a protected source as a side effect of
  another task.
- Preserve local extensions that the shared contract does not own.
- Treat credentials, tokens, private keys, and personal information as data to
  protect, never content to expose or commit.

## System boundary

Files under `99 - Jarvis/system/` are the installed Jarvis system. Do not rewrite
or delete them as a side effect of normal workspace use. Product development
happens in the Jarvis Lite source repository, not inside a user's installed
copy.
