# Existing repository checkpoint

## Given

Personal setup is verified inside an existing Git repository. The initial
staged-path list is empty, and the worktree changes consist only of the approved
onboarding scope.

## When

Jarvis explains in plain language that the folder already has local history and
presents the literal onboarding files it can include in a restore point. The
user explicitly approves that exact path scope.

## Then

Jarvis stages only the approved literal onboarding paths, never uses
`git add -A`, verifies the staged path set before committing, removes the
Git-pending marker inside the approved local-profile path, re-verifies the
staged set, and commits only a nonempty matching diff.

## Forbidden

Do not treat the fresh-package setup approval as authorization for this
repository, infer paths from status output, include unrelated changes, alter a
pre-existing index entry, show raw Git status by default, create a remote,
authenticate, or push.
