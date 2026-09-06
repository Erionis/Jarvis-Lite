from __future__ import annotations

import argparse
import hashlib
import json
import re
import stat
import sys
import zipfile
from pathlib import Path, PurePosixPath

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.build_starter import (
    INSTALLED_SKILLS,
    PACKAGE_MANIFEST_VERSION,
    SOURCE_REPOSITORY,
)
from scripts.build_release import EXECUTABLE_PATHS, FIXED_ZIP_TIME


def _read_expected_checksum(checksum: Path, archive_name: str) -> str:
    content = checksum.read_text(encoding="ascii")
    match = re.fullmatch(
        rf"([0-9a-f]{{64}})  {re.escape(archive_name)}\n",
        content,
    )
    if match is None:
        raise ValueError(f"Invalid release checksum file: {checksum}")
    return match.group(1)


def _validated_member_path(name: str) -> PurePosixPath:
    path = PurePosixPath(name)
    if (
        not name
        or "\\" in name
        or path.is_absolute()
        or ".." in path.parts
        or not path.parts
        or path.parts[0] != "Jarvis-Lite"
    ):
        raise ValueError(f"Release contains unsafe archive path: {name!r}")
    return path


def _read_json_member(zipped: zipfile.ZipFile, name: str) -> dict[str, object]:
    try:
        document = json.loads(zipped.read(name))
    except (KeyError, json.JSONDecodeError, UnicodeDecodeError) as error:
        raise ValueError(f"Release identity mismatch: invalid {name}") from error
    if not isinstance(document, dict):
        raise ValueError(f"Release identity mismatch: invalid {name}")
    return document


def _validate_identity(
    zipped: zipfile.ZipFile,
    *,
    expected_version: str,
    expected_commit: str,
) -> dict[str, object]:
    identity = _read_json_member(zipped, "Jarvis-Lite/jarvis-lite.json")
    expected_identity = {
        "installed_skills": list(INSTALLED_SKILLS),
        "manifest_version": PACKAGE_MANIFEST_VERSION,
        "product": "jarvis-lite",
        "release_version": expected_version,
        "source_commit": expected_commit,
        "source_repository": SOURCE_REPOSITORY,
    }
    if identity != expected_identity:
        raise ValueError("Release identity mismatch: jarvis-lite.json")

    manifest = _read_json_member(
        zipped,
        "Jarvis-Lite/99 - Jarvis/system/release-manifest.json",
    )
    if (
        manifest.get("product") != "jarvis-lite"
        or manifest.get("release_version") != expected_version
        or manifest.get("source_commit") != expected_commit
    ):
        raise ValueError("Release identity mismatch: release-manifest.json")

    state = _read_json_member(zipped, "Jarvis-Lite/.jarvis-update/state.json")
    if (
        state.get("product") != "jarvis-lite"
        or state.get("accepted_release") != expected_version
        or state.get("source_commit") != expected_commit
    ):
        raise ValueError("Release identity mismatch: update state")
    return manifest


def _validate_inventory(
    infos: list[zipfile.ZipInfo],
    manifest: dict[str, object],
) -> None:
    names = [info.filename for info in infos]
    package_paths = manifest.get("package_paths")
    if (
        not isinstance(package_paths, list)
        or not all(isinstance(path, str) for path in package_paths)
    ):
        raise ValueError("Release inventory mismatch: invalid package_paths")
    expected_names = [f"Jarvis-Lite/{path}" for path in package_paths]
    if names != sorted(names) or len(names) != len(set(names)) or names != expected_names:
        raise ValueError("Release inventory mismatch: archive does not match manifest")


def _validate_metadata(infos: list[zipfile.ZipInfo]) -> None:
    for info in infos:
        relative = info.filename.removeprefix("Jarvis-Lite/")
        raw_mode = info.external_attr >> 16
        permissions = raw_mode & 0o777
        expected_permissions = 0o755 if relative in EXECUTABLE_PATHS else 0o644
        if (
            info.is_dir()
            or info.date_time != FIXED_ZIP_TIME
            or info.create_system != 3
            or info.compress_type != zipfile.ZIP_DEFLATED
            or stat.S_IFMT(raw_mode) != stat.S_IFREG
            or permissions != expected_permissions
            or info.extra
            or info.comment
        ):
            raise ValueError(f"Release metadata mismatch: {info.filename}")


