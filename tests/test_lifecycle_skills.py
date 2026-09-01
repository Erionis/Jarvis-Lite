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

    def test_save_session_does_not_push(self):
        text = self.skill("save-session")
        self.assertIn("never push", text)
        self.assertIn("git status --short", text)
        self.assertIn("Future work", text)
        self.assertIn("Durable memory", text)

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

    def test_save_session_resolves_semantic_roles_including_daily_history(self):
        text = " ".join(self.skill("save-session").split())
        for phrase in [
            "Resolve `Daily history`, `Future work`, and `Durable memory` through the consumer's declared capability map",
            "A missing or ambiguous role disables only that persistence channel",
            "Do not invent a second history source",
        ]:
            self.assertIn(phrase, text)
        self.assertNotIn("starter/", text)

    def test_save_session_persists_completed_chronology_to_declared_daily_history(self):
        text = " ".join(self.skill("save-session").split())
        for phrase in [
            "Persist completed chronology only in the declared `Daily history` source",
            "one file per local calendar day",
            "`YYYY/MM/YYYY-MM-DD.md`",
            "append or update one compact session entry without overwriting unrelated entries",
        ]:
            self.assertIn(phrase, text)
        self.assertNotIn("Completed chronology is response-only", text)

    def test_save_session_inventory_and_future_work_are_evidence_scoped(self):
        text = " ".join(self.skill("save-session").split())
        for phrase in [
            "completed outcomes, explicit future items, stable signals, files actually changed in the session, and the current Git boundary",
            "Deduplicate and route only explicit unresolved follow-ups",
            "never deletion, reordering, or rewriting of unrelated entries",
            "If ownership or target is unclear, show a proposal and wait",
        ]:
            self.assertIn(phrase, text)

    def test_save_session_delegates_durable_signals_to_memory(self):
        text = " ".join(self.skill("save-session").split())
        for phrase in [
            "Route stable signals through `jarvis-memory`",
            "Do not write `Durable memory` directly",
            "Live state and ordinary history must not be promoted as durable facts",
        ]:
            self.assertIn(phrase, text)

    def test_save_session_stages_only_verified_exact_paths(self):
        text = " ".join(self.skill("save-session").split())
        for phrase in [
            "Stage exact session-owned paths only",
            "Never use `git add -A` or `git add .`",
            "Verify the staged path set before committing",
        ]:
            self.assertIn(phrase, text)

    def test_save_session_stops_for_a_preexisting_staged_index(self):
        text = " ".join(self.skill("save-session").split())
        for phrase in [
            "If the initial index is non-empty",
            "do not mutate the index and do not commit",
            "pre-existing work",
        ]:
            self.assertIn(phrase, text)

    def test_save_session_discloses_final_git_state_and_failure_recovery(self):
        text = " ".join(self.skill("save-session").split())
        for phrase in [
            "After a successful commit, report its hash and run `git status --short` again",
            "If staging or commit fails",
            "disclose the resulting index and worktree state",
            "recovery path limited to paths this workflow staged",
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
            "safe local Git commit",
            "must not write a second or undeclared history source",
            "mutate unrelated files or index entries",
            "must never push",
            "Git is optional",
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
            "preserves unrelated entries",
        ]:
            self.assertIn(phrase, card)
        self.assertNotIn("Completed chronology is response-only", card)

    def test_ingest_is_report_only_and_resolves_declared_inbox(self):
        text = " ".join(self.skill("ingest").split())
        for phrase in [
            "Resolve `Inbox` through the consumer's declared capability map",
            "report-only",
            "Do not create, modify, move, rename, or delete any file",
            "relative Markdown links",
            "confidence",
        ]:
            self.assertIn(phrase, text)

    def test_handoff_is_scoped_to_the_declared_source(self):
        text = " ".join(self.skill("handoff").split())
        for phrase in [
            "Resolve `Handoff` through the consumer's declared capability map",
            "Do not create a fallback directory",
            "status: active",
            "status: resumed",
            "Never delete a handoff as a side effect",
        ]:
            self.assertIn(phrase, text)

    def test_new_lifecycle_cards_and_scenarios_exist(self):
        for name in ["ingest", "handoff"]:
            self.assertTrue((ROOT / f"skills/{name}/README.md").is_file(), name)
            self.assertTrue((ROOT / f"tests/scenarios/{name}.md").is_file(), name)


if __name__ == "__main__":
    unittest.main()
