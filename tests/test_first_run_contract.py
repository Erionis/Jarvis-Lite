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

    def test_scenarios_exist(self):
        for name in ["new-user.md", "second-run.md", "git-missing.md"]:
            self.assertTrue((ROOT / "tests/scenarios" / name).is_file(), name)


if __name__ == "__main__":
    unittest.main()
