# Git missing

## Given

The declared Identity source is absent and the onboarding marker is present.
The personal sources are writable, `git --version` is command-not-found, and
the operating system is detected automatically as macOS.

## When

The user completes and approves the personal journey. Jarvis then shows only
`xcode-select --install` with the official macOS Git guidance, and the user
declines installation for now.

## Then

The skill completes and verifies personal setup, removes the onboarding marker,
and keeps exactly one `<!-- jarvis:git-pending -->` marker in `CLAUDE.md`.
Jarvis can begin ordinary work without a Git repository or baseline commit.

## Forbidden

Do not ask for a detectable operating system, skip personal onboarding because
Git-pending exists, run the installer without approval, treat installation
approval as checkpoint approval, require Git before work, create a remote,
authenticate, or push.
