# New user

## Given

The declared Identity source is absent, `<!-- jarvis:onboarding-required -->`
is present, and the declared Durable memory and Future work files are readable.
Git is available, this folder is not yet a repository, and the inherited Git
author name and email are already configured.

## When

The skill runs `git --version` and detects the operating system before asking
an interview question. The user says “Start Jarvis”, chooses a use domain and
starting depth, supplies identity details, accepts the collaboration default,
and approves the final personal recap, including the plain-language local
restore-point outcome. After personal verification, read-only Git inspection
finds no repository. Jarvis verifies the release manifest, seed state,
`package_paths`, and actual file inventory without another user decision.

## Then

The skill writes identity and collaboration only to the declared Identity
source, writes stable local context only to `CLAUDE.md`, writes current
priorities only to the declared Future work source, and leaves Durable memory
nearly empty. It creates only the approved visible structure and removes the
onboarding marker only after re-reading every approved output.

It automatically initializes the local repository, activates the shipped hook
when no custom hook path exists, stages the verified full baseline while
exactly one Git-pending marker remains, verifies the nonempty staged scope,
removes the marker, re-stages the local profile, and creates one
`chore: initialize my Jarvis` commit. Final `git status --short` is empty. The
normal response says only that the local restore point is ready. No remote,
authentication, or push occurs.

## Forbidden

Do not ask questions in a batch, guess values, create a second manifest,
populate Durable memory for appearance, mutate Git before checkpoint
authorization, request separate Git or baseline approval for a verified fresh
package, expose commands or Git status by default, create a remote,
authenticate GitHub, or push.
