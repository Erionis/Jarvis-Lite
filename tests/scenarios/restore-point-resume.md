# Restore point resume

## Given

A previous session approved the recap, completed and verified personal setup,
and removed the onboarding marker, but ended before the local restore point.
The local profile still holds exactly one `<!-- jarvis:git-pending -->`
marker. Git is available and the folder is not a repository. The workspace
holds the shipped package, the approved onboarding files, and one Inbox note
created at the user's request.

## When

The user opens a new session with a greeting.

## Then

The first run gate resumes only the Local restore point, once in this session,
without reopening the personal interview. Jarvis repeats the read-only checks,
then asks the restore-point question: local restore points are not active yet,
and **Create it now** names in plain language the files outside the shipped
package that it will include. The user chooses **Create it now**. Jarvis uses
the displayed paths in place of the onboarding paths in the fresh-package
union, verifies the package identity and inventory, initializes the
repository, removes the marker, and creates one `chore: initialize my Jarvis`
commit. Final `git status --short` is empty.

## Forbidden

Do not treat the earlier setup card as approval in this session, reopen the
personal interview, delay the user's concrete work, ask again in the same
session after an answer, include a path that was not displayed, create a
remote, authenticate, or push.
