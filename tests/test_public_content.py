from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts.build_starter import INSTALLED_SKILLS, build_starter


ROOT = Path(__file__).resolve().parents[1]
CATALOG_ONLY = {"adopt-capability", "defuddle", "playwright-cli"}


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

    def test_assembled_public_text_has_no_private_or_legacy_markers(self):
        denied = [
            "/Users/erionislamay",
            "Erionis-Vault",
            "01 - Diario",
            "99 - Jarvis/sistema",
            "Read `PROFILE.md`",
        ]
        with tempfile.TemporaryDirectory() as temporary:
            package = build_starter(ROOT, Path(temporary))
            for path in package.rglob("*"):
                if not path.is_file():
                    continue
                try:
                    content = path.read_text(encoding="utf-8")
                except UnicodeDecodeError:
                    continue
                for marker in denied:
                    self.assertNotIn(marker, content, f"{marker!r} in {path}")


if __name__ == "__main__":
    unittest.main()
