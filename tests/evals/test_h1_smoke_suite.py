from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.evals.h1_eval_contracts import H1_COMPARABLE_OUTPUT_KEYS
from fractal_agent_lab.evals.h1_smoke_suite import run_h1_smoke_suite_by_run_ids
from scripts.run_h2_f_h1_smoke_suite import is_smoke_passed


class H1SmokeSuiteTests(unittest.TestCase):
    def test_smoke_suite_passes_for_valid_stored_trio(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            ids = _write_h1_trio(Path(tmp_dir))
            report = run_h1_smoke_suite_by_run_ids(data_dir=tmp_dir, **ids)

        self.assertTrue(is_smoke_passed(report))
        summary = report["summary"]
        self.assertTrue(summary["all_artifacts_valid"])
        self.assertTrue(summary["all_replay_ready"])
        self.assertTrue(summary["all_comparable_outputs_complete"])
        self.assertTrue(summary["handoff_linkage_preserved"])

    def test_smoke_suite_fails_when_comparable_output_incomplete(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            ids = _write_h1_trio(
                Path(tmp_dir),
                manager_final_output_overrides={"recommended_mvp_direction": None},
            )
            report = run_h1_smoke_suite_by_run_ids(data_dir=tmp_dir, **ids)

        self.assertFalse(is_smoke_passed(report))
        summary = report["summary"]
        self.assertFalse(summary["all_comparable_outputs_complete"])

    def test_smoke_suite_fails_when_handoff_linkage_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            ids = _write_h1_trio(Path(tmp_dir), include_handoff_linkage=False)
            report = run_h1_smoke_suite_by_run_ids(data_dir=tmp_dir, **ids)

        self.assertFalse(is_smoke_passed(report))
        summary = report["summary"]
        self.assertFalse(summary["handoff_linkage_preserved"])

    def test_smoke_suite_fails_when_handoff_parent_reference_is_broken(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base = Path(tmp_dir)
            ids = _write_h1_trio(base)
            trace_path = base / "traces" / f"{ids['handoff_run_id']}.jsonl"
            events = [
                json.loads(line)
                for line in trace_path.read_text(encoding="utf-8").splitlines()
                if line.strip()
            ]
            handoff_event = next(event for event in events if event["event_type"] == "handoff_decided")
            handoff_event["parent_event_id"] = "missing-parent"
            trace_path.write_text(
                "\n".join(json.dumps(event, ensure_ascii=True) for event in events) + "\n",
                encoding="utf-8",
            )

            report = run_h1_smoke_suite_by_run_ids(data_dir=tmp_dir, **ids)

        self.assertFalse(is_smoke_passed(report))
        summary = report["summary"]
        self.assertFalse(summary["handoff_linkage_preserved"])


def _write_h1_trio(
    base: Path,
    *,
    include_handoff_linkage: bool = True,
    manager_final_output_overrides: dict[str, object] | None = None,
) -> dict[str, str]:
    comparable_full = _comparable_fields()

    single_run_id = "h2f-single"
    single_payload = {
        "run_id": single_run_id,
        "workflow_id": "h1.single.v1",
        "status": "succeeded",
        "input_payload": {"idea": "x"},
        "output_payload": {"step_results": {"single": {"output": dict(comparable_full)}}},
        "step_results": {"single": {"output": dict(comparable_full)}},
        "errors": [],
        "context": {},
        "trace_event_ids": ["s1", "s2", "s3", "s4"],
        "created_at": "2026-04-03T10:00:00+00:00",
        "started_at": "2026-04-03T10:00:01+00:00",
        "completed_at": "2026-04-03T10:00:02+00:00",
        "schema_version": "run_state.v0",
    }
    single_events = [
        _event("s1", single_run_id, 1, "run_started", payload={"execution_mode": "linear"}),
        _event("s2", single_run_id, 2, "step_started", step_id="single", payload={"lane": "linear"}),
        _event("s3", single_run_id, 3, "step_completed", step_id="single", payload={"lane": "linear"}),
        _event("s4", single_run_id, 4, "run_completed"),
    ]

    manager_run_id = "h2f-manager"
    manager_final_output = dict(comparable_full)
    if isinstance(manager_final_output_overrides, dict):
        manager_final_output.update(manager_final_output_overrides)
    manager_payload = {
        "run_id": manager_run_id,
        "workflow_id": "h1.manager.v1",
        "status": "succeeded",
        "input_payload": {"idea": "x"},
        "output_payload": {
            "step_results": {"synthesizer": {"output": {"ok": True}}},
            "final_output": manager_final_output,
            "manager_orchestration": {
                "manager_step_id": "synthesizer",
                "worker_step_ids": ["intake", "planner", "critic"],
                "turns": [{"turn_index": 1, "target_step_id": "intake"}],
            },
        },
        "step_results": {"synthesizer": {"output": {"ok": True}}},
        "errors": [],
        "failure": None,
        "context": {},
        "trace_event_ids": ["m1", "m2", "m3", "m4"],
        "status_transitions": [
            {"status": "pending", "timestamp": "2026-04-03T10:00:00+00:00"},
            {"status": "running", "timestamp": "2026-04-03T10:00:01+00:00"},
            {"status": "succeeded", "timestamp": "2026-04-03T10:00:02+00:00"},
        ],
        "created_at": "2026-04-03T10:00:00+00:00",
        "started_at": "2026-04-03T10:00:01+00:00",
        "completed_at": "2026-04-03T10:00:02+00:00",
        "schema_version": "run_state.v1",
    }
    manager_events = [
        _event("m1", manager_run_id, 1, "run_started", schema_version="trace_event.v1", payload={"execution_mode": "manager"}),
        _event("m2", manager_run_id, 2, "step_started", schema_version="trace_event.v1", step_id="synthesizer", payload={"lane": "manager", "turn_index": 1}),
        _event("m3", manager_run_id, 3, "step_completed", schema_version="trace_event.v1", step_id="synthesizer", payload={"lane": "manager", "turn_index": 1}),
        _event("m4", manager_run_id, 4, "run_completed", schema_version="trace_event.v1"),
    ]

    handoff_run_id = "h2f-handoff"
    handoff_payload = {
        "run_id": handoff_run_id,
        "workflow_id": "h1.handoff.v1",
        "status": "succeeded",
        "input_payload": {"idea": "x"},
        "output_payload": {
            "step_results": {"intake": {"output": {"ok": True}}, "planner": {"output": {"ok": True}}},
            "final_output": dict(comparable_full),
            "handoff_orchestration": {
                "entrypoint_step_id": "intake",
                "path": ["intake", "planner"],
                "handoff_count": 1,
                "turns": [{"handoff_index": 1, "from_step_id": "intake", "target_step_id": "planner"}],
                "final_step_id": "planner",
            },
        },
        "step_results": {"intake": {"output": {"ok": True}}, "planner": {"output": {"ok": True}}},
        "errors": [],
        "failure": None,
        "context": {},
        "trace_event_ids": ["h1", "h2", "h3", "h4", "h5", "h6"],
        "status_transitions": [
            {"status": "pending", "timestamp": "2026-04-03T10:00:00+00:00"},
            {"status": "running", "timestamp": "2026-04-03T10:00:01+00:00"},
            {"status": "succeeded", "timestamp": "2026-04-03T10:00:02+00:00"},
        ],
        "created_at": "2026-04-03T10:00:00+00:00",
        "started_at": "2026-04-03T10:00:01+00:00",
        "completed_at": "2026-04-03T10:00:02+00:00",
        "schema_version": "run_state.v1",
    }
    handoff_events = [
        _event("h1", handoff_run_id, 1, "run_started", schema_version="trace_event.v1", payload={"execution_mode": "handoff"}),
        _event(
            "h2",
            handoff_run_id,
            2,
            "step_started",
            schema_version="trace_event.v1",
            step_id="intake",
            payload={"lane": "handoff", "turn_index": 1, "handoff_index": 1, "from_step_id": "intake"},
            correlation_id="handoff:h2f-handoff:1" if include_handoff_linkage else None,
        ),
        _event(
            "h3",
            handoff_run_id,
            3,
            "step_completed",
            schema_version="trace_event.v1",
            step_id="intake",
            payload={"lane": "handoff", "turn_index": 1, "handoff_index": 1, "from_step_id": "intake"},
            correlation_id="handoff:h2f-handoff:1" if include_handoff_linkage else None,
        ),
        _event(
            "h4",
            handoff_run_id,
            4,
            "handoff_decided",
            schema_version="trace_event.v1",
            step_id="intake",
            parent_event_id="h3" if include_handoff_linkage else None,
            correlation_id="handoff:h2f-handoff:1" if include_handoff_linkage else None,
            payload={
                "lane": "handoff",
                "handoff_index": 1,
                "decision_action": "handoff",
                "decision_source": "explicit",
                "from_step_id": "intake",
                "to_step_id": "planner",
            },
        ),
        _event(
            "h5",
            handoff_run_id,
            5,
            "step_started",
            schema_version="trace_event.v1",
            step_id="planner",
            parent_event_id="h4" if include_handoff_linkage else None,
            correlation_id="handoff:h2f-handoff:2" if include_handoff_linkage else None,
            payload={"lane": "handoff", "turn_index": 2, "handoff_index": 2, "from_step_id": "planner"},
        ),
        _event("h6", handoff_run_id, 6, "run_completed", schema_version="trace_event.v1"),
    ]

    _write_pair(base, single_run_id, single_payload, single_events)
    _write_pair(base, manager_run_id, manager_payload, manager_events)
    _write_pair(base, handoff_run_id, handoff_payload, handoff_events)

    return {
        "single_run_id": single_run_id,
        "manager_run_id": manager_run_id,
        "handoff_run_id": handoff_run_id,
    }


def _comparable_fields() -> dict[str, object]:
    fields = {key: f"value:{key}" for key in H1_COMPARABLE_OUTPUT_KEYS}
    fields["strongest_assumptions"] = ["a1"]
    fields["weak_points"] = ["w1"]
    fields["alternatives"] = ["alt1"]
    fields["next_3_validation_steps"] = ["v1", "v2", "v3"]
    return fields


def _write_pair(base_dir: Path, run_id: str, run_payload: dict[str, object], events: list[dict[str, object]]) -> None:
    runs_dir = base_dir / "runs"
    traces_dir = base_dir / "traces"
    runs_dir.mkdir(parents=True, exist_ok=True)
    traces_dir.mkdir(parents=True, exist_ok=True)

    (runs_dir / f"{run_id}.json").write_text(json.dumps(run_payload, ensure_ascii=True), encoding="utf-8")
    (traces_dir / f"{run_id}.jsonl").write_text(
        "\n".join(json.dumps(event, ensure_ascii=True) for event in events) + "\n",
        encoding="utf-8",
    )


def _event(
    event_id: str,
    run_id: str,
    sequence: int,
    event_type: str,
    *,
    step_id: str | None = None,
    parent_event_id: str | None = None,
    correlation_id: str | None = None,
    payload: dict[str, object] | None = None,
    schema_version: str = "trace_event.v0",
    timestamp: str = "2026-04-03T10:00:01+00:00",
) -> dict[str, object]:
    return {
        "event_id": event_id,
        "run_id": run_id,
        "sequence": sequence,
        "event_type": event_type,
        "timestamp": timestamp,
        "source": "runtime.executor",
        "step_id": step_id,
        "parent_event_id": parent_event_id,
        "correlation_id": correlation_id,
        "payload": payload or {},
        "schema_version": schema_version,
    }


if __name__ == "__main__":
    unittest.main()
