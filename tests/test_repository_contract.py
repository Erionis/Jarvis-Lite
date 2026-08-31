from __future__ import annotations

import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


class RepositoryContractTest(unittest.TestCase):
    def test_required_public_files_exist(self):
        for relative in [
            ".github/ISSUE_TEMPLATE/bug.yml",
            ".github/ISSUE_TEMPLATE/config.yml",
            ".github/ISSUE_TEMPLATE/task.yml",
            ".github/pull_request_template.md",
            ".github/workflows/ci.yml",
            ".gitattributes",
            ".gitignore",
            "CHANGELOG.md",
            "CONTRIBUTING.md",
            "LICENSE",
            "README.md",
            "docs/provenance.md",
        ]:
            self.assertTrue((ROOT / relative).is_file(), relative)

    def test_repository_root_is_this_checkout(self):
        top_level = subprocess.check_output(
            ["git", "rev-parse", "--show-toplevel"], cwd=ROOT, text=True
        ).strip()
        self.assertEqual(Path(top_level).resolve(), ROOT.resolve())


if __name__ == "__main__":
    unittest.main()
