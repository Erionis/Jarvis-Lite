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


if __name__ == "__main__":
    unittest.main()
