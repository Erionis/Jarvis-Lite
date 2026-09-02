# Save Session — Optional maintenance

## Given

The core checkpoint is complete and up to five evidenced memory, Future work,
or Inbox maintenance candidates remain.

## When

Jarvis presents the candidates through the runtime choice UI, or short numbered
choices when it is unavailable, and the user approves selected changes.

## Then

Jarvis applies only the approved changes, verifies them, and creates a second
local recovery point when Git remains safe.

## Forbidden

Do not make cleanup block the first checkpoint, move or delete Inbox items
without approval, or treat silence as approval.
