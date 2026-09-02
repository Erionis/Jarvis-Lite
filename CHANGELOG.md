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
- Added six dependency-free installed skills, with Inbox organization handled
  through normal Jarvis behavior and optional post-checkpoint maintenance.
- Adapted `briefing` from the Lite 0.8.1 session-start flow with declared local
  sources, evidence-based priority selection, bounded choices, and concise
  continuity from daily history or handoffs.
- Made `save-session` update one idempotent daily history, route future work and
  durable signals, and create a guarded whole-workspace local recovery point.
  Optional Inbox maintenance runs only after the core checkpoint; Git never
  creates a remote or pushes automatically.
- Made `handoff` a living record shared with `briefing` and `save-session`:
  resume stays active, the same authoritative work updates in place, and
  completion or replacement closes the record without automatic deletion.
- Made `jarvis-doctor` report operational status, focus naturally on a named
  capability, verify write readiness without probes, and validate the Handoff
  lifecycle while remaining fully read-only.
- Added a standard-library builder that creates physical `.claude/skills` and
  `.agents/skills` mirrors without symlinks.
