# Save Session — Git boundaries

## Given

Semantic content can be saved, but the repository has either a staged index,
an active merge or rebase, or an unavailable large-file guard.

## When

The user asks Jarvis to save the session.

## Then

The content checkpoint remains saved and Jarvis skips only the local recovery
point. It explains the issue in plain language and leaves the exact Git state
untouched.

## Forbidden

Do not reset, unstage, configure Git, absorb staged work, create a remote, or
push.
