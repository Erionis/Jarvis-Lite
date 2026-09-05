from __future__ import annotations

import re
import tempfile
import unittest
from pathlib import Path

from scripts.build_starter import INSTALLED_SKILLS, build_starter


ROOT = Path(__file__).resolve().parents[1]
CATALOG_ONLY = {"adopt-capability", "defuddle", "playwright-cli"}
PRIVATE_PATTERNS = (
    re.compile(r"/Users/[^/\s]+"),
    re.compile(r"\b[A-Za-z0-9_-]+-Vault\b"),
    re.compile(r"\b[a-z0-9.-]+\.lan\b", re.IGNORECASE),
    re.compile(
        r"\b(?:10\.(?:\d{1,3}\.){2}\d{1,3}|"
        r"172\.(?:1[6-9]|2\d|3[01])\.(?:\d{1,3}\.)\d{1,3}|"
        r"192\.168\.(?:\d{1,3}\.)\d{1,3})\b"
    ),
    re.compile(r"\b(?:handoff|session)-\d{4}-\d{2}-\d{2}\b", re.IGNORECASE),
)
LEGACY_MARKERS = (
    "01 - Diario",
    "99 - Jarvis/sistema",
    "Read `PROFILE.md`",
)


class PublicContentTest(unittest.TestCase):
    def test_readme_explains_download_start_and_supported_runtimes(self):
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        for phrase in [
            "Download `Jarvis-Lite.zip`",
            "Start Jarvis",
            "Codex",
            "Claude Code",
            "OpenCode",
        ]:
            self.assertIn(phrase, readme)
        for skill in INSTALLED_SKILLS:
            self.assertIn(f"`{skill}`", readme)

    def test_catalog_only_capabilities_are_not_installed(self):
        with tempfile.TemporaryDirectory() as temporary:
            package = build_starter(ROOT, Path(temporary))
            for runtime in [".claude", ".agents"]:
                installed = {
                    path.name
                    for path in (package / runtime / "skills").iterdir()
                    if path.is_dir()
                }
                self.assertEqual(installed, set(INSTALLED_SKILLS))
                self.assertTrue(installed.isdisjoint(CATALOG_ONLY))

    def test_inbox_remains_supported_without_a_retired_skill(self):
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        normalized_readme = " ".join(readme.split())
        self.assertIn("seven installed skills", normalized_readme)
        self.assertIn("Python 3 standard library", normalized_readme)

        core = (ROOT / "starter/99 - Jarvis/system/core-instructions.md").read_text(
            encoding="utf-8"
        )
        normalized_core = " ".join(core.split())
        self.assertIn(
            "Organizing Inbox is normal Jarvis work and does not require a separate skill",
            normalized_core,
        )
        self.assertIn("bounded Inbox maintenance", normalized_core)
        self.assertTrue((ROOT / "starter/00 - Inbox/README.md").is_file())

        with tempfile.TemporaryDirectory() as temporary:
            package = build_starter(ROOT, Path(temporary))
            for runtime in [".claude", ".agents"]:
                self.assertEqual(
                    {
                        path.name
                        for path in (package / runtime / "skills").iterdir()
                        if path.is_dir()
                    },
                    set(INSTALLED_SKILLS),
                )

    def test_public_documentation_has_no_private_markers(self):
        documents = [
            ROOT / "README.md",
            ROOT / "AGENTS.md",
            ROOT / "CONTRIBUTING.md",
            *sorted((ROOT / "docs").glob("*.md")),
        ]
        for path in documents:
            content = path.read_text(encoding="utf-8")
            for pattern in PRIVATE_PATTERNS:
                self.assertIsNone(
                    pattern.search(content),
                    f"{pattern.pattern!r} in {path}",
                )

    def test_assembled_public_text_has_no_private_or_legacy_markers(self):
        with tempfile.TemporaryDirectory() as temporary:
            package = build_starter(ROOT, Path(temporary))
            for path in package.rglob("*"):
                if not path.is_file():
                    continue
                try:
                    content = path.read_text(encoding="utf-8")
                except UnicodeDecodeError:
                    continue
                for pattern in PRIVATE_PATTERNS:
                    self.assertIsNone(
                        pattern.search(content),
                        f"{pattern.pattern!r} in {path}",
                    )
                for marker in LEGACY_MARKERS:
                    self.assertNotIn(marker, content, f"{marker!r} in {path}")


if __name__ == "__main__":
    unittest.main()
