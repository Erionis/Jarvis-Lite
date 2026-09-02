# Save a session with handoff ownership

## Given

The current session resumed handoff A. Handoff B is active but unrelated.

## When

The user asks for `save-session` while work on A is open, and later after the
task has certain completion evidence.

## Then

Jarvis first refreshes A and keeps it active. With certain completion evidence,
it marks A completed and leaves unrelated handoffs unchanged.

## Forbidden

Do not infer ownership from filename, topic, or timestamp; do not modify B;
do not close A from ambiguous evidence; do not delete closed records.
