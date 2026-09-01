---
name: first-run
description: Use when the declared identity source is missing, an onboarding or Git-pending marker is present, or a user begins onboarding naturally, including “Start Jarvis” in any language.
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
  skip the personal interview and resume only Local Git checkpoint.
- If Identity is absent or onboarding-required exists, complete or reconcile
  personal onboarding first, even when Git-pending also exists.

Treat semantic equivalents of `Start Jarvis` in any language as the same
trigger. For the default starter, if `99 - Jarvis/memory/soul.md` already
exists, do not replace it.

## Personal interview

Read and follow [interview.md](interview.md) for the full visible journey. Ask
one question at a time and present one decision at a time. Use only direct
answers or explicitly confirmed choices; never infer personal facts from vague
signals, free-form memory, or unrelated notes.

Make no personalized filesystem write before the user approves the final
visible recap. Approval covers only the literal personal paths, content
summary, folders, and templates displayed in that recap. A request to change
the recap invalidates the previous proposal; revise it and ask again.

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
language, replace `[NAME]` and `[LANGUAGE]`, and apply only explicit
collaboration differences approved in the recap. Do not leave template tokens
or shorten the template into a profile card.

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

Create `98 - Archive/README.md` in every approved path. Create at most four
approved numbered domain folders. Every created folder receives a short
`README.md` that states its purpose without inventing user facts. Create a
template only for an explicitly recurring output. A progressive start creates
no domain folder and no template.

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
passes. Preserve every non-marker line. Re-read `CLAUDE.md` and prove that the
onboarding marker count is zero before reporting completion.

A failed or incomplete verification retains exactly one onboarding marker.
Report the exact missing or mismatched path and make no blind rewrite. Do not
claim that the workspace is ready.

## Close personal setup

Only after verification, say that personal setup is ready. State that Git is
optional and does not block ordinary Jarvis work. Continue to Local Git
checkpoint before offering the First trial.

## Local Git checkpoint

The detailed workflow lives in [git-checkpoint.md](git-checkpoint.md). Read it
only after personal setup verification, including a Git-only resume where
onboarding is already complete. Pass it the resolved local-profile path, the
confirmed Identity name when available, and the Git and operating-system
preflight results. Follow that reference through one completed, deferred,
unavailable, or safely failed local checkpoint result.

## Safety check

Before ending, re-read the resolved personal files and local profile. Confirm
that the existing Soul was retained when present, only explicit fields and
marker lines changed, onboarding is either safely complete or visibly pending,
and no remote, authentication, or push was attempted.

After Git is completed, deferred, unavailable, or safely failed, continue with
the First trial and Continuity guide from the interview reference.
