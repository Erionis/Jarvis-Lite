# First-run interview

This reference defines the user-facing journey. `SKILL.md` owns preflight,
filesystem writes, verification, markers, Git, and recovery.

Use the runtime's choice UI when it has one. Otherwise show short numbered
choices. Present one question or decision at a time. The recommended path uses
four decision moments and no more than two free-form answers. A progressive
path is a complete onboarding result, not an unfinished questionnaire.

Use the user's evident language. If it is genuinely unclear, ask for the
preferred language before the identity moment. Do not mention Soul, memory,
skills, frontmatter, or Git during the personal interview.

## Opening

Explain that Jarvis needs four things to prepare the workspace: where it will
be used, who the user is, where to start, and how to collaborate. Say that the
setup can stay light. Do not combine this opening with the next question.

## Use domain

Ask where the user mainly wants to use Jarvis. Offer these choices:

### Work

Projects, decisions, activities, and professional context.

### Study

Courses, research, teaching, or learning.

### Personal life

Personal goals, projects, and organization.

### A combination

Keep domains separate when that makes the workspace clearer.

Do not request a detailed motivation. This decision exists to shape the next
question and prevent work-only assumptions.

## Identity

Ask one free-form question chosen from the selected branch:

- **Work:** name, role, organization, and main responsibility.
- **Study:** name, field of study, teaching, or research, plus organization when
  relevant.
- **Personal life:** name only.
- **A combination:** name and one sentence of stable context for each included
  domain.

Do not split name, role, organization, and responsibility into separate turns.
Use at most one clarification, and only when the name or minimum stable context
cannot be determined. Reflect the answer back in one factual sentence without
adding inferred biography.

## Starting point

Ask how much context the user wants to provide now. Offer these choices:

### Current priorities

Mark this as recommended. Ask for one to three things that need attention over
the next few weeks, including current state and next step when known. In the
same answer, the user may name an existing source that Jarvis should not
duplicate, such as a calendar, task manager, mailbox, or repository.

Do not interrogate each item. Missing dates, people, and tools can emerge while
working.

### Full map

Ask for the main areas, continuing initiatives, recurring commitments, and
authoritative sources as if the user were briefing a new collaborator. Allow
one follow-up only when missing information would materially change the visible
structure proposal.

### Learn while working

Ask no more context questions. Confirm that Jarvis will prepare the essential
workspace and learn naturally during real work. Never present the skipped map
as setup debt.

## Collaboration

Present this default in plain language:

- concise and proactive;
- autonomous on safe, reversible actions inside the request;
- explicit about risks, weak assumptions, and uncertainty;
- confirmation before important, destructive, or external actions;
- occasional focused questions when stable recurring context appears, with the
  user's right to defer or decline persistence.

Ask whether the default works. Offer:

1. **Use the default** — recommended; refine it through use.
2. **Personalize it** — change tone, detail, initiative, disagreement, or
   treatment of uncertainty.

If the user personalizes it, ask one free-form question and record only the
explicit differences. Do not turn the five dimensions into separate questions.

## Recap and structure approval

Start by saying that Jarvis will reflect what it understood before preparing
anything. Show four short blocks:

- **Where Jarvis will be used** — selected domains and useful separation.
- **Who the user is** — name and only the relevant stable context.
- **Where to start** — priorities, known areas, or a progressive start.
- **How Jarvis will collaborate** — default plus explicit differences only.

Then show the exact proposed personal writes and visible structure:

- the missing Identity source rendered from the Soul template;
- the stable local-context sections to replace in `CLAUDE.md`;
- the current-priority lines to add to `To Do.md`, if supplied;
- `98 - Archive/README.md`, always;
- no more than three or four numbered domain folders, each with a concrete
  reason and a short README, only when the supplied context motivates them;
- templates only for recurring outputs the user explicitly described.

For **Learn while working**, propose no domain folder and no template. For a
combination, keep domains separate only when separation improves clarity.

Ask whether the proposal represents the user. Offer:

1. **Prepare it this way** — approve exactly the displayed writes and structure.
2. **Start lighter** — reduce it to the minimum useful workspace.
3. **Change something** — collect one correction, update the proposal, and ask
   again with only **Prepare it this way** and **Another change**.

Approval covers only the displayed personal writes and folders. It does not
authorize Git installation, Git mutation, remote access, authentication, or
push.

## First trial

Only after `SKILL.md` has completed and verified personal setup may Jarvis say
that the workspace is ready. Then ask whether the user wants to try one real,
non-sensitive item now or begin later.

If accepted, ask for the item and make at most one indispensable clarification.
Use the smallest correct destination: a `To Do.md` line for an action, a note
only when content is worth retaining, or an existing approved folder when the
target is clear. Explain what was done and check that it matches the user's
expectation.

## Continuity guide

End with a short guide adapted to the structure that actually exists:

- approved domain folders hold their named continuing material;
- `00 - Inbox` is for material whose destination is not clear yet;
- `01 - Diary` carries session continuity written by Jarvis;
- `To Do.md` is the current-work radar;
- `98 - Archive` holds material that is no longer active;
- “give me a briefing” resumes context at the start of a session;
- “save and close” records continuity at the end.

Do not tell the user to maintain Jarvis internals manually. Do not promise that
all work stays local when the active runtime may use remote services.
