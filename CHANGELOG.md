# Changelog

This project uses Semantic Versioning.

## Unreleased

- Restored the English numbered starter layout with `00 - Inbox`,
  `01 - Diary`, `99 - Jarvis`, and `To Do.md`.
- Added one canonical capability contract with thin runtime adapters.
- Restored the guided first-run journey with progressive or full-map setup,
  one authoritative home per fact, verified resume, a contract-declared Soul
  seed, a detailed Soul, a compact approval recap, and Git details loaded only
  after personal setup.
- Added automatic Git and platform preflight, separately approved installation
  and pending-state markers, plus an optional scoped local checkpoint that
  never creates a remote.
- Added the initial seven dependency-free installed skills, including
  report-only Inbox triage and session handoffs.
- Adapted `briefing` from the Lite 0.8.1 session-start flow with declared local
  sources, evidence-based priority selection, bounded choices, and concise
  continuity from daily history or handoffs.
- Made `save-session` update declared daily history and create only a scoped
  local commit, never a scheduled or remote push.
- Added a standard-library builder that creates physical `.claude/skills` and
  `.agents/skills` mirrors without symlinks.
