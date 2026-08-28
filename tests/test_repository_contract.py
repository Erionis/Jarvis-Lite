from __future__ import annotations

import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class RepositoryContractTest(unittest.TestCase):
    def test_required_public_files_exist(self):
        for relative in [
            ".gitattributes",
            ".gitignore",
            "CHANGELOG.md",
            "CONTRIBUTING.md",
            "LICENSE",
            "README.md",
            "docs/provenance.md",
        ]:
            self.assertTrue((ROOT / relative).is_file(), relative)

    def test_history_begins_in_this_repository(self):
        common = subprocess.check_output(
            ["git", "rev-parse", "--git-common-dir"], cwd=ROOT, text=True
        ).strip()
        self.assertEqual(common, ".git")

    def test_no_remote_exists_before_publication(self):
        remotes = subprocess.check_output(
            ["git", "remote"], cwd=ROOT, text=True
        ).splitlines()
        self.assertEqual(remotes, [])


if __name__ == "__main__":
    unittest.main()
