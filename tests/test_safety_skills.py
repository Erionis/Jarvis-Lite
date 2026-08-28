from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILLS = ROOT / "skills"


class SafetySkillsTest(unittest.TestCase):
    def read(self, name: str) -> str:
        path = SKILLS / name / "SKILL.md"
        return path.read_text(encoding="utf-8") if path.is_file() else ""

    def read_card(self, name: str) -> str:
        path = SKILLS / name / "README.md"
        return path.read_text(encoding="utf-8") if path.is_file() else ""

    def test_doctor_is_evidence_based_and_read_only(self):
        text = self.read("jarvis-doctor")
        for phrase in ["read-only", "evidence", "unverifiable", "optional"]:
            self.assertIn(phrase, text)
        self.assertNotIn("apply the fix automatically", text.lower())

    def test_doctor_frontmatter_has_a_trigger_only_description(self):
        text = self.read("jarvis-doctor")
        frontmatter = text.split("---", 2)[1].strip().splitlines() if text else []
        fields = dict(line.split(": ", 1) for line in frontmatter)

        self.assertEqual(set(fields), {"name", "description"})
        self.assertEqual(fields["name"], "jarvis-doctor")
        self.assertTrue(fields["description"].startswith("Use when"))
        for workflow_word in [
            "read",
            "resolve",
            "inspect",
            "report",
            "write",
            "repair",
            "commit",
        ]:
            self.assertNotIn(workflow_word, fields["description"].lower())

    def test_doctor_card_has_the_exact_adoption_headings(self):
        card = self.read_card("jarvis-doctor")
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

    def test_doctor_resolves_declared_roles_without_fallbacks(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for phrase in [
            "Resolve every capability role from the consumer's declared capability map",
            "Do not use starter paths, filesystem discovery, or guessed fallbacks",
            "missing or ambiguous",
            "declared target exists and is readable",
            "A declared missing target is evidence",
            "do not silently create it",
            "A missing optional capability is not automatically an error",
        ]:
            self.assertIn(phrase, text)
        self.assertNotIn("starter/", text)

    def test_doctor_preserves_local_extensions(self):
        text = " ".join(self.read("jarvis-doctor").split())
        self.assertIn(
            "Preserve local extensions outside the common contract", text
        )
        self.assertIn("Do not normalize or remove them", text)

    def test_doctor_stale_claim_rule_has_no_age_threshold(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for phrase in [
            "A past date alone is not stale",
            "current-state claim",
            "its own date or freshness statement no longer supports present-tense use",
            "declared evidence cannot establish it",
            "Do not invent a universal age threshold",
        ]:
            self.assertIn(phrase, text)

    def test_doctor_contradiction_rule_requires_compatible_scope_and_time(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for phrase in [
            "two mutually incompatible claims about the same subject",
            "compatible scope and time",
            "Different dates or scopes are not automatically contradictions",
            "If scope cannot be resolved, label the finding `unverifiable`",
        ]:
            self.assertIn(phrase, text)

    def test_doctor_checks_only_local_relative_markdown_links(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for phrase in [
            "Ignore external URLs and fragment-only anchors",
            "Resolve each local relative Markdown link relative to its declaring source",
            "literal link",
            "resolved missing target",
        ]:
            self.assertIn(phrase, text)

    def test_doctor_uses_the_three_exact_finding_labels(self):
        text = " ".join(self.read("jarvis-doctor").split())
        self.assertIn(
            "Use exactly one label: `error`, `unverifiable`, or `optional evolution`",
            text,
        )
        for label in ["error", "unverifiable", "optional evolution"]:
            self.assertIn(f"`{label}`:", text)

    def test_doctor_findings_have_evidence_and_proposed_next_step_fields(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for field in [
            "Label",
            "Capability role",
            "Source path and location",
            "Observed evidence",
            "Expected contract or verification limit",
            "Proposed next step",
        ]:
            self.assertIn(f"`{field}`", text)
        self.assertIn("explicitly not applied", text)

    def test_doctor_respects_the_first_run_gate(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for phrase in [
            "Identity is missing",
            "onboarding marker is present",
            "do not bypass first run",
            "missing non-Identity capability",
            "does not authorize a fallback source",
        ]:
            self.assertIn(phrase, text)

    def test_doctor_reports_verified_scope_without_overclaiming_health(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for phrase in [
            "Report inspected scope and count findings only after verifying what was read",
            "which roles, sources, and link scope were checked",
            "Do not claim the whole installation is healthy",
        ]:
            self.assertIn(phrase, text)

    def test_doctor_has_a_total_no_write_or_git_boundary(self):
        text = " ".join(self.read("jarvis-doctor").split())
        for phrase in [
            "Do not edit, create, rename, move, delete, or install anything",
            "Do not generate a report file",
            "Do not stage, commit, push, or configure Git",
            "never perform repair as a side effect",
        ]:
            self.assertIn(phrase, text)

    def test_doctor_card_keeps_adoption_read_only_and_semantic(self):
        card = " ".join(self.read_card("jarvis-doctor").split())
        for phrase in [
            "semantic capability map",
            "declared sources",
            "None. The audit is read-only",
            "preserve local extensions",
            "does not apply repairs",
        ]:
            self.assertIn(phrase, card)
        self.assertNotIn("starter/", card)


if __name__ == "__main__":
    unittest.main()
