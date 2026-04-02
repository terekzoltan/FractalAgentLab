from __future__ import annotations

from pathlib import Path


def resolve_data_dir(data_dir: str | Path) -> Path:
    return Path(data_dir)


def runs_dir_path(*, data_dir: str | Path) -> Path:
    return resolve_data_dir(data_dir) / "runs"


def traces_dir_path(*, data_dir: str | Path) -> Path:
    return resolve_data_dir(data_dir) / "traces"


def artifacts_root_dir_path(*, data_dir: str | Path) -> Path:
    return resolve_data_dir(data_dir) / "artifacts"


def run_artifact_path(*, run_id: str, data_dir: str | Path) -> Path:
    return runs_dir_path(data_dir=data_dir) / f"{run_id}.json"


def trace_artifact_path(*, run_id: str, data_dir: str | Path) -> Path:
    return traces_dir_path(data_dir=data_dir) / f"{run_id}.jsonl"


def run_artifact_dir_path(*, run_id: str, data_dir: str | Path) -> Path:
    return artifacts_root_dir_path(data_dir=data_dir) / run_id
