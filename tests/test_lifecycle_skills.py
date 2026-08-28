from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class LifecycleSkillsTest(unittest.TestCase):
    def skill(self, name: str) -> str:
        return (ROOT / f"skills/{name}/SKILL.md").read_text(encoding="utf-8")

    def test_briefing_is_read_only(self):
        text = self.skill("briefing")
        self.assertIn("read-only", text)
        self.assertIn("Future work", text)
        self.assertIn("Inbox", text)

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

    def test_briefing_does_not_choose_between_unordered_candidates(self):
        text = " ".join(self.skill("briefing").split())
        for phrase in [
            "If two or more distinct candidates are explicitly marked",
            "no single current priority is grounded",
            "surface the competing candidate titles and their source roles",
            "Do not rank or choose one",
        ]:
            self.assertIn(phrase, text)

    def test_briefing_can_report_explicit_inbox_blocker_evidence(self):
        text = " ".join(self.skill("briefing").split())
        for phrase in [
            "An explicit dependency, constraint, or waiting statement in Inbox may be reported",
            "identify Inbox as the evidence source",
            "Do not infer a blocker from an Inbox idea",
            "Never classify, move, integrate, or mutate Inbox content",
        ]:
            self.assertIn(phrase, text)

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

    def test_save_session_resolves_semantic_roles_without_history_fallbacks(self):
        text = " ".join(self.skill("save-session").split())
        for phrase in [
            "Resolve `Future work` and `Durable memory` through the consumer's declared capability map",
            "A missing or ambiguous role disables only that persistence channel",
            "Do not invent `Session Log`, daily notes, or any other history file",
        ]:
            self.assertIn(phrase, text)
        self.assertNotIn("starter/", text)

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
            "declared `Future work` source",
            "through `jarvis-memory`",
            "safe local Git commit",
            "must not write an undeclared history source",
            "mutate unrelated files or index entries",
            "must never push",
            "Git is optional",
        ]:
            self.assertIn(phrase, card)
        self.assertNotIn("starter/", card)


if __name__ == "__main__":
    unittest.main()
