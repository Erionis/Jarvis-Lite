---
name: first-run
description: Use when the declared identity source is missing, an onboarding or Git-pending marker is present, a user begins onboarding naturally, including “Start Jarvis” in any language, or a user asks to enable local restore points.
---

# First run

Complete the smallest useful personal setup, verify it, and leave the consumer
ready for ordinary work. The capability map in the local profile is
authoritative. Never create a second manifest or substitute starter paths.

## Read-only preflight

Before the interview, inspect the consumer without changing it:

1. Read the local profile (`CLAUDE.md` in the default starter) and resolve the
   Identity, Durable memory, Future work, Inbox, and Soul template paths from
   the consumer contract.
2. Read every resolved source that exists and inspect the declared Inbox.
   Count both marker types only in the resolved local profile. A marker
   mentioned in installed system instructions, skill references, or
   documentation is not consumer state.
3. Before asking any interview question, run `git --version`. Detect the
   operating system automatically from runtime platform metadata or a safe
   read-only system query. Do not ask the user which operating system they use
   when it can be detected. These preflight checks are read-only and require no
   consent. They do not authorize installation, Git configuration, staging, or
   a commit.

If the capability map is missing or ambiguous, stop and report the exact
problem. Do not fall back to a conventional path.

## Resolve first-run state

- If Identity exists and neither marker exists, onboarding is complete. Exit
  with zero questions, zero writes, zero staged changes, and zero commits.
- If Identity exists, onboarding-required is absent, and Git-pending exists,
  skip the personal interview and resume only Local restore point.
- If Identity is absent or onboarding-required exists, complete or reconcile
  personal onboarding first, even when Git-pending also exists.

The default starter ships both markers. Git-pending stays until Local restore
point reaches a terminal result, so a session that ends between personal setup
and the restore point resumes only the restore point next time.

Treat semantic equivalents of `Start Jarvis` in any language as the same
trigger. For the default starter, if `99 - Jarvis/memory/soul.md` already
exists, do not replace it.

## Personal interview

Read and follow [interview.md](interview.md) for the full visible journey. Use
one coherent interaction at a time: one free-form question, one decision, or a
small group of related closed questions that can be answered together. Keep
dependent questions separate until their context exists. Use only direct
answers or explicitly confirmed choices; never infer personal facts from vague
signals, free-form memory, or unrelated notes.

## Stages and re-entry

First run is one journey of ordered stages. A stage is resolved only by its
named outcome:

1. **Use domain** — one or more domains selected.
2. **Starting point** — one starting depth selected.
3. **Identity** — a name plus the minimum stable context for the branch.
4. **Context detail** — the requested priorities or map given, or explicitly
   skipped; Learn while working resolves it at once.
5. **Collaboration** — the default accepted or explicit differences given.
6. **Recap approval** — a displayed recap approved.
7. **Personal setup** — the approved writes applied and verified.
8. **Local restore point** — completed, deferred, unavailable, safely failed,
   or declined.
9. **First trial and Continuity guide** — offered and given.
10. **Optional cockpit** — offered, or skipped by its own conditions.

Stages 1 to 6 live only in the conversation, because nothing personal is
written before recap approval. From stage 7 on, the markers carry the pending
state across sessions.

A message that does not produce a stage's outcome leaves that stage open:

- A partial answer resolves only what it answers. Ask again only the missing
  part of a grouped interaction.
- A digression, question, or concrete request gets its answer or its work
  first. When that work needs nothing more from the user, the same response
  closes with the question of the first open stage, introduced by one short
  line that says where setup stands.
- When the requested work itself needs the user's input, ask for that input
  and add one line that names the open setup stage and says you will return to
  it. The first later response whose work needs nothing from the user closes
  with that stage's question.
- When work done in a digression supplies a likely answer to an open stage,
  such as action items that fit Current priorities, propose it as that answer
  and ask for confirmation instead of asking from scratch.
- An explicit "you choose" or "I don't know" resolves the stage with its
  default.
- A stage the user skips without answering is asked once more, in one short
  sentence that names its default. If it stays unanswered, apply the default
  and show it in the recap: Use domain stays unspecified with a name-only
  Identity question, Starting point becomes Learn while working, Context detail
  stays empty, and Collaboration uses the default.
- Identity has no default. While the name is missing, keep the stage open and
  say that setup continues when the user shares how to be addressed.
- When the user asks to pause or stop setup, stop asking. The next start
  resumes from the first open stage.

Until the last stage, every response closes with the question of the first
open stage or, while requested work waits for the user's input, the one line
that names it. Only a request to pause ends this. Never offer the First trial,
give the Continuity guide, or call the workspace ready while an earlier stage
is open.

Make no personalized filesystem write before the user approves the final
visible recap. Approval covers only the literal personal paths, content
summary, folders, templates, and local restore-point outcome displayed in that
recap. For a verified fresh Lite package, that outcome also authorizes the
internal local-history mutations defined in the Git reference. It never
authorizes software installation, an existing repository mutation, remote
access, authentication, or push. A request to change the recap invalidates the
previous proposal; revise it and ask again.

