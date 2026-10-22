from __future__ import annotations

import hashlib
import importlib.util
import json
import os
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from scripts.build_starter import build_starter


ROOT = Path(__file__).resolve().parents[1]
HELPER = ROOT / "skills/jarvis-update/scripts/adoption_recovery.py"


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def tree(root: Path) -> dict[str, bytes]:
    return {p.relative_to(root).as_posix(): p.read_bytes()
            for p in root.rglob("*") if p.is_file()}


class AdoptionRecoveryTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        assert HELPER.is_file(), "Missing scoped adoption recovery helper"
        spec = importlib.util.spec_from_file_location("adoption_recovery", HELPER)
        cls.helper = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.helper)

    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.addCleanup(self.temporary.cleanup)
        self.root = Path(self.temporary.name)
        self.consumer = self.root / "consumer"
        self.consumer.mkdir()
        (self.consumer / "profile").mkdir()
        (self.consumer / "profile/character.md").write_bytes(b"Be concise.\n")
        (self.consumer / "CHANGELOG.md").write_bytes(b"# History\n")
        (self.consumer / "private.md").write_bytes(b"Keep this unrelated note.\n")
        self.plan = {
            "source": {"label": "v0.5.0", "commit": "a" * 40},
            "capabilities": ["soul-proactive-help-v1"],
            "record_path": "CHANGELOG.md",
            "recovery": ".jarvis-adoption/recovery/example",
            "changes": [],
        }
        self.add_change("profile/character.md", b"Be concise. Suggest useful next steps.\n")
        self.add_change("CHANGELOG.md", b"# History\nAdopted soul-proactive-help-v1 from v0.5.0.\n")

    def add_change(self, relative: str, after: bytes):
        proposed = self.root / f"after-{len(self.plan['changes'])}"
        proposed.write_bytes(after)
        target = self.consumer / relative
        self.plan["changes"].append({
            "path": relative,
            "before_sha256": digest(target.read_bytes()) if target.is_file() else None,
            "after_file": str(proposed),
            "after_sha256": digest(after),
        })

    def prepare(self):
        return self.helper.prepare(self.consumer, self.plan, approved=True)

    def apply(self, indexes=None):
        changes = self.plan["changes"]
        for index in range(len(changes)) if indexes is None else indexes:
            change = changes[index]
            target = self.consumer / change["path"]
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(Path(change["after_file"]).read_bytes())

    def test_prepare_requires_approval_and_changes_no_consumer_content(self):
        before = tree(self.consumer)
        with self.assertRaisesRegex(self.helper.RecoveryError, "approval"):
            self.helper.prepare(self.consumer, self.plan)
        self.assertEqual(tree(self.consumer), before)
        recovery = self.prepare()
        self.assertEqual(self.helper.inspect(self.consumer, recovery)["status"], "not-applied")
        for path, content in before.items():
            self.assertEqual((self.consumer / path).read_bytes(), content)

    def test_changed_preview_is_rejected_before_any_recovery_write(self):
        (self.consumer / "profile/character.md").write_bytes(b"A newer preference.\n")
        before = tree(self.consumer)
        with self.assertRaisesRegex(self.helper.RecoveryError, "changed"):
            self.prepare()
        self.assertEqual(tree(self.consumer), before)
        self.assertFalse((self.consumer / ".jarvis-adoption").exists())

    def test_inspection_and_verification_are_read_only(self):
        recovery = self.prepare()
        self.apply()
        before = tree(self.consumer)
        self.assertEqual(self.helper.inspect(self.consumer, recovery)["status"], "applied")
        self.helper.verify(self.consumer, recovery)
        self.assertEqual(tree(self.consumer), before)

    def test_changed_proposed_content_is_rejected_before_recovery(self):
        Path(self.plan["changes"][0]["after_file"]).write_bytes(b"Different from the preview.\n")
        before = tree(self.consumer)
        with self.assertRaisesRegex(self.helper.RecoveryError, "[Pp]roposed.*changed"):
            self.prepare()
        self.assertEqual(tree(self.consumer), before)

    def test_interruption_is_reported_and_partial_changes_can_be_rolled_back(self):
        before = tree(self.consumer)
        recovery = self.prepare()
        self.apply([0])
        report = self.helper.inspect(self.consumer, recovery)
        self.assertEqual(report["status"], "partial")
        self.assertEqual([f["state"] for f in report["files"]], ["applied", "unchanged"])
        with self.assertRaisesRegex(self.helper.RecoveryError, "partial"):
            self.helper.verify(self.consumer, recovery)
        self.helper.rollback(self.consumer, recovery, approved=True)
        for path, content in before.items():
            self.assertEqual((self.consumer / path).read_bytes(), content)

    def test_rollback_removes_only_new_files_in_approved_scope(self):
        self.add_change("local/new-skill.md", b"A new local skill.\n")
        recovery = self.prepare()
        self.apply()
        unrelated = self.consumer / "local/later-note.md"
        unrelated.write_bytes(b"Later work.\n")
        self.helper.rollback(self.consumer, recovery, approved=True)
        self.assertFalse((self.consumer / "local/new-skill.md").exists())
        self.assertEqual(unrelated.read_bytes(), b"Later work.\n")

    def test_newer_edit_blocks_entire_rollback_without_partial_restore(self):
        recovery = self.prepare()
        self.apply()
        (self.consumer / "CHANGELOG.md").write_bytes(b"Newer log entry.\n")
        before = tree(self.consumer)
        self.assertEqual(self.helper.inspect(self.consumer, recovery)["status"], "diverged")
        with self.assertRaisesRegex(self.helper.RecoveryError, "diverged"):
            self.helper.rollback(self.consumer, recovery, approved=True)
        self.assertEqual(tree(self.consumer), before)

    def test_rollback_requires_approval(self):
        recovery = self.prepare()
        self.apply()
        before = tree(self.consumer)
        with self.assertRaisesRegex(self.helper.RecoveryError, "approval"):
            self.helper.rollback(self.consumer, recovery)
        self.assertEqual(tree(self.consumer), before)

    def test_corrupt_backup_blocks_all_restoration(self):
        recovery = self.prepare()
        self.apply()
        (recovery / "files/1").write_bytes(b"Corrupt copy.\n")
        before = tree(self.consumer)
        with self.assertRaisesRegex(self.helper.RecoveryError, "backup"):
            self.helper.rollback(self.consumer, recovery, approved=True)
        self.assertEqual(tree(self.consumer), before)

    def test_existing_recovery_is_not_overwritten(self):
        self.prepare()
        before = tree(self.consumer)
        with self.assertRaises(self.helper.RecoveryError):
            self.prepare()
        self.assertEqual(tree(self.consumer), before)

    @unittest.skipUnless(shutil.which("git"), "Git is optional")
    def test_recovery_copies_are_ignored_without_changing_consumer_git_rules(self):
        subprocess.run(["git", "init", "-q", str(self.consumer)], check=True, capture_output=True)
        recovery = self.prepare()
        result = subprocess.run(["git", "-C", str(self.consumer), "ls-files", "--others", "--exclude-standard", ".jarvis-adoption"], check=True, capture_output=True, text=True)
        self.assertEqual(result.stdout, "")
        self.assertTrue((recovery / "files/0").is_file())
        self.assertFalse((self.consumer / ".gitignore").exists())

    def test_record_must_be_in_approved_changes(self):
        self.plan["changes"].pop()
        with self.assertRaisesRegex(self.helper.RecoveryError, "record"):
            self.prepare()
        self.assertFalse((self.consumer / ".jarvis-adoption").exists())

    def test_repeated_completed_adoption_is_noop(self):
        recovery = self.prepare()
        self.apply()
        before = tree(self.consumer)
        self.helper.verify(self.consumer, recovery)
        self.helper.verify(self.consumer, recovery)
        self.assertEqual(tree(self.consumer), before)
        with self.assertRaises(self.helper.RecoveryError):
            self.prepare()
        self.assertEqual(tree(self.consumer), before)

    def test_rejects_path_traversal_git_paths_and_case_collisions(self):
        for unsafe in ["../outside", "/absolute", "a/../b", "a\\b", ".git/config", "C:drive", "a/", "a."]:
            with self.subTest(path=unsafe):
                self.plan["changes"][0]["path"] = unsafe
                with self.assertRaises(self.helper.RecoveryError):
                    self.prepare()
        self.plan["changes"][0]["path"] = "changelog.md"
        with self.assertRaisesRegex(self.helper.RecoveryError, "[Cc]ollision"):
            self.prepare()
        self.assertFalse((self.consumer / ".jarvis-adoption").exists())

    def test_rejects_changes_inside_recovery_area(self):
        self.plan["changes"][0]["path"] = ".jarvis-adoption/recovery/other/record.json"
        with self.assertRaises(self.helper.RecoveryError):
            self.prepare()

    def test_ancestor_collision_is_rejected_even_with_an_intervening_name(self):
        self.add_change("a", b"parent is a file\n")
        self.add_change("a-b", b"intervening sibling\n")
        self.add_change("a/child", b"cannot be written below a file\n")
        before = tree(self.consumer)
        with self.assertRaisesRegex(self.helper.RecoveryError, "[Cc]ollision"):
            self.prepare()
        self.assertEqual(tree(self.consumer), before)

    def test_unicode_aliases_are_rejected_before_snapshot(self):
        self.add_change("caf\u00e9.md", b"composed name\n")
        self.add_change("cafe\u0301.md", b"decomposed alias\n")
        before = tree(self.consumer)
        with self.assertRaisesRegex(self.helper.RecoveryError, "[Cc]ollision"):
            self.prepare()
        self.assertEqual(tree(self.consumer), before)

    @unittest.skipUnless(os.name == "nt", "Windows junction boundary")
    def test_windows_junctions_cannot_redirect_targets_or_recovery(self):
        outside = self.root / "outside"
        outside.mkdir()
        (outside / "character.md").write_bytes(b"Be concise.\n")
        for name in ["linked", ".jarvis-adoption"]:
            junction = self.consumer / name
            result = subprocess.run(["cmd", "/c", "mklink", "/J", str(junction), str(outside)], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            try:
                self.plan["changes"][0]["path"] = "linked/character.md" if name == "linked" else "profile/character.md"
                before = tree(outside)
                with self.assertRaises(self.helper.RecoveryError):
                    self.prepare()
                self.assertEqual(tree(outside), before)
            finally:
                os.rmdir(junction)

    @unittest.skipIf(os.name == "nt", "symlink creation needs special Windows privileges")
    def test_symlink_target_or_recovery_ancestor_is_rejected(self):
        target = self.consumer / "profile/character.md"
        target.unlink()
        target.symlink_to(self.consumer / "private.md")
        with self.assertRaisesRegex(self.helper.RecoveryError, "[Ss]ymlink"):
            self.prepare()
        target.unlink()
        target.write_bytes(b"Be concise.\n")
        (self.consumer / ".jarvis-adoption").symlink_to(self.root, target_is_directory=True)
        with self.assertRaisesRegex(self.helper.RecoveryError, "[Ss]ymlink"):
            self.prepare()

    @unittest.skipIf(os.name == "nt", "POSIX mode check")
    def test_original_permissions_are_restored_and_recovery_is_private(self):
        target = self.consumer / "profile/character.md"
        target.chmod(0o640)
        recovery = self.prepare()
        self.assertEqual(recovery.stat().st_mode & 0o777, 0o700)
        self.assertEqual((recovery / "files/0").stat().st_mode & 0o777, 0o600)
        self.apply()
        self.helper.rollback(self.consumer, recovery, approved=True)
        self.assertEqual(target.stat().st_mode & 0o777, 0o640)

    def test_recovery_cannot_be_used_in_a_different_consumer(self):
        recovery = self.prepare()
        another = self.root / "another"
        another.mkdir()
        with self.assertRaises(self.helper.RecoveryError):
            self.helper.inspect(another, recovery)

    def test_cli_handles_approval_inspection_and_partial_exit(self):
        plan_file = self.root / "plan.json"
        plan_file.write_text(json.dumps(self.plan))
        command = [sys.executable, "-B", str(HELPER)]
        args = ["--consumer", str(self.consumer)]
        denied = subprocess.run(command + ["prepare"] + args + ["--plan", str(plan_file)], capture_output=True, text=True)
        self.assertEqual(denied.returncode, 2)
        prepared = subprocess.run(command + ["prepare"] + args + ["--plan", str(plan_file), "--approved"], capture_output=True, text=True)
        self.assertEqual(prepared.returncode, 0, prepared.stderr)
        recovery = json.loads(prepared.stdout)["recovery"]
        self.apply([0])
        checked = subprocess.run(command + ["verify"] + args + ["--recovery", recovery], capture_output=True, text=True)
        self.assertEqual(checked.returncode, 2)
        inspected = subprocess.run(command + ["inspect"] + args + ["--recovery", recovery], capture_output=True, text=True)
        self.assertEqual(json.loads(inspected.stdout)["status"], "partial")

    def test_packaged_support_works_in_both_mirrors_without_repository(self):
        package = build_starter(ROOT, self.root / "package")
        for runtime in [".claude", ".agents"]:
            support = package / runtime / "skills/jarvis-update"
            self.assertTrue((support / "personal-improvements.md").is_file())
            self.assertTrue((support / "personal-adoption.md").is_file())
            result = subprocess.run([sys.executable, "-B", str(support / "scripts/adoption_recovery.py"), "--help"], capture_output=True)
            self.assertEqual(result.returncode, 0)
        self.assertFalse((package / ".jarvis-adoption").exists())


if __name__ == "__main__":
    unittest.main()
