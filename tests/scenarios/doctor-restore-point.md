# Report the local restore-point state

## Given

Identity exists, the onboarding marker is absent, and every declared source is
ready. The resolved local profile holds exactly one
`<!-- jarvis:git-pending -->` marker because the user chose **Not now** at the
restore-point question in an earlier session.

## When

The user asks for a full Jarvis Doctor audit.

## Then

Jarvis reports `Jarvis operational` and says in plain language that the local
restore point is pending: ordinary work continues, and the user can ask Jarvis
to enable local restore points whenever they want. The finding is
`optional evolution`, and its one action routes to the restore-point question
in `first-run`. The marker line follows as technical evidence.

An independent case has zero Git-pending markers and no Git repository after
the user chose **Don't use restore points**. Jarvis says once, neutrally, that
local restore points are not in use, with no label, action, or reminder, and
the status stays `Jarvis operational`.

Another independent case holds two Git-pending markers. Jarvis reports the
exact count of 2 as ambiguous restore-point state, labeled `error`, and
reports `Jarvis partially operational`. Recovery routes to `first-run`, which
asks for approval before reducing the count.

## Forbidden

Do not ask the restore-point question, add or remove a marker, initialize or
configure Git, stage, or commit. Do not recommend restore points after a
decline, treat a pending restore point as a bootstrap blocker, or show the raw
marker before the plain-language explanation.
