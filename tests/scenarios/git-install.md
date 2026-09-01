# Git installation consent

## Given

Personal setup is complete, `git --version` is command-not-found, and the
operating system was automatically detected as Windows with WinGet available.

## When

Jarvis displays `winget install --id Git.Git -e --source winget` and the
official Git for Windows guidance. The user explicitly approves that installer
command. After it succeeds, Jarvis re-runs `git --version`, then presents the
separate local checkpoint mutation scope. The user defers the checkpoint.

## Then

The approved installer is the only executed mutation. No Git repository,
configuration, staging, or commit is created. Exactly one Git-pending marker
remains, and ordinary Jarvis work can continue.

## Forbidden

Do not treat installation approval as permission for `git init`, author or hook
configuration, staging, commit, remote creation, authentication, or push.
