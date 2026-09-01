from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills/first-run/SKILL.md"
CARD = ROOT / "skills/first-run/README.md"
INTERVIEW = ROOT / "skills/first-run/interview.md"
GIT_CHECKPOINT = ROOT / "skills/first-run/git-checkpoint.md"
SCENARIOS = ROOT / "tests/scenarios"


class FirstRunContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = SKILL.read_text(encoding="utf-8")
        cls.flat = " ".join(cls.text.split())
        cls.git_text = (
            GIT_CHECKPOINT.read_text(encoding="utf-8")
            if GIT_CHECKPOINT.is_file()
            else ""
        )
        cls.contract_text = f"{cls.text}\n{cls.git_text}"
        cls.contract_flat = " ".join(cls.contract_text.split())

    def read_interview(self) -> str:
        self.assertTrue(INTERVIEW.is_file(), "first-run interview reference is missing")
        return INTERVIEW.read_text(encoding="utf-8")

    def read_scenario(self, name: str) -> str:
        path = SCENARIOS / name
        self.assertTrue(path.is_file(), name)
        return path.read_text(encoding="utf-8")

    def test_skill_routes_to_the_interview_reference(self):
        self.assertIn("[interview.md](interview.md)", self.text)

    def test_interview_moments_have_the_approved_order(self):
        text = self.read_interview()
        headings = [line[3:] for line in text.splitlines() if line.startswith("## ")]
        self.assertEqual(
            headings,
            [
                "Opening",
                "Use domain",
                "Identity",
                "Starting point",
                "Collaboration",
                "Recap and structure approval",
                "First trial",
                "Continuity guide",
            ],
        )

    def test_interview_covers_all_domain_and_starting_depth_branches(self):
        text = self.read_interview()
        for branch in [
            "Work",
            "Study",
            "Personal life",
            "A combination",
            "Current priorities",
            "Full map",
            "Learn while working",
        ]:
            self.assertIn(f"### {branch}", text)

    def test_interview_keeps_the_recommended_path_bounded(self):
        text = " ".join(self.read_interview().split())
        self.assertIn("four decision moments", text)
        self.assertIn("no more than two free-form answers", text)
        self.assertIn("one question or decision at a time", text)

    def test_opening_and_domain_are_one_user_facing_turn(self):
        text = " ".join(self.read_interview().split())
        for phrase in [
            "The first user-facing response combines this opening with the Use domain question",
            "contains only a short user-relevant orientation or factual reflection",
            "followed by the single current question or decision",
        ]:
            self.assertIn(phrase, text)

    def test_default_recap_is_a_compact_approval_card(self):
        text = " ".join(self.read_interview().split())
        for phrase in [
            "Use a compact approval card",
            "names the standard Soul template, confirmed name, confirmed language",
            "The complete rendered Soul appears only after an explicit preview request",
            "names every other exact path and action",
        ]:
            self.assertIn(phrase, text)

    def test_marker_counts_are_scoped_to_the_resolved_local_profile(self):
        text = " ".join(self.text.split())
        for phrase in [
            "Count both marker types only in the resolved local profile",
            "A marker mentioned in installed system instructions, skill references, or documentation is not consumer state",
        ]:
            self.assertIn(phrase, text)

    def test_git_checkpoint_is_a_lazily_loaded_reference(self):
        self.assertTrue(GIT_CHECKPOINT.is_file(), "Git checkpoint reference is missing")
        self.assertIn("[git-checkpoint.md](git-checkpoint.md)", self.text)
        self.assertIn("Read it only after personal setup verification", self.flat)
        for detail in [
            "git init -b main",
            "winget install --id Git.Git -e --source winget",
            'git commit -m "chore: initialize my Jarvis"',
        ]:
            self.assertNotIn(detail, self.text)
            self.assertIn(detail, self.git_text)

    def test_approved_journey_scenarios_exist(self):
        for name in [
            "new-user.md",
            "full-map-user.md",
            "progressive-user.md",
            "modified-structure.md",
            "resume-first-run.md",
            "git-missing.md",
            "git-install.md",
            "existing-repository.md",
            "staged-index.md",
        ]:
            self.assertTrue((SCENARIOS / name).is_file(), name)

    def test_personal_write_scope_has_one_authoritative_home_per_fact(self):
        text = " ".join(self.text.split())
        for phrase in [
            "name, preferred language, and explicit collaboration preferences only to Identity",
            "stable role, use domains, sources, tools, and recurring local context only to `CLAUDE.md`",
            "current priorities and next actions only to the declared `Future work` source",
            "Do not populate `Durable memory` merely to make onboarding look complete",
        ]:
            self.assertIn(phrase, text)
        for rejected in ["`Preferred language:`", "`Main focus:`"]:
            self.assertNotIn(rejected, self.text)

    def test_personal_writes_are_atomic_after_exact_recap_approval(self):
        text = " ".join(self.text.split())
        for phrase in [
            "Make no personalized filesystem write before the user approves the final visible recap",
            "Approval covers only the literal personal paths, content summary, folders, and templates displayed in that recap",
            "Create `98 - Archive/README.md` in every approved path",
            "Create at most four approved numbered domain folders",
            "Every created folder receives a short `README.md`",
            "Create a template only for an explicitly recurring output",
            "A progressive start creates no domain folder and no template",
        ]:
            self.assertIn(phrase, text)

    def test_soul_creation_and_reconciliation_preserve_identity_authority(self):
        text = " ".join(self.text.split())
        for phrase in [
            "render the complete Soul template in the confirmed language",
            "replace `[NAME]` and `[LANGUAGE]`",
            "apply only explicit collaboration differences approved in the recap",
            "Never replace or patch an existing Soul during first run",
            "Later Identity evolution belongs to `jarvis-memory`",
        ]:
            self.assertIn(phrase, text)

    def test_completion_verifies_outputs_before_removing_the_marker(self):
        text = " ".join(self.text.split())
        for phrase in [
            "Re-read every approved personal file and every created README or template",
            "verify that no onboarding placeholder remains",
            "Remove `<!-- jarvis:onboarding-required -->` only after every verification passes",
            "Re-read `CLAUDE.md` and prove that the onboarding marker count is zero",
            "A failed or incomplete verification retains exactly one onboarding marker",
            "Do not claim that the workspace is ready",
        ]:
            self.assertIn(phrase, text)

    def test_resume_and_second_run_have_distinct_terminal_behavior(self):
        resume = " ".join(self.read_scenario("resume-first-run.md").split())
        second = " ".join(self.read_scenario("second-run.md").split())
        for phrase in [
            "existing Soul bytes remain unchanged",
            "completes only the missing approved scope",
            "onboarding marker remains when any verification fails",
        ]:
            self.assertIn(phrase, resume)
        for phrase in [
            "zero changed bytes",
            "zero staged changes",
            "zero commits",
        ]:
            self.assertIn(phrase, second)

    def test_existing_repository_scenarios_define_both_index_boundaries(self):
        clean = " ".join(self.read_scenario("existing-repository.md").split())
        staged = " ".join(self.read_scenario("staged-index.md").split())
        for phrase in [
            "stages only the approved literal onboarding paths",
            "never uses `git add -A`",
            "verifies the staged path set before committing",
        ]:
            self.assertIn(phrase, clean)
        for phrase in [
            "displays every pre-existing staged path",
            "leaves the index byte-for-byte unchanged",
            "defers the checkpoint",
        ]:
            self.assertIn(phrase, staged)

    def test_one_question_and_idempotency_rules_are_explicit(self):
        for phrase in [
            "Ask one question at a time",
            "Treat semantic equivalents of `Start Jarvis` in any language as the same trigger",
            "For the default starter, if `99 - Jarvis/memory/soul.md` already exists, do not replace it",
            "Remove `<!-- jarvis:onboarding-required -->` only after",
            "Preserve every non-marker line",
            "render the complete Soul template in the confirmed language",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_git_and_os_detection_are_automatic_read_only_preflight(self):
        text = " ".join(self.text.split())
        for phrase in [
            "Before asking any interview question, run `git --version`",
            "Detect the operating system automatically",
            "Do not ask the user which operating system they use when it can be detected",
            "These preflight checks are read-only and require no consent",
        ]:
            self.assertIn(phrase, text)

    def test_git_install_help_is_specific_and_separately_approved(self):
        text = self.contract_flat
        for phrase in [
            "Missing Git never blocks personal onboarding or ordinary Jarvis work",
            "show exactly one matching installation command",
            "Ask for explicit installation approval before executing it",
            "Installation approval does not authorize any Git mutation",
            "Re-run `git --version` after the installer returns",
            "unsupported or ambiguous platform",
        ]:
            self.assertIn(phrase, text)
        for command in [
            "`xcode-select --install`",
            "`winget install --id Git.Git -e --source winget`",
            "`sudo apt-get install git`",
            "`sudo dnf install git`",
            "`sudo pacman -S git`",
        ]:
            self.assertIn(command, self.contract_text)

    def test_install_command_requires_a_verified_platform_package_manager(self):
        text = self.contract_flat
        for phrase in [
            "Before showing the Windows command, run `winget --version` as a read-only check",
            "If WinGet is unavailable, show only the official Windows installation guide",
            "For Linux, resolve `/etc/os-release` and verify that the matching package-manager command exists",
            "If the detected package manager does not match the distribution, show only the official Linux installation guide",
        ]:
            self.assertIn(phrase, text)

    def test_first_trial_follows_a_terminal_git_result(self):
        text = self.contract_flat
        for phrase in [
            "Continue to Local Git checkpoint before offering the First trial",
            "After Git is completed, deferred, unavailable, or safely failed",
            "continue with the First trial and Continuity guide",
        ]:
            self.assertIn(phrase, text)

    def test_git_checkpoint_uses_confirmed_name_and_lite_local_email(self):
        text = self.contract_flat
        for phrase in [
            "Reuse an existing nonempty repository-local or inherited author name",
            "set only the missing repository-local author name to the confirmed Identity name",
            "set only the missing repository-local email to `jarvis@vault.local`",
            "Display these exact local values before requesting checkpoint approval",
        ]:
            self.assertIn(phrase, text)

    def test_git_happy_path_is_complete(self):
        text = self.contract_flat
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
        text = self.contract_flat
        for phrase in [
            "Include local hook-path configuration in the displayed checkpoint scope",
            "Reuse `.githooks` when it is already configured",
            "If another nonempty hook path is configured, preserve it",
            "do not overwrite custom Git configuration",
            "Report that the Lite large-file guard was not activated",
        ]:
            self.assertIn(phrase, text)

    def test_git_missing_path_is_platform_specific(self):
        self.assertIn("https://git-scm.com/install/windows", self.contract_text)
        self.assertIn("https://git-scm.com/install/mac", self.contract_text)
        self.assertIn("<!-- jarvis:git-pending -->", self.contract_text)

    def test_fresh_baseline_requires_scope_review_and_approval(self):
        for phrase in [
            "git status --short",
            "freshly initialized Jarvis directory",
            "explicitly approve the displayed full baseline",
            "do not use `git add -A`",
            "stage only explicitly approved onboarding sources or defer checkpointing",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_existing_repository_index_isolated_before_checkpoint(self):
        for phrase in [
            "Before any onboarding staging or commit in an existing repository, run `git diff --cached --name-only`",
            "If the initial staged-path output contains any entry",
            "display every staged path, do not alter the index, do not stage, and do not commit",
            "Retain or add exactly one `<!-- jarvis:git-pending -->` marker",
            "defer the checkpoint, and permit normal Jarvis work",
            "Only when the initial staged-path output is empty may you stage the exact explicitly approved onboarding source paths",
            "After staging, run `git diff --cached --name-only` again",
            "contains no path outside the explicitly approved onboarding source paths",
            "the local profile must appear explicitly in that path list whenever its marker changes",
            "Repeat this staged-path comparison after re-staging the local profile and before commit",
            "do not automatically unstage or commit",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_git_can_be_deferred_and_failures_are_recoverable(self):
        for phrase in [
            "intentionally defers Git",
            "Declining installation",
            "does not block personal setup",
            "Report the exact failed command",
            "retain or add exactly one `<!-- jarvis:git-pending -->` marker",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_missing_identity_takes_precedence_over_git_pending(self):
        for phrase in [
            "If Identity is absent or onboarding-required exists",
            "complete or reconcile personal onboarding first",
            "If Identity exists, onboarding-required is absent, and Git-pending exists",
            "skip the personal interview and resume only Local Git checkpoint",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_git_pending_is_cleaned_before_approved_staging_and_restored_on_failure(self):
        for phrase in [
            "remove the Git-pending marker before staging",
            "successful checkpoint contains the clean profile state",
            "Restore or retain `<!-- jarvis:git-pending -->`",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_git_mutation_requires_checkpoint_consent(self):
        for phrase in [
            "wait for explicit acceptance before any Git mutation",
            "`git init -b main`, author configuration, hook-path configuration, staging, or commit",
            "A declined or deferred checkpoint performs no Git mutation",
            "performs no Git mutation",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_withheld_baseline_approval_defers_without_staging(self):
        for phrase in [
            "Withheld or declined baseline approval means no `git add -A` and no commit",
            "continue normal work",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_language_rendering_preserves_existing_custom_text(self):
        for phrase in [
            "render the complete Soul template in the confirmed language",
            "Preserve all existing custom text",
            "recap explicitly identifies a narrow addition",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_git_exit_codes_distinguish_expected_states_from_failures(self):
        for phrase in [
            "`git --version`: exit 0 means Git is available",
            "command-not-found means Git is missing",
            "`git rev-parse --is-inside-work-tree`: exit 0 with output `true` means an existing worktree",
            "only the expected not-a-repository result may lead to `git init -b main`",
            "`git config --get user.name`, `git config --get user.email`, and `git config --get core.hooksPath`: exit 0 with nonempty output means configured",
            "Exit 1 with empty output and no error is the expected missing-value state",
            "`git diff --cached --quiet`: exit 0 means empty; exit 1 means changes",
            "Any other exit code enters Git failure recovery",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_empty_staging_retains_marker_and_success_commits_marker_removal(self):
        for phrase in [
            "Stage the approved scope while Git-pending remains",
            "If the staged diff is empty, retain Git-pending, report that no checkpoint was made, and continue normal work",
            "remove the Git-pending marker, re-stage the local profile, recheck, then commit",
            "leaves no marker-removal change afterward",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_checkpoint_acceptance_materializes_one_marker_before_git_scope(self):
        for phrase in [
            "Explicit checkpoint acceptance authorizes adding or retaining exactly one `<!-- jarvis:git-pending -->` marker",
            "before the first Git mutation and the displayed `git status --short` inventory",
            "The approved scope therefore already includes that marker",
            "Decline, an empty staged diff, or any Git failure retains or restores exactly one Git-pending marker",
        ]:
            self.assertIn(phrase, self.contract_flat)

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
            self.assertIn(phrase, self.contract_flat)

    def test_partial_git_failure_preserves_index_and_requires_approved_recovery(self):
        for phrase in [
            "Immediately run and display `git status --short`",
            "Preserve the existing index; never blindly unstage",
            "stop further Git mutations",
            "Explain the exact staged and unstaged state",
            "offer only an explicit user-approved recovery step",
            "Normal Jarvis work may continue",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_current_work_has_one_live_home_outside_durable_memory(self):
        text = " ".join(self.text.split())
        for phrase in [
            "current priorities and next actions only to the declared `Future work` source",
            "Deduplicate an existing matching item",
            "never receives live state",
        ]:
            self.assertIn(phrase, text)
        self.assertNotIn("`Main focus:`", text)

    def test_stable_onboarding_signals_delegate_to_memory_workflow(self):
        text = " ".join(self.text.split())
        for phrase in [
            "distinct durable preference, constraint, or long-lived model with no better home",
            "present it separately as a `jarvis-memory` candidate",
            "not part of first-run completion",
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
        for name in [
            "new-user.md",
            "second-run.md",
            "git-missing.md",
            "git-install.md",
            "existing-repository.md",
            "staged-index.md",
        ]:
            scenario = (SCENARIOS / name).read_text(encoding="utf-8")
            headings = [
                line[3:] for line in scenario.splitlines() if line.startswith("## ")
            ]
            self.assertEqual(headings, ["Given", "When", "Then", "Forbidden"], name)

    def test_new_user_scenario_keeps_authorities_separate(self):
        scenario = " ".join(
            (SCENARIOS / "new-user.md").read_text(encoding="utf-8").split()
        )
        for phrase in [
            "writes identity and collaboration only to the declared Identity source",
            "writes stable local context only to `CLAUDE.md`",
            "writes current priorities only to the declared Future work source",
            "leaves Durable memory nearly empty",
        ]:
            self.assertIn(phrase, scenario)
        self.assertNotIn("Main focus", scenario)

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
        for name in [
            "new-user.md",
            "second-run.md",
            "git-missing.md",
            "git-install.md",
            "existing-repository.md",
            "staged-index.md",
        ]:
            self.assertTrue((ROOT / "tests/scenarios" / name).is_file(), name)


if __name__ == "__main__":
    unittest.main()
