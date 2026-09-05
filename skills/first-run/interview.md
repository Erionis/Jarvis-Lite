# First-run interview

This reference defines the user-facing journey. `SKILL.md` owns preflight,
filesystem writes, verification, markers, Git, and recovery.

Use the native interactive question tool only when the active runtime exposes
it and the user faces a real decision with at least two genuinely distinct
options: `AskUserQuestion` in Claude Code or `request_user_input` in Codex.
Normal Codex sessions may not expose `request_user_input`; follow actual
capabilities rather than assuming them from the runtime name. Never create a
one-option placeholder such as **I’ll type it out** to collect a free-form
answer. When the input is free-form, ask it directly in normal conversation.

Without a native choice tool, use the fallback allowed by the active runtime.
Show short numbered choices when textual choices are supported. If they are
not, ask one concise conversational question, preserve all alternatives in
prose, and accept a named choice, a combination, or a free-form correction.
Never imply that a native control was used. If the native UI cannot group
questions, split the interaction without changing its meaning. If it cannot
select multiple answers, use the single-select or conversational fallback
defined below.

Work through one coherent interaction at a time. It may contain one free-form
question, one decision, or a small group of related closed questions that can
be answered together. Allow multiple answers when several choices can be true.
Keep mutually exclusive choices single-select. Keep free-form or nuanced
reasoning conversational: the interactive UI supports the dialogue instead of
turning it into a form. The recommended path still covers four decision
moments, but it does not impose a fixed number of turns. A progressive path is
a complete onboarding result, not an unfinished questionnaire.

Use the user's evident language. If it is genuinely unclear, ask for the
preferred language before the identity moment. Before the approval card, keep
Soul, memory, skills, frontmatter, and Git out of the personal interview.

Use one visible-response shape throughout the personal interview. It contains
only a short user-relevant orientation or factual reflection, followed by the
current coherent question or decision group. Keep runtime process, skill
selection, preflight, marker, and no-write status out of the personal journey.

## Opening

Explain that Jarvis needs four things to prepare the workspace: where it will
be used, who the user is, where to start, and how to collaborate. Say that the
setup can stay light. The first user-facing interaction combines this opening
with Use domain and Starting point only when the runtime can group related
questions. These two closed decisions are independent and can be answered
together. Otherwise combine the opening with Use domain and ask Starting point
next. Do not group a dependent question before its context exists; Identity,
context detail, Collaboration, and recap approval remain later interactions.

## Use domain

Ask where the user wants to use Jarvis. When multi-select is available, offer
Work, Study, and Personal life and let the user select one or more. In a text
fallback, invite one or more numbered choices. When the UI is single-select but
has a free-form **Other** option, offer the three named domains and tell the
user to use **Other** to name the combination. If neither multi-select nor a
free-form **Other** option is available, use the numbered fallback rather than
forcing a mixed answer into one domain.

### Work

Projects, decisions, activities, and professional context.

### Study

Courses, research, teaching, or learning.

### Personal life

Personal goals, projects, and organization.

### A combination

Keep domains separate when that makes the workspace clearer.

This is the semantic branch reached by multiple selected domains, a named
combination in **Other**, or several numbered answers. Do not request a detailed
motivation. This decision exists to shape the later Identity question and
prevent work-only assumptions.

## Starting point

Ask how much context the user wants to provide now. This is mutually exclusive:
keep it single-select even when the domain question accepts multiple answers.
When the runtime supports grouped related questions, collect this selection in
the opening interaction with Use domain. Otherwise collect it immediately
after Use domain. Do not ask for the detailed context until after Identity.

### Current priorities

Mark this as recommended. After Identity, ask for one to three things that need
attention over the next few weeks, including current state and next step when
known. In the same answer, the user may name an existing source that Jarvis
should not duplicate, such as a calendar, task manager, mailbox, or repository.

Do not interrogate each item. Missing dates, people, and tools can emerge while
working.

### Full map

After Identity, ask for the main areas, continuing initiatives, recurring
commitments, and authoritative sources as if the user were briefing a new
collaborator. Allow one follow-up only when missing information would materially
change the visible structure proposal.

### Learn while working

After Identity, ask no more context questions. Confirm that Jarvis will prepare
the essential workspace and learn naturally during real work. Never present the
skipped map as setup debt.

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

Use a compact approval card. Start by saying that Jarvis will reflect what it
understood before preparing anything. Show four short blocks:

- **Where Jarvis will be used** — selected domains and useful separation.
- **Who the user is** — name and only the relevant stable context.
- **Where to start** — priorities, known areas, or a progressive start.
- **How Jarvis will collaborate** — default plus explicit differences only.

Then show the approved-change list. Its Identity line names the standard Soul
template, confirmed name, confirmed language, and explicit collaboration
differences. The complete rendered Soul appears only after an explicit preview
request; after showing it, ask for approval again. The default card does not
repeat unchanged standard template text.

The list names every other exact path and action:

- the literal stable local-context values to replace in `CLAUDE.md`;
- the literal current-priority lines to add to `To Do.md`, if supplied;
- `98 - Archive/README.md`, always, with its one-sentence purpose;
- no more than four numbered domain folders, each with its concrete reason and
  one-sentence README purpose, following the structure rule below;
- each template only when the user explicitly described a recurring output.

End the list with one outcome, not a technical operation:

- **Local protection** — create a local restore point after setup. Nothing is
  published or sent online.

State `No change` for an authoritative personal source that will remain
untouched. This card is the complete approval scope: path, action, personalized
content, and purpose, without dumping unchanged boilerplate.

For **Current priorities** or **Full map**, when two or more selected domains
each have confirmed stable context that can hold continuing material, propose
one separate numbered domain folder per domain by default, up to four. Do not
ask another question merely to decide whether to separate them: the approval
card makes the default visible, and **Start lighter** is the opt-out. Do not
invent a folder for a domain without confirmed continuing context. For one
domain, propose a folder only when the supplied context identifies continuing
material.

For **Learn while working**, propose no domain folder and no template,
including when the user selected several domains.

Ask whether the proposal represents the user. Offer:

1. **Prepare it this way** — approve the displayed writes, structure, and local
   restore-point outcome.
2. **Start lighter** — reduce it to the minimum useful workspace.
3. **Change something** — collect one correction, update the proposal, and ask
   again with only **Prepare it this way** and **Another change**.

The approved card authorizes the local restore-point outcome for a verified
fresh Lite package. It does not authorize software installation, changes to an
existing repository, remote access, authentication, or push. Keep Git commands,
configuration, and inventory out of this personal journey; the technical
reference owns them.

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
