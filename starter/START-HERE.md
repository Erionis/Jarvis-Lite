# Start Jarvis

1. Extract the complete `Jarvis-Lite` folder. Keep its hidden `.claude` and
   `.agents` folders with it.
2. Open the whole folder in Codex, Claude Code, OpenCode, or another compatible
   AI agent.
3. Say `Start Jarvis` in your language.

First run checks for Git automatically. If it is missing, Jarvis can show the
official installation command for the detected platform. Installing Git and
creating a local checkpoint are optional and require separate approval.

After setup, say `/jarvis-update` to check a verified Lite release. Jarvis
explains the release first, asks only about overlapping customizations, creates
scoped recovery, and verifies the approved update without running a general
Doctor audit. The updater uses the Python 3 standard library; its absence
blocks only updates.
