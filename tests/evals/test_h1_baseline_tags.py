from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.evals.h1_baseline_tags import capture_h1_baseline_tags_by_run_ids
from scripts.run_h2_g_h1_baseline_tags import is_tag_capture_ready


class H1BaselineTagsTests(unittest.TestCase):
    def test_assigns_canonical_roles_and_is_ready(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            ids = _write_h1_trio(Path(tmp_dir))
            report = capture_h1_baseline_tags_by_run_ids(data_dir=tmp_dir, **ids)

        self.assertTrue(is_tag_capture_ready(report))
        by_workflow = {entry["workflow_id"]: entry for entry in report["variants"]}
        self.assertEqual("baseline_anchor", by_workflow["h1.single.v1"]["comparison_role"])
        self.assertEqual("default_multi_agent_reference", by_workflow["h1.manager.v1"]["comparison_role"])
        self.assertEqual("reference_variant", by_workflow["h1.handoff.v1"]["comparison_role"])
        self.assertNotIn("recommended_next_default_candidate", report)

    def test_prompt_tags_missing_is_non_blocking(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            ids = _write_h1_trio(Path(tmp_dir))
            report = capture_h1_baseline_tags_by_run_ids(data_dir=tmp_dir, **ids)

        self.assertTrue(is_tag_capture_ready(report))
        for entry in report["variants"]:
            self.assertIn("prompt_tags", entry)

    def test_invalid_run_ids_make_capture_not_ready(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            report = capture_h1_baseline_tags_by_run_ids(
                single_run_id="missing-single",
                manager_run_id="missing-manager",
                handoff_run_id="missing-handoff",
                data_dir=tmp_dir,
            )

        self.assertFalse(is_tag_capture_ready(report))
        summary = report["summary"]
        self.assertFalse(summary["all_replay_ready"])

    def test_swapped_existing_run_ids_make_capture_not_ready(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            ids = _write_h1_trio(Path(tmp_dir))
            report = capture_h1_baseline_tags_by_run_ids(
                data_dir=tmp_dir,
                single_run_id=ids["manager_run_id"],
                manager_run_id=ids["single_run_id"],
                handoff_run_id=ids["handoff_run_id"],
            )

        self.assertFalse(is_tag_capture_ready(report))
        summary = report["summary"]
        self.assertFalse(summary["all_workflow_matches_expected"])

def _write_h1_trio(base: Path) -> dict[str, str]:
    comparable = {
        "clarified_idea": "idea",
        "strongest_assumptions": ["a1"],
        "weak_points": ["w1"],
        "alternatives": ["alt1"],
        "recommended_mvp_direction": "mvp",
        "next_3_validation_steps": ["s1", "s2", "s3"],
    }

    runs_dir = base / "runs"
    traces_dir = base / "traces"
    runs_dir.mkdir(parents=True, exist_ok=True)
    traces_dir.mkdir(parents=True, exist_ok=True)

    run_ids = {
        "single_run_id": "h2g-single",
        "manager_run_id": "h2g-manager",
        "handoff_run_id": "h2g-handoff",
    }

    _write_run_trace(
        runs_dir,
        traces_dir,
        run_ids["single_run_id"],
        "h1.single.v1",
        output_payload={"step_results": {"single": {"output": dict(comparable)}}},
        step_results={"single": {"output": dict(comparable)}},
        trace_events=[
            _event("s1", run_ids["single_run_id"], 1, "run_started"),
            _event("s2", run_ids["single_run_id"], 2, "step_started", step_id="single", payload={"lane": "linear"}),
            _event("s3", run_ids["single_run_id"], 3, "step_completed", step_id="single", payload={"lane": "linear"}),
            _event("s4", run_ids["single_run_id"], 4, "run_completed"),
        ],
        schema_version="run_state.v0",
    )
    _write_run_trace(
        runs_dir,
        traces_dir,
        run_ids["manager_run_id"],
        "h1.manager.v1",
        output_payload={
            "step_results": {"synthesizer": {"output": {"ok": True}}},
            "final_output": dict(comparable),
            "prompt_tags": {"variant": "manager", "pack_prompt_version": "h1.prompt.v1"},
            "manager_orchestration": {
                "manager_step_id": "synthesizer",
                "worker_step_ids": ["intake", "planner", "critic"],
                "turns": [{"turn_index": 1, "target_step_id": "intake"}],
            },
        },
        step_results={"synthesizer": {"output": {"ok": True}}},
        trace_events=[
            _event("m1", run_ids["manager_run_id"], 1, "run_started", schema_version="trace_event.v1"),
            _event("m2", run_ids["manager_run_id"], 2, "step_started", step_id="synthesizer", schema_version="trace_event.v1", payload={"lane": "manager", "turn_index": 1}),
            _event("m3", run_ids["manager_run_id"], 3, "step_completed", step_id="synthesizer", schema_version="trace_event.v1", payload={"lane": "manager", "turn_index": 1}),
            _event("m4", run_ids["manager_run_id"], 4, "run_completed", schema_version="trace_event.v1"),
        ],
        schema_version="run_state.v1",
        include_status_transitions=True,
    )
    _write_run_trace(
        runs_dir,
        traces_dir,
        run_ids["handoff_run_id"],
        "h1.handoff.v1",
        output_payload={
            "step_results": {"intake": {"output": {"ok": True}}},
            "final_output": dict(comparable),
            "handoff_orchestration": {
                "entrypoint_step_id": "intake",
                "path": ["intake", "planner"],
                "handoff_count": 1,
                "turns": [{"handoff_index": 1, "from_step_id": "intake", "target_step_id": "planner"}],
                "final_step_id": "planner",
            },
        },
        step_results={"intake": {"output": {"ok": True}}},
        trace_events=[
            _event("h1", run_ids["handoff_run_id"], 1, "run_started", schema_version="trace_event.v1"),
            _event("h2", run_ids["handoff_run_id"], 2, "step_started", step_id="intake", schema_version="trace_event.v1", payload={"lane": "handoff", "turn_index": 1}),
            _event("h3", run_ids["handoff_run_id"], 3, "step_completed", step_id="intake", schema_version="trace_event.v1", payload={"lane": "handoff", "turn_index": 1}),
            _event("h4", run_ids["handoff_run_id"], 4, "handoff_decided", step_id="intake", schema_version="trace_event.v1", parent_event_id="h3", correlation_id="handoff:h2g-handoff:1", payload={"lane": "handoff", "handoff_index": 1, "from_step_id": "intake", "to_step_id": "planner"}),
            _event("h5", run_ids["handoff_run_id"], 5, "step_started", step_id="planner", schema_version="trace_event.v1", parent_event_id="h4", correlation_id="handoff:h2g-handoff:2", payload={"lane": "handoff", "turn_index": 2}),
            _event("h6", run_ids["handoff_run_id"], 6, "run_completed", schema_version="trace_event.v1"),
        ],
        schema_version="run_state.v1",
        include_status_transitions=True,
    )

    return run_ids


def _write_run_trace(
    runs_dir: Path,
    traces_dir: Path,
    run_id: str,
    workflow_id: str,
    *,
    output_payload: dict[str, object],
    step_results: dict[str, object],
    trace_events: list[dict[str, object]],
    schema_version: str,
    include_status_transitions: bool = False,
) -> None:
    payload: dict[str, object] = {
        "run_id": run_id,
        "workflow_id": workflow_id,
        "status": "succeeded",
        "input_payload": {"idea": "x"},
        "output_payload": output_payload,
        "step_results": step_results,
        "errors": [],
        "context": {},
        "trace_event_ids": [event["event_id"] for event in trace_events],
        "created_at": "2026-04-03T10:00:00+00:00",
        "started_at": "2026-04-03T10:00:01+00:00",
        "completed_at": "2026-04-03T10:00:02+00:00",
        "schema_version": schema_version,
    }
    if schema_version == "run_state.v1":
        payload["failure"] = None
        if include_status_transitions:
            payload["status_transitions"] = [
                {"status": "pending", "timestamp": "2026-04-03T10:00:00+00:00"},
                {"status": "running", "timestamp": "2026-04-03T10:00:01+00:00"},
                {"status": "succeeded", "timestamp": "2026-04-03T10:00:02+00:00"},
            ]

    (runs_dir / f"{run_id}.json").write_text(
        json.dumps(payload, ensure_ascii=True),
        encoding="utf-8",
    )
    (traces_dir / f"{run_id}.jsonl").write_text(
        "\n".join(json.dumps(event, ensure_ascii=True) for event in trace_events) + "\n",
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
) -> dict[str, object]:
    return {
        "event_id": event_id,
        "run_id": run_id,
        "sequence": sequence,
        "event_type": event_type,
        "timestamp": "2026-04-03T10:00:01+00:00",
        "source": "runtime.executor",
        "step_id": step_id,
        "parent_event_id": parent_event_id,
        "correlation_id": correlation_id,
        "payload": payload or {},
        "schema_version": schema_version,
    }


if __name__ == "__main__":
    unittest.main()
