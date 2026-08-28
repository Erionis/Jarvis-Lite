from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILL = ROOT / "skills/first-run/SKILL.md"


class FirstRunContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.text = SKILL.read_text(encoding="utf-8")

    def test_one_question_and_idempotency_rules_are_explicit(self):
        for phrase in [
            "Ask one question at a time",
            "Treat semantic equivalents of `Start Jarvis` in any language as the same trigger",
            "If `jarvis/identity/SOUL.md` already exists, do not replace it",
            "Remove `<!-- jarvis:onboarding-required -->` only after",
            "Preserve every non-marker line",
            "Render Soul and personal content in the preferred language",
        ]:
            self.assertIn(phrase, self.text)

    def test_git_happy_path_is_complete(self):
        for command in [
            "git --version",
            "git rev-parse --is-inside-work-tree",
            "git init -b main",
            "git config --get user.name",
            "git config --get user.email",
            "git add -A",
            'git commit -m "chore: initialize my Jarvis"',
        ]:
            self.assertIn(command, self.text)

    def test_git_missing_path_is_platform_specific(self):
        self.assertIn("https://git-scm.com/download/win", self.text)
        self.assertIn("https://git-scm.com/download/mac", self.text)
        self.assertIn("<!-- jarvis:git-pending -->", self.text)

    def test_scenarios_exist(self):
        for name in ["new-user.md", "second-run.md", "git-missing.md"]:
            self.assertTrue((ROOT / "tests/scenarios" / name).is_file(), name)


if __name__ == "__main__":
    unittest.main()
