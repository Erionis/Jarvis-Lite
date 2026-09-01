# Existing repository checkpoint

## Given

Personal setup is verified inside an existing Git repository. The initial
staged-path list is empty, and the worktree changes consist only of the approved
onboarding scope.

## When

Jarvis displays the complete worktree inventory and a literal onboarding path
list. The user explicitly approves that checkpoint scope.

## Then

Jarvis stages only the approved literal onboarding paths, never uses
`git add -A`, verifies the staged path set before committing, removes the
Git-pending marker inside the approved local-profile path, re-verifies the
staged set, and commits only a nonempty matching diff.

## Forbidden

Do not infer paths from status output, include unrelated changes, alter a
pre-existing index entry, create a remote, authenticate, or push.
