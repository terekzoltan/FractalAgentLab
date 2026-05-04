from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parents[1]
SRC_ROOT = REPO_ROOT / "src"
if str(SRC_ROOT) not in sys.path:
    sys.path.insert(0, str(SRC_ROOT))

from fractal_agent_lab.memory.project_memory import ProjectMemory  # noqa: E402

SCHEMA_VERSION = "u5_f.memory_eval_index.v1"

MEMORY_CANDIDATE_FILENAME = "memory_candidates.json"
PROJECT_MEMORY_UPDATE_FILENAME = "project_memory_update.json"

ALLOWED_EVAL_REPORT_VERSIONS = {
    "h2_e.artifact_replay.v1",
    "h2_e.h1_artifact_set.v1",
    "h2_f.h1_smoke_suite.v1",
    "h2_g.h1_baseline_tags.v1",
    "h2_l.h1_memory_materiality.v1",
    "h2_o.identity_drift_smoke.v1",
    "l1_i.h1_smoke_comparison.v1",
    "l1_l.h1_evidence_prep.v1",
    "r3_k.h2_run_comparison.v1",
    "r3_l.evidence_curation.v1",
    "r3_p.h1_real_provider_smoke.v1",
    "cv1_d.h4_usefulness_check.v1",
    "p4_b.h1_cross_provider_smoke.v1",
}

CURATED_REFERENCES = [
    {
        "label": "R3-L historical curated evidence reference",
        "source_path": "docs/wave3/Wave3-W3-S3-TrackE-R3-L-Evidence-Curation-v1.md",
        "evidence_label": "historical_curated_reference",
        "note": "Linked source reference only; U5-F does not parse it into live metrics.",
    },
]


def build_memory_eval_index(*, data_dir: str | Path) -> dict[str, Any]:
    data_dir_path = Path(data_dir)
    warnings: list[str] = []
    memory_projects = _collect_memory_projects(data_dir=data_dir_path, warnings=warnings)
    memory_artifacts = _collect_memory_artifacts(data_dir=data_dir_path, warnings=warnings)
    eval_summaries = _collect_eval_summaries(data_dir=data_dir_path, warnings=warnings)

    project_store_state = "available" if memory_projects else "not_demonstrated"
    if not (data_dir_path / "memory" / "projects").exists():
        project_store_state = "no_local_project_memory_store_found"

    return {
        "schema_version": SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data_dir": data_dir_path.as_posix(),
        "summary": {
            "project_memory_store_state": project_store_state,
            "memory_project_count": len(memory_projects),
            "memory_artifact_count": len(memory_artifacts),
            "eval_summary_count": len(eval_summaries),
            "warnings_count": len(warnings),
        },
        "memory_projects": memory_projects,
        "memory_artifacts": memory_artifacts,
        "eval_summaries": eval_summaries,
        "curated_references": CURATED_REFERENCES,
        "warnings": warnings,
    }


