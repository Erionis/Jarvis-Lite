from __future__ import annotations

import hashlib
import json
import re
import shutil
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
INSTALLED = (
    "briefing",
    "first-run",
    "save-session",
    "handoff",
    "jarvis-memory",
    "jarvis-doctor",
    "jarvis-update",
)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


class BuildStarterTest(unittest.TestCase):
    def test_release_manifest_lists_every_shipped_regular_file(self):
        from scripts.build_starter import build_starter

        with tempfile.TemporaryDirectory() as temporary:
            package = build_starter(ROOT, Path(temporary))
            manifest = json.loads(
                (package / "99 - Jarvis/system/release-manifest.json").read_text(
                    encoding="utf-8"
                )
            )

            package_paths = manifest["package_paths"]
            actual_paths = sorted(
                path.relative_to(package).as_posix()
                for path in package.rglob("*")
                if path.is_file()
            )

            self.assertEqual(package_paths, actual_paths)
            self.assertEqual(len(package_paths), len(set(package_paths)))
            for relative in package_paths:
                path = Path(relative)
                self.assertFalse(path.is_absolute(), relative)
                self.assertNotIn("..", path.parts, relative)
                self.assertNotIn("\\", relative)

    def test_builds_both_physical_runtime_skill_mirrors(self):
        from scripts.build_starter import build_starter

        with tempfile.TemporaryDirectory() as temporary:
            package = build_starter(ROOT, Path(temporary))

            self.assertEqual(package, Path(temporary) / "Jarvis-Lite")
            for runtime in [".claude", ".agents"]:
                mirror = package / runtime / "skills"
                self.assertEqual(
                    {path.name for path in mirror.iterdir() if path.is_dir()},
                    set(INSTALLED),
                )
                for skill in INSTALLED:
                    source = ROOT / "skills" / skill / "SKILL.md"
                    copied = mirror / skill / "SKILL.md"
                    self.assertEqual(digest(copied), digest(source))

                first_run_reference = mirror / "first-run" / "interview.md"
                self.assertTrue(first_run_reference.is_file())
                self.assertEqual(
                    digest(first_run_reference),
                    digest(ROOT / "skills/first-run/interview.md"),
                )
                git_reference = mirror / "first-run" / "git-checkpoint.md"
                self.assertTrue(git_reference.is_file())
                self.assertEqual(
                    digest(git_reference),
                    digest(ROOT / "skills/first-run/git-checkpoint.md"),
                )

            self.assertTrue((package / ".claude/settings.json").is_file())
            self.assertTrue((package / "01 - Diary/README.md").is_file())
            self.assertFalse((package / "skills").exists())

            profile = (package / "CLAUDE.md").read_text(encoding="utf-8")
            declared_template = re.search(
                r"^\| Soul template \| `([^`]+)` \|$", profile, re.MULTILINE
            )
            self.assertIsNotNone(declared_template)
            self.assertTrue((package / declared_template.group(1)).is_file())

    def test_assembled_first_run_has_no_repository_test_dependency(self):
        from scripts.build_starter import build_starter

        with tempfile.TemporaryDirectory() as temporary:
            package = build_starter(ROOT, Path(temporary))
            for runtime in [".claude", ".agents"]:
                skill = (package / runtime / "skills/first-run/SKILL.md").read_text(
                    encoding="utf-8"
                )
                self.assertNotIn("tests/scenarios", skill)

    def test_assembled_tree_contains_no_symlink(self):
        from scripts.build_starter import build_starter

        with tempfile.TemporaryDirectory() as temporary:
            package = build_starter(ROOT, Path(temporary))
            self.assertFalse(any(path.is_symlink() for path in package.rglob("*")))

    def test_rejects_an_existing_nonempty_target(self):
        from scripts.build_starter import build_starter

        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / "Jarvis-Lite"
            target.mkdir()
            (target / "keep.txt").write_text("user data", encoding="utf-8")

            with self.assertRaises(FileExistsError):
                build_starter(ROOT, Path(temporary))

            self.assertEqual((target / "keep.txt").read_text(), "user data")

    def test_rejects_a_missing_installed_skill_before_writing(self):
        from scripts.build_starter import build_starter

        with tempfile.TemporaryDirectory() as temporary:
            fixture = Path(temporary) / "source"
            shutil.copytree(ROOT / "starter", fixture / "starter")
            for skill in INSTALLED[:-1]:
                shutil.copytree(ROOT / "skills" / skill, fixture / "skills" / skill)
            output = Path(temporary) / "output"

            with self.assertRaises(FileNotFoundError):
                build_starter(fixture, output)

            self.assertFalse((output / "Jarvis-Lite").exists())


if __name__ == "__main__":
    unittest.main()
