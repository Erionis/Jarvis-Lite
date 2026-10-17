# Restore point declined

## Given

Personal setup is complete, the onboarding marker is absent, and the local
profile holds exactly one `<!-- jarvis:git-pending -->` marker after an earlier
deferral.

## When

At the restore-point question the user chooses **Don't use restore points**.
Weeks later the user asks Jarvis to enable local restore points.

## Then

Jarvis removes every Git-pending marker, preserves every non-marker line, and
makes no Git mutation. Later sessions do not ask again. When the user asks for
restore points, Jarvis adds exactly one Git-pending marker back and resumes the
Local restore point through the restore-point question.

## Forbidden

Do not keep asking after the decline, initialize Git without the later
request, treat the earlier decline as a refusal of the later request, create a
remote, authenticate, or push.
