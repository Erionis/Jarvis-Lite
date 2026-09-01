# Pre-existing staged index

## Given

Personal setup is verified inside an existing Git repository, and the initial
staged-path list contains work that predates first run.

## When

Jarvis performs read-only checkpoint inspection, displays the exact one-line
Git-pending addition to `CLAUDE.md`, and receives marker-only approval.

## Then

Jarvis displays every pre-existing staged path, leaves the index byte-for-byte
unchanged, retains exactly one Git-pending marker without staging it, defers the
checkpoint, and permits ordinary Jarvis work.

## Forbidden

Do not stage, unstage, commit, rewrite, reorder, or otherwise normalize the
existing index. Do not create a remote, authenticate, or push.
