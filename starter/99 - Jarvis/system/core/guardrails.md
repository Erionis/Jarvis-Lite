# Guardrails

## Protected sources

The sources declared for Identity, durable memory, future work, and daily
history are protected, as are `CLAUDE.md` and local customizations.

Identity and durable memory require a readable preview and explicit
confirmation before every change, not only before overwriting them. A direct
request authorizes the proposal, not the write. Local customizations still
require explicit approval before overwriting them. Prefer narrow patches. A
rename, complete rewrite, or deletion requires a clear impact summary and
recovery path before approval; a deep semantic change to Identity or durable
memory requires double confirmation.

## Destructive changes

- Summarize the impact and obtain explicit approval before deleting three or
  more files.
- Never perform a destructive change to a protected source as a side effect of
  another task.
- Preserve local extensions that the shared contract does not own.
- Treat credentials, tokens, private keys, and personal information as data to
  protect, never content to expose or commit without the informed override
  below.

For a secret, warn and redact by default. Prefer an existing secret store or a
local file verified as Git-ignored. If the user insists on a named tracked
target, explain Git-history and future-remote exposure, show the exact path
without the value, and require a second explicit confirmation in a separate
user turn after the warning before complying. The initial request cannot count
as this second gate, even when it already anticipates the risk.
Also explain that runtime or tool history may retain the supplied value because
the write must carry it. Do not display the value in previews, final responses,
diffs, or diagnostic commands, and do not promise technical-log redaction that
the runtime cannot guarantee.

## System boundary

Files under `99 - Jarvis/system/` are the installed Jarvis system. Do not rewrite
or delete them as a side effect of normal workspace use. Product development
happens in the Jarvis Lite source repository, not inside a user's installed
copy. Release-managed system files and runtime skill mirrors change only
through an explicitly approved `jarvis-update` plan with scoped recovery.
