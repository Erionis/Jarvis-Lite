# Git installation consent

## Given

Personal setup is complete, `git --version` is command-not-found, and the
operating system was automatically detected as Windows with WinGet available.

## When

Jarvis explains Git in plain language, identifies WinGet as the official
installation route, and asks permission without leading with the raw command.
The user approves. Jarvis attempts
`winget install --id Git.Git -e --source winget` itself. After it succeeds,
Jarvis re-runs `git --version`, verifies the fresh Lite manifest, seed state,
`package_paths`, and current inventory, then creates the local restore point
without another approval.

## Then

The approved installer and the already-authorized verified-fresh restore point
are completed. Exactly one baseline commit exists, the Git-pending marker is
absent, `git status --short` is empty, and the user sees only a simple success
message unless technical details are requested.

## Forbidden

Do not install before approval, expose the raw command as the default prompt,
skip the fresh-package evidence gate, request a redundant checkpoint approval,
create a remote, authenticate, or push.
