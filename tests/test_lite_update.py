from __future__ import annotations

import hashlib
import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
import warnings
import zipfile
from pathlib import Path
from unittest import mock

from scripts.build_starter import build_starter


ROOT = Path(__file__).resolve().parents[1]
UPDATER_PATH = ROOT / "skills/jarvis-update/scripts/update_lite.py"


def load_updater():
    spec = importlib.util.spec_from_file_location("jarvis_lite_update", UPDATER_PATH)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def snapshot(root: Path) -> dict[str, bytes]:
    return {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in root.rglob("*")
        if path.is_file()
    }


def refresh_package_metadata(package: Path) -> None:
    manifest_path = package / "99 - Jarvis/system/release-manifest.json"
    state_path = package / ".jarvis-update/state.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for entry in manifest["managed_files"]:
        entry["sha256"] = digest(package / entry["path"])
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    state = json.loads(state_path.read_text(encoding="utf-8"))
    state["accepted_release"] = manifest["release_version"]
    state["source_commit"] = manifest["source_commit"]
    state["contract_revision"] = manifest["contract_revision"]
    state["baseline"] = {
        entry["path"]: entry for entry in manifest["managed_files"]
    }
    state["manifest_sha256"] = digest(manifest_path)
    state_path.write_text(
        json.dumps(state, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def make_zip(package: Path, destination: Path) -> tuple[Path, Path]:
    archive = destination / "Jarvis-Lite.zip"
    with zipfile.ZipFile(archive, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        for path in sorted(candidate for candidate in package.rglob("*") if candidate.is_file()):
            bundle.write(path, f"Jarvis-Lite/{path.relative_to(package).as_posix()}")
    checksum = destination / "Jarvis-Lite.zip.sha256"
    checksum.write_text(f"{digest(archive)}  Jarvis-Lite.zip\n", encoding="utf-8")
    return archive, checksum


def change_mirrored_skill(
    package: Path,
    component: str,
    suffix: str,
    content: str,
) -> None:
    for runtime in [".claude", ".agents"]:
        path = package / runtime / "skills" / component / suffix
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
    refresh_package_metadata(package)


def add_managed_pair(
    package: Path,
    component: str,
    suffix: str,
    content: str,
    ownership: str,
) -> None:
    manifest_path = package / "99 - Jarvis/system/release-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    for runtime in [".claude", ".agents"]:
        path = package / runtime / "skills" / component / suffix
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8")
        manifest["managed_files"].append(
            {
                "path": path.relative_to(package).as_posix(),
                "sha256": digest(path),
                "ownership": ownership,
                "component": component,
                "dependencies": [],
            }
        )
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    refresh_package_metadata(package)


def remove_managed_pair(package: Path, component: str, suffix: str) -> None:
    manifest_path = package / "99 - Jarvis/system/release-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    removed = set()
    for runtime in [".claude", ".agents"]:
        path = package / runtime / "skills" / component / suffix
        removed.add(path.relative_to(package).as_posix())
        path.unlink()
    manifest["managed_files"] = [
        entry for entry in manifest["managed_files"] if entry["path"] not in removed
    ]
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    refresh_package_metadata(package)


def add_migration(
    package: Path,
    migration_id: str,
    components: list[str],
    paths: list[str],
    *,
    required: bool,
) -> None:
    manifest_path = package / "99 - Jarvis/system/release-manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    manifest["migrations"].append(
        {
            "id": migration_id,
            "summary": "Move lifecycle writers to the Diary-only contract.",
            "required": required,
            "components": components,
            "paths": paths,
        }
    )
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )
    refresh_package_metadata(package)


class LiteUpdatePackageContractTest(unittest.TestCase):
    def test_package_seeds_release_manifest_state_and_seventh_skill(self):
        with tempfile.TemporaryDirectory() as temporary:
            package = build_starter(
                ROOT,
                Path(temporary),
                release_version="0.1.0",
                source_commit="a" * 40,
                release_summary="First public Jarvis Lite release.",
            )

            manifest_path = package / "99 - Jarvis/system/release-manifest.json"
            state_path = package / ".jarvis-update/state.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            state = json.loads(state_path.read_text(encoding="utf-8"))

            self.assertEqual(manifest["schema_version"], 1)
            self.assertEqual(manifest["product"], "jarvis-lite")
            self.assertEqual(manifest["release_version"], "0.1.0")
            self.assertEqual(manifest["source_commit"], "a" * 40)
            self.assertEqual(manifest["contract_revision"], 1)
            self.assertEqual(
                manifest["release_summary"],
                "First public Jarvis Lite release.",
            )

            entries = {entry["path"]: entry for entry in manifest["managed_files"]}
            for runtime in [".claude", ".agents"]:
                update_script = (
                    package
                    / runtime
                    / "skills/jarvis-update/scripts/update_lite.py"
                )
                self.assertTrue(update_script.is_file())
                relative = update_script.relative_to(package).as_posix()
                self.assertEqual(entries[relative]["ownership"], "control-plane")
                self.assertEqual(entries[relative]["component"], "jarvis-update")
                self.assertEqual(entries[relative]["sha256"], digest(update_script))

            briefing = ".claude/skills/briefing/SKILL.md"
            self.assertEqual(entries[briefing]["ownership"], "functional")
            self.assertEqual(entries[briefing]["component"], "briefing")
            self.assertNotIn("CLAUDE.md", entries)
            self.assertNotIn("01 - Diary/README.md", entries)

            self.assertEqual(state["schema_version"], 1)
            self.assertEqual(state["product"], "jarvis-lite")
            self.assertEqual(state["accepted_release"], "0.1.0")
            self.assertEqual(state["source_commit"], "a" * 40)
            self.assertEqual(state["contract_revision"], 1)
            self.assertEqual(state["baseline"], entries)
            self.assertEqual(state["overrides"], {})
            self.assertEqual(state["postponed_migrations"], [])
            self.assertIsNone(state["last_recovery"])
            self.assertEqual(state["manifest_sha256"], digest(manifest_path))
            self.assertFalse(any("__pycache__" in path.parts for path in package.rglob("*")))
            self.assertFalse(any(path.suffix == ".pyc" for path in package.rglob("*")))

    def test_builder_rejects_noncanonical_release_identity(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            for index, version in enumerate(["1.0", "01.0.0", "v1.0.0"]):
                with self.subTest(version=version):
                    with self.assertRaises(ValueError):
                        build_starter(
                            ROOT,
                            root / f"bad-version-{index}",
                            release_version=version,
                            source_commit="a" * 40,
                        )
            with self.assertRaises(ValueError):
                build_starter(
                    ROOT,
                    root / "bad-commit",
                    release_version="1.0.0",
                    source_commit="ABC123",
                )

    def test_update_skill_defines_the_negotiated_control_plane(self):
        skill_path = ROOT / "skills/jarvis-update/SKILL.md"
        text = skill_path.read_text(encoding="utf-8")
        normalized = " ".join(text.split())
        frontmatter = text.split("---", 2)[1].strip().splitlines()
        fields = dict(line.split(": ", 1) for line in frontmatter)

        self.assertEqual(fields["name"], "jarvis-update")
        self.assertTrue(fields["description"].startswith("Use when"))
        for workflow_word in ["download", "inspect", "classify", "backup", "apply"]:
            self.assertNotIn(workflow_word, fields["description"].lower())

        for phrase in [
            "Explain the release before asking for approval",
            "read-only preflight",
            "one conflict at a time",
            "keep and adapt",
            "replace",
            "merge",
            "postpone",
            "No consumer write starts before explicit approval of the exact plan",
            "Do not invoke `jarvis-doctor`",
            "control-plane",
            "functional",
            "consumer-owned",
            "both runtime mirrors",
            "scoped recovery point",
            "focused verification",
            "rollback",
            "Python 3 standard library",
        ]:
            self.assertIn(phrase, normalized)

    def test_update_scenarios_cover_safe_conflicting_and_interrupted_paths(self):
        expected = {
            "update-pristine": [
                "one confirmation",
                "no consumer-owned content changes",
                "both runtime mirrors are coherent",
            ],
            "update-customized": [
                "modified `save-session`",
                "one conflict at a time",
                "keep and adapt",
                "replace",
                "merge",
                "postpone",
            ],
            "update-interrupted": [
                "installed state does not advance",
                "scoped recovery point remains available",
                "rollback restores every in-scope path",
            ],
        }
        for name, phrases in expected.items():
            scenario = (
                ROOT / "tests/scenarios" / f"{name}.md"
            ).read_text(encoding="utf-8")
            normalized = " ".join(scenario.split())
            for phrase in phrases:
                self.assertIn(phrase, normalized, f"{phrase!r} missing from {name}")


class LiteUpdatePreflightTest(unittest.TestCase):
    def setUp(self):
        self.updater = load_updater()

    def build_release(self, parent: Path, version: str, commit: str) -> Path:
        output = parent / f"release-{version}-{commit[:8]}"
        return build_starter(
            ROOT,
            output,
            release_version=version,
            source_commit=commit,
            release_summary=f"Release {version} changes update behavior.",
        )

    def test_valid_preflight_is_read_only_for_a_pristine_consumer(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = self.build_release(root, "0.1.0", "a" * 40)
            target = self.build_release(root, "0.2.0", "b" * 40)
            target_file = target / ".claude/skills/briefing/SKILL.md"
            target_file.write_text(
                target_file.read_text(encoding="utf-8") + "\nTarget behavior.\n",
                encoding="utf-8",
            )
            twin = target / ".agents/skills/briefing/SKILL.md"
            twin.write_bytes(target_file.read_bytes())
            refresh_package_metadata(target)
            artifact_dir = root / "artifact"
            artifact_dir.mkdir()
            archive, checksum = make_zip(target, artifact_dir)
            before = snapshot(consumer)

            report = self.updater.preflight(
                consumer,
                archive,
                checksum,
                root / "stage",
            )

            self.assertEqual(report["status"], "ready")
            self.assertEqual(report["installed_release"], "0.1.0")
            self.assertEqual(report["target_release"], "0.2.0")
            self.assertEqual(
                report["release_summary"],
                "Release 0.2.0 changes update behavior.",
            )
            briefing = report["components"]["briefing"]
            self.assertEqual(briefing["classification"], "safe")
            self.assertEqual(briefing["action"], "replace")
            self.assertEqual(snapshot(consumer), before)
            self.assertTrue(Path(report["staged_root"]).is_dir())

    def test_preflight_rejects_staging_inside_the_consumer(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = self.build_release(root, "0.1.0", "a" * 40)
            target = self.build_release(root, "0.2.0", "b" * 40)
            artifact_dir = root / "artifact"
            artifact_dir.mkdir()
            archive, checksum = make_zip(target, artifact_dir)
            before = snapshot(consumer)

            with self.assertRaisesRegex(
                self.updater.UpdateError, "outside the consumer"
            ):
                self.updater.preflight(
                    consumer,
                    archive,
                    checksum,
                    consumer / ".unsafe-stage",
                )

            self.assertEqual(snapshot(consumer), before)
            self.assertFalse((consumer / ".unsafe-stage").exists())

    def test_checksum_failure_stops_before_consumer_or_extraction_changes(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = self.build_release(root, "0.1.0", "a" * 40)
            target = self.build_release(root, "0.2.0", "b" * 40)
            artifact_dir = root / "artifact"
            artifact_dir.mkdir()
            archive, checksum = make_zip(target, artifact_dir)
            checksum.write_text(f"{'0' * 64}  Jarvis-Lite.zip\n", encoding="utf-8")
            before = snapshot(consumer)
            stage = root / "stage"

            with self.assertRaisesRegex(self.updater.UpdateError, "checksum"):
                self.updater.preflight(consumer, archive, checksum, stage)

            self.assertEqual(snapshot(consumer), before)
            self.assertFalse(stage.exists())

    def test_wrong_product_and_unsafe_archive_paths_are_rejected(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = self.build_release(root, "0.1.0", "a" * 40)
            target = self.build_release(root, "0.2.0", "b" * 40)
            manifest_path = target / "99 - Jarvis/system/release-manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["product"] = "another-product"
            manifest_path.write_text(
                json.dumps(manifest, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )
            artifact_dir = root / "artifact"
            artifact_dir.mkdir()
            archive, checksum = make_zip(target, artifact_dir)

            with self.assertRaisesRegex(self.updater.UpdateError, "product"):
                self.updater.preflight(
                    consumer, archive, checksum, root / "wrong-product-stage"
                )

            unsafe = root / "unsafe.zip"
            with zipfile.ZipFile(unsafe, "w") as bundle:
                bundle.writestr("Jarvis-Lite/../escaped.txt", "escape")
            unsafe_checksum = root / "unsafe.zip.sha256"
            unsafe_checksum.write_text(
                f"{digest(unsafe)}  unsafe.zip\n", encoding="utf-8"
            )

            with self.assertRaisesRegex(self.updater.UpdateError, "unsafe"):
                self.updater.preflight(
                    consumer, unsafe, unsafe_checksum, root / "unsafe-stage"
                )
            self.assertFalse((root / "escaped.txt").exists())

    def test_duplicate_archive_entries_are_rejected_before_extraction(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = self.build_release(root, "0.1.0", "a" * 40)
            archive = root / "duplicate.zip"
            with warnings.catch_warnings():
                warnings.simplefilter("ignore", UserWarning)
                with zipfile.ZipFile(archive, "w") as bundle:
                    bundle.writestr("Jarvis-Lite/duplicate.txt", "first")
                    bundle.writestr("Jarvis-Lite/duplicate.txt", "second")
            checksum = root / "duplicate.zip.sha256"
            checksum.write_text(
                f"{digest(archive)}  duplicate.zip\n", encoding="utf-8"
            )

            with self.assertRaisesRegex(self.updater.UpdateError, "Duplicate"):
                self.updater.preflight(
                    consumer, archive, checksum, root / "duplicate-stage"
                )

            self.assertFalse((root / "duplicate-stage").exists())

            alias = root / "alias.zip"
            with zipfile.ZipFile(alias, "w") as bundle:
                bundle.writestr("Jarvis-Lite/value.txt", "first")
                bundle.writestr("Jarvis-Lite/./value.txt", "second")
            alias_checksum = root / "alias.zip.sha256"
            alias_checksum.write_text(
                f"{digest(alias)}  alias.zip\n", encoding="utf-8"
            )
            with self.assertRaisesRegex(self.updater.UpdateError, "unsafe"):
                self.updater.preflight(
                    consumer, alias, alias_checksum, root / "alias-stage"
                )
            self.assertFalse((root / "alias-stage").exists())

    def test_symlinked_consumer_parent_cannot_redirect_managed_paths(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = self.build_release(root, "0.1.0", "a" * 40)
            target = self.build_release(root, "0.2.0", "b" * 40)
            outside = root / "outside"
            outside.mkdir()
            shutil.rmtree(consumer / ".claude")
            (consumer / ".claude").symlink_to(outside, target_is_directory=True)
            artifact_dir = root / "artifact"
            artifact_dir.mkdir()
            archive, checksum = make_zip(target, artifact_dir)

            with self.assertRaisesRegex(self.updater.UpdateError, "symlink"):
                self.updater.preflight(
                    consumer, archive, checksum, root / "symlink-stage"
                )

            self.assertEqual(list(outside.iterdir()), [])

    def test_broken_symlink_at_managed_path_is_blocked_and_preserved(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = self.build_release(root, "0.1.0", "a" * 40)
            target = self.build_release(root, "0.2.0", "b" * 40)
            managed = consumer / ".claude/skills/briefing/SKILL.md"
            managed.unlink()
            managed.symlink_to(root / "missing-target")
            artifact_dir = root / "artifact"
            artifact_dir.mkdir()
            archive, checksum = make_zip(target, artifact_dir)

            report = self.updater.preflight(
                consumer, archive, checksum, root / "broken-link-stage"
            )

            self.assertEqual(report["status"], "blocked")
            self.assertEqual(
                report["components"]["briefing"]["classification"],
                "blocked",
            )
            self.assertTrue(managed.is_symlink())

            state_link_consumer = self.build_release(root, "0.1.0", "c" * 40)
            state_link = state_link_consumer / ".jarvis-update/state.json"
            state_link.unlink()
            state_link.symlink_to(root / "missing-state")
            with self.assertRaisesRegex(
                self.updater.UpdateError, "state is not a regular file"
            ):
                self.updater.preflight(
                    state_link_consumer,
                    archive,
                    checksum,
                    root / "state-link-stage",
                )
            self.assertTrue(state_link.is_symlink())

    def test_overlapping_functional_change_needs_a_decision_but_control_plane_does_not(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = self.build_release(root, "0.1.0", "a" * 40)
            target = self.build_release(root, "0.2.0", "b" * 40)
            change_mirrored_skill(
                target,
                "save-session",
                "SKILL.md",
                "target save-session behavior\n",
            )
            change_mirrored_skill(
                target,
                "jarvis-doctor",
                "SKILL.md",
                "target canonical doctor\n",
            )
            for runtime in [".claude", ".agents"]:
                (consumer / runtime / "skills/save-session/SKILL.md").write_text(
                    "local vertical save-session\n", encoding="utf-8"
                )
                (consumer / runtime / "skills/jarvis-doctor/SKILL.md").write_text(
                    "local modified doctor\n", encoding="utf-8"
                )
            local_extension = consumer / "local-skills/weekly-review/SKILL.md"
            local_extension.parent.mkdir(parents=True)
            local_extension.write_text("local extension\n", encoding="utf-8")
            artifact_dir = root / "artifact"
            artifact_dir.mkdir()
            archive, checksum = make_zip(target, artifact_dir)

            report = self.updater.preflight(
                consumer, archive, checksum, root / "stage"
            )

            self.assertEqual(report["status"], "decision")
            self.assertEqual(
                report["components"]["save-session"]["classification"],
                "decision",
            )
            self.assertIsNone(report["components"]["save-session"]["action"])
            self.assertEqual(
                report["components"]["jarvis-doctor"]["classification"],
                "safe",
            )
            self.assertEqual(
                report["components"]["jarvis-doctor"]["action"],
                "replace",
            )
            self.assertNotIn(
                "local-skills/weekly-review/SKILL.md",
                {item["path"] for item in report["paths"]},
            )

    def test_new_unmanaged_collision_blocks_and_target_mirrors_must_match(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = self.build_release(root, "0.1.0", "a" * 40)
            target = self.build_release(root, "0.2.0", "b" * 40)
            add_managed_pair(
                target,
                "new-functional",
                "SKILL.md",
                "target capability\n",
                "functional",
            )
            for runtime in [".claude", ".agents"]:
                collision = consumer / runtime / "skills/new-functional/SKILL.md"
                collision.parent.mkdir(parents=True)
                collision.write_text("unmanaged local capability\n", encoding="utf-8")
            artifact_dir = root / "artifact"
            artifact_dir.mkdir()
            archive, checksum = make_zip(target, artifact_dir)

            report = self.updater.preflight(
                consumer, archive, checksum, root / "stage"
            )
            self.assertEqual(report["status"], "blocked")
            self.assertEqual(
                report["components"]["new-functional"]["classification"],
                "blocked",
            )

            broken_target = self.build_release(root, "0.3.0", "c" * 40)
            one_mirror = broken_target / ".claude/skills/briefing/SKILL.md"
            one_mirror.write_text("incoherent target\n", encoding="utf-8")
            refresh_package_metadata(broken_target)
            broken_dir = root / "broken-artifact"
            broken_dir.mkdir()
            broken_archive, broken_checksum = make_zip(broken_target, broken_dir)
            with self.assertRaisesRegex(self.updater.UpdateError, "incoherent"):
                self.updater.preflight(
                    consumer,
                    broken_archive,
                    broken_checksum,
                    root / "broken-stage",
                )

    def test_blocked_path_is_not_downgraded_when_local_mirrors_diverge(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = self.build_release(root, "0.1.0", "a" * 40)
            target = self.build_release(root, "0.2.0", "b" * 40)
            add_managed_pair(
                target,
                "new-functional",
                "SKILL.md",
                "target capability\n",
                "functional",
            )
            collision = consumer / ".claude/skills/new-functional/SKILL.md"
            collision.parent.mkdir(parents=True)
            collision.write_text("unmanaged local capability\n", encoding="utf-8")
            artifact_dir = root / "artifact"
            artifact_dir.mkdir()
            archive, checksum = make_zip(target, artifact_dir)

            report = self.updater.preflight(
                consumer, archive, checksum, root / "stage"
            )

            component = report["components"]["new-functional"]
            self.assertEqual(component["classification"], "blocked")
            self.assertIsNone(component["action"])

    def test_version_relation_blocks_downgrade_and_rebuilt_same_version(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = self.build_release(root, "0.2.0", "b" * 40)

            older = self.build_release(root, "0.1.0", "a" * 40)
            older_dir = root / "older-artifact"
            older_dir.mkdir()
            older_archive, older_checksum = make_zip(older, older_dir)
            older_report = self.updater.preflight(
                consumer, older_archive, older_checksum, root / "older-stage"
            )
            self.assertEqual(older_report["target_relation"], "older")
            self.assertEqual(older_report["status"], "blocked")

            rebuilt = self.build_release(root, "0.2.0", "c" * 40)
            rebuilt_dir = root / "rebuilt-artifact"
            rebuilt_dir.mkdir()
            rebuilt_archive, rebuilt_checksum = make_zip(rebuilt, rebuilt_dir)
            rebuilt_report = self.updater.preflight(
                consumer,
                rebuilt_archive,
                rebuilt_checksum,
                root / "rebuilt-stage",
            )
            self.assertEqual(rebuilt_report["target_relation"], "rebuilt")
            self.assertEqual(rebuilt_report["status"], "blocked")

    def test_unreleased_source_build_can_adopt_the_first_semantic_release(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = build_starter(ROOT, root / "source-build")
            target = self.build_release(root, "0.1.0", "a" * 40)
            artifact_dir = root / "artifact"
            artifact_dir.mkdir()
            archive, checksum = make_zip(target, artifact_dir)

            report = self.updater.preflight(
                consumer, archive, checksum, root / "stage"
            )

            self.assertEqual(report["installed_release"], "unreleased")
            self.assertEqual(report["target_relation"], "adoption")
            self.assertEqual(report["status"], "ready")

    def test_pre_updater_adoption_requires_a_recognizable_lite_consumer(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            target = self.build_release(root, "0.2.0", "b" * 40)
            artifact_dir = root / "artifact"
            artifact_dir.mkdir()
            archive, checksum = make_zip(target, artifact_dir)

            unknown = root / "unknown-consumer"
            unknown.mkdir()
            (unknown / "CLAUDE.md").write_text(
                "unrelated workspace\n", encoding="utf-8"
            )
            with self.assertRaisesRegex(
                self.updater.UpdateError, "identity is missing or ambiguous"
            ):
                self.updater.preflight(
                    unknown, archive, checksum, root / "unknown-stage"
                )

            legacy = self.build_release(root, "0.1.0", "a" * 40)
            (legacy / ".jarvis-update/state.json").unlink()
            (legacy / "99 - Jarvis/system/release-manifest.json").unlink()
            report = self.updater.preflight(
                legacy, archive, checksum, root / "legacy-stage"
            )
            self.assertTrue(report["legacy_install"])
            self.assertEqual(report["target_relation"], "adoption")
            self.assertEqual(report["status"], "ready")

    def test_manifest_cannot_claim_consumer_owned_paths_or_false_ownership(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = self.build_release(root, "0.1.0", "a" * 40)
            target = self.build_release(root, "0.2.0", "b" * 40)
            manifest_path = target / "99 - Jarvis/system/release-manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            manifest["managed_files"].append(
                {
                    "path": "CLAUDE.md",
                    "sha256": digest(target / "CLAUDE.md"),
                    "ownership": "control-plane",
                    "component": "local-profile",
                    "dependencies": [],
                }
            )
            manifest_path.write_text(
                json.dumps(manifest, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )
            refresh_package_metadata(target)
            artifact_dir = root / "artifact"
            artifact_dir.mkdir()
            archive, checksum = make_zip(target, artifact_dir)
            with self.assertRaisesRegex(self.updater.UpdateError, "managed roots"):
                self.updater.preflight(
                    consumer, archive, checksum, root / "consumer-path-stage"
                )

            target = self.build_release(root, "0.3.0", "c" * 40)
            manifest_path = target / "99 - Jarvis/system/release-manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            update_entry = next(
                entry
                for entry in manifest["managed_files"]
                if entry["path"] == ".claude/skills/jarvis-update/SKILL.md"
            )
            update_entry["ownership"] = "functional"
            manifest_path.write_text(
                json.dumps(manifest, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )
            refresh_package_metadata(target)
            false_dir = root / "false-ownership-artifact"
            false_dir.mkdir()
            false_archive, false_checksum = make_zip(target, false_dir)
            with self.assertRaisesRegex(self.updater.UpdateError, "ownership"):
                self.updater.preflight(
                    consumer,
                    false_archive,
                    false_checksum,
                    root / "false-ownership-stage",
                )

    def test_migration_cannot_overlap_managed_or_update_state_paths(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = self.build_release(root, "0.1.0", "a" * 40)
            forbidden = [
                ".claude/skills/briefing/SKILL.md",
                ".jarvis-update/state.json",
            ]
            for index, relative in enumerate(forbidden):
                target = self.build_release(
                    root, f"0.{index + 2}.0", chr(ord("b") + index) * 40
                )
                add_migration(
                    target,
                    f"invalid-{index}",
                    ["briefing"],
                    [relative],
                    required=True,
                )
                artifact_dir = root / f"artifact-{index}"
                artifact_dir.mkdir()
                archive, checksum = make_zip(target, artifact_dir)

                with self.assertRaisesRegex(
                    self.updater.UpdateError, "overlaps managed update state"
                ):
                    self.updater.preflight(
                        consumer,
                        archive,
                        checksum,
                        root / f"stage-{index}",
                    )

    def test_divergent_local_functional_mirrors_are_a_decision_not_a_silent_preserve(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = self.build_release(root, "0.1.0", "a" * 40)
            target = self.build_release(root, "0.2.0", "b" * 40)
            (consumer / ".claude/skills/briefing/SKILL.md").write_text(
                "one-runtime-only customization\n", encoding="utf-8"
            )
            artifact_dir = root / "artifact"
            artifact_dir.mkdir()
            archive, checksum = make_zip(target, artifact_dir)

            report = self.updater.preflight(
                consumer, archive, checksum, root / "stage"
            )

            self.assertEqual(report["status"], "decision")
            component = report["components"]["briefing"]
            self.assertEqual(component["classification"], "decision")
            self.assertIn("runtime mirrors diverge", component["reasons"])


class LiteUpdateApplyTest(unittest.TestCase):
    def setUp(self):
        self.updater = load_updater()

    def build_release(self, parent: Path, version: str, commit: str) -> Path:
        return build_starter(
            ROOT,
            parent / f"release-{version}-{commit[:8]}",
            release_version=version,
            source_commit=commit,
            release_summary=f"Release {version} changes update behavior.",
        )

    def prepare_changed_update(self, root: Path):
        consumer = self.build_release(root, "0.1.0", "a" * 40)
        target = self.build_release(root, "0.2.0", "b" * 40)
        change_mirrored_skill(
            target,
            "briefing",
            "SKILL.md",
            "target briefing\n",
        )
        change_mirrored_skill(
            target,
            "jarvis-doctor",
            "SKILL.md",
            "target canonical doctor\n",
        )
        artifact_dir = root / "artifact"
        artifact_dir.mkdir()
        archive, checksum = make_zip(target, artifact_dir)
        report = self.updater.preflight(
            consumer, archive, checksum, root / "stage"
        )
        return consumer, target, report

    def test_plan_and_apply_require_resolved_decisions_and_explicit_approval(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer, _, report = self.prepare_changed_update(root)
            plan = self.updater.plan_update(report, {})
            before = snapshot(consumer)

            with self.assertRaisesRegex(self.updater.UpdateError, "approval"):
                self.updater.apply_update(consumer, plan, approved=False)

            self.assertEqual(snapshot(consumer), before)

            target = self.build_release(root, "0.3.0", "c" * 40)
            change_mirrored_skill(
                target,
                "save-session",
                "SKILL.md",
                "target save-session\n",
            )
            for runtime in [".claude", ".agents"]:
                (consumer / runtime / "skills/save-session/SKILL.md").write_text(
                    "local save-session\n", encoding="utf-8"
                )
            decision_dir = root / "decision-artifact"
            decision_dir.mkdir()
            archive, checksum = make_zip(target, decision_dir)
            decision_report = self.updater.preflight(
                consumer, archive, checksum, root / "decision-stage"
            )
            with self.assertRaisesRegex(self.updater.UpdateError, "save-session"):
                self.updater.plan_update(decision_report, {})

    def test_apply_replaces_managed_files_with_scoped_recovery(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer, target, report = self.prepare_changed_update(root)
            for runtime in [".claude", ".agents"]:
                (consumer / runtime / "skills/jarvis-doctor/SKILL.md").write_text(
                    "local modified doctor\n", encoding="utf-8"
                )
            personal = consumer / "01 - Diary/2026/09/2026-09-03.md"
            personal.parent.mkdir(parents=True)
            personal.write_text("private daily history\n", encoding="utf-8")
            artifact_dir = root / "artifact-2"
            artifact_dir.mkdir()
            archive, checksum = make_zip(target, artifact_dir)
            report = self.updater.preflight(
                consumer, archive, checksum, root / "stage-2"
            )
            plan = self.updater.plan_update(report, {})
            result = self.updater.apply_update(consumer, plan, approved=True)

            self.assertEqual(result["status"], "updated")
            self.assertEqual(result["effective_release"], "0.2.0")
            self.assertEqual(personal.read_text(encoding="utf-8"), "private daily history\n")
            for runtime in [".claude", ".agents"]:
                for component in ["briefing", "jarvis-doctor"]:
                    relative = Path(runtime) / "skills" / component / "SKILL.md"
                    self.assertEqual(
                        (consumer / relative).read_bytes(),
                        (target / relative).read_bytes(),
                    )

            recovery = Path(result["recovery"])
            self.assertTrue(recovery.is_dir())
            inventory = json.loads(
                (recovery / "inventory.json").read_text(encoding="utf-8")
            )
            recovered_paths = {item["path"] for item in inventory["files"]}
            self.assertIn(".jarvis-update/state.json", recovered_paths)
            self.assertIn("99 - Jarvis/system/release-manifest.json", recovered_paths)
            self.assertNotIn(personal.relative_to(consumer).as_posix(), recovered_paths)
            old_doctor = recovery / "files/.claude/skills/jarvis-doctor/SKILL.md"
            self.assertEqual(
                old_doctor.read_text(encoding="utf-8"),
                "local modified doctor\n",
            )

            state = json.loads(
                (consumer / ".jarvis-update/state.json").read_text(encoding="utf-8")
            )
            self.assertEqual(state["accepted_release"], "0.2.0")
            self.assertEqual(
                state["last_recovery"],
                recovery.relative_to(consumer.resolve()).as_posix(),
            )
            self.assertTrue(self.updater.focused_verify(consumer)["ok"])


    def test_cli_runs_preflight_plan_apply_verify_and_approved_rollback(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = build_starter(
                ROOT,
                root / "consumer",
                release_version="0.1.0",
                source_commit="a" * 40,
                release_summary="Installed release.",
            )
            target = build_starter(
                ROOT,
                root / "target",
                release_version="0.2.0",
                source_commit="b" * 40,
                release_summary="Target release.",
            )
            change_mirrored_skill(
                target, "briefing", "SKILL.md", "target briefing behavior\n"
            )
            artifact_dir = root / "artifact"
            artifact_dir.mkdir()
            archive, checksum = make_zip(target, artifact_dir)
            report_path = root / "report.json"
            plan_path = root / "plan.json"
            decisions_path = root / "decisions.json"
            decisions_path.write_text("{}\n", encoding="utf-8")

            unsafe_report = consumer / "preflight-report.json"
            unsafe_stage = root / "unsafe-output-stage"
            unsafe_output_result = subprocess.run(
                [
                    sys.executable,
                    str(UPDATER_PATH),
                    "preflight",
                    "--consumer",
                    str(consumer),
                    "--artifact",
                    str(archive),
                    "--checksum",
                    str(checksum),
                    "--stage-parent",
                    str(unsafe_stage),
                    "--output",
                    str(unsafe_report),
                ],
                text=True,
                capture_output=True,
            )
            self.assertEqual(unsafe_output_result.returncode, 2)
            self.assertIn("outside the consumer", unsafe_output_result.stderr)
            self.assertFalse(unsafe_report.exists())
            self.assertFalse(unsafe_stage.exists())

            preflight_result = subprocess.run(
                [
                    sys.executable,
                    str(UPDATER_PATH),
                    "preflight",
                    "--consumer",
                    str(consumer),
                    "--artifact",
                    str(archive),
                    "--checksum",
                    str(checksum),
                    "--stage-parent",
                    str(root / "stage"),
                    "--output",
                    str(report_path),
                ],
                text=True,
                capture_output=True,
            )
            self.assertEqual(preflight_result.returncode, 0, preflight_result.stderr)
            self.assertEqual(json.loads(report_path.read_text())["status"], "ready")

            plan_result = subprocess.run(
                [
                    sys.executable,
                    str(UPDATER_PATH),
                    "plan",
                    "--report",
                    str(report_path),
                    "--decisions",
                    str(decisions_path),
                    "--output",
                    str(plan_path),
                ],
                text=True,
                capture_output=True,
            )
            self.assertEqual(plan_result.returncode, 0, plan_result.stderr)

            refused = subprocess.run(
                [
                    sys.executable,
                    str(UPDATER_PATH),
                    "apply",
                    "--consumer",
                    str(consumer),
                    "--plan",
                    str(plan_path),
                ],
                text=True,
                capture_output=True,
            )
            self.assertNotEqual(refused.returncode, 0)
            self.assertIn("approval", refused.stderr.lower())

            applied = subprocess.run(
                [
                    sys.executable,
                    str(UPDATER_PATH),
                    "apply",
                    "--consumer",
                    str(consumer),
                    "--plan",
                    str(plan_path),
                    "--approved",
                ],
                text=True,
                capture_output=True,
            )
            self.assertEqual(applied.returncode, 0, applied.stderr)
            applied_result = json.loads(applied.stdout)
            recovery = applied_result["recovery"]

            verified = subprocess.run(
                [
                    sys.executable,
                    str(UPDATER_PATH),
                    "verify",
                    "--consumer",
                    str(consumer),
                ],
                text=True,
                capture_output=True,
            )
            self.assertEqual(verified.returncode, 0, verified.stderr)
            self.assertTrue(json.loads(verified.stdout)["ok"])

            rolled_back = subprocess.run(
                [
                    sys.executable,
                    str(UPDATER_PATH),
                    "rollback",
                    "--consumer",
                    str(consumer),
                    "--recovery",
                    recovery,
                    "--approved",
                ],
                text=True,
                capture_output=True,
            )
            self.assertEqual(rolled_back.returncode, 0, rolled_back.stderr)
            state = json.loads(
                (consumer / ".jarvis-update/state.json").read_text(encoding="utf-8")
            )
            self.assertEqual(state["accepted_release"], "0.1.0")

    def test_interruption_keeps_old_state_and_rollback_restores_all_in_scope_paths(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer, _, report = self.prepare_changed_update(root)
            personal = consumer / "To Do.md"
            personal_before = personal.read_bytes()
            state_before = (consumer / ".jarvis-update/state.json").read_bytes()
            before = snapshot(consumer)
            plan = self.updater.plan_update(report, {})
            real_install = self.updater._install_file
            calls = 0

            def interrupt_after_first(source, destination):
                nonlocal calls
                real_install(source, destination)
                calls += 1
                if calls == 1:
                    raise OSError("simulated interruption")

            with mock.patch.object(
                self.updater, "_install_file", side_effect=interrupt_after_first
            ):
                with self.assertRaises(self.updater.PartialUpdateError) as caught:
                    self.updater.apply_update(consumer, plan, approved=True)

            self.assertEqual(
                (consumer / ".jarvis-update/state.json").read_bytes(), state_before
            )
            self.assertEqual(personal.read_bytes(), personal_before)
            recovery = Path(caught.exception.recovery)
            self.assertTrue(recovery.is_dir())
            self.assertTrue(caught.exception.applied_paths)

            result = self.updater.rollback_update(consumer, recovery)

            self.assertEqual(result["status"], "rolled_back")
            for relative, content in before.items():
                self.assertEqual((consumer / relative).read_bytes(), content, relative)
            self.assertTrue(recovery.is_dir())

    def test_rollback_refuses_to_overwrite_changes_made_after_update(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer, _, report = self.prepare_changed_update(root)
            plan = self.updater.plan_update(report, {})
            result = self.updater.apply_update(consumer, plan, approved=True)
            edited = consumer / ".claude/skills/briefing/SKILL.md"
            edited.write_text("user edit after update\n", encoding="utf-8")
            before_rollback = snapshot(consumer)

            with self.assertRaisesRegex(
                self.updater.UpdateError, "changed since update"
            ):
                self.updater.rollback_update(consumer, Path(result["recovery"]))

            self.assertEqual(snapshot(consumer), before_rollback)

    def test_merge_overlay_updates_both_mirrors_and_records_the_override(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = self.build_release(root, "0.1.0", "a" * 40)
            target = self.build_release(root, "0.2.0", "b" * 40)
            change_mirrored_skill(
                target,
                "save-session",
                "SKILL.md",
                "target save-session\n",
            )
            for runtime in [".claude", ".agents"]:
                (consumer / runtime / "skills/save-session/SKILL.md").write_text(
                    "local save-session\n", encoding="utf-8"
                )
            artifact_dir = root / "artifact"
            artifact_dir.mkdir()
            archive, checksum = make_zip(target, artifact_dir)
            report = self.updater.preflight(
                consumer, archive, checksum, root / "stage"
            )
            overlay = root / "overlay"
            for runtime in [".claude", ".agents"]:
                shutil.copytree(
                    target / runtime / "skills/save-session",
                    overlay / runtime / "skills/save-session",
                )
                (overlay / runtime / "skills/save-session/SKILL.md").write_text(
                    "merged local and target behavior\n", encoding="utf-8"
                )

            plan = self.updater.plan_update(
                report,
                {
                    "save-session": {
                        "action": "merge",
                        "overlay_root": str(overlay),
                    }
                },
            )
            result = self.updater.apply_update(consumer, plan, approved=True)

            self.assertEqual(result["status"], "updated_with_preserved_overrides")
            for runtime in [".claude", ".agents"]:
                relative = f"{runtime}/skills/save-session/SKILL.md"
                self.assertEqual(
                    (consumer / relative).read_text(encoding="utf-8"),
                    "merged local and target behavior\n",
                )
            state = json.loads(
                (consumer / ".jarvis-update/state.json").read_text(encoding="utf-8")
            )
            for runtime in [".claude", ".agents"]:
                relative = f"{runtime}/skills/save-session/SKILL.md"
                self.assertEqual(state["overrides"][relative]["decision"], "merge")
            self.assertTrue(self.updater.focused_verify(consumer)["ok"])

    def test_obsolete_files_are_deleted_only_at_baseline_and_modified_ones_can_be_postponed(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = self.build_release(root, "0.1.0", "a" * 40)
            add_managed_pair(
                consumer,
                "retired-skill",
                "SKILL.md",
                "old canonical behavior\n",
                "functional",
            )
            target = self.build_release(root, "0.2.0", "b" * 40)
            artifact_dir = root / "artifact"
            artifact_dir.mkdir()
            archive, checksum = make_zip(target, artifact_dir)
            report = self.updater.preflight(
                consumer, archive, checksum, root / "stage"
            )
            self.assertEqual(report["components"]["retired-skill"]["action"], "delete")
            plan = self.updater.plan_update(report, {})
            self.updater.apply_update(consumer, plan, approved=True)
            for runtime in [".claude", ".agents"]:
                self.assertFalse(
                    (consumer / runtime / "skills/retired-skill/SKILL.md").exists()
                )

            changed = self.build_release(root, "0.1.0", "c" * 40)
            add_managed_pair(
                changed,
                "retired-skill",
                "SKILL.md",
                "old canonical behavior\n",
                "functional",
            )
            for runtime in [".claude", ".agents"]:
                (changed / runtime / "skills/retired-skill/SKILL.md").write_text(
                    "local retained behavior\n", encoding="utf-8"
                )
            changed_report = self.updater.preflight(
                changed, archive, checksum, root / "changed-stage"
            )
            self.assertEqual(changed_report["status"], "decision")
            changed_plan = self.updater.plan_update(
                changed_report, {"retired-skill": "postpone"}
            )
            changed_result = self.updater.apply_update(
                changed, changed_plan, approved=True
            )
            self.assertEqual(
                changed_result["status"], "updated_with_preserved_overrides"
            )
            state = json.loads(
                (changed / ".jarvis-update/state.json").read_text(encoding="utf-8")
            )
            self.assertIn("retired-skill", state["postponed_components"])
            for runtime in [".claude", ".agents"]:
                relative = f"{runtime}/skills/retired-skill/SKILL.md"
                self.assertTrue((changed / relative).is_file())
                self.assertIn(relative, state["baseline"])
                self.assertIn(relative, state["overrides"])
            self.assertTrue(self.updater.focused_verify(changed)["ok"])

    def test_managed_change_after_preflight_stops_before_recovery_or_mutation(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer, _, report = self.prepare_changed_update(root)
            plan = self.updater.plan_update(report, {})
            changed = consumer / ".claude/skills/briefing/SKILL.md"
            changed.write_text("concurrent local edit\n", encoding="utf-8")
            recovery_root = consumer / ".jarvis-update/recovery"

            with self.assertRaisesRegex(self.updater.UpdateError, "changed after preflight"):
                self.updater.apply_update(consumer, plan, approved=True)

            self.assertEqual(changed.read_text(encoding="utf-8"), "concurrent local edit\n")
            self.assertFalse(recovery_root.exists())

    def test_symlink_parent_added_after_preflight_stops_before_mutation(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer, _, report = self.prepare_changed_update(root)
            plan = self.updater.plan_update(report, {})
            (consumer / ".claude").rename(root / "original-claude")
            outside = root / "outside"
            outside.mkdir()
            (consumer / ".claude").symlink_to(outside, target_is_directory=True)
            agents_before = snapshot(consumer / ".agents")

            with self.assertRaisesRegex(self.updater.UpdateError, "symlink"):
                self.updater.apply_update(consumer, plan, approved=True)

            self.assertEqual(snapshot(consumer / ".agents"), agents_before)
            self.assertEqual(list(outside.iterdir()), [])
            self.assertFalse((consumer / ".jarvis-update/recovery").exists())

    def test_tampered_report_or_approved_plan_is_rejected_before_recovery(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer, target, report = self.prepare_changed_update(root)
            tampered_report = json.loads(json.dumps(report))
            tampered_report["target_release"] = "9.9.9"
            with self.assertRaisesRegex(self.updater.UpdateError, "integrity"):
                self.updater.plan_update(tampered_report, {})

            plan = self.updater.plan_update(report, {})
            plan["operations"].append(
                {
                    "path": "CLAUDE.md",
                    "operation": "write",
                    "expected_current_sha256": digest(consumer / "CLAUDE.md"),
                    "source": str(target / "CLAUDE.md"),
                    "source_sha256": digest(target / "CLAUDE.md"),
                }
            )
            before = snapshot(consumer)

            with self.assertRaisesRegex(self.updater.UpdateError, "integrity"):
                self.updater.apply_update(consumer, plan, approved=True)

            self.assertEqual(snapshot(consumer), before)
            self.assertFalse((consumer / ".jarvis-update/recovery").exists())

    def test_required_migration_can_be_postponed_only_with_the_complete_legacy_writer_set(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = self.build_release(root, "0.1.0", "a" * 40)
            target = self.build_release(root, "0.2.0", "b" * 40)
            writers = ["briefing", "save-session", "handoff"]
            for component in writers:
                change_mirrored_skill(
                    target,
                    component,
                    "SKILL.md",
                    f"target {component} diary-only behavior\n",
                )
            add_migration(
                target,
                "diary-only-v1",
                writers,
                ["CLAUDE.md"],
                required=True,
            )
            artifact_dir = root / "artifact"
            artifact_dir.mkdir()
            archive, checksum = make_zip(target, artifact_dir)
            report = self.updater.preflight(
                consumer, archive, checksum, root / "stage"
            )
            self.assertEqual(report["status"], "decision")
            self.assertEqual(report["migrations"][0]["classification"], "decision")

            incomplete = {
                "_migrations": {"diary-only-v1": "postpone"},
                "save-session": "postpone",
            }
            with self.assertRaisesRegex(
                self.updater.UpdateError, "complete compatible functional overlay"
            ):
                self.updater.plan_update(report, incomplete)

            complete = {
                "_migrations": {"diary-only-v1": "postpone"},
                **{component: "postpone" for component in writers},
            }
            plan = self.updater.plan_update(report, complete)
            result = self.updater.apply_update(consumer, plan, approved=True)

            self.assertEqual(result["status"], "updated_with_preserved_overrides")
            state = json.loads(
                (consumer / ".jarvis-update/state.json").read_text(encoding="utf-8")
            )
            self.assertEqual(state["postponed_migrations"], ["diary-only-v1"])
            self.assertEqual(state["postponed_components"], sorted(writers))
            for component in writers:
                for runtime in [".claude", ".agents"]:
                    self.assertNotEqual(
                        (consumer / runtime / f"skills/{component}/SKILL.md").read_bytes(),
                        (target / runtime / f"skills/{component}/SKILL.md").read_bytes(),
                    )
            self.assertTrue(self.updater.focused_verify(consumer)["ok"])

    def test_approved_migration_overlay_is_recovered_applied_and_verified(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = self.build_release(root, "0.1.0", "a" * 40)
            target = self.build_release(root, "0.2.0", "b" * 40)
            add_migration(
                target,
                "profile-contract-v1",
                ["jarvis-core"],
                ["CLAUDE.md"],
                required=True,
            )
            artifact_dir = root / "artifact"
            artifact_dir.mkdir()
            archive, checksum = make_zip(target, artifact_dir)
            report = self.updater.preflight(
                consumer, archive, checksum, root / "stage"
            )
            overlay = root / "migration-overlay"
            overlay.mkdir()
            (overlay / "CLAUDE.md").write_text(
                "approved migrated profile\n", encoding="utf-8"
            )
            plan = self.updater.plan_update(
                report,
                {
                    "_migrations": {
                        "profile-contract-v1": {
                            "action": "apply",
                            "overlay_root": str(overlay),
                        }
                    }
                },
            )
            result = self.updater.apply_update(consumer, plan, approved=True)

            self.assertEqual(
                (consumer / "CLAUDE.md").read_text(encoding="utf-8"),
                "approved migrated profile\n",
            )
            recovery = Path(result["recovery"])
            self.assertTrue((recovery / "files/CLAUDE.md").is_file())
            state = json.loads(
                (consumer / ".jarvis-update/state.json").read_text(encoding="utf-8")
            )
            expected_hash = hashlib.sha256(b"approved migrated profile\n").hexdigest()
            self.assertEqual(
                state["applied_migrations"]["profile-contract-v1"]["CLAUDE.md"],
                expected_hash,
            )
            self.assertEqual(state["postponed_migrations"], [])
            self.assertTrue(self.updater.focused_verify(consumer)["ok"])

    def test_partial_postpone_is_blocked_when_an_updated_component_depends_on_it(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            consumer = self.build_release(root, "0.1.0", "a" * 40)
            target = self.build_release(root, "0.2.0", "b" * 40)
            change_mirrored_skill(
                target,
                "save-session",
                "SKILL.md",
                "target save-session\n",
            )
            for runtime in [".claude", ".agents"]:
                (consumer / runtime / "skills/save-session/SKILL.md").write_text(
                    "local save-session\n", encoding="utf-8"
                )
            manifest_path = target / "99 - Jarvis/system/release-manifest.json"
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            for entry in manifest["managed_files"]:
                if entry["component"] == "briefing":
                    entry["dependencies"] = ["save-session"]
            manifest_path.write_text(
                json.dumps(manifest, indent=2, sort_keys=True) + "\n",
                encoding="utf-8",
            )
            refresh_package_metadata(target)
            artifact_dir = root / "artifact"
            artifact_dir.mkdir()
            archive, checksum = make_zip(target, artifact_dir)
            report = self.updater.preflight(
                consumer, archive, checksum, root / "stage"
            )

            with self.assertRaisesRegex(self.updater.UpdateError, "dependency"):
                self.updater.plan_update(report, {"save-session": "postpone"})


if __name__ == "__main__":
    unittest.main()
