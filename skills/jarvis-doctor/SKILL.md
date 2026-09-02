---
name: jarvis-doctor
description: Use when an existing Jarvis appears inconsistent or needs a local safety check.
---

# Jarvis Doctor

Audit contract, readiness, and consistency from local evidence. Diagnose only:
`jarvis-memory` remains the only curator of Durable memory.

## Scope and focus

Scope is the profile and bootstrap contract, guardrails, declared sources, and
one direct local-reference hop. Do not use remote services as evidence or scan
the workspace. Preserve local extensions outside the common contract. Do not
normalize or remove them.

A plain Doctor request audits the complete bounded scope. If the user names a
symptom or capability, report that role and its direct dependencies. Include
bootstrap blockers, never unrelated bootstrap-only findings. Do not introduce
flags or a second mode.

Doctor is read-only. Do not edit, create, rename, move, delete, or install
anything. Do not generate a report file. Do not stage, commit, push, or
configure Git; never perform repair as a side effect.

## 1. Resolve the contract

1. Resolve every capability role from the consumer's declared capability map.
   Do not use starter paths, filesystem discovery, or guessed fallbacks.
   Identify each declaration as unique, missing or ambiguous. Check whether
   each declared target exists and is readable. A declared missing target is
   evidence; do not silently create it. If a prerequisite is unreachable,
   report only what direct evidence proves.
2. Treat `<!-- jarvis:onboarding-required -->` in the resolved local profile
   only as the onboarding marker. A Doctor request is concrete user work:
   complete the bounded read-only diagnosis before offering setup. When
   Identity is missing or the onboarding marker is present, do not bypass first
   run: report `Bootstrap blocked` and route to `first-run`. A missing
   non-Identity capability is unavailable and does not authorize a fallback
   source. A missing optional capability is not automatically an error; an
   invalid declared target is.

## 2. Verify structure and readiness

Common Lite roles use Markdown files for `Identity`, `Soul template`, `Durable
memory`, and `Future work`, and directories for `Daily history`, `Handoff`, and
`Inbox`. Do not impose these shapes on local roles.

A full audit checks every declared writer: `Durable memory`, `Future work`,
`Daily history`, `Handoff`, and `Inbox`. A focused audit checks only the named
writer and its dependencies. For each, assess writability without mutation.
Use an available read-only effective-access check or permission metadata;
certain denial is a verified error. If the runtime cannot establish it without
mutation, readiness is `unverifiable`. Do not create a write probe, script,
cache, or temporary file in the consumer.

The consumer's established Handoff contract is the lifecycle authority. Use
the already-discovered `handoff` skill and bootstrap contract; do not search
for another schema. The shipped Lite contract defines records as Markdown
files whose frontmatter contains `type: handoff`; valid states are `active`,
`completed`, and `superseded`. A missing or unknown status is a verified error.
`created:` and `updated:` are required on every Handoff record. `completed`
requires `completed:`; `superseded` requires `superseded:` and
`superseded_by:`. `resumed:` is metadata, not a status. Do not lint ordinary
Markdown files as handoffs or change records. Preserve lifecycle extensions
declared by an adapted consumer contract.

Daily history is historical evidence. Open it beyond readiness only when an
active source directly cites it for a current fact.

## 3. Inspect bounded semantics

- **Profile:** A repeated shared rule is `optional evolution`; an incompatible
  directive or expired override is an `error`. Bootstrap reminders, capability
  declarations, and local context are not duplicates. Do not judge style or
  length.
- **Current facts:** Require an explicit pointer,
  time-bound promise, or directly verifiable filesystem evidence. A past date
  alone is not stale. Mark a current-state claim `unverifiable` only when its
  own date or freshness statement no longer supports present-tense use, or the
  declared evidence cannot establish it. Do not invent a universal age
  threshold. Do not turn preferences or descriptive present-tense prose into
  findings.
- **Contradictions:** Require two mutually incompatible claims about the same
  subject with compatible scope and time. Different dates or scopes are not
  automatically contradictions. If scope cannot be resolved, label the
  finding `unverifiable`, not `error`.
- **Authority:** A normative directive duplicated across Identity and Durable
  memory is `optional evolution`; incompatible directives are errors.
  Pointers, examples, and history are not duplication. Consolidation is a
  separate `jarvis-memory` request.
- **Local links:** Ignore external URLs and fragment-only anchors. Resolve each
  local relative Markdown link relative to its declaring source. Ignore links
  inside code. For a missing target, retain the literal link and resolved
  missing target as evidence.

Group equivalent low-impact findings; keep bootstrap blockers and failures in
different capabilities separate.

## 4. Report operationally

Open in the user's language with the equivalent of one state:
`Jarvis operational`, `Jarvis partially operational`, or `Bootstrap blocked`,
and say that nothing was changed. Use partial status for non-bootstrap errors or
`unverifiable` readiness. Other uncertainty and optional evolution do not
degrade status.

Use exactly one label: `error`, `unverifiable`, or `optional evolution`.

- `error`: a mechanically verified contract or readiness failure.
- `unverifiable`: evidence cannot support a reliable conclusion.
- `optional evolution`: a non-required improvement, never a disguised failure.

State the inspected scope. For each finding, include a compact source path and
location when applicable. Explain problem, impact, evidence, and minimal repair
in plain language before technical detail. End with at most three prioritized
actions routed to the owner. With no findings, about three lines are enough.

Report inspected scope and count findings only after verifying what was read.
With no findings, name which roles, sources, and link scope were checked. Do
not claim the whole installation is healthy beyond that evidence.

After the report, actionable findings may justify a separate plan. Offer to
update an existing plan or ask where a new one belongs; if `Future work`
exists, offer one pointer. A plan or repair is separate follow-up work. Never
create or update it during Doctor. Without actionable findings, do not offer a
plan.

Doctor does not certify external services or preserve audit state.
