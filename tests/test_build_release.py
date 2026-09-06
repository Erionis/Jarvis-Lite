from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import unittest
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class BuildReleaseTest(unittest.TestCase):
    def test_version_from_tag_accepts_only_stable_semantic_tags(self):
        module_path = ROOT / "scripts/build_release.py"
        self.assertTrue(module_path.is_file())

        from scripts.build_release import version_from_tag

        for tag, expected in [
            ("v0.1.0", "0.1.0"),
            ("v1.20.300", "1.20.300"),
        ]:
            with self.subTest(tag=tag):
                self.assertEqual(version_from_tag(tag), expected)

        for tag in [
            "0.1.0",
            "v01.0.0",
            "v1.02.3",
            "v1.2.03",
            "v1.2",
            "v1.2.3-beta.1",
            "v1.2.3+build",
            "release-v1.2.3",
        ]:
            with self.subTest(tag=tag):
                with self.assertRaisesRegex(ValueError, "Invalid release tag"):
                    version_from_tag(tag)

    def test_same_identity_produces_identical_zip_and_checksum(self):
        import scripts.build_release as release_builder

        self.assertTrue(hasattr(release_builder, "build_release"))

        with (
            tempfile.TemporaryDirectory() as first_temporary,
            tempfile.TemporaryDirectory() as second_temporary,
        ):
            first_archive, first_checksum = release_builder.build_release(
                ROOT,
                Path(first_temporary),
                tag="v0.1.0",
                source_commit="a" * 40,
            )
            second_archive, second_checksum = release_builder.build_release(
                ROOT,
                Path(second_temporary),
                tag="v0.1.0",
                source_commit="a" * 40,
            )

            self.assertEqual(first_archive.name, "Jarvis-Lite.zip")
            self.assertEqual(first_checksum.name, "Jarvis-Lite.zip.sha256")
            self.assertEqual(first_archive.read_bytes(), second_archive.read_bytes())
            self.assertEqual(first_checksum.read_bytes(), second_checksum.read_bytes())
            expected = hashlib.sha256(first_archive.read_bytes()).hexdigest()
            self.assertEqual(
                first_checksum.read_text(encoding="ascii"),
                f"{expected}  Jarvis-Lite.zip\n",
            )

    def test_archive_preserves_complete_portable_package_contract(self):
        from scripts.build_release import FIXED_ZIP_TIME, build_release

        with tempfile.TemporaryDirectory() as temporary:
            archive, _ = build_release(
                ROOT,
                Path(temporary),
                tag="v0.1.0",
                source_commit="b" * 40,
            )

            with zipfile.ZipFile(archive) as zipped:
                names = zipped.namelist()
                self.assertEqual(names, sorted(names))
                self.assertTrue(names)
                self.assertEqual(
                    {Path(name).parts[0] for name in names},
                    {"Jarvis-Lite"},
                )
                self.assertIn(
                    "Jarvis-Lite/.agents/skills/first-run/SKILL.md", names
                )
                self.assertIn(
                    "Jarvis-Lite/.claude/skills/first-run/SKILL.md", names
                )
                self.assertIn("Jarvis-Lite/jarvis-lite.json", names)

                manifest = json.loads(
                    zipped.read(
                        "Jarvis-Lite/99 - Jarvis/system/release-manifest.json"
                    )
                )
                self.assertEqual(
                    names,
                    [f"Jarvis-Lite/{path}" for path in manifest["package_paths"]],
                )

                identity = json.loads(zipped.read("Jarvis-Lite/jarvis-lite.json"))
                self.assertEqual(identity["release_version"], "0.1.0")
                self.assertEqual(identity["source_commit"], "b" * 40)
                self.assertNotIn("build_timestamp", identity)
                self.assertNotIn("build_machine", identity)

                for info in zipped.infolist():
                    self.assertEqual(info.date_time, FIXED_ZIP_TIME)
                    self.assertEqual(info.create_system, 3)
                    permissions = (info.external_attr >> 16) & 0o777
                    if info.filename == "Jarvis-Lite/.githooks/pre-commit":
                        self.assertEqual(permissions, 0o755)
                    else:
                        self.assertEqual(permissions, 0o644)

    def test_existing_release_assets_are_never_overwritten(self):
        from scripts.build_release import build_release

        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            archive = output / "Jarvis-Lite.zip"
            archive.write_bytes(b"keep this archive")

            with self.assertRaisesRegex(FileExistsError, "already exists"):
                build_release(
                    ROOT,
                    output,
                    tag="v0.1.0",
                    source_commit="c" * 40,
                )

            self.assertEqual(archive.read_bytes(), b"keep this archive")
            self.assertFalse((output / "Jarvis-Lite.zip.sha256").exists())

    def test_cli_builds_the_two_documented_release_assets(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / "release"
            completed = subprocess.run(
                [
                    sys.executable,
                    "scripts/build_release.py",
                    "--tag",
                    "v0.1.0",
                    "--source-commit",
                    "d" * 40,
                    "--output",
                    str(output),
                ],
                cwd=ROOT,
                text=True,
                capture_output=True,
                check=False,
            )

            self.assertEqual(completed.returncode, 0, completed.stderr)
            self.assertEqual(
                completed.stdout.splitlines(),
                [
                    str(output / "Jarvis-Lite.zip"),
                    str(output / "Jarvis-Lite.zip.sha256"),
                ],
            )
            self.assertTrue((output / "Jarvis-Lite.zip").is_file())
            self.assertTrue((output / "Jarvis-Lite.zip.sha256").is_file())

    def test_symlinked_output_directory_is_rejected_before_writing(self):
        from scripts.build_release import build_release

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            real_output = root / "real-output"
            real_output.mkdir()
            linked_output = root / "linked-output"
            linked_output.symlink_to(real_output, target_is_directory=True)

            with self.assertRaisesRegex(ValueError, "symlink"):
                build_release(
                    ROOT,
                    linked_output,
                    tag="v0.1.0",
                    source_commit="e" * 40,
                )

            self.assertEqual(list(real_output.iterdir()), [])


if __name__ == "__main__":
    unittest.main()
