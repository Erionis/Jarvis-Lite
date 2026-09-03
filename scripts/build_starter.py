from __future__ import annotations

import argparse
import hashlib
import json
import re
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
    "jarvis-update",
)

UPDATE_SCHEMA_VERSION = 1
UPDATE_CONTRACT_REVISION = 1
DEFAULT_RELEASE_VERSION = "unreleased"
DEFAULT_SOURCE_COMMIT = "unreleased"
DEFAULT_RELEASE_SUMMARY = "Source build from an unreleased revision."


def _digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _validate_release_identity(release_version: str, source_commit: str) -> None:
    if release_version != DEFAULT_RELEASE_VERSION and not re.fullmatch(
        r"(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)",
        release_version,
    ):
        raise ValueError(f"Invalid release version: {release_version}")
    if source_commit != DEFAULT_SOURCE_COMMIT and not re.fullmatch(
        r"[0-9a-f]{40}", source_commit
    ):
        raise ValueError(f"Invalid source commit: {source_commit}")


def _managed_metadata(relative: str) -> tuple[str, str] | None:
    control_plane = {
        ".githooks/pre-commit": "git-safety",
        "99 - Jarvis/system/core-instructions.md": "jarvis-core",
        "99 - Jarvis/system/core/guardrails.md": "jarvis-core",
        "AGENTS.md": "runtime-adapter",
    }
    if relative in control_plane:
        return "control-plane", control_plane[relative]

    parts = Path(relative).parts
    if len(parts) >= 4 and parts[0] in {".agents", ".claude"} and parts[1] == "skills":
        skill = parts[2]
        ownership = (
            "control-plane"
            if skill in {"jarvis-doctor", "jarvis-update"}
            else "functional"
        )
        return ownership, skill
    return None


def _write_update_metadata(
    package: Path,
    *,
    release_version: str,
    source_commit: str,
    release_summary: str,
) -> None:
    managed_files = []
    for path in sorted(candidate for candidate in package.rglob("*") if candidate.is_file()):
        relative = path.relative_to(package).as_posix()
        metadata = _managed_metadata(relative)
        if metadata is None:
            continue
        ownership, component = metadata
        managed_files.append(
            {
                "path": relative,
                "sha256": _digest(path),
                "ownership": ownership,
                "component": component,
                "dependencies": [],
            }
        )

    manifest = {
        "schema_version": UPDATE_SCHEMA_VERSION,
        "product": "jarvis-lite",
        "release_version": release_version,
        "source_commit": source_commit,
        "contract_revision": UPDATE_CONTRACT_REVISION,
        "release_summary": release_summary,
        "managed_files": managed_files,
        "migrations": [],
    }
    manifest_path = package / "99 - Jarvis/system/release-manifest.json"
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )

    state = {
        "schema_version": UPDATE_SCHEMA_VERSION,
        "product": "jarvis-lite",
        "accepted_release": release_version,
        "source_commit": source_commit,
        "contract_revision": UPDATE_CONTRACT_REVISION,
        "artifact_sha256": None,
        "manifest_sha256": _digest(manifest_path),
        "baseline": {entry["path"]: entry for entry in managed_files},
        "overrides": {},
        "postponed_components": [],
        "postponed_migrations": [],
        "applied_migrations": {},
        "last_recovery": None,
    }
    state_path = package / ".jarvis-update/state.json"
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(
        json.dumps(state, indent=2, sort_keys=True) + "\n",
        encoding="utf-8",
    )


def _reject_symlinks(root: Path) -> None:
    if root.is_symlink():
        raise ValueError(f"Symlink source is not allowed: {root}")
    for path in root.rglob("*"):
        if path.is_symlink():
            raise ValueError(f"Symlink source is not allowed: {path}")


def build_starter(
    source_root: Path,
    output_root: Path,
    *,
    release_version: str = DEFAULT_RELEASE_VERSION,
    source_commit: str = DEFAULT_SOURCE_COMMIT,
    release_summary: str = DEFAULT_RELEASE_SUMMARY,
) -> Path:
    """Assemble one portable Jarvis Lite directory and return its path."""
    source_root = Path(source_root)
    output_root = Path(output_root)
    starter = source_root / "starter"
    target = output_root / PACKAGE_NAME

    _validate_release_identity(release_version, source_commit)

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
            shutil.copytree(
                source,
                mirror / name,
                ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "*.pyo"),
            )

    _write_update_metadata(
        target,
        release_version=release_version,
        source_commit=source_commit,
        release_summary=release_summary,
    )

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
    parser.add_argument("--release-version", default=DEFAULT_RELEASE_VERSION)
    parser.add_argument("--source-commit", default=DEFAULT_SOURCE_COMMIT)
    parser.add_argument("--release-summary", default=DEFAULT_RELEASE_SUMMARY)
    args = parser.parse_args()
    repository_root = Path(__file__).resolve().parents[1]
    package = build_starter(
        repository_root,
        args.output,
        release_version=args.release_version,
        source_commit=args.source_commit,
        release_summary=args.release_summary,
    )
    print(package)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
