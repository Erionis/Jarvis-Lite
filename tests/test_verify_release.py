from __future__ import annotations

import copy
import hashlib
import json
import tempfile
import unittest
import zipfile
from pathlib import Path

from scripts.build_release import build_release


ROOT = Path(__file__).resolve().parents[1]


def write_checksum(archive: Path, checksum: Path) -> None:
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    checksum.write_text(f"{digest}  {archive.name}\n", encoding="ascii")


def replace_json_member(
    archive: Path,
    member_name: str,
    key: str,
    value: object,
) -> None:
    replacement = archive.with_name("replacement.zip")
    with zipfile.ZipFile(archive) as source, zipfile.ZipFile(replacement, "w") as target:
        for info in source.infolist():
            data = source.read(info)
            if info.filename == member_name:
                document = json.loads(data)
                document[key] = value
                data = (json.dumps(document, indent=2, sort_keys=True) + "\n").encode()
            target.writestr(info, data)
    replacement.replace(archive)


def remove_member(archive: Path, member_name: str) -> None:
    replacement = archive.with_name("replacement.zip")
    with zipfile.ZipFile(archive) as source, zipfile.ZipFile(replacement, "w") as target:
        for info in source.infolist():
            if info.filename != member_name:
                target.writestr(info, source.read(info))
    replacement.replace(archive)


def replace_member(
    archive: Path,
    member_name: str,
    *,
    data: bytes | None = None,
    permissions: int | None = None,
) -> None:
    replacement = archive.with_name("replacement.zip")
    with zipfile.ZipFile(archive) as source, zipfile.ZipFile(replacement, "w") as target:
        for source_info in source.infolist():
            info = copy.copy(source_info)
            member_data = source.read(source_info)
            if info.filename == member_name:
                if data is not None:
                    member_data = data
                if permissions is not None:
                    info.external_attr = (0o100000 | permissions) << 16
            target.writestr(info, member_data)
    replacement.replace(archive)


