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
- Made first-run questions capability-aware: Claude Code and Codex use their
  native interactive controls when exposed, related closed decisions may be
  grouped, compatible domains may be multi-select, and nuanced reasoning stays
  conversational. The Soul template now treats those controls as dialogue
  tools rather than a form.
- Added automatic Git and platform preflight, informed approval before any
  system installation, and an automatic local restore point for a verified
  fresh package using shipped-path evidence. Pending state stays internal;
  existing repositories and unexpected files remain conservative, and no
  remote is created.
- Added seven installed skills, with six using only the Markdown/filesystem
  contract and `jarvis-update` using the Python 3 standard library. Inbox
  organization remains normal Jarvis behavior with optional post-checkpoint
  maintenance.
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
- Made `jarvis-memory` the preview-first semantic curator for Identity and
  Durable memory, with direct reads, one authoritative home, progressive
  project-aware structure, concurrency checks, and informed secret handling.
- Moved memory and observed structural proposals after the `save-session` core
  checkpoint. Recovery claims now verify every changed operation, including
  ignored files, deletions, and renames.
- Added a standard-library builder that creates physical `.claude/skills` and
  `.agents/skills` mirrors without symlinks.
- Added the artifact-based update control plane: release and baseline
  identities and hashes, read-only preflight, ownership-aware conflict decisions, coherent
  runtime mirrors, exact migration overlays, scoped recovery, focused
  verification, and complete rollback without consumer Git mutation.
