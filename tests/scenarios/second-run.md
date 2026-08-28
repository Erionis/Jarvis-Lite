# Second run

## Given

The declared identity source and custom durable memory already exist, the
profile has neither `<!-- jarvis:onboarding-required -->` nor
`<!-- jarvis:git-pending -->` markers, and the folder may already have a Git
history.

## When

The user returns or says an equivalent of “Start Jarvis”.

## Then

The skill recognizes completed onboarding and exits with zero changed bytes,
zero staged changes, and zero commits. The existing identity, custom memory,
profile, future work, and repository history are unchanged.

## Forbidden

Do not reopen onboarding, replace Soul, normalize personal files, configure
Git, stage files, create a commit, create a remote, authenticate, or push.