## One authoritative home per fact

Route name, preferred language, and explicit collaboration preferences only to
Identity. Route stable role, use domains, sources, tools, and recurring local
context only to `CLAUDE.md`. Route current priorities and next actions only to
the declared `Future work` source.

Do not populate `Durable memory` merely to make onboarding look complete. It
may remain nearly empty. If first run reveals a distinct durable preference,
constraint, or long-lived model with no better home, present it separately as a
`jarvis-memory` candidate. That optional memory proposal is not part of
first-run completion and never receives live state.

## Apply the approved personal setup

Apply the recap as one approved unit. Preserve all existing custom text unless
the recap explicitly identifies a narrow addition.

### Identity

If Identity is absent, render the complete Soul template in the confirmed
language: translate every prose heading and sentence while preserving the
template's semantic structure, replace `[NAME]` and `[LANGUAGE]`, and apply
only explicit collaboration differences approved in the recap. Do not leave
template tokens or shorten the template into a profile card.

Never replace or patch an existing Soul during first run. Its current bytes are
authoritative even when onboarding-required remains. Later Identity evolution
belongs to `jarvis-memory`.

### Local context and future work

Replace only approved placeholder entries in the stable-context sections of
`CLAUDE.md`; preserve the capability map and all non-placeholder text. For a
progressive start, use plain final statements such as `To be learned
progressively`, `None declared`, or `No active overrides` instead of bracketed
placeholders.

Write approved current priorities and next actions to the active section of
the declared Future work source. Deduplicate an existing matching item. A
progressive start must not invent a task merely to fill the file.

### Visible structure

Create the single `98 - Archive/README.md` at the approved workspace root.
Create at most four approved numbered domain folders. Every created folder
receives a short `README.md` that states its purpose without inventing user
facts. Create a template only for an explicitly recurring output. A
progressive start creates no domain folder and no template.

Never create `PROFILE.md`, `JARVIS.md`, a second Soul, or a second capability
manifest.

## Reconciliation and resume

When onboarding-required remains, reconcile against the filesystem instead of
starting over:

- If Identity exists, preserve it byte for byte and complete only the missing
  approved scope. Do not mine it or another file for unconfirmed answers.
- If interruption happened before recap approval, no partial answers were
  persisted; restart the interview from the first unresolved decision.
- If interruption happened after approved writes began, re-read the actual
  files, show a missing-only recap, and require approval for that remaining
  literal scope. Do not rewrite completed items.

The acceptance behavior is a missing-only resume: existing Soul bytes stay
unchanged, completed items are not rewritten, and any failed verification
keeps onboarding visibly pending.

## Verify personal completion

Re-read every approved personal file and every created README or template.
Verify that Identity, Durable memory, and Future work resolve and are readable;
that the capability map is intact; that the approved visible structure matches
the recap; and verify that no onboarding placeholder remains.

Remove `<!-- jarvis:onboarding-required -->` only after every verification
passes. Preserve every non-marker line. In the same edit, leave exactly one
`<!-- jarvis:git-pending -->`, adding it when the profile lacks one, unless the
approved recap declined Local protection; then remove every Git-pending marker
in that edit instead. The profile never holds neither marker while Local
restore point is unresolved. Re-read `CLAUDE.md` and prove that the onboarding
marker count is zero and the Git-pending count is one, or zero after a declined
Local protection, before reporting completion.

A failed or incomplete verification retains exactly one onboarding marker.
Report the exact missing or mismatched path and make no blind rewrite. Do not
claim that the workspace is ready.

## Close personal setup

Only after verification, record that personal setup is complete internally.
Do not yet offer the First trial or lead with Git. Continue to Local restore
point in the same turn: it is the next stage, not an optional follow-up.
Missing or deferred local protection never invalidates the completed personal
setup.

## Local restore point

The detailed workflow lives in [git-checkpoint.md](git-checkpoint.md). Read it
only after personal setup verification, including a Git-only resume where
onboarding is already complete. Pass it the resolved local-profile path, the
confirmed Identity name when available, the literal approved personal paths,
the Git and operating-system preflight results, and the installed release
manifest and seed-state paths. On a Git-only resume in a later session, the
earlier recap is no longer in context: pass no approved personal paths, and the
reference asks for the paths it needs. Follow that reference through one
completed, deferred, unavailable, safely failed, or declined local
restore-point result.

## Safety check

Before ending, re-read the resolved personal files and local profile. Confirm
that the existing Soul was retained when present, only explicit fields and
marker lines changed, onboarding is either safely complete or visibly pending,
and no remote, authentication, or push was attempted.

After the local restore point is completed, deferred, unavailable, safely
failed, or declined, continue with the First trial and Continuity guide from the interview
reference, then the optional [cockpit.md](cockpit.md), which asks its own
question.
