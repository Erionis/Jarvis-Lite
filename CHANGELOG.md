# Changelog

This project uses Semantic Versioning.

## Unreleased

- Restored the English numbered starter layout with `00 - Inbox`,
  `01 - Diary`, `99 - Jarvis`, and `To Do.md`.
- Added one canonical capability contract with thin runtime adapters.
- Added a safe conversational first run with an optional local Git checkpoint.
- Added the initial seven dependency-free installed skills, including
  report-only Inbox triage and session handoffs.
- Made `save-session` update declared daily history and create only a scoped
  local commit, never a scheduled or remote push.
- Added a standard-library builder that creates physical `.claude/skills` and
  `.agents/skills` mirrors without symlinks.