def write_memory_eval_index(*, data_dir: str | Path, out_path: str | Path) -> dict[str, Any]:
    index = build_memory_eval_index(data_dir=data_dir)
    resolved_out = Path(out_path)
    resolved_out.parent.mkdir(parents=True, exist_ok=True)
    resolved_out.write_text(json.dumps(index, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
    return index


def _collect_memory_projects(*, data_dir: Path, warnings: list[str]) -> list[dict[str, Any]]:
    projects_dir = data_dir / "memory" / "projects"
    if not projects_dir.exists():
        return []

    projects: list[dict[str, Any]] = []
    for path in sorted(projects_dir.glob("*.json")):
        payload = _read_json_object(path=path, warnings=warnings, context="project memory")
        if payload is None:
            continue
        try:
            project_memory = ProjectMemory.from_dict(payload)
        except ValueError as error:
            warnings.append(f"Invalid project memory JSON: {path.as_posix()} ({error})")
            continue
        projects.append(
            {
                "project_id": project_memory.project_id,
                "source_path": path.as_posix(),
                "schema_version": project_memory.schema_version,
                "updated_at": project_memory.updated_at,
                "stable_decision_count": len(project_memory.stable_decisions),
                "workflow_learning_count": len(project_memory.workflow_learnings),
                "prompt_observation_count": len(project_memory.prompt_observations),
            },
        )
    return projects


def _collect_memory_artifacts(*, data_dir: Path, warnings: list[str]) -> list[dict[str, Any]]:
    artifacts_dir = data_dir / "artifacts"
    if not artifacts_dir.exists():
        return []

    rows: list[dict[str, Any]] = []
    for run_dir in sorted(entry for entry in artifacts_dir.iterdir() if entry.is_dir()):
        candidates_path = run_dir / MEMORY_CANDIDATE_FILENAME
        if candidates_path.exists():
            payload = _read_json_object(path=candidates_path, warnings=warnings, context="memory candidate sidecar")
            if payload is not None:
                rows.append(_memory_candidate_row(run_id=run_dir.name, path=candidates_path, payload=payload, warnings=warnings))

        update_path = run_dir / PROJECT_MEMORY_UPDATE_FILENAME
        if update_path.exists():
            payload = _read_json_object(path=update_path, warnings=warnings, context="project memory update sidecar")
            if payload is not None:
                rows.append(_project_memory_update_row(run_id=run_dir.name, path=update_path, payload=payload, warnings=warnings))
    return rows


def _collect_eval_summaries(*, data_dir: Path, warnings: list[str]) -> list[dict[str, Any]]:
    artifacts_dir = data_dir / "artifacts"
    if not artifacts_dir.exists():
        return []

    summaries: list[dict[str, Any]] = []
    for path in sorted(artifacts_dir.glob("*/*.json")):
        if path.name in {MEMORY_CANDIDATE_FILENAME, PROJECT_MEMORY_UPDATE_FILENAME, "identity_update.json"}:
            continue
        payload = _read_json_object(path=path, warnings=warnings, context="artifact sidecar")
        if payload is None:
            continue
        report_version = _str_or_none(payload.get("report_version"))
        if report_version is None:
            continue
        if report_version not in ALLOWED_EVAL_REPORT_VERSIONS:
            warnings.append(f"Skipped unsupported eval report shape: {path.as_posix()} ({report_version})")
            continue
        summaries.append(_eval_summary_row(path=path, payload=payload, report_version=report_version))
    return summaries


def _memory_candidate_row(*, run_id: str, path: Path, payload: dict[str, Any], warnings: list[str]) -> dict[str, Any]:
    _warn_if_mismatch(path=path, field="run_id", expected=run_id, payload=payload, warnings=warnings)
    return {
        "run_id": _str_or_none(payload.get("run_id")) or run_id,
        "source_path": path.as_posix(),
        "artifact_kind": "memory_candidates",
        "artifact_version": _str_or_none(payload.get("artifact_version")),
        "schema_version": _str_or_none(payload.get("candidate_schema_version")),
        "workflow_id": _str_or_none(payload.get("workflow_id")),
        "session_id": _str_or_none(payload.get("session_id")),
        "project_id": None,
        "generated_at": _str_or_none(payload.get("generated_at")),
        "item_count": _int_or_zero(payload.get("candidate_count")),
    }


def _project_memory_update_row(*, run_id: str, path: Path, payload: dict[str, Any], warnings: list[str]) -> dict[str, Any]:
    _warn_if_mismatch(path=path, field="run_id", expected=run_id, payload=payload, warnings=warnings)
    return {
        "run_id": _str_or_none(payload.get("run_id")) or run_id,
        "source_path": path.as_posix(),
        "artifact_kind": "project_memory_update",
        "artifact_version": _str_or_none(payload.get("artifact_version")),
        "schema_version": _str_or_none(payload.get("project_memory_schema_version")),
        "workflow_id": _str_or_none(payload.get("workflow_id")),
        "session_id": None,
        "project_id": _str_or_none(payload.get("project_id")),
        "generated_at": _str_or_none(payload.get("generated_at")),
        "item_count": _int_or_zero(payload.get("created_count")) + _int_or_zero(payload.get("updated_count")),
    }


def _eval_summary_row(*, path: Path, payload: dict[str, Any], report_version: str) -> dict[str, Any]:
    summary = payload.get("summary") if isinstance(payload.get("summary"), dict) else {}
    known_limits = payload.get("known_limits") if isinstance(payload.get("known_limits"), list) else []
    return {
        "label": _label_for_report_version(report_version),
        "source_path": path.as_posix(),
        "report_version": report_version,
        "generated_at": _str_or_none(payload.get("created_at")) or _str_or_none(payload.get("generated_at")),
        "source_reported_outcome": _source_reported_outcome(summary),
        "source_reported_summary": _safe_summary(summary),
        "known_limits": [item for item in known_limits if isinstance(item, str)],
    }


def _read_json_object(*, path: Path, warnings: list[str], context: str) -> dict[str, Any] | None:
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        warnings.append(f"Malformed {context}: {path.as_posix()} ({error})")
        return None
    if not isinstance(payload, dict):
        warnings.append(f"Malformed {context}: {path.as_posix()} (root is not a JSON object)")
        return None
    return payload


def _warn_if_mismatch(*, path: Path, field: str, expected: str, payload: dict[str, Any], warnings: list[str]) -> None:
    value = _str_or_none(payload.get(field))
    if value is not None and value != expected:
        warnings.append(f"Sidecar {field} mismatch: {path.as_posix()} has {value}, expected {expected}")


def _source_reported_outcome(summary: dict[str, Any]) -> str | None:
    for key in (
        "eval_outcome",
        "comparison_outcome",
        "smoke_outcome",
        "provider_smoke_outcome",
        "lane_outcome",
        "blocked_reason",
    ):
        value = _str_or_none(summary.get(key))
        if value is not None:
            return f"{key}: {value}"
    for key in (
        "track_e_evidence_ready",
        "comparison_ready",
        "smoke_passed",
        "h4_usefulness_passed",
        "cross_provider_smoke_passed",
        "real_provider_smoke_passed",
    ):
        value = summary.get(key)
        if isinstance(value, bool):
            return f"{key}: {str(value).lower()}"
    return None


def _safe_summary(summary: dict[str, Any]) -> dict[str, str | bool | int | float | None]:
    safe: dict[str, str | bool | int | float | None] = {}
    for key, value in summary.items():
        if isinstance(value, (str, bool, int, float)) or value is None:
            safe[key] = value
    return dict(sorted(safe.items()))


def _label_for_report_version(report_version: str) -> str:
    return report_version.replace(".", " ").replace("_", " ")


def _str_or_none(value: Any) -> str | None:
    if isinstance(value, str) and value.strip():
        return value.strip()
    return None


def _int_or_zero(value: Any) -> int:
    return value if isinstance(value, int) and value >= 0 else 0


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the U5-F derived memory/eval index for the local UI.")
    parser.add_argument("--data-dir", default="../data", help="Canonical FAL data directory to inspect.")
    parser.add_argument("--out", default="public/generated/memory-eval-index.json", help="Generated index output path.")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(sys.argv[1:] if argv is None else argv)
    try:
        index = write_memory_eval_index(data_dir=args.data_dir, out_path=args.out)
    except OSError as error:
        print(f"Error: failed to write memory/eval index: {error}", file=sys.stderr)
        return 2
    print(
        "Generated memory/eval index at {path}: {projects} projects, {artifacts} memory artifacts, {evals} eval summaries, {warnings} warnings.".format(
            path=Path(args.out).as_posix(),
            projects=index["summary"]["memory_project_count"],
            artifacts=index["summary"]["memory_artifact_count"],
            evals=index["summary"]["eval_summary_count"],
            warnings=index["summary"]["warnings_count"],
        ),
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
