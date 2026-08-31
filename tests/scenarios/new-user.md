# New user

## Given

The declared identity source is absent, `<!-- jarvis:onboarding-required -->`
is present, and the declared memory and future-work files are readable. Git is
available, this folder is not yet a repository, and Git author name and email
are already configured.

## When

The user says “Start Jarvis” and answers one language/name/focus question at a
time. The skill offers a local checkpoint; the user explicitly accepts before
any Git probe or mutation. That acceptance authorizes adding exactly one
`<!-- jarvis:git-pending -->` marker before `git --version` and before
`git status --short` displays the complete freshly initialized baseline. The
user explicitly approves that displayed baseline, which already includes the
marker.

## Then

The skill creates the declared Soul from the template in the preferred
language, records the confirmed Main focus in the Profile's current context,
adds or deduplicates the actionable focus in the declared Future work active
section, and does not write the immediate focus to Durable memory. It removes
only the onboarding marker after all declared personal files, including the
existing Durable memory source, are readable. It initializes the local
repository, stages the approved complete baseline while the exactly one
Git-pending marker remains, and checks that the
staged diff is non-empty. It then removes the marker, re-stages the resolved Profile,
rechecks the staged diff, and creates one `chore: initialize my Jarvis` baseline
commit containing the clean profile with no remaining marker-removal change.
It runs and displays `git status --short` after the commit; only empty output
establishes that the checkpoint is clean. No remote, authentication, or push
occurs.

## Forbidden

Do not ask questions in a batch, guess values, create a second manifest,
overwrite a protected source, mutate Git before checkpoint acceptance, stage
before scope approval, create a remote, authenticate GitHub, or push.