class VerifyReleaseTest(unittest.TestCase):
    def test_checksum_mismatch_stops_before_extraction(self):
        module_path = ROOT / "scripts/verify_release.py"
        self.assertTrue(module_path.is_file())

        from scripts.verify_release import verify_release

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            archive, checksum = build_release(
                ROOT,
                root / "artifacts",
                tag="v0.1.0",
                source_commit="a" * 40,
            )
            checksum.write_text(
                f"{'0' * 64}  Jarvis-Lite.zip\n",
                encoding="ascii",
            )
            extraction = root / "extracted"

            with self.assertRaisesRegex(ValueError, "checksum mismatch"):
                verify_release(
                    archive,
                    checksum,
                    expected_version="0.1.0",
                    expected_commit="a" * 40,
                    extract_to=extraction,
                )

            self.assertFalse(extraction.exists())

    def test_valid_release_extracts_one_complete_clean_package(self):
        from scripts.verify_release import verify_release

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            archive, checksum = build_release(
                ROOT,
                root / "artifacts",
                tag="v0.1.0",
                source_commit="b" * 40,
            )
            extraction = root / "extracted"

            verify_release(
                archive,
                checksum,
                expected_version="0.1.0",
                expected_commit="b" * 40,
                extract_to=extraction,
            )

            package = extraction / "Jarvis-Lite"
            self.assertTrue((package / ".agents/skills/first-run/SKILL.md").is_file())
            self.assertTrue((package / ".claude/skills/first-run/SKILL.md").is_file())
            self.assertTrue((package / "START-HERE.md").is_file())
            identity = json.loads(
                (package / "jarvis-lite.json").read_text(encoding="utf-8")
            )
            self.assertEqual(identity["release_version"], "0.1.0")
            self.assertEqual(identity["source_commit"], "b" * 40)
            update_state = json.loads(
                (package / ".jarvis-update/state.json").read_text(encoding="utf-8")
            )
            self.assertEqual(update_state["accepted_release"], "0.1.0")
            self.assertEqual(update_state["source_commit"], "b" * 40)
            self.assertEqual(
                (package / ".githooks/pre-commit").stat().st_mode & 0o777,
                0o755,
            )

    def test_unsafe_archive_paths_are_rejected_before_extraction(self):
        from scripts.verify_release import verify_release

        for unsafe_name in [
            "/absolute.txt",
            "Jarvis-Lite/../escape.txt",
            "Jarvis-Lite\\escape.txt",
            "Other-Root/file.txt",
        ]:
            with self.subTest(name=unsafe_name), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                archive = root / "Jarvis-Lite.zip"
                checksum = root / "Jarvis-Lite.zip.sha256"
                with zipfile.ZipFile(archive, "w") as zipped:
                    zipped.writestr(unsafe_name, b"unsafe")
                write_checksum(archive, checksum)
                extraction = root / "extracted"

                with self.assertRaisesRegex(ValueError, "unsafe archive path"):
                    verify_release(
                        archive,
                        checksum,
                        expected_version="0.1.0",
                        expected_commit="c" * 40,
                        extract_to=extraction,
                    )

                self.assertFalse(extraction.exists())

    def test_mismatched_package_identities_are_rejected(self):
        from scripts.verify_release import verify_release

        cases = [
            ("Jarvis-Lite/jarvis-lite.json", "source_commit", "c" * 40),
            (
                "Jarvis-Lite/99 - Jarvis/system/release-manifest.json",
                "release_version",
                "9.9.9",
            ),
            (
                "Jarvis-Lite/.jarvis-update/state.json",
                "accepted_release",
                "9.9.9",
            ),
        ]
        for member, key, value in cases:
            with self.subTest(member=member, key=key), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                archive, checksum = build_release(
                    ROOT,
                    root / "artifacts",
                    tag="v0.1.0",
                    source_commit="b" * 40,
                )
                replace_json_member(archive, member, key, value)
                write_checksum(archive, checksum)

                with self.assertRaisesRegex(ValueError, "identity mismatch"):
                    verify_release(
                        archive,
                        checksum,
                        expected_version="0.1.0",
                        expected_commit="b" * 40,
                    )

    def test_missing_package_entry_is_rejected_against_release_manifest(self):
        from scripts.verify_release import verify_release

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            archive, checksum = build_release(
                ROOT,
                root / "artifacts",
                tag="v0.1.0",
                source_commit="d" * 40,
            )
            remove_member(
                archive,
                "Jarvis-Lite/.agents/skills/first-run/SKILL.md",
            )
            write_checksum(archive, checksum)

            with self.assertRaisesRegex(ValueError, "inventory mismatch"):
                verify_release(
                    archive,
                    checksum,
                    expected_version="0.1.0",
                    expected_commit="d" * 40,
                )

    def test_archive_metadata_and_managed_content_tampering_are_rejected(self):
        from scripts.verify_release import verify_release

        cases = [
            (
                "Jarvis-Lite/.githooks/pre-commit",
                {"permissions": 0o644},
                "metadata mismatch",
            ),
            (
                "Jarvis-Lite/.claude/skills/first-run/SKILL.md",
                {"data": b"tampered runtime mirror\n"},
                "content mismatch",
            ),
        ]
        for member, replacement, error in cases:
            with self.subTest(member=member), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                archive, checksum = build_release(
                    ROOT,
                    root / "artifacts",
                    tag="v0.1.0",
                    source_commit="e" * 40,
                )
                replace_member(archive, member, **replacement)
                write_checksum(archive, checksum)

                with self.assertRaisesRegex(ValueError, error):
                    verify_release(
                        archive,
                        checksum,
                        expected_version="0.1.0",
                        expected_commit="e" * 40,
                    )

    def test_nonempty_extraction_target_is_preserved_and_rejected(self):
        from scripts.verify_release import verify_release

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            archive, checksum = build_release(
                ROOT,
                root / "artifacts",
                tag="v0.1.0",
                source_commit="f" * 40,
            )
            extraction = root / "existing"
            extraction.mkdir()
            keep = extraction / "keep.txt"
            keep.write_text("user content", encoding="utf-8")

            with self.assertRaisesRegex(FileExistsError, "not empty"):
                verify_release(
                    archive,
                    checksum,
                    expected_version="0.1.0",
                    expected_commit="f" * 40,
                    extract_to=extraction,
                )

            self.assertEqual(keep.read_text(encoding="utf-8"), "user content")
            self.assertEqual(list(extraction.iterdir()), [keep])

    def test_cli_verifies_and_extracts_the_release(self):
        import subprocess
        import sys

        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            archive, checksum = build_release(
                ROOT,
                root / "artifacts",
                tag="v0.1.0",
                source_commit="1" * 40,
            )
            extraction = root / "clean-install"
            completed = subprocess.run(
                [
                    sys.executable,
                    "scripts/verify_release.py",
                    "--archive",
                    str(archive),
                    "--checksum",
                    str(checksum),
                    "--expected-version",
                    "0.1.0",
                    "--expected-commit",
                    "1" * 40,
                    "--extract-to",
                    str(extraction),
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
                    f"Verified {archive}",
                    f"Extracted to {extraction}",
                ],
            )
            self.assertTrue((extraction / "Jarvis-Lite/START-HERE.md").is_file())


if __name__ == "__main__":
    unittest.main()
