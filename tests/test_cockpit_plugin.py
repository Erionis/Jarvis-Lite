from __future__ import annotations

import json
import re
import tempfile
import unittest
from pathlib import Path

from scripts.build_starter import build_starter


ROOT = Path(__file__).resolve().parents[1]
PLUGIN = ROOT / "plugins" / "jarvis-cockpit"
SEMVER = re.compile(r"^\d+\.\d+\.\d+$")


class CockpitPluginContractTest(unittest.TestCase):
    def read_json(self, path: Path) -> dict:
        self.assertTrue(path.is_file(), f"missing {path}")
        return json.loads(path.read_text(encoding="utf-8"))

    def test_marketplace_lists_the_cockpit_plugin(self):
        market = self.read_json(ROOT / ".claude-plugin" / "marketplace.json")
        self.assertEqual(market["name"], "jarvis-lite")
        self.assertEqual(market["owner"]["name"], "Erion Islamay")
        entries = {entry["name"]: entry for entry in market["plugins"]}
        self.assertEqual(set(entries), {"jarvis-cockpit"})
        self.assertEqual(entries["jarvis-cockpit"]["source"], "./plugins/jarvis-cockpit")

    def test_plugin_manifest_matches_the_marketplace_entry(self):
        manifest = self.read_json(PLUGIN / ".claude-plugin" / "plugin.json")
        self.assertEqual(manifest["name"], "jarvis-cockpit")
        self.assertRegex(manifest["version"], SEMVER)
        self.assertEqual(manifest["author"]["name"], "Erion Islamay")
        self.assertTrue((PLUGIN / "hooks" / "hooks.json").is_file())
        self.assertTrue((PLUGIN / "LICENSE-filetree").is_file())
        market = self.read_json(ROOT / ".claude-plugin" / "marketplace.json")
        self.assertIn(manifest["name"], {entry["name"] for entry in market["plugins"]})
        self.assertTrue((PLUGIN / manifest["types"]).is_file())

    def test_mascot_skill_ships_with_the_plugin(self):
        skill = (PLUGIN / "skills" / "cockpit-mascot" / "SKILL.md").read_text(encoding="utf-8")
        self.assertIn("99 - Jarvis/mascot", skill)
        for name in ("idle.svg", "talk.svg", "viewBox"):
            self.assertIn(name, skill)

    def test_docs_name_the_command_that_reopens_the_panel(self):
        state = (PLUGIN / "hooks" / "state.ts").read_text(encoding="utf-8")
        command = re.search(r"export const COMMAND = '([a-z-]+)'", state).group(1)
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        section = readme[readme.index("## Cockpit"):readme.index("## Compatibility and prerequisites")]
        for text in (
            section,
            (ROOT / "docs" / "cockpit.md").read_text(encoding="utf-8"),
            (ROOT / "skills" / "first-run" / "cockpit.md").read_text(encoding="utf-8"),
        ):
            self.assertIn(f"`/{command}`", text)

    def test_english_text_says_workspace_like_the_rest_of_jarvis_lite(self):
        for path in (
            PLUGIN / "hooks" / "strings.en.ts",
            PLUGIN / "skills" / "cockpit-mascot" / "SKILL.md",
            ROOT / "skills" / "first-run" / "cockpit.md",
            ROOT / "docs" / "cockpit.md",
        ):
            self.assertIsNone(
                re.search(r"\bvaults?\b", path.read_text(encoding="utf-8"), re.IGNORECASE),
                f"'vault' in {path.relative_to(ROOT)}",
            )

    def test_starter_package_does_not_contain_the_plugin(self):
        with tempfile.TemporaryDirectory() as temporary:
            package = build_starter(ROOT, Path(temporary))
            names = {path.relative_to(package).parts[0] for path in package.rglob("*")}
            self.assertNotIn("plugins", names)
            self.assertNotIn(".claude-plugin", names)
            self.assertFalse(any(package.rglob("cockpit-mascot")))


if __name__ == "__main__":
    unittest.main()
