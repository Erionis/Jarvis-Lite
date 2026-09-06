from __future__ import annotations

import argparse
import hashlib
import re
import stat
import sys
import tempfile
import zipfile
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.build_starter import build_starter


SEMANTIC_TAG = re.compile(
    r"v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)"
)


def version_from_tag(tag: str) -> str:
    if SEMANTIC_TAG.fullmatch(tag) is None:
        raise ValueError(f"Invalid release tag: {tag}")
    return tag[1:]


FIXED_ZIP_TIME = (1980, 1, 1, 0, 0, 0)
ARCHIVE_NAME = "Jarvis-Lite.zip"
CHECKSUM_NAME = "Jarvis-Lite.zip.sha256"
EXECUTABLE_PATHS = {".githooks/pre-commit"}


def build_release(
    source_root: Path,
    output_root: Path,
    *,
    tag: str,
    source_commit: str,
) -> tuple[Path, Path]:
    source_root = Path(source_root)
    output_root = Path(output_root)
    release_version = version_from_tag(tag)
    if output_root.is_symlink():
        raise ValueError(f"Release output directory cannot be a symlink: {output_root}")
    output_root.mkdir(parents=True, exist_ok=True)
    archive = output_root / ARCHIVE_NAME
    checksum = output_root / CHECKSUM_NAME
    for target in (archive, checksum):
        if target.exists() or target.is_symlink():
            raise FileExistsError(f"Release asset already exists: {target}")

    with tempfile.TemporaryDirectory() as temporary:
        package = build_starter(
            source_root,
            Path(temporary),
            release_version=release_version,
            source_commit=source_commit,
            release_summary=f"Jarvis Lite {tag}",
        )
        entries = sorted(
            (
                path.relative_to(package).as_posix(),
                path,
            )
            for path in package.rglob("*")
            if path.is_file()
        )
        with zipfile.ZipFile(
            archive,
            "w",
            compression=zipfile.ZIP_DEFLATED,
            compresslevel=9,
        ) as zipped:
            for relative, path in entries:
                info = zipfile.ZipInfo(
                    f"Jarvis-Lite/{relative}",
                    date_time=FIXED_ZIP_TIME,
                )
                info.create_system = 3
                info.compress_type = zipfile.ZIP_DEFLATED
                permissions = 0o755 if relative in EXECUTABLE_PATHS else 0o644
                info.external_attr = (stat.S_IFREG | permissions) << 16
                zipped.writestr(
                    info,
                    path.read_bytes(),
                    compress_type=zipfile.ZIP_DEFLATED,
                    compresslevel=9,
                )

    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    checksum.write_text(f"{digest}  {ARCHIVE_NAME}\n", encoding="ascii")
    return archive, checksum


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Build deterministic Jarvis Lite release assets"
    )
    parser.add_argument("--tag", required=True, help="Stable tag such as v0.1.0")
    parser.add_argument(
        "--source-commit",
        required=True,
        help="Complete 40-character source commit SHA",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("dist/release"),
        help="Directory that will receive the ZIP and checksum",
    )
    args = parser.parse_args()
    repository_root = Path(__file__).resolve().parents[1]
    archive, checksum = build_release(
        repository_root,
        args.output,
        tag=args.tag,
        source_commit=args.source_commit,
    )
    print(archive)
    print(checksum)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
