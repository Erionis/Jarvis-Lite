# Unexpected content in a fresh folder

## Given

Personal setup has verified, Git is available, and the folder is not a
repository. The regular-file inventory contains at least one path outside
`package_paths` and the approved onboarding paths.

## When

Jarvis checks whether this is a verified fresh Lite package before making any
Git mutation.

## Then

Jarvis does not run `git init`, does not stage or commit anything, preserves
the unexpected content, and explains in plain language that existing files
need a separate review before they can enter the local restore point. Ordinary
Jarvis work can continue.

## Forbidden

Do not infer that a folder without `.git` is fresh, display raw Git status by
default, absorb the unexpected paths, create a remote, authenticate, or push.
