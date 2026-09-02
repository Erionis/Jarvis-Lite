from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class LifecycleSkillsTest(unittest.TestCase):
    def skill(self, name: str) -> str:
        return (ROOT / f"skills/{name}/SKILL.md").read_text(encoding="utf-8")

    def test_briefing_is_local_read_only_and_dependency_free(self):
        text = self.skill("briefing")
        for phrase in ["read-only", "local", "dependency-free"]:
            self.assertIn(phrase, text)
        for role in [
            "Identity",
            "Durable memory",
            "Future work",
            "Daily history",
            "Handoff",
            "Inbox",
        ]:
            self.assertIn(role, text)

    def test_briefing_frontmatter_has_a_valid_trigger_only_description(self):
        text = self.skill("briefing")
        frontmatter = text.split("---", 2)[1].strip().splitlines()
        fields = dict(line.split(": ", 1) for line in frontmatter)

        self.assertEqual(fields["name"], "briefing")
        self.assertTrue(fields["description"].startswith("Use when"))
        for workflow_word in ["read", "resolve", "report", "write"]:
            self.assertNotIn(workflow_word, fields["description"].lower())

    def test_briefing_card_has_the_adoption_headings(self):
        card = (ROOT / "skills/briefing/README.md").read_text(encoding="utf-8")
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

    def test_briefing_recommends_only_from_distinguishing_evidence(self):
        text = " ".join(self.skill("briefing").split())
        for phrase in [
            "explicit priority",
            "explicit deadline",
            "dependency or unblock",
            "unequivocal continuation",
            "concrete next step",
            "why it matters now",
            "assumed urgency",
        ]:
            self.assertIn(phrase, text)

    def test_briefing_turns_equivalent_candidates_into_a_bounded_choice(self):
        text = " ".join(self.skill("briefing").split())
        for phrase in [
            "materially equivalent",
            "canonical interaction rule",
            "at most three",
            "concrete next step",
            "Do not invent a ranking",
        ]:
            self.assertIn(phrase, text)

    def test_briefing_reads_starter_active_sections_as_candidate_sources(self):
        future_work = (ROOT / "starter/To Do.md").read_text(
            encoding="utf-8"
        )
        durable_memory = (ROOT / "starter/99 - Jarvis/memory/MEMORY.md").read_text(
            encoding="utf-8"
        )
        self.assertIn("\n## Active\n", future_work)
        self.assertIn("\n## Active Memory\n", durable_memory)

        text = " ".join(self.skill("briefing").split())
        for phrase in [
            "`Future work` supplies current work and next actions",
            "`Durable memory` supplies retained commitments",
            "Stable preferences, references, and facts are not work candidates",
            "Ignore empty placeholders such as `- [ ]`",
        ]:
            self.assertIn(phrase, text)

    def test_briefing_uses_daily_history_and_handoff_for_continuity(self):
        text = " ".join(self.skill("briefing").split())
        for phrase in [
            "`Daily history` supplies recent unfinished work or an explicit next action",
            "A Handoff is active only when its frontmatter contains `status: active`",
            "Treat each distinct active Handoff with an unfinished next action as a candidate",
            "Do not select between multiple active Handoffs by recency alone",
            "Deduplicate the same semantic focus across sources",
            "At most one visible `Continuity` line",
        ]:
            self.assertIn(phrase, text)

    def test_briefing_reports_unresolved_roles_without_fallback(self):
        text = " ".join(self.skill("briefing").split())
        for role in [
            "Identity",
            "Durable memory",
            "Future work",
            "Daily history",
            "Handoff",
            "Inbox",
        ]:
            self.assertIn(role, text)
        for phrase in [
            "missing, ambiguous, or points to a missing source",
            "Do not discover or substitute another path",
            "one compact `Context incomplete` line",
        ]:
            self.assertIn(phrase, text)

    def test_briefing_limits_conclusions_when_candidate_context_is_unresolved(self):
        text = " ".join(self.skill("briefing").split())
        for phrase in [
            "candidate-bearing role",
            "If any candidate-bearing role is unresolved",
            "do not claim a unique priority",
            "partial evidence",
        ]:
            self.assertIn(phrase, text)

    def test_briefing_keeps_inbox_attention_only(self):
        text = " ".join(self.skill("briefing").split())
        for phrase in [
            "Inbox is attention-only",
            "never a priority candidate",
            "An unresolved Inbox limits only attention and triage coverage",
        ]:
            self.assertIn(phrase, text)

    def test_briefing_output_is_adaptive_and_omits_empty_sections(self):
        text = " ".join(self.skill("briefing").split())
        for phrase in [
            "about five lines",
            "10–12 lines",
            "Omit empty sections",
            "`Attention` only for verified",
        ]:
            self.assertIn(phrase, text)

    def test_briefing_has_no_remote_or_weekday_integration(self):
        text = self.skill("briefing").lower()
        for forbidden in [
            "gitea",
            "\ntea ",
            "git status",
            "monday",
            "tuesday",
            "wednesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
        ]:
            self.assertNotIn(forbidden, text)
        self.assertIn("use only rituals declared in the local profile", text)

    def test_briefing_scenarios_cover_the_approved_behavior(self):
        scenarios = [
            "briefing-clear-priority",
            "briefing-choice",
            "briefing-continuity",
            "briefing-empty",
            "briefing-unresolved",
        ]
        expected_contract = {
            "briefing-clear-priority": [
                "one current priority",
                "deadline",
                "why it matters now",
                "Inbox evidence remains attention-only",
            ],
            "briefing-choice": [
                "materially equivalent",
                "at most three",
                "runtime choice UI",
                "Do not invent a winner",
            ],
            "briefing-continuity": [
                "active handoff",
                "at most one continuity line",
                "Do not show two continuity sections",
            ],
            "briefing-empty": [
                "about five lines",
                "without manufacturing urgency",
                "Do not render empty sections",
            ],
            "briefing-unresolved": [
                "candidate-bearing role cannot be resolved",
                "Context incomplete",
                "avoids claiming a unique priority",
                "Do not search for a fallback path",
            ],
        }
        for name in scenarios:
            path = ROOT / "tests/scenarios" / f"{name}.md"
            self.assertTrue(path.is_file(), name)
            scenario = path.read_text(encoding="utf-8")
            headings = [
                line[3:] for line in scenario.splitlines()
                if line.startswith("## ")
            ]
            self.assertEqual(headings, ["Given", "When", "Then", "Forbidden"])
            for phrase in expected_contract[name]:
                self.assertIn(phrase, scenario, f"{name}: {phrase}")

    def test_memory_has_one_authoritative_home(self):
        text = self.skill("jarvis-memory")
        for phrase in [
            "Durable memory",
            "one authoritative source",
            "propose before semantic deletion",
            "do not copy live state",
        ]:
            self.assertIn(phrase, text)

    def test_memory_frontmatter_has_a_valid_trigger_only_description(self):
        text = self.skill("jarvis-memory")
        frontmatter = text.split("---", 2)[1].strip().splitlines()
        fields = dict(line.split(": ", 1) for line in frontmatter)

        self.assertEqual(set(fields), {"name", "description"})
        self.assertEqual(fields["name"], "jarvis-memory")
        self.assertTrue(fields["description"].startswith("Use when"))
        for workflow_word in ["resolve", "read", "patch", "write", "delete", "commit"]:
            self.assertNotIn(workflow_word, fields["description"].lower())

    def test_memory_card_has_the_adoption_headings(self):
        card = (ROOT / "skills/jarvis-memory/README.md").read_text(encoding="utf-8")
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

    def test_memory_resolves_the_declared_role_or_stops(self):
        text = " ".join(self.skill("jarvis-memory").split())
        for phrase in [
            "Resolve `Durable memory` through the consumer's declared capability map",
            "missing, ambiguous, or points to a missing source",
            "stop without inventing a fallback",
        ]:
            self.assertIn(phrase, text)
        self.assertNotIn("starter/", text)

    def test_memory_gates_semantic_deletion_on_explicit_approval(self):
        text = " ".join(self.skill("jarvis-memory").split())
        for phrase in [
            "propose before semantic deletion",
            "exact fact and its authoritative location",
            "impact and recovery",
            "explicit approval before modifying",
        ]:
            self.assertIn(phrase, text)

    def test_memory_card_keeps_consumer_sources_and_git_out_of_scope(self):
        card = " ".join(
            (ROOT / "skills/jarvis-memory/README.md")
            .read_text(encoding="utf-8")
            .split()
        )
        for phrase in [
            "Consultation is read-only",
            "only the declared `Durable memory` source",
            "does not mutate Identity, Future work, Inbox, or Git",
            "semantic adoption workflow",
        ]:
            self.assertIn(phrase, card)
        self.assertNotIn("starter/", card)

    def test_memory_does_not_mutate_git(self):
        text = " ".join(self.skill("jarvis-memory").split())
        self.assertIn(
            "Do not stage, commit, push, or change Git configuration", text
        )

    def test_save_session_keeps_the_checkpoint_local(self):
        text = self.skill("save-session").lower()
        self.assertIn("never push", text)
        self.assertIn("git status --short", text)
        self.assertIn("future work", text)
        self.assertIn("durable memory", text)
        self.assertIn("local recovery point", text)
        self.assertIn("not an off-device backup", text)

    def test_save_session_frontmatter_has_a_valid_trigger_only_description(self):
        text = self.skill("save-session")
        frontmatter = text.split("---", 2)[1].strip().splitlines()
        fields = dict(line.split(": ", 1) for line in frontmatter)

        self.assertEqual(set(fields), {"name", "description"})
        self.assertEqual(fields["name"], "save-session")
        self.assertTrue(fields["description"].startswith("Use when"))
        for workflow_word in [
            "read",
            "resolve",
            "route",
            "write",
            "stage",
            "commit",
            "push",
        ]:
            self.assertNotIn(workflow_word, fields["description"].lower())

    def test_save_session_card_has_the_adoption_headings(self):
        card = (ROOT / "skills/save-session/README.md").read_text(
            encoding="utf-8"
        )
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

    def test_save_session_resolves_every_persistence_role_without_fallback(self):
        text = " ".join(self.skill("save-session").split())
        for phrase in [
            "Resolve `Daily history`, `Future work`, `Durable memory`, `Handoff`, and `Inbox` through the consumer's declared capability map",
            "An intentionally unavailable optional role disables only its feature",
            "A declared source that is missing or ambiguous makes the checkpoint partial",
            "Do not invent a second history source",
        ]:
            self.assertIn(phrase, text)
        self.assertNotIn("starter/", text)

    def test_save_session_updates_one_idempotent_daily_file(self):
        text = " ".join(self.skill("save-session").split())
        for phrase in [
            "Persist completed chronology only in the declared `Daily history` source",
            "one file per local calendar day",
            "`YYYY/MM/YYYY-MM-DD.md`",
            "`## Done`, `## Decisions`, and `## Closing state`",
            "semantically deduplicate",
            "rewrite `Closing state`",
            "Do not add per-session timestamps or subsections",
            "preserve frontmatter, custom sections, and unrelated content",
            "Re-read the daily file immediately before and after editing",
        ]:
            self.assertIn(phrase, text)
        self.assertNotIn("Completed chronology is response-only", text)

    def test_save_session_routes_future_work_without_normalizing_it(self):
        text = " ".join(self.skill("save-session").split())
        for phrase in [
            "close an existing item only when completion is evidenced",
            "add only explicit unresolved follow-ups",
            "Do not add completed work retroactively",
            "plain bullets and checkboxes",
            "one short actionable item per line",
            "Do not automatically remove or reorder entries",
            "at most five obvious `Future work` cleanup candidates",
        ]:
            self.assertIn(phrase, text)

    def test_save_session_delegates_bounded_durable_signals_to_memory(self):
        text = " ".join(self.skill("save-session").split())
        for phrase in [
            "Delegate at most five stable candidates to `jarvis-memory`",
            "Do not write `Durable memory` directly",
            "Live status, ordinary history, and current tasks are not durable candidates",
            "parallel worker when the runtime supports it",
            "inline fallback",
            "must not touch Git or unrelated files",
            "Approval-only memory proposals remain pending until after the core checkpoint",
        ]:
            self.assertIn(phrase, text)

    def test_save_session_checkpoints_the_dedicated_workspace(self):
        text = " ".join(self.skill("save-session").split()).lower()
        for phrase in [
            "dedicated personal workspace",
            "`git add -A`",
            "5 mib",
            "`save-session: yyyy-mm-dd <focus>`",
            "verify the commit hash and final `git status --short`",
            "do not initialize git, install it, or change git configuration",
        ]:
            self.assertIn(phrase.lower(), text)
        self.assertNotIn("session-owned paths", text)

    def test_save_session_skips_git_when_the_repository_is_busy_or_unprotected(self):
        text = " ".join(self.skill("save-session").split()).lower()
        for phrase in [
            "initial staged index is non-empty",
            "merge, rebase, cherry-pick, revert, bisect, or another Git operation",
            "large-file guard is missing or inactive",
            "skip only the Git recovery point",
            "Do not alter the existing index",
        ]:
            self.assertIn(phrase.lower(), text)

    def test_save_session_treats_an_empty_diff_as_already_safe(self):
        text = " ".join(self.skill("save-session").split())
        for phrase in [
            "staged diff is empty",
            "do not create an empty commit",
            "no new local recovery point was needed",
        ]:
            self.assertIn(phrase, text)

    def test_save_session_preserves_failure_and_concurrent_state(self):
        text = " ".join(self.skill("save-session").split()).lower()
        for phrase in [
            "staging, the guard, or the commit fails",
            "Never reset, discard, or blindly unstage",
            "report the exact index and worktree state",
            "Concurrent changes left after the commit",
            "do not stage them again",
        ]:
            self.assertIn(phrase.lower(), text)

    def test_save_session_finishes_core_checkpoint_before_optional_maintenance(self):
        text = " ".join(self.skill("save-session").split())
        for phrase in [
            "Report the core checkpoint before offering optional maintenance",
            "non-hidden, non-README Inbox items",
            "Move, Keep, or Delete",
            "runtime choice UI",
            "No move or deletion happens without explicit confirmation",
            "`save-session: YYYY-MM-DD maintenance`",
            "No response leaves the completed checkpoint and its recovery point valid",
        ]:
            self.assertIn(phrase, text)

    def test_save_session_keeps_technical_detail_out_of_normal_success(self):
        text = " ".join(self.skill("save-session").split())
        for phrase in [
            "plain language",
            "Do not show commit hashes",
            "local restore point",
            "state what succeeded first",
            "Nothing was deleted",
            "Never claim full conversational memory",
        ]:
            self.assertIn(phrase, text)

    def test_save_session_card_states_mutation_and_remote_boundaries(self):
        card = " ".join(
            (ROOT / "skills/save-session/README.md")
            .read_text(encoding="utf-8")
            .split()
        )
        for phrase in [
            "declared `Daily history` source",
            "declared `Future work` source",
            "through `jarvis-memory`",
            "whole dedicated workspace",
            "local Git recovery point",
            "must not write a second or undeclared history source",
            "must never push",
            "Git is optional",
            "optional Inbox maintenance",
        ]:
            self.assertIn(phrase, card)
        self.assertNotIn("starter/", card)

    def test_save_session_card_bounds_daily_history_mutation_scope(self):
        card = " ".join(
            (ROOT / "skills/save-session/README.md")
            .read_text(encoding="utf-8")
            .split()
        )
        for phrase in [
            "Completed chronology goes only to the declared `Daily history` source",
            "one local-day file",
            "preserves frontmatter, custom sections, and unrelated entries",
        ]:
            self.assertIn(phrase, card)
        self.assertNotIn("Completed chronology is response-only", card)

    def test_save_session_scenarios_cover_the_approved_behavior(self):
        expected_contract = {
            "save-session-first-save": [
                "year and month folders",
                "Done, Decisions, and Closing state",
                "plain-language result",
            ],
            "save-session-same-day": [
                "same daily file",
                "semantically deduplicated",
                "latest one or two lines",
            ],
            "save-session-partial": [
                "declared Daily history source is ambiguous",
                "other safe channels continue",
                "Nothing is deleted",
            ],
            "save-session-git-boundaries": [
                "staged index",
                "large-file guard",
                "content checkpoint remains saved",
            ],
            "save-session-maintenance": [
                "core checkpoint is complete",
                "runtime choice UI",
                "second local recovery point",
            ],
        }
        for name, phrases in expected_contract.items():
            path = ROOT / "tests/scenarios" / f"{name}.md"
            self.assertTrue(path.is_file(), name)
            scenario = path.read_text(encoding="utf-8")
            headings = [
                line[3:] for line in scenario.splitlines()
                if line.startswith("## ")
            ]
            self.assertEqual(headings, ["Given", "When", "Then", "Forbidden"])
            normalized = " ".join(scenario.split())
            for phrase in phrases:
                self.assertIn(phrase, normalized, f"{name}: {phrase}")

    def test_handoff_is_scoped_to_the_declared_source(self):
        text = " ".join(self.skill("handoff").split())
        for phrase in [
            "Resolve `Handoff` through the consumer's declared capability map",
            "Do not create a fallback directory",
            "readable and writable directory",
            "Write only inside the declared `Handoff` source",
            "link other authorities without changing them",
            "Never delete, archive, or expire a handoff automatically",
        ]:
            self.assertIn(phrase, text)

    def test_handoff_uses_one_living_record_per_authoritative_anchor(self):
        text = " ".join(self.skill("handoff").split())
        for phrase in [
            "valid states are `active`, `completed`, and `superseded`",
            "Compare every record",
            "same authoritative reference",
            "A similar filename is insufficient",
            "update the active record in place",
            "runtime choice UI",
            "numbered options",
            "closed match",
            "authoritative match has a missing or unknown status",
            "stop without writing",
        ]:
            self.assertIn(phrase, text)

    def test_handoff_resume_stays_active_and_handles_closed_records(self):
        skill = self.skill("handoff")
        resume = skill.split("## Resume", 1)[1].split(
            "## Complete and supersede", 1
        )[0]
        normalized = " ".join(resume.split())
        for phrase in [
            "no relevant `active` record",
            "closed record",
            "do not reopen it implicitly",
            "new scope",
            "`resumed:`",
            "keep `status: active`",
        ]:
            self.assertIn(phrase, normalized)
        self.assertNotIn("`status: resumed`", skill)

    def test_handoff_complete_and_supersede_are_explicit(self):
        skill = self.skill("handoff")
        section = skill.split("## Complete and supersede", 1)[1].split(
            "## List", 1
        )[0]
        for phrase in [
            "`status: completed`",
            "`completed:`",
            "create the replacement first",
            "`status: superseded`",
            "`superseded:`",
            "`superseded_by:`",
        ]:
            self.assertIn(phrase, section)

    def test_handoff_lifecycle_is_shared_with_briefing_save_and_core(self):
        briefing = " ".join(self.skill("briefing").split())
        for phrase in [
            "readable directory",
            "A missing or unknown status is not active",
            "report it as a discrepancy",
        ]:
            self.assertIn(phrase, briefing)

        save = " ".join(self.skill("save-session").split())
        for phrase in [
            "Resolve `Daily history`, `Future work`, `Durable memory`, `Handoff`, and `Inbox`",
            "current-session handoff",
            "status, ownership, or evidence",
            "existing status is missing or unknown",
            "report the discrepancy and skip this channel",
            "leave every other handoff unchanged",
        ]:
            self.assertIn(phrase, save)

        core = " ".join(
            (ROOT / "starter/99 - Jarvis/system/core-instructions.md")
            .read_text(encoding="utf-8")
            .split()
        )
        for phrase in [
            "remains `active` until work is completed or superseded",
            "`save-session` updates only the handoff used in the current session",
            "never deletes closed records automatically",
        ]:
            self.assertIn(phrase, core)

    def test_save_session_card_adopts_all_five_persistence_roles(self):
        card = " ".join(
            (ROOT / "skills/save-session/README.md")
            .read_text(encoding="utf-8")
            .split()
        )
        self.assertIn("five semantic roles", card)
        self.assertIn("handoff authority", card)

    def test_handoff_card_documents_the_living_lifecycle(self):
        card = " ".join(
            (ROOT / "skills/handoff/README.md").read_text(encoding="utf-8").split()
        )
        for phrase in [
            "create, update, resume, complete, supersede, or list",
            "one living record",
            "readable and writable `Handoff` source",
            "does not change other capabilities or Git",
        ]:
            self.assertIn(phrase, card)

    def test_handoff_scenarios_cover_cross_session_transitions(self):
        expected_contract = {
            "handoff": [
                "same authoritative issue",
                "updates the existing active record in place",
                "does not create a duplicate",
            ],
            "handoff-resume": [
                "keeps status active",
                "remains visible to briefing",
                "completed handoff",
            ],
            "handoff-save-session": [
                "current session",
                "leaves unrelated handoffs unchanged",
                "certain completion evidence",
            ],
            "handoff-ambiguity": [
                "runtime choice UI",
                "numbered options",
                "does not select by recency",
            ],
            "handoff-invalid-source": [
                "readable and writable directory",
                "reports a discrepancy",
                "authoritative match has invalid status",
                "stops without writing",
                "does not create a fallback",
            ],
            "handoff-concurrency": [
                "semantic conflict",
                "preserves non-overlapping changes",
                "does not use last-writer-wins",
            ],
            "handoff-lifecycle": [
                "resume -> briefing -> save-session -> briefing",
                "open path",
                "completed path",
                "remains visible as active continuity",
                "no longer appears as active continuity",
            ],
        }
        for name, phrases in expected_contract.items():
            path = ROOT / "tests/scenarios" / f"{name}.md"
            self.assertTrue(path.is_file(), name)
            scenario = path.read_text(encoding="utf-8")
            headings = [
                line[3:] for line in scenario.splitlines() if line.startswith("## ")
            ]
            self.assertEqual(headings, ["Given", "When", "Then", "Forbidden"])
            normalized = " ".join(scenario.split())
            for phrase in phrases:
                self.assertIn(phrase, normalized, f"{name}: {phrase}")

    def test_new_lifecycle_cards_and_scenarios_exist(self):
        for name in ["handoff"]:
            self.assertTrue((ROOT / f"skills/{name}/README.md").is_file(), name)
            self.assertTrue((ROOT / f"tests/scenarios/{name}.md").is_file(), name)


if __name__ == "__main__":
    unittest.main()
