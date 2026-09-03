from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import stat
import sys
import tempfile
import uuid
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any


PRODUCT = "jarvis-lite"
SCHEMA_VERSION = 1
MANIFEST_PATH = Path("99 - Jarvis/system/release-manifest.json")
STATE_PATH = Path(".jarvis-update/state.json")
RUNTIMES = (".agents", ".claude")
OWNERSHIP = {"control-plane", "functional"}
CLASSIFICATION_ORDER = {"safe": 0, "preserve": 1, "decision": 2, "blocked": 3}


class UpdateError(RuntimeError):
    pass


class PartialUpdateError(UpdateError):
    def __init__(self, message: str, recovery: Path, applied_paths: list[str]):
        super().__init__(message)
        self.recovery = str(recovery)
        self.applied_paths = list(applied_paths)


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _document_digest(value: dict[str, Any], field: str) -> str:
    payload = dict(value)
    payload.pop(field, None)
    encoded = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def _seal(value: dict[str, Any], field: str) -> dict[str, Any]:
    sealed = dict(value)
    sealed[field] = _document_digest(sealed, field)
    return sealed


def _verify_integrity(value: dict[str, Any], field: str, label: str) -> None:
    expected = value.get(field)
    if not isinstance(expected, str) or expected != _document_digest(value, field):
        raise UpdateError(f"{label} integrity check failed")


def _read_json(path: Path, label: str) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        raise UpdateError(f"Invalid {label}: {path}: {error}") from error
    if not isinstance(value, dict):
        raise UpdateError(f"Invalid {label}: expected a JSON object")
    return value


def _safe_relative(value: str, label: str) -> PurePosixPath:
    if not isinstance(value, str) or not value or "\\" in value:
        raise UpdateError(f"Invalid or unsafe {label}: {value!r}")
    relative = PurePosixPath(value)
    if relative.is_absolute() or ".." in relative.parts or relative.parts[0] in {"", "."}:
        raise UpdateError(f"Invalid or unsafe {label}: {value!r}")
    return relative


def _read_expected_checksum(checksum_path: Path, artifact_name: str) -> str:
    try:
        lines = [
            line.strip()
            for line in checksum_path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]
    except (OSError, UnicodeError) as error:
        raise UpdateError(f"Cannot read checksum file: {error}") from error
    if len(lines) != 1:
        raise UpdateError("Invalid checksum file: expected exactly one checksum")
    parts = lines[0].split()
    if len(parts) != 2 or not re.fullmatch(r"[0-9a-fA-F]{64}", parts[0]):
        raise UpdateError("Invalid checksum file format")
    if parts[1].lstrip("*") != artifact_name:
        raise UpdateError("Checksum filename does not match the artifact")
    return parts[0].lower()


def _validate_archive(artifact: Path) -> None:
    try:
        with zipfile.ZipFile(artifact) as bundle:
            infos = bundle.infolist()
            if not infos:
                raise UpdateError("Invalid archive: it is empty")
            seen_names = set()
            for info in infos:
                name = info.filename
                if name in seen_names:
                    raise UpdateError(f"Duplicate archive entry: {name!r}")
                seen_names.add(name)
                if "\\" in name:
                    raise UpdateError(f"Invalid or unsafe archive path: {name!r}")
                path = PurePosixPath(name)
                if path.is_absolute() or ".." in path.parts:
                    raise UpdateError(f"Invalid or unsafe archive path: {name!r}")
                canonical = path.as_posix() + ("/" if info.is_dir() else "")
                if name != canonical:
                    raise UpdateError(f"Invalid or unsafe archive path: {name!r}")
                if not path.parts or path.parts[0] != "Jarvis-Lite":
                    raise UpdateError("Invalid archive: expected one Jarvis-Lite root")
                if len(path.parts) == 1 and not info.is_dir():
                    raise UpdateError("Invalid archive: Jarvis-Lite root is not a directory")
                mode = info.external_attr >> 16
                if stat.S_ISLNK(mode):
                    raise UpdateError(f"Invalid archive: symlink entry {name!r}")
    except zipfile.BadZipFile as error:
        raise UpdateError(f"Invalid archive: {error}") from error


def _validate_release_version(value: Any) -> str:
    if not isinstance(value, str) or not re.fullmatch(
        r"(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)", value
    ):
        raise UpdateError(f"Invalid release version: {value!r}")
    return value


def _validate_manifest(
    package: Path,
) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    manifest_path = package / MANIFEST_PATH
    manifest = _read_json(manifest_path, "release manifest")
    if manifest.get("schema_version") != SCHEMA_VERSION:
        raise UpdateError("Unsupported release manifest schema")
    if manifest.get("product") != PRODUCT:
        raise UpdateError(
            f"Wrong product in release manifest: {manifest.get('product')!r}"
        )
    _validate_release_version(manifest.get("release_version"))
    if not re.fullmatch(r"[0-9a-f]{40}", str(manifest.get("source_commit", ""))):
        raise UpdateError("Invalid source commit in release manifest")
    if (
        not isinstance(manifest.get("contract_revision"), int)
        or manifest["contract_revision"] < 1
    ):
        raise UpdateError("Invalid contract revision in release manifest")
    if (
        not isinstance(manifest.get("release_summary"), str)
        or not manifest["release_summary"].strip()
    ):
        raise UpdateError("Missing release summary in release manifest")
    _validate_migrations(manifest.get("migrations"))

    raw_entries = manifest.get("managed_files")
    if not isinstance(raw_entries, list) or not raw_entries:
        raise UpdateError("Release manifest has no managed files")
    entries: dict[str, dict[str, Any]] = {}
    for raw in raw_entries:
        if not isinstance(raw, dict):
            raise UpdateError("Invalid managed-file entry")
        relative = _safe_relative(raw.get("path"), "managed path").as_posix()
        if relative in entries:
            raise UpdateError(f"Duplicate managed path: {relative}")
        if raw.get("ownership") not in OWNERSHIP:
            raise UpdateError(f"Invalid ownership for managed path: {relative}")
        if not isinstance(raw.get("component"), str) or not raw["component"]:
            raise UpdateError(f"Missing component for managed path: {relative}")
        expected_metadata = _expected_managed_metadata(relative)
        if expected_metadata is None:
            raise UpdateError(
                f"Managed path is outside Lite managed roots: {relative}"
            )
        expected_ownership, expected_component = expected_metadata
        if raw["ownership"] != expected_ownership:
            raise UpdateError(f"Invalid ownership for managed path: {relative}")
        if raw["component"] != expected_component:
            raise UpdateError(f"Invalid component for managed path: {relative}")
        if not isinstance(raw.get("dependencies"), list) or not all(
            isinstance(item, str) and item for item in raw["dependencies"]
        ):
            raise UpdateError(f"Invalid dependencies for managed path: {relative}")
        expected = raw.get("sha256")
        if not isinstance(expected, str) or not re.fullmatch(
            r"[0-9a-f]{64}", expected
        ):
            raise UpdateError(f"Invalid hash for managed path: {relative}")
        target = package / Path(*PurePosixPath(relative).parts)
        if not target.is_file() or target.is_symlink():
            raise UpdateError(
                f"Managed artifact file is missing or unsafe: {relative}"
            )
        if digest(target) != expected:
            raise UpdateError(f"Managed artifact hash mismatch: {relative}")
        entries[relative] = raw

    components = {entry["component"] for entry in entries.values()}
    for relative, entry in entries.items():
        unknown = sorted(set(entry["dependencies"]) - components)
        if unknown:
            raise UpdateError(
                f"Unknown component dependency for {relative}: {', '.join(unknown)}"
            )

    _validate_target_mirrors(entries)
    _validate_seed_state(package, manifest, entries)
    return manifest, entries


