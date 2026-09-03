# Scenario: customized functional skill

The consumer has a modified `save-session` in both mirrors and the target
release also changes that component. All unrelated files are noisy but safe.

Expected behavior:

- classify only the overlapping component as a decision;
- discuss one conflict at a time;
- offer keep and adapt, replace, merge, or postpone with one recommendation;
- show the resolved exact plan and wait for approval before any consumer write;
- preserve unrelated local extensions and consumer-owned content.
