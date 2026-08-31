from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
STARTER = ROOT / "starter"
MARKER = "<!-- jarvis:onboarding-required -->"


class StarterContractTest(unittest.TestCase):
    def read(self, relative: str) -> str:
        return (STARTER / relative).read_text(encoding="utf-8")

    def test_adapters_load_one_canonical_contract(self):
        agents = self.read("AGENTS.md")
        claude = self.read("CLAUDE.md")
        self.assertIn("jarvis/JARVIS.md", agents)
        self.assertEqual(claude.strip(), "@AGENTS.md")
        self.assertNotIn("## Bootstrap", agents)

    def test_profile_declares_visible_capabilities(self):
        profile = self.read("jarvis/PROFILE.md")
        self.assertIn(MARKER, profile)
        for role, path in {
            "Identity": "jarvis/identity/SOUL.md",
            "Durable memory": "jarvis/memory/MEMORY.md",
            "Future work": "jarvis/open-loops.md",
            "Inbox": "jarvis/Inbox/",
        }.items():
            self.assertIn(f"| {role} | `{path}` |", profile)

    def test_identity_is_absent_until_first_run(self):
        self.assertFalse((STARTER / "jarvis/identity/SOUL.md").exists())
        self.assertTrue((STARTER / "jarvis/identity/README.md").is_file())

    def test_canonical_contract_owns_bootstrap(self):
        contract = self.read("jarvis/JARVIS.md")
        for phrase in [
            "Read `jarvis/PROFILE.md`",
            MARKER,
            "one question at a time",
            "Do not overwrite",
            "jarvis/skills/",
        ]:
            self.assertIn(phrase, contract)

    def test_canonical_guardrails_name_protected_sources(self):
        contract = self.read("jarvis/JARVIS.md")
        self.assertIn(
            "Identity, durable memory, and local customizations", contract
        )
        self.assertIn("require explicit approval", contract)
        self.assertIn("before overwriting them", contract)


if __name__ == "__main__":
    unittest.main()
