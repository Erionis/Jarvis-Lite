from __future__ import annotations

import argparse
import shutil
from pathlib import Path


PACKAGE_NAME = "Jarvis-Lite"
INSTALLED_SKILLS = (
    "briefing",
    "first-run",
    "save-session",
    "handoff",
    "jarvis-memory",
    "jarvis-doctor",
)


def _reject_symlinks(root: Path) -> None:
    if root.is_symlink():
        raise ValueError(f"Symlink source is not allowed: {root}")
    for path in root.rglob("*"):
        if path.is_symlink():
            raise ValueError(f"Symlink source is not allowed: {path}")


def build_starter(source_root: Path, output_root: Path) -> Path:
    """Assemble one portable Jarvis Lite directory and return its path."""
    source_root = Path(source_root)
    output_root = Path(output_root)
    starter = source_root / "starter"
    target = output_root / PACKAGE_NAME

    if not starter.is_dir():
        raise FileNotFoundError(f"Starter source is missing: {starter}")

    skill_sources: dict[str, Path] = {}
    for name in INSTALLED_SKILLS:
        source = source_root / "skills" / name
        if not (source / "SKILL.md").is_file():
            raise FileNotFoundError(f"Installed skill is missing: {source}")
        skill_sources[name] = source

    _reject_symlinks(starter)
    for source in skill_sources.values():
        _reject_symlinks(source)

    if target.exists():
        if not target.is_dir() or any(target.iterdir()):
            raise FileExistsError(f"Output target is not empty: {target}")
        shutil.copytree(starter, target, dirs_exist_ok=True)
    else:
        output_root.mkdir(parents=True, exist_ok=True)
        shutil.copytree(starter, target)

    for runtime in (".claude", ".agents"):
        mirror = target / runtime / "skills"
        mirror.mkdir(parents=True, exist_ok=True)
        for name, source in skill_sources.items():
            shutil.copytree(source, mirror / name)

    _reject_symlinks(target)
    return target


def main() -> int:
    parser = argparse.ArgumentParser(description="Assemble the Jarvis Lite starter")
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("dist"),
        help="Parent directory for the assembled Jarvis-Lite folder",
    )
    args = parser.parse_args()
    repository_root = Path(__file__).resolve().parents[1]
    package = build_starter(repository_root, args.output)
    print(package)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
