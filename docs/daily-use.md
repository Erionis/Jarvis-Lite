# Use Jarvis Lite day to day

Jarvis Lite keeps work understandable by giving each kind of information one
authoritative home. You can work in ordinary language; the commands below are
short, explicit entry points when you want them.

| Kind of information | Authoritative role |
| --- | --- |
| What needs attention now or soon | Future work |
| Stable preferences, decisions, constraints, and references | Durable memory |
| What happened on a day | Daily history |
| The live continuation package for unfinished work | Handoff |

The actual paths come from the workspace's local capability map. Jarvis does
not guess a replacement path when a declared source is missing.

## Start with grounded orientation

| You say | Jarvis does | Local sources that may change |
| --- | --- | --- |
| `/briefing` or “Where should we resume?” | Reads declared current-work, history, handoff, memory, and Inbox evidence; recommends one grounded focus or asks you to choose when evidence is tied. | None. Briefing is read-only. |

[`briefing`](../skills/briefing/SKILL.md) does not process Inbox, rank by age,
or invent urgency. An unresolved source is reported as a limit on the answer.

## Work on something concrete

| You say | Jarvis does | Local sources that may change |
| --- | --- | --- |
| “Update the decision note for this project.” | Resolves the task's authoritative source, applies the bounded change, and verifies it. | Only the named or confirmed task source. |
| “Keep this for later,” without a clear destination | Preserves the material in the declared Inbox until its destination is clear or approved. | The declared Inbox only when a write was requested or approved. |

Inbox organization is normal Jarvis work. Lite does not install an `ingest`
command or impose a universal project hierarchy.

## Remember, correct, or forget something

| You say | Jarvis does | Local sources that may change |
| --- | --- | --- |
| “Remember this preference.” | Classifies the fact, finds its authoritative home, shows the proposed text or diff, and waits. | None before explicit confirmation; then only the approved Identity or Durable memory patch. |
| “Correct this remembered fact.” | Shows before/after, identifies affected links, and offers save, edit, or do not save. | Only the confirmed target. |
| “What do you remember about this?” | Reads the declared source and answers from evidence. | None. Consultation is read-only. |

[`jarvis-memory`](../skills/jarvis-memory/SKILL.md) curates Identity and Durable
memory. Current tasks remain in Future work, completed events in Daily history,
and project knowledge in its project-owned source.

## Save and close a work block

| You say | Jarvis does | Local sources that may change |
| --- | --- | --- |
| `/save-session` or “Save and close.” | Applies any separately confirmed Inbox action first; records the day's result, updates future work and the involved handoff, then creates the available local checkpoint. | Confirmed Inbox targets, Daily history, Future work, the involved Handoff, and local Git history when available. |

The core checkpoint closes before optional memory or structural proposals.
Those proposals keep their own confirmation and do not make a successful
checkpoint incomplete. No push happens automatically. See the canonical
[`save-session`](../skills/save-session/SKILL.md) contract for exact ordering.

## Continue work across sessions

| You say | Jarvis does | Local sources that may change |
| --- | --- | --- |
| `/handoff` | Creates or updates one living continuation record with state, evidence, and the next action. | The selected Handoff record after confirmation where required. |
| `/handoff resume` | Selects a relevant active record, re-reads its evidence, and refreshes continuity without hiding it. | The resumed and updated timestamps of that record. |
| `/handoff complete` | Marks the selected record completed while preserving its history. | The selected Handoff record. |
| `/handoff list` | Lists active, completed, superseded, and invalid records. | None. Listing is read-only. |

A handoff stays active until work completes or an intentional replacement
supersedes it. The canonical lifecycle lives in
[`handoff`](../skills/handoff/SKILL.md).

## Check the installation without repairing it

| You say | Jarvis does | Local sources that may change |
| --- | --- | --- |
| `/jarvis-doctor` | Audits the declared contract, readiness, bounded semantics, and local links; reports evidence and routes any repair to its owner. | None. Doctor is read-only. |

[`jarvis-doctor`](../skills/jarvis-doctor/SKILL.md) diagnoses only. A repair,
memory change, install, or update is a separate request.

## Avoid these shortcuts

- Do not maintain `99 - Jarvis` internals by hand unless you are deliberately
  developing or repairing Jarvis.
- Do not copy the same fact into current work, memory, Daily history, and a
  handoff.
- Do not treat a local Git commit as a backup or assume it was pushed.
- Do not move unclear raw material out of Inbox merely to make it look empty.
- Do not use an update workflow to adopt capabilities into a non-Lite Jarvis.

Read [Update or adopt Jarvis Lite](updates.md) before changing Jarvis itself, or
return to the [Jarvis Lite overview](../README.md).
