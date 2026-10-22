"""Scoped recovery for agent-applied, explicitly approved adoption patches.

This helper never merges or applies proposed content. The authorized local
writer owns that action. Inspection reconstructs state from file hashes; there
is no automatic continuation or transaction scheduler.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
import stat
import tempfile
import unicodedata
from pathlib import Path, PurePosixPath


RECOVERY_ROOT = ".jarvis-adoption/recovery"


class RecoveryError(ValueError):
    pass


def _hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _sha(value, *, absent=False):
    if absent and value is None:
        return value
    if not isinstance(value, str) or not re.fullmatch(r"[0-9a-f]{64}", value):
        raise RecoveryError("Invalid file hash")
    return value


def _relative(value: str) -> str:
    if not isinstance(value, str) or not value or any(c in value for c in "\\:\x00"):
        raise RecoveryError("Invalid relative path")
    parts = value.split("/")
    if any(p in {"", ".", ".."} or p.lower() == ".git" or p.endswith((" ", ".")) for p in parts):
        raise RecoveryError(f"Unsafe relative path: {value}")
    return PurePosixPath(value).as_posix()


def _root(consumer: Path) -> Path:
    consumer = Path(consumer)
    if _alias(consumer) or not consumer.is_dir():
        raise RecoveryError("Consumer must be an existing directory, not a symlink")
    return consumer.resolve()


def _alias(path: Path) -> bool:
    return path.is_symlink() or getattr(path, "is_junction", lambda: False)()


def _path(root: Path, relative: str) -> Path:
    relative = _relative(relative)
    current = root
    for part in PurePosixPath(relative).parts:
        current = current / part
        if _alias(current):
            raise RecoveryError(f"Symlink or junction path is not supported: {relative}")
        if not current.resolve().is_relative_to(root.resolve()):
            raise RecoveryError(f"Path resolves outside its root: {relative}")
        if current != root / relative and current.exists() and not current.is_dir():
            raise RecoveryError(f"Non-directory path ancestor: {relative}")
    return current


def _bytes(path: Path) -> bytes | None:
    if path.is_symlink():
        raise RecoveryError(f"Symlink file is not supported: {path.name}")
    if not path.exists():
        return None
    if not path.is_file() or path.stat().st_nlink != 1:
        raise RecoveryError(f"Expected an unlinked regular file: {path.name}")
    return path.read_bytes()


def _current(path: Path) -> str | None:
    data = _bytes(path)
    return _hash(data) if data is not None else None


def _recovery_path(root: Path, relative: str) -> Path:
    relative = _relative(relative)
    if PurePosixPath(relative).parent.as_posix() != RECOVERY_ROOT:
        raise RecoveryError(f"Recovery must be a direct child of {RECOVERY_ROOT}")
    return _path(root, relative)


def _change_paths(changes: list) -> list[str]:
    if not isinstance(changes, list) or not changes:
        raise RecoveryError("Expected a nonempty approved change list")
    paths = [_relative(c["path"]) for c in changes]
    folded = {unicodedata.normalize("NFC", p).casefold() for p in paths}
    if len(folded) != len(paths):
        raise RecoveryError("Collision between approved paths")
    for path in folded:
        if path == ".jarvis-adoption" or path.startswith(".jarvis-adoption/"):
            raise RecoveryError("Changes may not target recovery storage")
        if any(parent.as_posix() in folded for parent in PurePosixPath(path).parents):
            raise RecoveryError("Collision between approved paths")
    return paths


def _source(source: dict) -> dict:
    if (not isinstance(source, dict) or not isinstance(source.get("label"), str)
            or not source["label"].strip()
            or not isinstance(source.get("commit"), str)
            or not re.fullmatch(r"[0-9a-f]{40}", source["commit"])):
        raise RecoveryError("Source requires a label and full resolved commit SHA")
    return {"label": source["label"], "commit": source["commit"]}


def _approval(approved: bool):
    if not approved:
        raise RecoveryError("Explicit approval of the exact scope is required")


def prepare(consumer: Path, plan: dict, *, approved=False) -> Path:
    """Save preimages only after checking every reviewed precondition."""
    _approval(approved)
    root = _root(consumer)
    source = _source(plan["source"])
    capabilities = plan["capabilities"]
    if (not isinstance(capabilities, list) or not capabilities
            or any(not isinstance(c, str) or not c.strip() for c in capabilities)):
        raise RecoveryError("Name the adopted capabilities")
    paths = _change_paths(plan["changes"])
    if _relative(plan["record_path"]) not in paths:
        raise RecoveryError("Decision/provenance record must be in approved changes")
    recovery = _recovery_path(root, plan["recovery"])
    if recovery.exists():
        raise RecoveryError("Recovery already exists; inspect it before replanning")
    files, originals = [], []
    for change, relative in zip(plan["changes"], paths):
        target = _path(root, relative)
        data = _bytes(target)
        before = _hash(data) if data is not None else None
        if before != _sha(change["before_sha256"], absent=True):
            raise RecoveryError(f"Reviewed file changed: {relative}")
        proposed = Path(change["after_file"])
        if not proposed.is_absolute():
            raise RecoveryError("Proposed files must have absolute paths outside the consumer")
        if proposed.resolve().is_relative_to(root):
            raise RecoveryError("Prepare proposed files outside the consumer")
        after = _bytes(proposed)
        if after is None:
            raise RecoveryError("Proposed file is missing")
        if _hash(after) != _sha(change["after_sha256"]):
            raise RecoveryError(f"Proposed content changed: {relative}")
        files.append({"path": relative, "before_sha256": before,
                      "after_sha256": _hash(after),
                      "mode": stat.S_IMODE(target.stat().st_mode) if data is not None else None})
        originals.append(data)

    # The whole approved scope is validated before the first recovery write.
    recovery.mkdir(parents=True, mode=0o700)
    try:
        # Keep private preimages out of ordinary Git staging, including in
        # existing consumers whose root ignore file predates this workflow.
        (recovery / ".gitignore").write_text("*\n", encoding="utf-8")
        (recovery / "files").mkdir(mode=0o700)
        for index, data in enumerate(originals):
            if data is not None:
                backup = recovery / "files" / str(index)
                with backup.open("xb") as stream:
                    os.chmod(backup, 0o600)
                    stream.write(data)
        record = {"schema_version": 1, "consumer": str(root), "source": source,
                  "capabilities": capabilities, "record_path": plan["record_path"], "files": files}
        manifest = recovery / "record.json"
        with manifest.open("x", encoding="utf-8") as stream:
            os.chmod(manifest, 0o600)
            json.dump(record, stream, indent=2)
            stream.write("\n")
    except BaseException:
        shutil.rmtree(recovery)
        raise
    return recovery


def _load(consumer: Path, recovery: Path) -> tuple[Path, Path, dict]:
    root = _root(consumer)
    recovery = Path(recovery)
    if recovery.is_absolute():
        try:
            relative = recovery.relative_to(root).as_posix()
        except ValueError as exc:
            raise RecoveryError("Recovery belongs to a different consumer") from exc
    else:
        relative = recovery.as_posix()
    recovery = _recovery_path(root, relative)
    data = _bytes(_path(recovery, "record.json"))
    if data is None:
        raise RecoveryError("Recovery record is missing")
    record = json.loads(data)
    if record["schema_version"] != 1 or record["consumer"] != str(root):
        raise RecoveryError("Invalid recovery schema or consumer")
    _source(record["source"])
    paths = _change_paths(record["files"])
    if record["record_path"] not in paths:
        raise RecoveryError("Recovery has no approved provenance record")
    for item in record["files"]:
        _sha(item["before_sha256"], absent=True)
        _sha(item["after_sha256"])
        mode = item["mode"]
        if item["before_sha256"] is not None and (type(mode) is not int or not 0 <= mode <= 0o7777):
            raise RecoveryError("Invalid original file mode")
    return root, recovery, record


def inspect(consumer: Path, recovery: Path) -> dict:
    """Reconstruct actual progress without writing or inferring approval."""
    root, recovery, record = _load(consumer, recovery)
    files = []
    for item in record["files"]:
        current = _current(_path(root, item["path"]))
        if current == item["after_sha256"]:
            state = "applied"
        elif current == item["before_sha256"]:
            state = "unchanged"
        else:
            state = "diverged"
        files.append({"path": item["path"], "state": state})
    states = {item["state"] for item in files}
    status = ("diverged" if "diverged" in states else "applied" if states == {"applied"}
              else "not-applied" if states == {"unchanged"} else "partial")
    return {"status": status, "recovery": str(recovery), "source": record["source"],
            "capabilities": record["capabilities"], "files": files}


def verify(consumer: Path, recovery: Path) -> dict:
    report = inspect(consumer, recovery)
    if report["status"] != "applied":
        raise RecoveryError(f"Adoption is {report['status']}; inspect before replanning or rollback")
    return report


def _restore(target: Path, data: bytes, mode: int):
    descriptor, temporary = tempfile.mkstemp(prefix=".adoption-restore-", dir=target.parent)
    try:
        with os.fdopen(descriptor, "wb") as stream:
            stream.write(data)
        os.chmod(temporary, mode)
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def rollback(consumer: Path, recovery: Path, *, approved=False) -> dict:
    _approval(approved)
    root, recovery, record = _load(consumer, recovery)
    report = inspect(root, recovery)
    if report["status"] == "diverged":
        raise RecoveryError("Files diverged; preserve newer work before rollback")
    backups = []
    for index, item in enumerate(record["files"]):
        data = None
        if item["before_sha256"] is not None:
            data = _bytes(_path(recovery, f"files/{index}"))
            if data is None or _hash(data) != item["before_sha256"]:
                raise RecoveryError(f"Missing or corrupt backup: {item['path']}")
        backups.append(data)
    # Validate all backups and destinations before any restore. Recheck each
    # destination immediately before mutation; no concurrent-writer lock is claimed.
    for item, data in zip(record["files"], backups):
        target = _path(root, item["path"])
        current = _current(target)
        if current == item["before_sha256"]:
            continue
        if current != item["after_sha256"]:
            raise RecoveryError(f"File diverged during rollback: {item['path']}")
        if data is None:
            target.unlink()
        else:
            _restore(target, data, item["mode"])
    for item in record["files"]:
        if _current(_path(root, item["path"])) != item["before_sha256"]:
            raise RecoveryError(f"Rollback verification failed: {item['path']}")
    return {"status": "rolled-back", "recovery": str(recovery)}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    for command in ("prepare", "inspect", "verify", "rollback"):
        sub = commands.add_parser(command)
        sub.add_argument("--consumer", type=Path, required=True)
        if command == "prepare":
            sub.add_argument("--plan", type=Path, required=True)
        else:
            sub.add_argument("--recovery", type=Path, required=True)
        if command in {"prepare", "rollback"}:
            sub.add_argument("--approved", action="store_true", help="Use only after exact-scope approval")
    args = parser.parse_args()
    try:
        if args.command == "prepare":
            result = {"recovery": str(prepare(args.consumer, json.loads(args.plan.read_text(encoding="utf-8")), approved=args.approved))}
        elif args.command == "rollback":
            result = rollback(args.consumer, args.recovery, approved=args.approved)
        else:
            result = {"inspect": inspect, "verify": verify}[args.command](args.consumer, args.recovery)
        print(json.dumps(result, indent=2))
        return 0
    except (RecoveryError, OSError, ValueError, KeyError, TypeError) as exc:
        parser.exit(2, f"error: {exc}\n")


if __name__ == "__main__":
    raise SystemExit(main())