def _expected_managed_metadata(relative: str) -> tuple[str, str] | None:
    control_plane = {
        ".githooks/pre-commit": "git-safety",
        "99 - Jarvis/system/core-instructions.md": "jarvis-core",
        "99 - Jarvis/system/core/guardrails.md": "jarvis-core",
        "AGENTS.md": "runtime-adapter",
    }
    if relative in control_plane:
        return "control-plane", control_plane[relative]
    parts = PurePosixPath(relative).parts
    if len(parts) >= 4 and parts[0] in RUNTIMES and parts[1] == "skills":
        component = parts[2]
        ownership = (
            "control-plane"
            if component in {"jarvis-doctor", "jarvis-update"}
            else "functional"
        )
        return ownership, component
    return None


def _validate_migrations(value: Any) -> None:
    if not isinstance(value, list):
        raise UpdateError("Invalid migrations in release manifest")
    seen = set()
    seen_paths = set()
    for migration in value:
        if not isinstance(migration, dict):
            raise UpdateError("Invalid migration entry")
        migration_id = migration.get("id")
        if (
            not isinstance(migration_id, str)
            or not re.fullmatch(r"[a-z0-9][a-z0-9-]*", migration_id)
            or migration_id in seen
        ):
            raise UpdateError(f"Invalid or duplicate migration id: {migration_id!r}")
        seen.add(migration_id)
        if not isinstance(migration.get("summary"), str) or not migration["summary"].strip():
            raise UpdateError(f"Migration summary is missing: {migration_id}")
        if not isinstance(migration.get("required"), bool):
            raise UpdateError(f"Migration required flag is invalid: {migration_id}")
        components = migration.get("components")
        if not isinstance(components, list) or not components or not all(
            isinstance(component, str) and component for component in components
        ):
            raise UpdateError(f"Migration components are invalid: {migration_id}")
        paths = migration.get("paths")
        if not isinstance(paths, list) or not paths:
            raise UpdateError(f"Migration paths are invalid: {migration_id}")
        for raw_relative in paths:
            relative = _safe_relative(
                raw_relative, "migration path"
            ).as_posix()
            if relative in seen_paths:
                raise UpdateError(f"Duplicate migration path: {relative}")
            seen_paths.add(relative)
            if (
                _expected_managed_metadata(relative) is not None
                or relative == MANIFEST_PATH.as_posix()
                or relative == ".jarvis-update"
                or relative.startswith(".jarvis-update/")
            ):
                raise UpdateError(
                    f"Migration path overlaps managed update state: {relative}"
                )


def _validate_target_mirrors(entries: dict[str, dict[str, Any]]) -> None:
    mirrors: dict[tuple[str, str], dict[str, str]] = {}
    for relative, entry in entries.items():
        parts = PurePosixPath(relative).parts
        if len(parts) < 4 or parts[0] not in RUNTIMES or parts[1] != "skills":
            continue
        logical = (entry["component"], PurePosixPath(*parts[3:]).as_posix())
        mirrors.setdefault(logical, {})[parts[0]] = entry["sha256"]
    for logical, runtime_hashes in mirrors.items():
        if set(runtime_hashes) != set(RUNTIMES) or len(
            set(runtime_hashes.values())
        ) != 1:
            raise UpdateError(
                f"Release runtime mirrors are incoherent: {logical[0]}/{logical[1]}"
            )


def _validate_seed_state(
    package: Path,
    manifest: dict[str, Any],
    entries: dict[str, dict[str, Any]],
) -> None:
    state = _read_json(package / STATE_PATH, "release seed state")
    expected = {
        "schema_version": SCHEMA_VERSION,
        "product": PRODUCT,
        "accepted_release": manifest["release_version"],
        "source_commit": manifest["source_commit"],
        "contract_revision": manifest["contract_revision"],
    }
    for key, value in expected.items():
        if state.get(key) != value:
            raise UpdateError(f"Release seed state does not match manifest: {key}")
    if state.get("baseline") != entries:
        raise UpdateError("Release seed baseline does not match manifest")
    if state.get("manifest_sha256") != digest(package / MANIFEST_PATH):
        raise UpdateError("Release seed manifest hash does not match")


def _load_installed_state(consumer: Path) -> dict[str, Any] | None:
    path = _path_from_root(consumer, STATE_PATH.as_posix())
    if path.is_symlink():
        raise UpdateError("Installed update state is not a regular file")
    if not path.exists():
        return None
    state = _read_json(path, "installed state")
    if (
        state.get("schema_version") != SCHEMA_VERSION
        or state.get("product") != PRODUCT
    ):
        raise UpdateError("Installed state has an unsupported schema or product")
    if not isinstance(state.get("baseline"), dict):
        raise UpdateError("Installed state baseline is invalid")
    return state


