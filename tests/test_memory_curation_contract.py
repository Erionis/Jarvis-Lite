from __future__ import annotations

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class MemoryCurationContractTest(unittest.TestCase):
    def read(self, relative: str) -> str:
        return (ROOT / relative).read_text(encoding="utf-8")

    def flat(self, relative: str) -> str:
        return " ".join(self.read(relative).split())

    def test_memory_is_a_small_semantic_curator_not_a_read_gateway(self):
        text = self.read("skills/jarvis-memory/SKILL.md")
        self.assertLessEqual(len(re.findall(r"\b\w+[\w'-]*\b", text)), 900)
        text = " ".join(text.split())
        for phrase in [
            "semantic curator of `Identity` and `Durable memory`",
            "not a global gateway",
            "Direct reads stay direct",
            "Consultation is read-only",
        ]:
            self.assertIn(phrase, text)

    def test_memory_classifies_every_signal_into_one_authoritative_home(self):
        text = self.flat("skills/jarvis-memory/SKILL.md")
        for phrase in [
            "stable local context",
            "project-owned knowledge",
            "Future work",
            "Daily history",
            "live state",
            "secret store or a protected local file",
            "one authoritative home",
        ]:
            self.assertIn(phrase, text)

    def test_every_identity_or_memory_mutation_is_preview_first(self):
        text = self.flat("skills/jarvis-memory/SKILL.md")
        for phrase in [
            "An explicit request authorizes a proposal, not a write",
            "semantic destination",
            "path only when useful or requested",
            "before/after",
            "`Save`, `Edit`, or `Do not save`",
            "no write before confirmation",
            "Silence",
            "double confirmation",
        ]:
            self.assertIn(phrase, text)

    def test_memory_proactivity_and_delegation_are_bounded(self):
        text = self.flat("skills/jarvis-memory/SKILL.md")
        for phrase in [
            "at most one high-value stable candidate",
            "natural boundary",
            "at most five candidates",
            "does not block the calling workflow",
            "caller retains ownership",
            "Git stays outside this skill",
        ]:
            self.assertIn(phrase, text)

    def test_memory_structure_grows_progressively_without_duplicating_projects(self):
        text = self.flat("skills/jarvis-memory/SKILL.md")
        for phrase in [
            "recurrence and durable density",
            "indexed detail note",
            "never create it automatically",
            "project hub remains authoritative",
            "orientation and a pointer",
            "Raw uploads stay in `Inbox`",
            "preserve original files",
            "Do not impose a universal `Projects/raw/deliverables` hierarchy",
        ]:
            self.assertIn(phrase, text)

    def test_memory_rereads_before_write_and_stops_on_semantic_overlap(self):
        text = self.flat("skills/jarvis-memory/SKILL.md")
        for phrase in [
            "Re-read the target immediately before the patch",
            "preserve non-overlapping changes",
            "semantic overlap",
            "last-writer-wins",
            "do not write",
        ]:
            self.assertIn(phrase, text)

    def test_secret_handling_warns_by_default_but_allows_informed_override(self):
        text = self.flat("skills/jarvis-memory/SKILL.md")
        for phrase in [
            "do not repeat the value",
            "verified as excluded from Git",
            "Git history and future remotes",
            "exact path",
            "second explicit confirmation",
            "separate user turn after the warning",
            "initial request cannot satisfy this second gate",
            "runtime or tool history may retain the supplied value",
            "Do not display the value in previews, final responses, or diagnostic commands",
            "save anyway",
        ]:
            self.assertIn(phrase, text)

        guardrails = self.flat("starter/99 - Jarvis/system/core/guardrails.md")
        self.assertIn("separate user turn after the warning", guardrails)
        self.assertIn("runtime or tool history may retain the supplied value", guardrails)
        self.assertIn("without the informed override below", guardrails)

    def test_save_session_runs_memory_after_the_core_checkpoint(self):
        text = self.flat("skills/save-session/SKILL.md")
        for phrase in [
            "Resolve `Identity`",
            "Complete and report the core checkpoint before memory proposals",
            "same agent owns all writes",
            "parallel read-only worker",
            "at most five stable candidates",
            "at most one structural opportunity already observed in this session",
            "Do not scan the workspace",
            "separate task",
            "second local recovery point only when an approved proposal changed files",
        ]:
            self.assertIn(phrase, text)

    def test_save_session_verifies_restore_coverage_by_operation(self):
        text = self.flat("skills/save-session/SKILL.md")
        for phrase in [
            "exact list of files changed",
            "operation type and pre-phase state",
            "git ls-files --error-unmatch",
            "git diff --quiet HEAD --",
            "git cat-file -e",
            "defer the recovery conclusion",
            "commit result matches final `HEAD`",
            "For a deletion",
            "For a rename",
            "intentionally unversioned",
        ]:
            self.assertIn(phrase, text)

    def test_core_and_doctor_share_the_same_memory_authority(self):
        core = self.flat("starter/99 - Jarvis/system/core-instructions.md")
        guardrails = self.flat("starter/99 - Jarvis/system/core/guardrails.md")
        doctor = self.flat("skills/jarvis-doctor/SKILL.md")
        for phrase in [
            "only operational curator of `Identity` and `Durable memory`",
            "Direct reads remain available",
        ]:
            self.assertIn(phrase, core)
        self.assertIn("preview and explicit confirmation before every change", guardrails)
        self.assertIn(
            "`jarvis-memory` remains the only curator of Identity and Durable memory",
            doctor,
        )
        self.assertIn("separate `jarvis-memory` request with a preview", doctor)

    def test_horizon_test_precedes_classification(self):
        text = self.flat("skills/jarvis-memory/SKILL.md")
        for phrase in [
            "does not select the source",
            "horizon",
            "end date",
            "do not propose `Durable memory`",
        ]:
            self.assertIn(phrase, text)
        self.assertLess(text.index("horizon"), text.index("one authoritative home"))
        self.assertRegex(
            self.read("skills/jarvis-memory/SKILL.md"),
            r"(?m)^description:.*durable fact",
        )

    def test_repository_and_starter_ignore_common_secret_files(self):
        for relative in [".gitignore", "starter/.gitignore"]:
            lines = self.read(relative).splitlines()
            for pattern in [".env", ".env.*", "*.pem", "*.key", "credentials.json"]:
                self.assertIn(pattern, lines, f"{pattern} missing from {relative}")

    def test_behavioral_scenarios_cover_the_memory_contract(self):
        expected = {
            "memory-preview": [
                "Identity",
                "Save, Edit, or Do not save",
                "No file changes before confirmation",
            ],
            "memory-consultation": [
                "reads the declared sources directly",
                "read-only",
                "does not turn jarvis-memory into a mandatory gateway",
            ],
            "memory-project-growth": [
                "raw uploads remain in Inbox",
                "existing project hub remains authoritative",
                "indexed detail note",
                "never automatic",
            ],
            "memory-concurrency": [
                "non-overlapping concurrent edit",
                "semantic overlap",
                "does not write",
            ],
            "memory-time-bounded": [
                "end date",
                "Future work",
                "project note",
                "does not propose durable memory",
            ],
            "memory-secrets": [
                "verified Git-ignored destination",
                "second explicit confirmation",
                "runtime or tool history may retain the supplied value",
                "does not display the secret",
            ],
            "save-session-memory": [
                "core checkpoint first",
                "at most five stable candidates",
                "one observed structural improvement",
                "operation-aware verification",
            ],
        }
        for name, phrases in expected.items():
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


if __name__ == "__main__":
    unittest.main()
