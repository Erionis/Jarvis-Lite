from __future__ import annotations

import re
import sys
import tempfile
import unittest
from pathlib import Path
from urllib.parse import unquote


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
LOCAL_LINK = re.compile(r"(?<!!)\[[^]]*\]\(([^)]+)\)")


def local_link_targets(document: Path) -> set[str]:
    targets = set()
    for target in LOCAL_LINK.findall(document.read_text(encoding="utf-8")):
        target = unquote(target.split("#", 1)[0].strip())
        if target and "://" not in target and not target.startswith("mailto:"):
            targets.add(target)
    return targets


def resolve_local_target(document: Path, target: str) -> Path:
    return (document.parent / target).resolve()


class DocumentationFoundationTest(unittest.TestCase):
    def test_maintainer_navigation_links_resolve(self):
        documents = {
            "AGENTS.md": {
                "README.md",
                "CONTRIBUTING.md",
                "docs/architecture.md",
                "docs/provenance.md",
                "scripts/build_starter.py",
                "starter/99 - Jarvis/system/core-instructions.md",
                "starter/AGENTS.md",
                "skills/",
                "tests/",
                ".github/workflows/ci.yml",
                ".github/pull_request_template.md",
            },
            "CONTRIBUTING.md": {"AGENTS.md", "docs/architecture.md"},
            "docs/architecture.md": {
                "../README.md",
                "../CONTRIBUTING.md",
                "provenance.md",
                "../scripts/build_starter.py",
                "../starter/99 - Jarvis/system/core-instructions.md",
                "../skills/",
                "../.github/workflows/ci.yml",
            },
            "docs/updates.md": {
                "../README.md",
                "../skills/adopt-capability/SKILL.md",
                "../skills/jarvis-update/SKILL.md",
            },
            "docs/daily-use.md": {
                "../README.md",
                "../skills/briefing/SKILL.md",
                "../skills/handoff/SKILL.md",
                "../skills/jarvis-doctor/SKILL.md",
                "../skills/jarvis-memory/SKILL.md",
                "../skills/save-session/SKILL.md",
                "updates.md",
            },
            "docs/getting-started.md": {
                "../README.md",
                "../scripts/build_starter.py",
                "../skills/first-run/SKILL.md",
                "../skills/first-run/interview.md",
                "../skills/jarvis-doctor/SKILL.md",
                "daily-use.md",
                "updates.md",
            },
            "README.md": {
                "AGENTS.md",
                "CONTRIBUTING.md",
                "LICENSE",
                "docs/architecture.md",
                "docs/daily-use.md",
                "docs/getting-started.md",
                "docs/provenance.md",
                "docs/updates.md",
            },
        }

        for relative_document, expected_targets in documents.items():
            document = ROOT / relative_document
            actual_targets = local_link_targets(document)
            self.assertTrue(expected_targets <= actual_targets, relative_document)
            for target in actual_targets:
                self.assertTrue(
                    resolve_local_target(document, target).exists(),
                    f"{relative_document}: {target}",
                )

    def test_starter_keeps_its_consumer_adapter_separate_from_maintainer_guide(self):
        from scripts.build_starter import build_starter

        with tempfile.TemporaryDirectory() as temporary:
            package = build_starter(ROOT, Path(temporary))
            packaged_adapter = (package / "AGENTS.md").read_bytes()

        self.assertEqual(packaged_adapter, (ROOT / "starter/AGENTS.md").read_bytes())
        self.assertNotEqual(packaged_adapter, (ROOT / "AGENTS.md").read_bytes())


if __name__ == "__main__":
    unittest.main()