def _validate_legacy_install(consumer: Path) -> None:
    profile = _path_from_root(consumer, "CLAUDE.md")
    core = _path_from_root(
        consumer, "99 - Jarvis/system/core-instructions.md"
    )
    if (
        not profile.is_file()
        or profile.is_symlink()
        or not core.is_file()
        or core.is_symlink()
    ):
        raise UpdateError("Installed Jarvis Lite identity is missing or ambiguous")
    try:
        core_text = core.read_text(encoding="utf-8")
    except (OSError, UnicodeError) as error:
        raise UpdateError(
            "Installed Jarvis Lite identity is missing or ambiguous"
        ) from error
    if "# Jarvis Lite core instructions" not in core_text:
        raise UpdateError("Installed Jarvis Lite identity is missing or ambiguous")
    for runtime in RUNTIMES:
        skills = _path_from_root(consumer, f"{runtime}/skills")
        if not skills.is_dir() or skills.is_symlink():
            raise UpdateError(
                "Installed Jarvis Lite identity is missing or ambiguous"
            )


def _version_relation(
    state: dict[str, Any] | None,
    target_version: str,
    target_commit: str,
) -> str:
    if state is None:
        return "adoption"
    installed_version = state.get("accepted_release")
    if installed_version == "unreleased":
        return "adoption"
    if not isinstance(installed_version, str) or not re.fullmatch(
        r"(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)",
        installed_version,
    ):
        return "unknown"
    installed = tuple(int(part) for part in installed_version.split("."))
    target = tuple(int(part) for part in target_version.split("."))
    if target > installed:
        return "newer"
    if target < installed:
        return "older"
    return "same" if state.get("source_commit") == target_commit else "rebuilt"