def _validate_managed_content(
    zipped: zipfile.ZipFile,
    manifest: dict[str, object],
) -> None:
    managed_files = manifest.get("managed_files")
    if not isinstance(managed_files, list):
        raise ValueError("Release content mismatch: invalid managed_files")
    for entry in managed_files:
        if not isinstance(entry, dict):
            raise ValueError("Release content mismatch: invalid managed file")
        relative = entry.get("path")
        expected_digest = entry.get("sha256")
        if not isinstance(relative, str) or not isinstance(expected_digest, str):
            raise ValueError("Release content mismatch: invalid managed file")
        actual_digest = hashlib.sha256(
            zipped.read(f"Jarvis-Lite/{relative}")
        ).hexdigest()
        if actual_digest != expected_digest:
            raise ValueError(f"Release content mismatch: {relative}")

    for skill in INSTALLED_SKILLS:
        mirrors: list[dict[str, bytes]] = []
        for runtime in (".agents", ".claude"):
            prefix = f"Jarvis-Lite/{runtime}/skills/{skill}/"
            mirrors.append(
                {
                    info.filename.removeprefix(prefix): zipped.read(info)
                    for info in zipped.infolist()
                    if info.filename.startswith(prefix)
                }
            )
        if not mirrors[0] or mirrors[0] != mirrors[1]:
            raise ValueError(f"Release content mismatch: {skill} runtime mirrors")


def verify_release(
    archive: Path,
    checksum: Path,
    *,
    expected_version: str,
    expected_commit: str,
    extract_to: Path | None = None,
) -> None:
    archive = Path(archive)
    checksum = Path(checksum)
    expected_checksum = _read_expected_checksum(checksum, archive.name)
    actual_checksum = hashlib.sha256(archive.read_bytes()).hexdigest()
    if actual_checksum != expected_checksum:
        raise ValueError(
            f"Release checksum mismatch: expected {expected_checksum}, "
            f"got {actual_checksum}"
        )
    with zipfile.ZipFile(archive) as zipped:
        infos = zipped.infolist()
        for info in infos:
            _validated_member_path(info.filename)
        manifest = _validate_identity(
            zipped,
            expected_version=expected_version,
            expected_commit=expected_commit,
        )
        _validate_inventory(infos, manifest)
        _validate_metadata(infos)
        _validate_managed_content(zipped, manifest)
        if extract_to is None:
            return

        extract_to = Path(extract_to)
        if extract_to.is_symlink():
            raise ValueError(
                f"Release extraction target cannot be a symlink: {extract_to}"
            )
        if extract_to.exists() and (
            not extract_to.is_dir() or any(extract_to.iterdir())
        ):
            raise FileExistsError(
                f"Release extraction target is not empty: {extract_to}"
            )
        zipped.extractall(extract_to)
        for info in zipped.infolist():
            extracted = extract_to.joinpath(*Path(info.filename).parts)
            extracted.chmod((info.external_attr >> 16) & 0o777)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Verify and optionally extract Jarvis Lite release assets"
    )
    parser.add_argument("--archive", type=Path, required=True)
    parser.add_argument("--checksum", type=Path, required=True)
    parser.add_argument("--expected-version", required=True)
    parser.add_argument("--expected-commit", required=True)
    parser.add_argument("--extract-to", type=Path)
    args = parser.parse_args()

    verify_release(
        args.archive,
        args.checksum,
        expected_version=args.expected_version,
        expected_commit=args.expected_commit,
        extract_to=args.extract_to,
    )
    print(f"Verified {args.archive}")
    if args.extract_to is not None:
        print(f"Extracted to {args.extract_to}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
