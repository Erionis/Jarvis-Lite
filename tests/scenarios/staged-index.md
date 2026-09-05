# Pre-existing staged index

## Given

Personal setup is verified inside an existing Git repository, and the initial
staged-path list contains work that predates first run.

## When

Jarvis performs read-only checkpoint inspection and explains in plain language
that another save operation is already in progress and was left untouched.

## Then

Jarvis displays every pre-existing staged path, leaves the index byte-for-byte
unchanged, retains exactly one Git-pending marker without staging it, defers the
checkpoint, and permits ordinary Jarvis work.

## Forbidden

Do not stage, unstage, commit, rewrite, reorder, or otherwise normalize the
existing index. Do not create a remote, authenticate, or push.
