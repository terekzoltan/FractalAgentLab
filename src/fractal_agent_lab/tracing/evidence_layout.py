from __future__ import annotations

from pathlib import Path

from fractal_agent_lab.core.contracts.w6_packet import RESERVED_PACKET_IDS, require_w6_path_identifier
from fractal_agent_lab.tracing.artifact_layout import resolve_data_dir


def wave6_evidence_root_dir_path(*, data_dir: str | Path) -> Path:
    return resolve_data_dir(data_dir) / "evidence" / "wave6"


def wave6_loops_dir_path(*, data_dir: str | Path) -> Path:
    return wave6_evidence_root_dir_path(data_dir=data_dir) / "loops"


def wave6_loop_dir_path(*, loop_id: str, data_dir: str | Path) -> Path:
    safe_loop_id = require_w6_path_identifier(loop_id, field_name="loop_id")
    return wave6_loops_dir_path(data_dir=data_dir) / safe_loop_id


def wave6_packet_dir_path(*, loop_id: str, data_dir: str | Path) -> Path:
    return wave6_loop_dir_path(loop_id=loop_id, data_dir=data_dir) / "packets"


def wave6_packet_artifact_path(*, loop_id: str, packet_id: str, data_dir: str | Path) -> Path:
    safe_packet_id = require_w6_path_identifier(
        packet_id,
        field_name="packet_id",
        reserved_names=RESERVED_PACKET_IDS,
    )
    return wave6_packet_dir_path(loop_id=loop_id, data_dir=data_dir) / f"{safe_packet_id}.json"


def wave6_ledger_artifact_path(*, loop_id: str, data_dir: str | Path) -> Path:
    return wave6_loop_dir_path(loop_id=loop_id, data_dir=data_dir) / "ledger.json"
