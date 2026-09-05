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
                "Starting point",
                "Identity",
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

    def test_interview_uses_coherent_interactions_without_a_rigid_question_limit(self):
        text = " ".join(self.read_interview().split())
        self.assertIn("four decision moments", text)
        for phrase in [
            "one coherent interaction at a time",
            "small group of related closed questions",
            "Allow multiple answers when several choices can be true",
            "Keep mutually exclusive choices single-select",
            "Keep free-form or nuanced reasoning conversational",
        ]:
            self.assertIn(phrase, text)
        self.assertNotIn("one question or decision at a time", text)

    def test_opening_groups_only_the_independent_setup_choices(self):
        text = " ".join(self.read_interview().split())
        for phrase in [
            "The first user-facing interaction combines this opening with Use domain and Starting point",
            "only when the runtime can group related questions",
            "contains only a short user-relevant orientation or factual reflection",
            "followed by the current coherent question or decision group",
            "Do not group a dependent question before its context exists",
        ]:
            self.assertIn(phrase, text)

    def test_interview_maps_native_question_tools_and_capability_fallbacks(self):
        text = " ".join(self.read_interview().split())
        for phrase in [
            "`AskUserQuestion` in Claude Code",
            "`request_user_input` in Codex",
            "when the active runtime exposes it",
            "If the native UI cannot group questions",
            "If it cannot select multiple answers",
            "short numbered choices",
        ]:
            self.assertIn(phrase, text)

    def test_interview_never_forces_free_form_input_into_a_fake_choice(self):
        text = " ".join(self.read_interview().split())
        for phrase in [
            "at least two genuinely distinct options",
            "Never create a one-option placeholder",
            "ask it directly in normal conversation",
            "preserve all alternatives in prose",
        ]:
            self.assertIn(phrase, text)
        self.assertIn("I’ll type it out", text)

    def test_multiple_confirmed_domains_have_a_deterministic_structure_default(self):
        text = " ".join(self.read_interview().split())
        for phrase in [
            "two or more selected domains each have confirmed stable context",
            "propose one separate numbered domain folder per domain by default",
            "Start lighter",
            "Do not ask another question merely to decide whether to separate them",
            "Learn while working",
        ]:
            self.assertIn(phrase, text)

    def test_use_domain_preserves_combinations_with_single_select_runtimes(self):
        text = " ".join(self.read_interview().split())
        for phrase in [
            "let the user select one or more",
            "free-form **Other** option",
            "use **Other** to name the combination",
            "If neither multi-select nor a free-form **Other** option is available",
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

    def test_pending_marker_does_not_create_a_user_facing_decision(self):
        text = self.contract_flat
        for phrase in [
            "The approved local restore-point outcome covers adding or retaining exactly one",
            "Do not ask for marker-only approval",
            "The marker is implementation state",
            "report only whether local protection is ready or still pending",
        ]:
            self.assertIn(phrase, text)

    def test_marker_lifecycle_tracks_restore_point_state(self):
        text = self.contract_flat
        for phrase in [
            "A successful commit contains no Git-pending marker",
            "Failure or deferral retains or restores exactly one",
            "leaves no marker-only worktree change",
        ]:
            self.assertIn(phrase, text)

    def test_soul_rendering_translates_the_complete_template(self):
        text = " ".join(self.text.split())
        self.assertIn(
            "translate every prose heading and sentence while preserving the template's semantic structure",
            text,
        )

    def test_archive_is_one_workspace_root_path(self):
        text = " ".join(self.text.split())
        self.assertIn(
            "Create the single `98 - Archive/README.md` at the approved workspace root",
            text,
        )
        self.assertNotIn("Create `98 - Archive/README.md` in every approved path", text)

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
            "unexpected-fresh-content.md",
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
            "Approval covers only the literal personal paths, content summary, folders, templates, and local restore-point outcome displayed in that recap",
            "Create the single `98 - Archive/README.md` at the approved workspace root",
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

    def test_coherent_interaction_and_idempotency_rules_are_explicit(self):
        for phrase in [
            "Use one coherent interaction at a time",
            "Treat semantic equivalents of `Start Jarvis` in any language as the same trigger",
            "For the default starter, if `99 - Jarvis/memory/soul.md` already exists, do not replace it",
            "Remove `<!-- jarvis:onboarding-required -->` only after",
            "Preserve every non-marker line",
            "render the complete Soul template in the confirmed language",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_journey_scenarios_allow_related_grouping_but_forbid_form_like_batches(self):
        new_user = " ".join(self.read_scenario("new-user.md").split())
        progressive = " ".join(self.read_scenario("progressive-user.md").split())
        for phrase in [
            "groups the related Use domain and Starting point decisions",
            "allows multiple use domains when the runtime supports multi-select",
            "Do not batch unrelated or dependent questions",
        ]:
            self.assertIn(phrase, new_user)
        for phrase in [
            "one coherent interaction",
            "a small related decision group when useful",
            "does not turn the conversation into a form",
        ]:
            self.assertIn(phrase, progressive)

        full_map = " ".join(self.read_scenario("full-map-user.md").split())
        for phrase in [
            "separate numbered folder for each confirmed domain by default",
            "Start lighter",
            "without another structure question",
        ]:
            self.assertIn(phrase, full_map)

    def test_git_and_os_detection_are_automatic_read_only_preflight(self):
        text = " ".join(self.text.split())
        for phrase in [
            "Before asking any interview question, run `git --version`",
            "Detect the operating system automatically",
            "Do not ask the user which operating system they use when it can be detected",
            "These preflight checks are read-only and require no consent",
        ]:
            self.assertIn(phrase, text)

    def test_setup_card_approves_a_plain_language_local_restore_point(self):
        text = " ".join(self.read_interview().split())
        for phrase in [
            "local restore point",
            "Nothing is published or sent online",
            "authorizes the local restore-point outcome for a verified fresh Lite package",
        ]:
            self.assertIn(phrase, text)

    def test_verified_fresh_package_checkpoint_needs_no_second_approval(self):
        text = self.contract_flat
        for phrase in [
            "coherent Jarvis Lite release manifest and seed state",
            "`package_paths`",
            "actual regular-file inventory",
            "shipped package paths plus the literal personal paths approved during onboarding",
            "no separate checkpoint or baseline-inventory approval",
            "Only this verified fresh-package branch may use `git add -A` automatically",
        ]:
            self.assertIn(phrase, text)

    def test_missing_git_is_named_explained_and_installed_after_consent(self):
        text = self.contract_flat
        for phrase in [
            "Name Git",
            "widely used open source tool",
            "keeps a local history of file changes",
            "official source",
            "creates no account",
            "does not publish or send the user's documents online",
            "Name any broader system package",
            "Ask for explicit installation approval",
            "After approval, attempt the verified official command",
            "guide the user one step at a time",
        ]:
            self.assertIn(phrase, text)

    def test_pending_marker_is_internal_restore_point_state(self):
        text = self.contract_flat
        for phrase in [
            "approved local restore-point outcome covers adding or retaining exactly one `<!-- jarvis:git-pending -->` marker",
            "Do not ask for marker-only approval",
            "Failure or deferral retains or restores exactly one `<!-- jarvis:git-pending -->` marker",
        ]:
            self.assertIn(phrase, text)

    def test_unexpected_fresh_content_scenario_defers_before_git_init(self):
        scenario = " ".join(
            self.read_scenario("unexpected-fresh-content.md").split()
        )
        for phrase in [
            "outside `package_paths` and the approved onboarding paths",
            "does not run `git init`",
            "does not stage or commit anything",
            "plain language",
            "Ordinary Jarvis work can continue",
        ]:
            self.assertIn(phrase, scenario)

    def test_git_install_help_is_specific_transparent_and_separately_approved(self):
        text = self.contract_flat
        for phrase in [
            "Missing Git never blocks personal onboarding or ordinary Jarvis work",
            "Ask for explicit installation approval without displaying the raw command by default",
            "After approval, attempt the verified official command yourself",
            "Installation approval authorizes only that displayed software or system package",
            "Re-run `git --version` after the installer returns",
            "guide the user one step at a time",
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
            "On Windows run `winget --version`; without WinGet use only the official Windows guide",
            "On Linux resolve `/etc/os-release` and confirm that the matching package manager command exists",
            "On macOS confirm that `xcode-select` exists",
            "Apple Command Line Tools",
        ]:
            self.assertIn(phrase, text)

    def test_first_trial_follows_a_terminal_git_result(self):
        text = self.contract_flat
        for phrase in [
            "Continue to Local restore point",
            "After the local restore point is completed, deferred, unavailable, or safely failed",
            "continue with the First trial and Continuity guide",
        ]:
            self.assertIn(phrase, text)

    def test_git_checkpoint_uses_confirmed_name_and_lite_local_email(self):
        text = self.contract_flat
        for phrase in [
            "Reuse an existing nonempty repository-local or inherited author name",
            "Set only a missing local name to the confirmed Identity name",
            "Set only a missing local email to `jarvis@vault.local`",
            "do not expose author values",
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
            "Reuse `.githooks` when already configured",
            "Preserve any other nonempty custom hook path",
            "the Lite large-file guard was not activated",
        ]:
            self.assertIn(phrase, text)

    def test_git_missing_path_is_platform_specific(self):
        self.assertIn("https://git-scm.com/install/windows", self.contract_text)
        self.assertIn("https://git-scm.com/install/mac", self.contract_text)
        self.assertIn("<!-- jarvis:git-pending -->", self.contract_text)

    def test_fresh_baseline_is_automatic_only_after_inventory_verification(self):
        for phrase in [
            "git status --short",
            "Before `git init`",
            "Every actual path is in the shipped package paths plus the literal personal paths approved during onboarding",
            "Only this verified fresh-package branch may use `git add -A` automatically",
            "do not expose author values, hook configuration, status output, or another Git choice",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_existing_repository_index_isolated_before_checkpoint(self):
        for phrase in [
            "The setup-card approval does not authorize changes to an existing repository",
            "If the initial staged-path set is nonempty",
            "leave the index byte-for-byte unchanged",
            "Show raw Git state only on request",
            "With an empty initial index",
            "request one explicit approval",
            "use `git add -- <approved-path>...`",
            "verify that the staged set equals the approved literal set",
            "Any unrelated or mismatched path defers the restore point without index cleanup",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_git_can_be_deferred_and_failures_are_recoverable(self):
        for phrase in [
            "installation is declined, fails, or is unsupported",
            "Missing Git never blocks personal onboarding or ordinary Jarvis work",
            "local restore points are not active yet",
            "Failure or deferral retains or restores exactly one `<!-- jarvis:git-pending -->` marker",
            "ordinary work can continue",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_missing_identity_takes_precedence_over_git_pending(self):
        for phrase in [
            "If Identity is absent or onboarding-required exists",
            "complete or reconcile personal onboarding first",
            "If Identity exists, onboarding-required is absent, and Git-pending exists",
            "skip the personal interview and resume only Local restore point",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_git_pending_is_cleaned_before_approved_staging_and_restored_on_failure(self):
        for phrase in [
            "Remove the Git-pending marker, re-stage only the local profile",
            "A successful commit contains no Git-pending marker",
            "Failure or deferral retains or restores exactly one `<!-- jarvis:git-pending -->` marker",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_git_mutation_authorization_depends_on_repository_state(self):
        for phrase in [
            "approved setup card authorizes the local restore-point outcome only for a verified fresh Lite package",
            "need no separate checkpoint or baseline-inventory approval",
            "Software installation changes the host and always needs its own explicit approval",
            "The setup-card approval does not authorize changes to an existing repository",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_unexpected_content_defers_without_initializing_or_staging(self):
        for phrase in [
            "If any identity check fails or an unexpected path exists",
            "do not run `git init`, configure Git, stage, or commit",
            "Preserve all content",
            "Ordinary Jarvis work may continue",
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
            "`git rev-parse --is-inside-work-tree`: exit 0 with `true` means an existing worktree",
            "Only exit 128 with an explicit not-a-repository error is the expected missing-repository state",
            "Exit 1 with empty output and no error means missing",
            "exit 1 authorizes the commit",
            "exit 0 means there is nothing to save",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_empty_staging_retains_marker_and_success_commits_marker_removal(self):
        for phrase in [
            "Ensure exactly one Git-pending marker",
            "exit 0 means there is nothing to save",
            "Failure or deferral retains or restores exactly one",
            "A successful commit contains no Git-pending marker",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_setup_card_materializes_one_marker_before_fresh_git_scope(self):
        for phrase in [
            "approved local restore-point outcome covers adding or retaining exactly one `<!-- jarvis:git-pending -->` marker",
            "During an approved first run, add the marker before the first Git mutation",
            "Do not ask for marker-only approval",
            "Failure or deferral retains or restores exactly one",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_successful_commit_discloses_final_git_state(self):
        for phrase in [
            "After a commit, run `git status --short`",
            "Empty output is evidence of a clean restore point",
            "Report simply that the local restore point is ready",
            "Offer the commit and status details only when requested",
            "Report the affected paths in plain language",
            "make no automatic cleanup or extra commit",
            "require explicit approval before recovery",
        ]:
            self.assertIn(phrase, self.contract_flat)

    def test_partial_git_failure_preserves_index_and_requires_approved_recovery(self):
        for phrase in [
            "Stop further Git mutations",
            "preserve the existing index; never blindly unstage",
            "local protection is pending and ordinary work can continue",
            "Offer exact commands, staged and unstaged state",
            "one bounded recovery action as technical details",
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
            "unexpected-fresh-content.md",
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

    def test_git_defer_scenarios_keep_marker_state_internal(self):
        for name in ["git-missing.md", "staged-index.md"]:
            scenario = " ".join(self.read_scenario(name).split())
            self.assertNotIn("marker-only approval", scenario, name)
            self.assertIn("git-pending", scenario.lower(), name)

    def test_scenarios_exist(self):
        for name in [
            "new-user.md",
            "second-run.md",
            "git-missing.md",
            "git-install.md",
            "unexpected-fresh-content.md",
            "existing-repository.md",
            "staged-index.md",
        ]:
            self.assertTrue((ROOT / "tests/scenarios" / name).is_file(), name)


if __name__ == "__main__":
    unittest.main()