def _migration_reports(
    consumer: Path,
    migrations: list[dict[str, Any]],
    state: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    applied = state.get("applied_migrations", {}) if state else {}
    reports = []
    for migration in migrations:
        path_states = []
        for relative in migration["paths"]:
            current_hash, unsafe = _current_hash(_path_from_root(consumer, relative))
            path_states.append(
                {
                    "path": relative,
                    "current_sha256": current_hash,
                    "unsafe": unsafe,
                }
            )
        if any(item["unsafe"] for item in path_states):
            classification = "blocked"
        elif migration["id"] in applied:
            classification = "safe"
        else:
            classification = "decision"
        reports.append(
            migration
            | {
                "classification": classification,
                "path_states": path_states,
            }
        )
    return reports


def _current_hash(path: Path) -> tuple[str | None, bool]:
    if path.is_symlink():
        return None, True
    if not path.exists():
        return None, False
    if not path.is_file():
        return None, True
    return digest(path), False


def _classify_path(
    consumer: Path,
    relative: str,
    target: dict[str, Any] | None,
    baseline: dict[str, Any] | None,
    legacy: bool,
) -> dict[str, Any]:
    current, unsafe = _current_hash(
        _path_from_root(consumer, relative)
    )
    ownership = (target or baseline)["ownership"]
    component = (target or baseline)["component"]
    result = {
        "path": relative,
        "component": component,
        "ownership": ownership,
        "baseline_sha256": baseline.get("sha256") if baseline else None,
        "current_sha256": current,
        "target_sha256": target.get("sha256") if target else None,
    }
    if unsafe:
        return result | {
            "classification": "blocked",
            "action": None,
            "reason": "managed path is not a regular file",
        }

    if target is not None and baseline is not None:
        target_hash = target["sha256"]
        baseline_hash = baseline["sha256"]
        if current == target_hash:
            classification, action, reason = "safe", "none", "already at target"
        elif current == baseline_hash:
            classification, action, reason = (
                "safe",
                "replace",
                "unchanged from baseline",
            )
        elif target_hash == baseline_hash:
            classification, action, reason = (
                "preserve",
                "preserve",
                "local override not touched by release",
            )
        elif ownership == "control-plane":
            classification, action, reason = (
                "safe",
                "replace",
                "control-plane collision preserved in recovery",
            )
        else:
            classification, action, reason = (
                "decision",
                None,
                "local and release changes overlap",
            )
    elif target is not None:
        if current is None:
            classification, action, reason = (
                "safe",
                "create",
                "new managed path is free",
            )
        elif current == target["sha256"]:
            classification, action, reason = (
                "safe",
                "none",
                "existing path already matches target",
            )
        elif legacy and ownership == "control-plane":
            classification, action, reason = (
                "safe",
                "replace",
                "legacy control-plane collision preserved in recovery",
            )
        elif legacy:
            classification, action, reason = (
                "decision",
                None,
                "legacy functional baseline is unknown",
            )
        else:
            classification, action, reason = (
                "blocked",
                None,
                "new managed path collides with an unmanaged file",
            )
    else:
        if current is None:
            classification, action, reason = (
                "safe",
                "none",
                "obsolete path already absent",
            )
        elif current == baseline["sha256"]:
            classification, action, reason = (
                "safe",
                "delete",
                "obsolete path still matches baseline",
            )
        else:
            classification, action, reason = (
                "decision",
                None,
                "obsolete managed path has local changes",
            )

    return result | {
        "classification": classification,
        "action": action,
        "reason": reason,
    }


def _summarize_components(
    paths: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = {}
    for item in paths:
        grouped.setdefault(item["component"], []).append(item)
    components = {}
    for component, items in sorted(grouped.items()):
        mirrors: dict[str, dict[str, str | None]] = {}
        for item in items:
            parts = PurePosixPath(item["path"]).parts
            if len(parts) >= 4 and parts[0] in RUNTIMES and parts[1] == "skills":
                logical = PurePosixPath(*parts[3:]).as_posix()
                mirrors.setdefault(logical, {})[parts[0]] = item["current_sha256"]
        mirrors_diverge = any(
            set(runtime_hashes) != set(RUNTIMES)
            or len(set(runtime_hashes.values())) != 1
            for runtime_hashes in mirrors.values()
        )
        classification = max(
            (item["classification"] for item in items),
            key=CLASSIFICATION_ORDER.__getitem__,
        )
        actions = {item["action"] for item in items}
        reasons = {item["reason"] for item in items}
        if mirrors_diverge:
            reasons.add("runtime mirrors diverge")
            if classification == "blocked":
                action = None
            elif items[0]["ownership"] == "control-plane":
                classification = "safe"
                action = "replace"
            else:
                classification = "decision"
                action = None
        elif classification in {"decision", "blocked"}:
            action = None
        elif classification == "preserve":
            action = "preserve"
        elif actions <= {"none"}:
            action = "none"
        elif "delete" in actions and actions <= {"delete", "none"}:
            action = "delete"
        else:
            action = "replace"
        components[component] = {
            "classification": classification,
            "action": action,
            "ownership": items[0]["ownership"],
            "paths": [item["path"] for item in items],
            "reasons": sorted(reasons),
        }
    return components


def preflight(
    consumer: Path,
    artifact: Path,
    checksum_file: Path,
    stage_parent: Path,
) -> dict[str, Any]:
    consumer = Path(consumer).resolve()
    artifact = Path(artifact).resolve()
    checksum_file = Path(checksum_file).resolve()
    stage_parent = Path(stage_parent).resolve()
    if not consumer.is_dir():
        raise UpdateError(f"Consumer is not a directory: {consumer}")
    if stage_parent == consumer or stage_parent.is_relative_to(consumer):
        raise UpdateError("Update staging must stay outside the consumer")
    expected_checksum = _read_expected_checksum(checksum_file, artifact.name)
    actual_checksum = digest(artifact)
    if actual_checksum != expected_checksum:
        raise UpdateError(
            "Artifact checksum does not match the published checksum"
        )
    _validate_archive(artifact)

    stage_parent.mkdir(parents=True, exist_ok=True)
    stage = Path(
        tempfile.mkdtemp(prefix="jarvis-lite-update-", dir=stage_parent)
    )
    try:
        with zipfile.ZipFile(artifact) as bundle:
            bundle.extractall(stage)
        package = stage / "Jarvis-Lite"
        manifest, target_entries = _validate_manifest(package)
        state = _load_installed_state(consumer)
        if state is None:
            _validate_legacy_install(consumer)
        baseline = state.get("baseline", {}) if state else {}
        paths = [
            _classify_path(
                consumer,
                relative,
                target_entries.get(relative),
                baseline.get(relative),
                state is None,
            )
            for relative in sorted(set(target_entries) | set(baseline))
        ]
        components = _summarize_components(paths)
        migrations = _migration_reports(
            consumer,
            manifest["migrations"],
            state,
        )
        classifications = {
            item["classification"] for item in components.values()
        }
        relation = _version_relation(
            state,
            manifest["release_version"],
            manifest["source_commit"],
        )
        status = (
            "blocked"
            if "blocked" in classifications
            or any(item["classification"] == "blocked" for item in migrations)
            or relation in {"older", "rebuilt", "unknown"}
            else "decision"
            if "decision" in classifications
            or any(item["classification"] == "decision" for item in migrations)
            else "ready"
        )
        return _seal({
            "schema_version": SCHEMA_VERSION,
            "product": PRODUCT,
            "status": status,
            "installed_release": (
                state.get("accepted_release") if state else None
            ),
            "target_release": manifest["release_version"],
            "target_relation": relation,
            "source_commit": manifest["source_commit"],
            "contract_revision": manifest["contract_revision"],
            "release_summary": manifest["release_summary"],
            "artifact_sha256": actual_checksum,
            "consumer_root": str(consumer),
            "staged_root": str(package),
            "legacy_install": state is None,
            "paths": paths,
            "components": components,
            "migrations": migrations,
        }, "report_sha256")
    except Exception:
        shutil.rmtree(stage, ignore_errors=True)
        raise


def _path_from_root(root: Path, relative: str) -> Path:
    safe = _safe_relative(relative, "update path")
    root = Path(root)
    parent = root
    for part in safe.parts[:-1]:
        parent = parent / part
        if parent.is_symlink():
            raise UpdateError(f"Unsafe symlink parent for update path: {relative}")
        if parent.exists() and not parent.is_dir():
            raise UpdateError(f"Unsafe non-directory parent for update path: {relative}")
    return root / Path(*safe.parts)


def _decision_action(value: Any, component: str) -> tuple[str, Path | None]:
    if isinstance(value, str):
        action = value
        overlay_root = None
    elif isinstance(value, dict):
        action = value.get("action")
        overlay_value = value.get("overlay_root")
        overlay_root = Path(overlay_value).resolve() if overlay_value else None
    else:
        raise UpdateError(f"Invalid decision for {component}")
    if action not in {"replace", "adapt", "merge", "postpone"}:
        raise UpdateError(f"Invalid decision for {component}: {action!r}")
    if action in {"adapt", "merge"} and overlay_root is None:
        raise UpdateError(f"Decision for {component} requires an overlay_root")
    return action, overlay_root


def _migration_decision(value: Any, migration_id: str) -> tuple[str, Path | None]:
    if isinstance(value, str):
        action = value
        overlay_root = None
    elif isinstance(value, dict):
        action = value.get("action")
        overlay_value = value.get("overlay_root")
        overlay_root = Path(overlay_value).resolve() if overlay_value else None
    else:
        raise UpdateError(f"Invalid decision for migration {migration_id}")
    if action not in {"apply", "postpone"}:
        raise UpdateError(f"Invalid decision for migration {migration_id}: {action!r}")
    if action == "apply" and overlay_root is None:
        raise UpdateError(f"Migration {migration_id} requires an overlay_root")
    return action, overlay_root


def _operation_for_target(
    item: dict[str, Any],
    staged_root: Path,
    source_root: Path | None = None,
) -> dict[str, Any] | None:
    target_hash = item["target_sha256"]
    if target_hash is None:
        return {
            "path": item["path"],
            "operation": "delete",
            "expected_current_sha256": item["current_sha256"],
            "source": None,
            "source_sha256": None,
        }
    source = _path_from_root(source_root or staged_root, item["path"])
    if not source.is_file() or source.is_symlink():
        raise UpdateError(f"Planned source is missing or unsafe: {item['path']}")
    source_hash = digest(source)
    if source_root is None and source_hash != target_hash:
        raise UpdateError(f"Staged source hash changed: {item['path']}")
    return {
        "path": item["path"],
        "operation": "write",
        "expected_current_sha256": item["current_sha256"],
        "source": str(source),
        "source_sha256": source_hash,
    }


def _validate_effective_mirrors(
    effective: dict[str, dict[str, Any]],
) -> None:
    mirrors: dict[tuple[str, str], dict[str, str]] = {}
    for relative, entry in effective.items():
        parts = PurePosixPath(relative).parts
        if len(parts) < 4 or parts[0] not in RUNTIMES or parts[1] != "skills":
            continue
        logical = (entry["component"], PurePosixPath(*parts[3:]).as_posix())
        mirrors.setdefault(logical, {})[parts[0]] = entry["sha256"]
    for logical, runtime_hashes in mirrors.items():
        if set(runtime_hashes) != set(RUNTIMES) or len(
            set(runtime_hashes.values())
        ) != 1:
            raise UpdateError(
                f"Planned runtime mirrors are incoherent: {logical[0]}/{logical[1]}"
            )


def plan_update(
    report: dict[str, Any],
    decisions: dict[str, Any],
) -> dict[str, Any]:
    if not isinstance(report, dict) or report.get("product") != PRODUCT:
        raise UpdateError("Invalid preflight report")
    _verify_integrity(report, "report_sha256", "Preflight report")
    if report.get("status") == "blocked":
        raise UpdateError("Blocked preflight cannot be planned")
    if not isinstance(decisions, dict):
        raise UpdateError("Decisions must be a JSON object")
    consumer = Path(report["consumer_root"]).resolve()
    staged_root = Path(report["staged_root"]).resolve()
    manifest, target_entries = _validate_manifest(staged_root)
    installed_state = _load_installed_state(consumer)
    installed_baseline = installed_state.get("baseline", {}) if installed_state else {}
    planned_baseline = dict(target_entries)
    if manifest["release_version"] != report.get("target_release"):
        raise UpdateError("Staged release no longer matches preflight")

    items_by_component: dict[str, list[dict[str, Any]]] = {}
    for item in report.get("paths", []):
        items_by_component.setdefault(item["component"], []).append(item)

    operations: list[dict[str, Any]] = []
    overrides: dict[str, dict[str, Any]] = {}
    postponed_components: list[str] = []
    postponed_migrations: list[str] = []
    applied_migrations = dict(
        installed_state.get("applied_migrations", {}) if installed_state else {}
    )
    forced_components: set[str] = set()
    migration_decisions = decisions.get("_migrations", {})
    if not isinstance(migration_decisions, dict):
        raise UpdateError("Migration decisions must be a JSON object")
    migration_preconditions: dict[str, str | None] = {}
    for migration in report.get("migrations", []):
        migration_id = migration["id"]
        for path_state in migration["path_states"]:
            migration_preconditions[path_state["path"]] = path_state["current_sha256"]
        if migration["classification"] == "blocked":
            raise UpdateError(f"Migration is blocked: {migration_id}")
        if migration["classification"] == "safe":
            continue
        if migration_id not in migration_decisions:
            raise UpdateError(f"Missing decision for migration {migration_id}")
        action, overlay_root = _migration_decision(
            migration_decisions[migration_id], migration_id
        )
        if action == "postpone":
            postponed_migrations.append(migration_id)
            if migration["required"]:
                for component in migration["components"]:
                    value = decisions.get(component)
                    if value is None:
                        raise UpdateError(
                            "A required migration can be postponed only with a "
                            "complete compatible functional overlay"
                        )
                    component_action, _ = _decision_action(value, component)
                    compatible = (
                        isinstance(value, dict)
                        and migration_id in value.get("compatible_migrations", [])
                    )
                    if component_action != "postpone" and not (
                        component_action in {"adapt", "merge"} and compatible
                    ):
                        raise UpdateError(
                            "A required migration can be postponed only with a "
                            "complete compatible functional overlay"
                        )
                    forced_components.add(component)
        else:
            result_paths = {}
            for path_state in migration["path_states"]:
                relative = path_state["path"]
                source = _path_from_root(overlay_root, relative)
                if not source.is_file() or source.is_symlink():
                    raise UpdateError(
                        f"Migration overlay is missing or unsafe: {relative}"
                    )
                source_hash = digest(source)
                operations.append(
                    {
                        "path": relative,
                        "operation": "write",
                        "expected_current_sha256": path_state["current_sha256"],
                        "source": str(source),
                        "source_sha256": source_hash,
                    }
                )
                result_paths[relative] = source_hash
            applied_migrations[migration_id] = result_paths

    effective: dict[str, dict[str, Any]] = {}
    for component, component_report in sorted(report["components"].items()):
        items = items_by_component[component]
        classification = component_report["classification"]
        if classification == "blocked":
            raise UpdateError(f"Component is blocked: {component}")
        selected = None
        overlay_root = None
        if classification == "decision" or component in forced_components:
            if component not in decisions:
                raise UpdateError(f"Missing decision for {component}")
            selected, overlay_root = _decision_action(decisions[component], component)
        elif classification == "preserve":
            selected = "preserve"

        for item in items:
            path = item["path"]
            if selected in {"adapt", "merge"}:
                if item["target_sha256"] is None:
                    raise UpdateError(
                        f"Overlay cannot retain an obsolete managed path: {path}"
                    )
                operation = _operation_for_target(item, staged_root, overlay_root)
                operations.append(operation)
                overrides[path] = {
                    "sha256": operation["source_sha256"],
                    "component": component,
                    "decision": selected,
                    "target_sha256": item["target_sha256"],
                }
                effective[path] = {
                    "sha256": operation["source_sha256"],
                    "component": component,
                    "ownership": item["ownership"],
                }
            elif selected in {"postpone", "preserve"}:
                if item["current_sha256"] is None:
                    raise UpdateError(f"Cannot preserve a missing path: {path}")
                overrides[path] = {
                    "sha256": item["current_sha256"],
                    "component": component,
                    "decision": selected,
                    "target_sha256": item["target_sha256"],
                }
                effective[path] = {
                    "sha256": item["current_sha256"],
                    "component": component,
                    "ownership": item["ownership"],
                }
                if item["target_sha256"] is None:
                    previous = installed_baseline.get(path)
                    if not isinstance(previous, dict):
                        raise UpdateError(
                            f"Cannot retain obsolete path without its baseline: {path}"
                        )
                    planned_baseline[path] = previous
                if selected == "postpone" and component not in postponed_components:
                    postponed_components.append(component)
            else:
                action = (
                    "replace" if selected == "replace" else item.get("action")
                )
                if action in {"create", "replace", "delete"}:
                    operation = _operation_for_target(item, staged_root)
                    if operation is not None:
                        operations.append(operation)
                if item["target_sha256"] is not None:
                    effective[path] = {
                        "sha256": item["target_sha256"],
                        "component": component,
                        "ownership": item["ownership"],
                    }

    for relative, entry in target_entries.items():
        component = entry["component"]
        for dependency in entry["dependencies"]:
            if (
                dependency in postponed_components
                and component not in postponed_components
            ):
                raise UpdateError(
                    "Component dependency prevents postponing "
                    f"{dependency} while updating {component}"
                )

    _validate_effective_mirrors(effective)
    installed_manifest = _path_from_root(consumer, MANIFEST_PATH.as_posix())
    installed_manifest_hash, installed_manifest_unsafe = _current_hash(
        installed_manifest
    )
    if installed_manifest_unsafe:
        raise UpdateError("Installed release manifest is not a regular file")
    manifest_operation = {
        "path": MANIFEST_PATH.as_posix(),
        "operation": "write",
        "expected_current_sha256": installed_manifest_hash,
        "source": str(staged_root / MANIFEST_PATH),
        "source_sha256": digest(staged_root / MANIFEST_PATH),
    }
    operations.append(manifest_operation)

    state_hash, state_unsafe = _current_hash(
        _path_from_root(consumer, STATE_PATH.as_posix())
    )
    if state_unsafe:
        raise UpdateError("Installed state is not a regular file")
    preconditions = {
        item["path"]: item["current_sha256"] for item in report["paths"]
    }
    preconditions[MANIFEST_PATH.as_posix()] = installed_manifest_hash
    preconditions[STATE_PATH.as_posix()] = state_hash
    preconditions.update(migration_preconditions)
    return _seal({
        "schema_version": SCHEMA_VERSION,
        "product": PRODUCT,
        "consumer_root": str(consumer),
        "staged_root": str(staged_root),
        "artifact_sha256": report["artifact_sha256"],
        "target_release": manifest["release_version"],
        "source_commit": manifest["source_commit"],
        "contract_revision": manifest["contract_revision"],
        "preconditions": preconditions,
        "operations": operations,
        "baseline": planned_baseline,
        "overrides": overrides,
        "postponed_components": sorted(postponed_components),
        "postponed_migrations": sorted(postponed_migrations),
        "applied_migrations": applied_migrations,
    }, "plan_sha256")


def _verify_preconditions(consumer: Path, plan: dict[str, Any]) -> None:
    for relative, expected_hash in plan["preconditions"].items():
        current_hash, unsafe = _current_hash(_path_from_root(consumer, relative))
        if unsafe or current_hash != expected_hash:
            raise UpdateError(f"Consumer changed after preflight: {relative}")


def _install_file(source: Path, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(
        f".{destination.name}.jarvis-update-{uuid.uuid4().hex}.tmp"
    )
    try:
        shutil.copy2(source, temporary)
        temporary.replace(destination)
    finally:
        if temporary.exists():
            temporary.unlink()


def _write_json_atomic(path: Path, value: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(
        f".{path.name}.jarvis-update-{uuid.uuid4().hex}.tmp"
    )
    try:
        temporary.write_text(
            json.dumps(value, indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
        temporary.replace(path)
    finally:
        if temporary.exists():
            temporary.unlink()


def _json_sha256(value: dict[str, Any]) -> str:
    serialized = json.dumps(value, indent=2, sort_keys=True) + "\n"
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def _create_recovery(
    consumer: Path,
    paths: list[str],
) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    recovery = _path_from_root(
        consumer,
        f".jarvis-update/recovery/{stamp}-{uuid.uuid4().hex[:8]}",
    )
    files_root = recovery / "files"
    records = []
    try:
        for relative in sorted(set(paths)):
            source = _path_from_root(consumer, relative)
            current_hash, unsafe = _current_hash(source)
            if unsafe:
                raise UpdateError(f"Cannot recover unsafe path: {relative}")
            record = {
                "path": relative,
                "existed": current_hash is not None,
                "sha256": current_hash,
            }
            if current_hash is not None:
                backup = _path_from_root(files_root, relative)
                backup.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, backup)
            records.append(record)
        recovery.mkdir(parents=True, exist_ok=True)
        _write_json_atomic(
            recovery / "inventory.json",
            {
                "schema_version": SCHEMA_VERSION,
                "product": PRODUCT,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "files": records,
            },
        )
        return recovery
    except Exception:
        shutil.rmtree(recovery, ignore_errors=True)
        raise


def _proposed_state(plan: dict[str, Any], recovery: Path) -> dict[str, Any]:
    return {
        "schema_version": SCHEMA_VERSION,
        "product": PRODUCT,
        "accepted_release": plan["target_release"],
        "source_commit": plan["source_commit"],
        "contract_revision": plan["contract_revision"],
        "artifact_sha256": plan["artifact_sha256"],
        "manifest_sha256": digest(Path(plan["staged_root"]) / MANIFEST_PATH),
        "baseline": plan["baseline"],
        "overrides": plan["overrides"],
        "postponed_components": plan["postponed_components"],
        "postponed_migrations": plan["postponed_migrations"],
        "applied_migrations": plan["applied_migrations"],
        "last_recovery": recovery.relative_to(
            Path(plan["consumer_root"])
        ).as_posix(),
    }


def _record_expected_post_state(
    recovery: Path,
    operations: list[dict[str, Any]],
    state: dict[str, Any],
) -> None:
    inventory_path = recovery / "inventory.json"
    inventory = _read_json(inventory_path, "recovery inventory")
    expected = {
        operation["path"]: (
            operation["source_sha256"]
            if operation["operation"] == "write"
            else None
        )
        for operation in operations
    }
    expected[STATE_PATH.as_posix()] = _json_sha256(state)
    for record in inventory["files"]:
        relative = record["path"]
        if relative not in expected:
            raise UpdateError(f"Recovery path has no planned result: {relative}")
        record["post_sha256"] = expected[relative]
    _write_json_atomic(inventory_path, inventory)


def _paths_changed_from_recovery(consumer: Path, recovery: Path) -> list[str]:
    inventory = _read_json(recovery / "inventory.json", "recovery inventory")
    changed = []
    for record in inventory.get("files", []):
        relative = _safe_relative(record.get("path"), "recovery path").as_posix()
        current_hash, unsafe = _current_hash(_path_from_root(consumer, relative))
        before_hash = record.get("sha256") if record.get("existed") else None
        if unsafe or current_hash != before_hash:
            changed.append(relative)
    return changed


def focused_verify(
    consumer: Path,
    expected_state: dict[str, Any] | None = None,
) -> dict[str, Any]:
    consumer = Path(consumer).resolve()
    state = expected_state or _load_installed_state(consumer)
    if state is None:
        raise UpdateError("Installed state is missing")
    manifest, target_entries = _validate_manifest_without_seed(consumer)
    for key in ["accepted_release", "source_commit", "contract_revision"]:
        manifest_key = "release_version" if key == "accepted_release" else key
        if state.get(key) != manifest.get(manifest_key):
            raise UpdateError(f"Installed state and manifest disagree: {key}")
    if state.get("manifest_sha256") != digest(
        _path_from_root(consumer, MANIFEST_PATH.as_posix())
    ):
        raise UpdateError("Installed manifest hash does not match state")
    baseline = state.get("baseline")
    overrides = state.get("overrides")
    if not isinstance(baseline, dict) or not isinstance(overrides, dict):
        raise UpdateError("Installed baseline or overrides are invalid")
    for relative, target in target_entries.items():
        baseline_entry = baseline.get(relative)
        if baseline_entry != target:
            raise UpdateError(f"Installed baseline does not match release: {relative}")
    effective: dict[str, dict[str, Any]] = {}
    for relative, entry in baseline.items():
        override = overrides.get(relative)
        expected_hash = override.get("sha256") if override else entry.get("sha256")
        current_hash, unsafe = _current_hash(_path_from_root(consumer, relative))
        if unsafe or current_hash != expected_hash:
            raise UpdateError(f"Focused verification failed: {relative}")
        if entry.get("ownership") == "control-plane" and override:
            raise UpdateError(f"Control-plane override is not allowed: {relative}")
        effective[relative] = {
            "sha256": expected_hash,
            "component": entry["component"],
            "ownership": entry["ownership"],
        }
    _validate_effective_mirrors(effective)
    applied_migrations = state.get("applied_migrations", {})
    if not isinstance(applied_migrations, dict):
        raise UpdateError("Applied migration state is invalid")
    for migration_id, results in applied_migrations.items():
        if not isinstance(results, dict):
            raise UpdateError(f"Applied migration result is invalid: {migration_id}")
        for relative, expected_hash in results.items():
            current_hash, unsafe = _current_hash(
                _path_from_root(consumer, relative)
            )
            if unsafe or current_hash != expected_hash:
                raise UpdateError(
                    f"Focused migration verification failed: {migration_id}/{relative}"
                )
    return {
        "ok": True,
        "release": state["accepted_release"],
        "overrides": sorted(overrides),
    }


def _validate_manifest_without_seed(
    consumer: Path,
) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    manifest_path = _path_from_root(consumer, MANIFEST_PATH.as_posix())
    manifest = _read_json(manifest_path, "installed release manifest")
    if manifest.get("schema_version") != SCHEMA_VERSION:
        raise UpdateError("Unsupported installed release manifest schema")
    if manifest.get("product") != PRODUCT:
        raise UpdateError("Wrong product in installed release manifest")
    _validate_release_version(manifest.get("release_version"))
    entries = {}
    for raw in manifest.get("managed_files", []):
        relative = _safe_relative(raw.get("path"), "managed path").as_posix()
        entries[relative] = raw
    if not entries:
        raise UpdateError("Installed release manifest has no managed files")
    return manifest, entries


def apply_update(
    consumer: Path,
    plan: dict[str, Any],
    *,
    approved: bool,
) -> dict[str, Any]:
    consumer = Path(consumer).resolve()
    if not approved:
        raise UpdateError("Explicit approval of the exact plan is required")
    _verify_integrity(plan, "plan_sha256", "Approved plan")
    if plan.get("product") != PRODUCT or Path(plan.get("consumer_root", "")).resolve() != consumer:
        raise UpdateError("Plan does not belong to this consumer")
    _validate_manifest(Path(plan["staged_root"]))
    _verify_preconditions(consumer, plan)
    recovery_paths = [operation["path"] for operation in plan["operations"]]
    recovery_paths.append(STATE_PATH.as_posix())
    recovery = _create_recovery(consumer, recovery_paths)
    state = _proposed_state(plan, recovery)
    try:
        _record_expected_post_state(recovery, plan["operations"], state)
    except Exception:
        shutil.rmtree(recovery, ignore_errors=True)
        raise
    applied_paths: list[str] = []
    try:
        for operation in plan["operations"]:
            destination = _path_from_root(consumer, operation["path"])
            if operation["operation"] == "write":
                source = Path(operation["source"])
                if not source.is_file() or digest(source) != operation["source_sha256"]:
                    raise UpdateError(
                        f"Planned source changed: {operation['path']}"
                    )
                _install_file(source, destination)
            elif operation["operation"] == "delete":
                if destination.exists():
                    if not destination.is_file() or destination.is_symlink():
                        raise UpdateError(
                            f"Cannot delete unsafe managed path: {operation['path']}"
                        )
                    destination.unlink()
            else:
                raise UpdateError(
                    f"Unknown operation: {operation['operation']}"
                )
            applied_paths.append(operation["path"])

        focused_verify(consumer, expected_state=state)
        _write_json_atomic(
            _path_from_root(consumer, STATE_PATH.as_posix()), state
        )
        verification = focused_verify(consumer)
    except Exception as error:
        applied_paths = _paths_changed_from_recovery(consumer, recovery)
        raise PartialUpdateError(
            f"Update stopped after a partial write: {error}",
            recovery,
            applied_paths,
        ) from error

    status = "updated_with_preserved_overrides" if state["overrides"] else "updated"
    return {
        "status": status,
        "effective_release": state["accepted_release"],
        "recovery": str(recovery),
        "verification": verification,
    }


def rollback_update(consumer: Path, recovery: Path) -> dict[str, Any]:
    consumer = Path(consumer).resolve()
    raw_recovery = Path(recovery)
    if not raw_recovery.is_absolute():
        raw_recovery = consumer / raw_recovery
    if raw_recovery.is_symlink():
        raise UpdateError("Recovery path cannot be a symlink")
    _path_from_root(
        consumer,
        ".jarvis-update/recovery/.rollback-parent-check",
    )
    recovery = raw_recovery.resolve()
    recovery_root = _path_from_root(
        consumer, ".jarvis-update/recovery"
    ).resolve()
    if recovery.parent != recovery_root:
        raise UpdateError("Recovery path is outside this consumer")
    inventory = _read_json(recovery / "inventory.json", "recovery inventory")
    if inventory.get("schema_version") != SCHEMA_VERSION or inventory.get("product") != PRODUCT:
        raise UpdateError("Recovery inventory has an unsupported schema or product")
    records = inventory.get("files")
    if not isinstance(records, list):
        raise UpdateError("Recovery inventory files are invalid")

    for record in records:
        relative = _safe_relative(record.get("path"), "recovery path").as_posix()
        if "post_sha256" not in record:
            raise UpdateError(f"Recovery has no expected post-update state: {relative}")
        if record.get("existed"):
            backup = _path_from_root(recovery / "files", relative)
            if not backup.is_file() or digest(backup) != record.get("sha256"):
                raise UpdateError(f"Recovery backup is missing or damaged: {relative}")

    for record in records:
        relative = record["path"]
        current_hash, unsafe = _current_hash(_path_from_root(consumer, relative))
        before_hash = record["sha256"] if record["existed"] else None
        if unsafe or current_hash not in {before_hash, record["post_sha256"]}:
            raise UpdateError(f"Rollback path changed since update: {relative}")

    ordered = sorted(
        records,
        key=lambda record: record.get("path") == STATE_PATH.as_posix(),
    )
    for record in ordered:
        relative = record["path"]
        destination = _path_from_root(consumer, relative)
        if record["existed"]:
            _install_file(_path_from_root(recovery / "files", relative), destination)
        elif destination.exists():
            if not destination.is_file() or destination.is_symlink():
                raise UpdateError(f"Cannot remove unsafe rollback path: {relative}")
            destination.unlink()

    for record in records:
        current_hash, unsafe = _current_hash(
            _path_from_root(consumer, record["path"])
        )
        expected = record["sha256"] if record["existed"] else None
        if unsafe or current_hash != expected:
            raise UpdateError(f"Rollback verification failed: {record['path']}")
    return {"status": "rolled_back", "recovery": str(recovery)}


def _emit(value: dict[str, Any], output: Path | None = None) -> None:
    if output is not None:
        _write_json_atomic(output, value)
    print(json.dumps(value, indent=2, sort_keys=True))


def _require_external_output(output: Path | None, consumer: Path) -> None:
    if output is None:
        return
    resolved_output = Path(output).resolve()
    resolved_consumer = Path(consumer).resolve()
    if (
        resolved_output == resolved_consumer
        or resolved_output.is_relative_to(resolved_consumer)
    ):
        raise UpdateError("Pre-approval output must stay outside the consumer")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Safely update a Jarvis Lite consumer"
    )
    subparsers = parser.add_subparsers(dest="command", required=True)
    preflight_parser = subparsers.add_parser("preflight")
    preflight_parser.add_argument("--consumer", type=Path, required=True)
    preflight_parser.add_argument("--artifact", type=Path, required=True)
    preflight_parser.add_argument("--checksum", type=Path, required=True)
    preflight_parser.add_argument("--stage-parent", type=Path, required=True)
    preflight_parser.add_argument("--output", type=Path)
    plan_parser = subparsers.add_parser("plan")
    plan_parser.add_argument("--report", type=Path, required=True)
    plan_parser.add_argument("--decisions", type=Path, required=True)
    plan_parser.add_argument("--output", type=Path, required=True)
    apply_parser = subparsers.add_parser("apply")
    apply_parser.add_argument("--consumer", type=Path, required=True)
    apply_parser.add_argument("--plan", type=Path, required=True)
    apply_parser.add_argument("--approved", action="store_true")
    verify_parser = subparsers.add_parser("verify")
    verify_parser.add_argument("--consumer", type=Path, required=True)
    rollback_parser = subparsers.add_parser("rollback")
    rollback_parser.add_argument("--consumer", type=Path, required=True)
    rollback_parser.add_argument("--recovery", type=Path, required=True)
    rollback_parser.add_argument("--approved", action="store_true")
    args = parser.parse_args()
    try:
        if args.command == "preflight":
            _require_external_output(args.output, args.consumer)
            result = preflight(
                args.consumer,
                args.artifact,
                args.checksum,
                args.stage_parent,
            )
            _emit(result, args.output)
        elif args.command == "plan":
            report = _read_json(args.report, "preflight report")
            result = plan_update(
                report,
                _read_json(args.decisions, "decision file"),
            )
            _require_external_output(args.output, Path(result["consumer_root"]))
            _emit(result, args.output)
        elif args.command == "apply":
            result = apply_update(
                args.consumer,
                _read_json(args.plan, "update plan"),
                approved=args.approved,
            )
            _emit(result)
        elif args.command == "verify":
            _emit(focused_verify(args.consumer))
        elif args.command == "rollback":
            if not args.approved:
                raise UpdateError("Explicit approval of rollback is required")
            _emit(rollback_update(args.consumer, args.recovery))
        else:
            raise AssertionError(args.command)
        return 0
    except PartialUpdateError as error:
        print(
            json.dumps(
                {
                    "error": str(error),
                    "recovery": error.recovery,
                    "applied_paths": error.applied_paths,
                },
                sort_keys=True,
            ),
            file=sys.stderr,
        )
        return 3
    except UpdateError as error:
        print(f"error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
