from __future__ import annotations

import os
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STARTER = ROOT / "starter"
MARKER = "<!-- jarvis:onboarding-required -->"

REQUIRED_STARTER_FILES = (
    ".githooks/pre-commit",
    "00 - Inbox/README.md",
    "01 - Diary/README.md",
    "99 - Jarvis/Templates/README.md",
    "99 - Jarvis/handoffs/README.md",
    "99 - Jarvis/memory/MEMORY.md",
    "99 - Jarvis/system/core-instructions.md",
    "99 - Jarvis/system/core/guardrails.md",
    "99 - Jarvis/system/soul-template.md",
    ".gitignore",
    "AGENTS.md",
    "CLAUDE.md",
    "START-HERE.md",
    "To Do.md",
)


class StarterContractTest(unittest.TestCase):
    def read(self, relative: str) -> str:
        return (STARTER / relative).read_text(encoding="utf-8")

    def test_starter_uses_the_english_numbered_layout(self):
        for relative in REQUIRED_STARTER_FILES:
            self.assertTrue((STARTER / relative).is_file(), relative)

        for rejected in [
            "jarvis",
            "01 - Diario",
            "99 - Jarvis/sistema",
        ]:
            self.assertFalse((STARTER / rejected).exists(), rejected)

    def test_adapters_load_one_canonical_contract(self):
        agents = self.read("AGENTS.md")
        claude = self.read("CLAUDE.md")
        contract = "99 - Jarvis/system/core-instructions.md"
        self.assertIn(contract, agents)
        self.assertIn(contract, claude)
        self.assertNotIn("## Bootstrap", agents)

    def test_local_profile_declares_visible_capabilities(self):
        profile = self.read("CLAUDE.md")
        self.assertEqual(profile.count(MARKER), 1)
        for role, path in {
            "Identity": "99 - Jarvis/memory/soul.md",
            "Durable memory": "99 - Jarvis/memory/MEMORY.md",
            "Future work": "To Do.md",
            "Daily history": "01 - Diary/",
            "Handoff": "99 - Jarvis/handoffs/",
            "Inbox": "00 - Inbox/",
        }.items():
            self.assertIn(f"| {role} | `{path}` |", profile)

    def test_local_profile_owns_stable_context_without_identity_or_future_work(self):
        profile = self.read("CLAUDE.md")
        normalized = " ".join(profile.split())
        for heading in [
            "## Use domains",
            "## Stable context",
            "## Sources and tools",
            "## Local heuristics",
            "## Rituals",
            "## Local assets",
            "## Overrides",
        ]:
            self.assertIn(heading, profile)

        for rejected in ["Name:", "Preferred language:", "Main focus:"]:
            self.assertNotIn(rejected, profile)

        self.assertIn(
            "Current priorities and next actions belong in `To Do.md`", normalized
        )
        self.assertIn(
            "Identity and collaboration preferences belong in the declared `Identity` source",
            normalized,
        )

    def test_local_overrides_do_not_duplicate_identity_preferences(self):
        profile = " ".join(self.read("CLAUDE.md").split())
        self.assertIn(
            "Overrides are workspace-specific operational exceptions, not cross-domain collaboration preferences",
            profile,
        )

    def test_identity_is_absent_until_first_run(self):
        self.assertFalse(
            (STARTER / "99 - Jarvis/memory/soul.md").exists()
        )
        self.assertTrue(
            (STARTER / "99 - Jarvis/system/soul-template.md").is_file()
        )

    def test_detailed_soul_template_renders_only_confirmed_identity_values(self):
        template = self.read("99 - Jarvis/system/soul-template.md")
        tokens = set(re.findall(r"\[[A-Z_]+\]", template))
        self.assertEqual(tokens, {"[NAME]", "[LANGUAGE]"})

        rendered = template.replace("[NAME]", "Giulia").replace(
            "[LANGUAGE]", "Italian"
        )
        self.assertFalse(re.search(r"\[[A-Z_]+\]", rendered))
        for heading in [
            "## Who I am",
            "## How I collaborate",
            "## How I communicate",
            "## Decision altitude",
            "## How I write",
            "## What matters",
            "## How I evolve",
        ]:
            self.assertIn(heading, rendered)
        self.assertIn("Giulia", rendered)
        self.assertIn("Italian", rendered)
        self.assertNotIn("Main focus", rendered)

    def test_core_assigns_stable_context_to_profile_and_nonduplicated_knowledge_to_memory(self):
        contract = self.read("99 - Jarvis/system/core-instructions.md")
        self.assertIn("stable local context in `CLAUDE.md`", contract)
        self.assertIn(
            "durable knowledge with no other authoritative home in `Durable memory`",
            contract,
        )
        self.assertIn("current priorities and next actions in `Future work`", contract)

    def test_canonical_contract_owns_bootstrap(self):
        contract = self.read("99 - Jarvis/system/core-instructions.md")
        for phrase in [
            "Read `CLAUDE.md`",
            MARKER,
            "one question at a time",
            "Do not overwrite",
        ]:
            self.assertIn(phrase, contract)

    def test_canonical_guardrails_name_protected_sources(self):
        contract = self.read("99 - Jarvis/system/core/guardrails.md")
        self.assertIn(
            "Identity, durable memory, and local customizations", contract
        )
        self.assertIn("require explicit approval", contract)
        self.assertIn("before overwriting them", contract)

    def test_local_pre_commit_guard_is_executable(self):
        hook = STARTER / ".githooks/pre-commit"
        self.assertTrue(hook.is_file())
        self.assertTrue(os.access(hook, os.X_OK))


if __name__ == "__main__":
    unittest.main()
