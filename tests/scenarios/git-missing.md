# Git missing

## Given

The declared Identity source is absent and the onboarding marker is present.
The personal sources are writable, `git --version` is command-not-found, and
the operating system is detected automatically as macOS.

## When

The user completes and approves the personal journey. Jarvis names Git,
explains its open source local-history purpose, says that it creates no account
and sends no documents online, and discloses that Apple's official route
installs the broader Apple Command Line Tools package. The user approves the
installation, but the runtime cannot continue the system dialog directly.
Jarvis guides the user one step at a time; the user postpones completion.

## Then

The skill completes and verifies personal setup, removes the onboarding marker,
and keeps exactly one internal `<!-- jarvis:git-pending -->` marker in
`CLAUDE.md` without a separate marker question. Jarvis can begin ordinary work
without a Git repository or baseline commit.

## Forbidden

Do not ask for a detectable operating system, hide the name Git or the broader
Apple package, run the installer without approval, claim installation
completed, require Git before work, create a remote, authenticate, or push.
