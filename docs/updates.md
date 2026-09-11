# Update or adopt Jarvis Lite

Jarvis Lite separates three operations that can look similar from the outside.
Choose the path that matches the workspace you already have; none of them
authorizes an automatic install or replacement.

| Starting point | Use | Result |
| --- | --- | --- |
| Current Jarvis Lite with `jarvis-update` | “Check for Jarvis updates.” | Compare and apply a verified Lite release. |
| Older Jarvis Lite without the updater | The updater from the target official artifact | Establish the managed baseline, then update. |
| A Jarvis that is not Lite | Repository-only `adopt-capability` | Compare and adopt only selected capabilities. |

Only a published GitHub Release ZIP with its matching checksum is an official
update artifact. A source build remains useful for development and evaluation,
but does not substitute for that immutable release boundary.

## Current Jarvis Lite

Say `Check for Jarvis updates`. Jarvis first shows the installed release
identity, the target release, and the practical changes. Where recognized,
`/jarvis-update` is an optional alias for the same request. The preflight is
read-only: it verifies the target artifact and compares only release-managed
files with the accepted local baseline.

The common path has one approval for the exact update plan. If a functional
skill overlaps a local customization, Jarvis stops on that component and asks
how to proceed.

| Choice | What it means |
| --- | --- |
| Keep and adapt | Preserve the local behavior and add only the compatible target change. |
| Replace | Accept the target component after its previous bytes are saved in scoped recovery. |
| Merge | Approve one explicit combined version rather than choosing either side wholesale. |
| Postpone | Leave that component unchanged and continue only where the remaining plan is safe. |

The parts Jarvis manages — the updater, Doctor, and shared guardrails — follow
the target release after their previous bytes are saved. Identity,
durable memory, current work, Daily history, handoffs, Inbox, local extensions,
and Git history stay yours.

After approval, Jarvis creates scoped recovery, applies only the displayed
plan, and runs focused verification. A general Doctor audit is not part of the
update.

The final report names the effective version and whether changes were updated,
kept as overrides, postponed, blocked, or rolled back, with scoped recovery
information when relevant.

## Older Lite without `jarvis-update`

Use this path only with an official immutable Lite artifact:

1. Download the official ZIP and its checksum from the
   [latest published release](https://github.com/Erionis/Jarvis-Lite/releases/latest).
2. Verify the artifact using the release's own checksum instructions.
3. Extract it outside your current workspace.
4. Point the agent at the target artifact's `jarvis-update` skill.
5. Let the target updater verify that the existing workspace is genuinely Lite.
6. Review and approve the exact adoption plan.

The target updater must recognize the Lite profile, core marker, and both
physical runtime mirrors before it establishes a baseline. A source that cannot
prove those boundaries must stop without changing your workspace.

## A Jarvis that is not Lite

Do not treat another Jarvis installation as an old Lite release. Point the
agent at an immutable public Lite release or commit and use the repository-only
[`adopt-capability`](../skills/adopt-capability/SKILL.md) workflow.

Select the capabilities you want, review their semantic classification, and
approve the exact patch. Existing identity, memory, paths, local extensions,
and Git history stay authoritative. This path is capability adoption, not an
update and not an automatic installation.

Copy-ready prompt for your existing Jarvis:

> This is the reference version of Jarvis: https://github.com/Erionis/Jarvis-Lite.
> Before proposing anything, read skills/adopt-capability/SKILL.md at the latest
> release tag, and for every skill you consider read its SKILL.md and the
> README.md beside it (its adoption card). If you cannot browse, ask me to clone
> the repository at that tag and read the same files locally. Then walk me through
> adopting the useful capabilities from that release: propose what to take,
> classify each item, and ask my approval for every change. Don't touch my
> identity, memory, Diary, handoffs, Inbox, local extensions, or Git history.

If your agent cannot browse the web, clone this repository at the release tag
and point the agent at the same files in that local copy: the adoption contract
above, and each candidate skill's `SKILL.md` with the `README.md` beside it.

## Interruption, recovery, and rollback

An interrupted update is not reported as successful. Jarvis re-reads your
workspace and the recovery evidence before deciding whether it can resume, verify,
or stop safely.

Recovery is scoped to files involved in the approved update. A rollback checks
those files again before mutation and stops if any of them changed after the
update; newer local work is never silently overwritten. Git may add a local
recovery layer, but it is not a backup and no remote or push is implied.

If Python 3 is unavailable, the update stops before changing your workspace.
Ordinary Markdown-based Jarvis work remains available.

## Canonical mechanics

This guide explains user choices and outcomes. The executable mechanics remain
in [`jarvis-update`](../skills/jarvis-update/SKILL.md) and
[`adopt-capability`](../skills/adopt-capability/SKILL.md). Return to the
[`README`](../README.md) for the product overview.
