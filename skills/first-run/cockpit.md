# Optional cockpit

Read this only after the Continuity guide, when onboarding is otherwise finished.

The cockpit is an optional panel beside the chat in the Claude Code desktop app: a recap of today
and the last session, To Do, Diary, Memories, and the workspace's files. It is drawn only in the
desktop app; elsewhere it shows a single line. It is a plugin that lives in the Jarvis Lite
repository, outside the starter package, and it is macOS-only for now.

## When to offer it

Offer it only when every condition holds; otherwise end without mentioning it:

- the active runtime is Claude Code, in its desktop app: `echo "$CLAUDE_CODE_ENTRYPOINT"` prints
  `claude-desktop` (anything else, or nothing, means do not offer it);
- `uname -s` prints `Darwin`;
- the `claude` command is available;
- `claude plugin list` does not already list `jarvis-cockpit`.

## The offer

Ask one question. Say in plain words what the cockpit shows; that it is optional and appears only
in the desktop app; that installing downloads the plugin from GitHub, records it in this
workspace's `.claude/settings.json`, and adds the `jarvis-lite` marketplace to the user's Claude
Code settings, outside the workspace; and that two short commands remove it again. Install only
after an explicit yes to this question, given after you asked it: the recap approval, an earlier
answer, a vague reply or silence never counts, and any other answer ends onboarding without the
cockpit.

After an explicit yes, run from the workspace folder:

```bash
claude plugin install jarvis-cockpit --marketplace Erionis/Jarvis-Lite --scope project
```

This is the only network access first run itself performs, it comes after the Safety check, and it
happens only on that yes: the Safety check's statement about remotes still describes onboarding
itself. `--scope project` keeps the cockpit to this workspace; `.claude/settings.json` belongs to
the user and `jarvis-update` never manages it.

If the command asks a question, show it to the user and answer only what they decide; if it cannot
ask, stop and tell the user. If it fails, report the error as it is and continue without the
cockpit.

## After installing

Tell the user to start a new session (or run `/reload-plugins`) to see the cockpit: it opens beside
the chat at their first message of each session, and `/jarvis` opens it again if they close it. Tell
them too that they can change its mascot by asking Jarvis, and that two commands, run from the
workspace folder, remove it. The first removes the cockpit from this workspace:

```bash
claude plugin uninstall jarvis-cockpit --scope project
```

The second removes the `jarvis-lite` marketplace from the user's Claude Code settings; it is needed
only if the marketplace was not there before this install and no other workspace of theirs still
uses the cockpit:

```bash
claude plugin marketplace remove jarvis-lite
```
