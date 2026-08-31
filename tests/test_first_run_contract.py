from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills/first-run/SKILL.md"
CARD = ROOT / "skills/first-run/README.md"
SCENARIOS = ROOT / "tests/scenarios"


class FirstRunContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = SKILL.read_text(encoding="utf-8")

    def test_one_question_and_idempotency_rules_are_explicit(self):
        for phrase in [
            "Ask one question at a time",
            "Treat semantic equivalents of `Start Jarvis` in any language as the same trigger",
            "For the default starter, if `99 - Jarvis/memory/soul.md` already exists, do not replace it",
            "Remove `<!-- jarvis:onboarding-required -->` only after",
            "Preserve every non-marker line",
            "Render Soul and personal content in the preferred language",
        ]:
            self.assertIn(phrase, self.text)

    def test_git_happy_path_is_complete(self):
        text = " ".join(self.text.split())
        for command in [
            "git --version",
            "git rev-parse --is-inside-work-tree",
            "git init -b main",
            "git config --get user.name",
            "git config --get user.email",
            "git config --get core.hooksPath",
            "git config --local core.hooksPath .githooks",
            "git add -A",
            'git commit -m "chore: initialize my Jarvis"',
        ]:
            self.assertIn(command, text)

    def test_git_hook_activation_preserves_existing_custom_configuration(self):
        text = " ".join(self.text.split())
        for phrase in [
            "include local hook-path configuration in the displayed checkpoint scope",
            "Reuse `.githooks` when it is already configured",
            "If another nonempty hook path is configured, preserve it",
            "do not overwrite custom Git configuration",
            "Report that the Lite large-file guard was not activated",
        ]:
            self.assertIn(phrase, text)

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
            "Repeat this staged-path comparison after re-staging the local profile and before commit",
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
            "remove the Git-pending marker, re-stage the local profile, recheck, then commit",
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

    def test_immediate_focus_has_one_live_home_outside_durable_memory(self):
        text = " ".join(self.text.split())
        for phrase in [
            "Record the confirmed `Main focus` in the local profile's `## Current context`",
            "add or deduplicate the actionable focus in the declared `Future work` active section",
            "one live authoritative home",
            "Do not write the immediate focus to `Durable memory`",
            "Never copy live state into `Durable memory`",
        ]:
            self.assertIn(phrase, text)
        self.assertNotIn(
            "add the stated focus to the existing memory and future-work sections",
            text,
        )

    def test_stable_onboarding_signals_delegate_to_memory_workflow(self):
        text = " ".join(self.text.split())
        for phrase in [
            "distinct genuinely stable preference, constraint, or long-lived model",
            "route it through `jarvis-memory` as a separate candidate",
            "obey that skill's conflict and approval rules",
            "not a condition for first-run completion",
        ]:
            self.assertIn(phrase, text)

    def test_first_run_frontmatter_has_a_trigger_only_description(self):
        frontmatter = self.text.split("---", 2)[1].strip().splitlines()
        fields = dict(line.split(": ", 1) for line in frontmatter)

        self.assertEqual(set(fields), {"name", "description"})
        self.assertEqual(fields["name"], "first-run")
        self.assertTrue(fields["description"].startswith("Use when"))
        for workflow_word in [
            "read",
            "resolve",
            "inspect",
            "write",
            "patch",
            "stage",
            "commit",
        ]:
            self.assertNotIn(workflow_word, fields["description"].lower())

    def test_first_run_card_has_the_exact_adoption_headings(self):
        card = CARD.read_text(encoding="utf-8")
        headings = [line[3:] for line in card.splitlines() if line.startswith("## ")]

        self.assertEqual(
            headings,
            [
                "Purpose",
                "Use it when",
                "Dependencies",
                "Files it may change",
                "Adopting it into an existing Jarvis",
            ],
        )

    def test_first_run_card_does_not_promise_direct_memory_writes(self):
        card = " ".join(CARD.read_text(encoding="utf-8").split())
        self.assertIn("declared `Future work` active section", card)
        self.assertIn("does not write `Durable memory` directly", card)
        self.assertNotIn("profile/memory/future-work fields", card)

    def test_first_run_has_no_rejected_legacy_paths(self):
        for rejected in ["jarvis/PROFILE.md", "jarvis/identity/SOUL.md"]:
            self.assertNotIn(rejected, self.text)

    def test_scenarios_have_the_exact_contract_headings(self):
        for name in ["new-user.md", "second-run.md", "git-missing.md"]:
            scenario = (SCENARIOS / name).read_text(encoding="utf-8")
            headings = [
                line[3:] for line in scenario.splitlines() if line.startswith("## ")
            ]
            self.assertEqual(headings, ["Given", "When", "Then", "Forbidden"], name)

    def test_new_user_scenario_keeps_focus_out_of_durable_memory(self):
        scenario = " ".join(
            (SCENARIOS / "new-user.md").read_text(encoding="utf-8").split()
        )
        for phrase in [
            "records the confirmed Main focus in the local profile's current context",
            "adds or deduplicates the actionable focus in the declared Future work active section",
            "does not write the immediate focus to Durable memory",
        ]:
            self.assertIn(phrase, scenario)
        self.assertNotIn("profile/memory/future-work content", scenario)

    def test_second_run_excludes_both_resume_markers(self):
        scenario = " ".join(
            (SCENARIOS / "second-run.md").read_text(encoding="utf-8").split()
        )
        self.assertIn(
            "has neither `<!-- jarvis:onboarding-required -->` nor "
            "`<!-- jarvis:git-pending -->` markers",
            scenario,
        )

    def test_git_missing_scenario_is_command_not_found(self):
        scenario = (SCENARIOS / "git-missing.md").read_text(encoding="utf-8")
        self.assertIn("`git --version` is command-not-found", scenario)

    def test_scenarios_exist(self):
        for name in ["new-user.md", "second-run.md", "git-missing.md"]:
            self.assertTrue((ROOT / "tests/scenarios" / name).is_file(), name)


if __name__ == "__main__":
    unittest.main()
