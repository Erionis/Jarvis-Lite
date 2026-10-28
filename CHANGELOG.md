# Changelog

This project uses Semantic Versioning.

## 0.5.0 - 2026-10-28

- The default Soul puts disagreement in the first sentence of an answer, also
  for instructions and guidance handed over by other sessions or agents, and
  raises it once before leaving the decision to the user. It also anticipates
  the user's next step: reads allowed without asking are done ahead, and the
  next step is named in one line without a question. A repeated request
  becomes a proposal for a tool or page. Existing personal Souls are not
  changed; updates offer both behaviors as the personal improvements
  `soul-disagreement-first-v1` and `soul-anticipate-next-step-v1` (#63).
- Update checks and capability adoption can offer explicit personal-behavior
  improvements adapted to existing instructions, with separate preview and
  approval. Existing local curators are honored; a memory skill is not a
  mandatory dependency. Equivalent behavior and recorded declines are skipped.
- Approved adoption patches gain scoped original copies, read-only inspection,
  exact-result verification and guarded rollback. Partial work is reported;
  newer edits stop restoration. There is no automatic resume engine (#60).

## 0.4.0 - 2026-10-21

- First run now resumes the first unanswered interview stage after detours or
  a new chat when the user accepted a temporary setup draft. The approval
  recap shows the complete rendered Soul before writing it (#54).
- The fresh-package restore point verifies the shipped seed schema before
  creating local history, so an unexpected package shape stops safely (#55).
- The Soul template now asks Jarvis to raise relevant risks, better approaches,
  and useful next steps proactively. The core offers `save-session` once at a
  natural stopping point after substantial work when continuity is useful;
  saving still requires the user's acceptance (#57). Existing user-owned Soul
  files are not rewritten by this release.

## 0.3.0 - 2026-10-19

- Completing or superseding a handoff now archives the selected record, also
  when closed by save-session. History and link destinations are preserved;
  ordinary briefing excludes the archive and listing includes it read-only.
  Open work never expires by age, and updates do not sweep old user records.

## 0.2.1 - 2026-10-17

- First run no longer loses its remaining questions after a digression, a
  skipped answer, or a pause. The interview follows ordered stages, returns to
  the first open one after other work, and applies announced defaults to
  skipped stages; only the name has no default (#39).
- The local restore point can no longer be silently lost. The starter ships
  the pending marker, files created during setup are listed for approval, and
  a pending restore point is offered at most once per later session with
  **Create it now**, **Not now**, or **Don't use restore points** (#39).
- `jarvis-doctor` now reports a pending, declined, or ambiguous local restore
  point while staying read-only (#41).

## 0.2.0 - 2026-10-16

- Added the optional Jarvis cockpit plugin (`plugins/jarvis-cockpit`, version
  0.8.0) for the Claude Code desktop app on macOS: Recap, Diary, To Do, Files,
  Reading, and Memories beside the chat, in Italian or English as the
  workspace's identity says, with the Terminal mascot and a replaceable one
  (`cockpit-mascot` skill).
- Made the repository a plugin marketplace (`.claude-plugin/marketplace.json`);
  the starter package does not include the plugin.
- First run now offers the cockpit at the end, only in the Claude Code desktop
  app on macOS and only after an explicit yes.
- The prompt for adopting Jarvis Lite capabilities into an existing Jarvis now
  names the adoption contract and its local-clone fallback (#34).

## 0.1.1 - 2026-09-11

- Fixed `jarvis-memory` so a time-bounded "remember" (event, deadline, or
  delivery) is routed to `Future work` and the project note by a horizon test
  that precedes classification; the skill description now names the durable
  fact instead of the verb.
- Reworked the README and `docs/updates.md` as onboarding: value before setup,
  a recommended Jarvis setup with desktop apps in coding mode, working-folder
  guidance for ZIP users, an onboarding path for an existing non-Lite Jarvis,
  and removal of a stray `ingest` reference carried over from Vanilla.

## 0.1.0 - 2026-09-06

- Added deterministic semantic-tag release builds with a portable ZIP, external
  SHA-256 checksum, embedded package identity, cross-platform extraction gates,
  and draft-only GitHub publication.
- Made the ready-to-use release ZIP the primary public path, with a prominent
  self-hosted download control and checksum instructions.

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
