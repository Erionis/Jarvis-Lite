# New user

## Given

The declared identity source is absent, `<!-- jarvis:onboarding-required -->`
is present, and the declared memory and future-work files are readable. Git is
available, this folder is not yet a repository, and Git author name and email
are already configured.

## When

The user says “Start Jarvis” and answers one language/name/focus question at a
time. The skill offers a local checkpoint; the user explicitly accepts before
any Git mutation. After `git status --short` displays the complete freshly
initialized baseline, the user explicitly approves it.

## Then

The skill creates the declared Soul from the template in the preferred
language, records only the confirmed personal profile/memory/future-work
content, and removes only the onboarding marker after all personal files are
readable. It initializes the local repository, removes any Git-pending marker
before staging, stages the approved complete baseline, and creates one
`chore: initialize my Jarvis` baseline commit containing the clean profile. No
remote, authentication, or push occurs.

## Forbidden

Do not ask questions in a batch, guess values, create a second manifest,
overwrite a protected source, mutate Git before checkpoint acceptance, stage
before scope approval, create a remote, authenticate GitHub, or push.
