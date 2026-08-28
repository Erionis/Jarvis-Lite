from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills/first-run/SKILL.md"


class FirstRunContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = SKILL.read_text(encoding="utf-8")

    def test_one_question_and_idempotency_rules_are_explicit(self):
        for phrase in [
            "Ask one question at a time",
            "Treat semantic equivalents of `Start Jarvis` in any language as the same trigger",
            "If `jarvis/identity/SOUL.md` already exists, do not replace it",
            "Remove `<!-- jarvis:onboarding-required -->` only after",
            "Preserve every non-marker line",
            "Render Soul and personal content in the preferred language",
        ]:
            self.assertIn(phrase, self.text)

    def test_git_happy_path_is_complete(self):
        for command in [
            "git --version",
            "git rev-parse --is-inside-work-tree",
            "git init -b main",
            "git config --get user.name",
            "git config --get user.email",
            "git add -A",
            'git commit -m "chore: initialize my Jarvis"',
        ]:
            self.assertIn(command, self.text)

    def test_git_missing_path_is_platform_specific(self):
        self.assertIn("https://git-scm.com/download/win", self.text)
        self.assertIn("https://git-scm.com/download/mac", self.text)
        self.assertIn("<!-- jarvis:git-pending -->", self.text)

    def test_fresh_baseline_requires_scope_review_and_approval(self):
        for phrase in [
            "git status --short",
            "freshly initialized Jarvis directory",
            "explicitly approves the displayed full baseline",
            "do not use `git add -A`",
            "stage only explicitly approved onboarding sources or defer checkpointing",
        ]:
            self.assertIn(phrase, self.text)

    def test_existing_repository_index_isolated_before_checkpoint(self):
        for phrase in [
            "Before any onboarding staging or commit in an existing repository, run `git diff --cached --name-only`",
            "If the initial staged-path output contains any entry",
            "display every staged path, do not alter the index, do not stage, and do not commit",
            "retain or add exactly one `<!-- jarvis:git-pending -->` marker",
            "defer the checkpoint and permit normal Jarvis work",
            "Only when the initial staged-path output is empty may you stage the exact explicitly approved onboarding source paths",
            "After staging, run `git diff --cached --name-only` again",
            "contains no path outside the explicitly approved onboarding source paths",
            "Repeat this staged-path comparison after re-staging the resolved Profile and before commit",
            "do not automatically unstage or commit",
        ]:
            self.assertIn(phrase, self.text)

    def test_existing_identity_uses_resolved_path_and_safe_name_reconciliation(self):
        for phrase in [
            "resolved Identity capability source",
            "non-authoritative starter Soul is legacy content",
            "recognized identity name field",
            "explicit approval to patch only that field",
            "keep onboarding pending",
        ]:
            self.assertIn(phrase, self.text)

    def test_existing_candidates_need_confirmation_but_direct_answers_do_not(self):
        for phrase in [
            "Preferred language:",
            "Main focus:",
            "Ask one explicit confirmation for each candidate read from files",
            "A direct answer needs no duplicate confirmation",
        ]:
            self.assertIn(phrase, self.text)

    def test_git_can_be_deferred_and_failures_are_recoverable(self):
        for phrase in [
            "intentionally defers Git",
            "does not answer the operating-system question",
            "Offer operating-system guidance later only on request",
            "report the exact failed command",
            "retain or add `<!-- jarvis:git-pending -->`",
        ]:
            self.assertIn(phrase, self.text)

    def test_custom_identity_has_an_approved_narrow_recovery_patch(self):
        for phrase in [
            "show a narrow proposed patch",
            "existing style and location",
            "explicit approval before applying it",
            "ordinary Jarvis work may continue",
        ]:
            self.assertIn(phrase, self.text)

    def test_missing_identity_takes_precedence_over_git_pending(self):
        for phrase in [
            "If the resolved Identity source is absent, run personal onboarding first",
            "Git-only resume applies only when the resolved Identity source exists and the onboarding marker is absent",
        ]:
            self.assertIn(phrase, self.text)

    def test_git_pending_is_cleaned_before_approved_staging_and_restored_on_failure(self):
        for phrase in [
            "Remove the Git-pending marker before staging",
            "successful checkpoint contains the clean profile state",
            "restore or retain `<!-- jarvis:git-pending -->`",
        ]:
            self.assertIn(phrase, self.text)

    def test_git_mutation_requires_checkpoint_consent(self):
        for phrase in [
            "wait for explicit acceptance before any Git mutation",
            "git init -b main, author configuration, staging, or commit",
            "A declined or deferred checkpoint",
            "performs no Git mutation",
        ]:
            self.assertIn(phrase, self.text)

    def test_withheld_baseline_approval_defers_without_staging(self):
        for phrase in [
            "Withheld or declined baseline approval means no `git add -A` and no commit",
            "continue normal work",
        ]:
            self.assertIn(phrase, self.text)

    def test_language_rendering_preserves_existing_custom_text(self):
        for phrase in [
            "Only newly created or newly added personal text is rendered",
            "Preserve existing custom text verbatim",
            "separately approves a semantic rewrite",
        ]:
            self.assertIn(phrase, self.text)

    def test_git_exit_codes_distinguish_expected_states_from_failures(self):
        for phrase in [
            "`git --version`: exit 0 means Git is available",
            "command-not-found means Git is missing",
            "`git rev-parse --is-inside-work-tree`: exit 0 with output `true` means existing worktree",
            "only the expected not-a-repository result may lead to `git init -b main`",
            "`git config --get user.name` / `git config --get user.email`: exit 0 with nonempty output means configured",
            "expected missing-value state means ask before repository-local configuration",
            "`git diff --cached --quiet`: exit 0 means empty; exit 1 means changes",
            "Any other exit code enters Git failure recovery",
        ]:
            self.assertIn(phrase, self.text)

    def test_empty_staging_retains_marker_and_success_commits_marker_removal(self):
        for phrase in [
            "stage the approved scope while Git-pending remains",
            "If the staged diff is empty, retain Git-pending, report that no checkpoint was made, and continue normal work",
            "remove the Git-pending marker, re-stage the resolved Profile, recheck, then commit",
            "leaves no marker-removal change afterward",
        ]:
            self.assertIn(phrase, self.text)

    def test_checkpoint_acceptance_materializes_one_marker_before_git_scope(self):
        for phrase in [
            "Explicit checkpoint acceptance authorizes adding or retaining exactly one `<!-- jarvis:git-pending -->` marker",
            "before `git --version`, every other Git probe or mutation, and the displayed `git status --short` inventory",
            "The approved scope therefore already includes that marker",
            "Decline, an empty staged diff, or any Git failure retains or restores exactly one Git-pending marker",
        ]:
            self.assertIn(phrase, self.text)

    def test_successful_commit_discloses_final_git_state(self):
        for phrase in [
            "After a successful commit, run and display `git status --short`",
            "Only empty output is evidence of a clean checkpoint",
            "report the exact remaining state",
            "make no automatic cleanup or extra commit",
            "do not claim a clean checkpoint",
            "require explicit approval before any recovery",
            "If this status command errors, enter Git failure recovery",
        ]:
            self.assertIn(phrase, self.text)

    def test_partial_git_failure_preserves_index_and_requires_approved_recovery(self):
        for phrase in [
            "Immediately run and display `git status --short`",
            "Preserve the existing index; never blindly unstage",
            "stop further Git mutations",
            "explain the exact staged and unstaged state",
            "offer only an explicit user-approved recovery step",
            "Normal Jarvis work may continue",
        ]:
            self.assertIn(phrase, self.text)

    def test_missing_profile_fields_use_an_approved_smallest_addition(self):
        for phrase in [
            "If `Preferred language:` or `Main focus:` is absent",
            "show the smallest exact proposed addition under an existing `## Current context`",
            "propose adding `## Current context` at the end",
            "Apply it only after explicit approval",
            "Preserve every existing line",
        ]:
            self.assertIn(phrase, self.text)

    def test_scenarios_exist(self):
        for name in ["new-user.md", "second-run.md", "git-missing.md"]:
            self.assertTrue((ROOT / "tests/scenarios" / name).is_file(), name)


if __name__ == "__main__":
    unittest.main()
