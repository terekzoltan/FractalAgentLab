from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.evals.h2_run_comparison import run_h2_run_comparison_by_run_ids
from scripts.run_r3_k_h2_run_comparison import is_comparison_ready


class H2RunComparisonTests(unittest.TestCase):
    def test_comparison_ready_for_valid_h2_runs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            _write_h2_run(Path(tmp_dir), run_id="r3k-h2-a")
            _write_h2_run(Path(tmp_dir), run_id="r3k-h2-b")
            report = run_h2_run_comparison_by_run_ids(
                run_ids=["r3k-h2-a", "r3k-h2-b"],
                data_dir=tmp_dir,
            )

        self.assertTrue(is_comparison_ready(report))
        summary = report["summary"]
        self.assertEqual(2, summary["run_count"])
        self.assertTrue(summary["minimum_run_count_met"])
        self.assertTrue(summary["all_artifacts_valid"])
        self.assertTrue(summary["all_runs_match_expected_workflow"])
        self.assertTrue(summary["all_comparable_outputs_complete"])
        self.assertTrue(summary["all_key_orders_match"])

    def test_not_ready_for_single_valid_h2_run(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            _write_h2_run(Path(tmp_dir), run_id="r3k-h2-solo")
            report = run_h2_run_comparison_by_run_ids(
                run_ids=["r3k-h2-solo"],
                data_dir=tmp_dir,
            )

        self.assertFalse(is_comparison_ready(report))
        summary = report["summary"]
        self.assertEqual(1, summary["run_count"])
        self.assertFalse(summary["minimum_run_count_met"])

    def test_not_ready_when_workflow_id_mismatch(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            _write_h2_run(Path(tmp_dir), run_id="r3k-h2-valid")
            _write_h2_run(Path(tmp_dir), run_id="r3k-h2-wrong", workflow_id="h1.manager.v1")
            report = run_h2_run_comparison_by_run_ids(
                run_ids=["r3k-h2-valid", "r3k-h2-wrong"],
                data_dir=tmp_dir,
            )

        self.assertFalse(is_comparison_ready(report))
        self.assertFalse(report["summary"]["all_runs_match_expected_workflow"])

    def test_not_ready_when_key_order_or_shape_invalid(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            _write_h2_run(Path(tmp_dir), run_id="r3k-h2-good")
            _write_h2_run(
                Path(tmp_dir),
                run_id="r3k-h2-bad-order",
                final_output_overrides={
                    "project_summary": "Build a decomposition workflow",
                    "tracks": ["core"],
                },
                reorder_final_output=True,
            )
            _write_h2_run(
                Path(tmp_dir),
                run_id="r3k-h2-bad-shape",
                final_output_overrides={
                    "implementation_waves": ["wave-1"],
                    "recommended_starting_slice": "",
                },
            )
            report = run_h2_run_comparison_by_run_ids(
                run_ids=["r3k-h2-good", "r3k-h2-bad-order", "r3k-h2-bad-shape"],
                data_dir=tmp_dir,
            )

        self.assertFalse(is_comparison_ready(report))
        summary = report["summary"]
        self.assertFalse(summary["all_key_orders_match"])
        self.assertFalse(summary["all_implementation_waves_valid"])
        self.assertFalse(summary["all_recommended_starting_slice_present"])

    def test_not_ready_when_run_artifact_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            _write_h2_run(Path(tmp_dir), run_id="r3k-h2-good")
            report = run_h2_run_comparison_by_run_ids(
                run_ids=["r3k-h2-good", "missing-run"],
                data_dir=tmp_dir,
            )

        self.assertFalse(is_comparison_ready(report))
        self.assertFalse(report["summary"]["all_artifacts_valid"])
        self.assertFalse(report["summary"]["all_replay_ready"])


def _write_h2_run(
    base: Path,
    *,
    run_id: str,
    workflow_id: str = "h2.manager.v1",
    final_output_overrides: dict[str, object] | None = None,
    reorder_final_output: bool = False,
) -> None:
    runs_dir = base / "runs"
    traces_dir = base / "traces"
    runs_dir.mkdir(parents=True, exist_ok=True)
    traces_dir.mkdir(parents=True, exist_ok=True)

    final_output: dict[str, object] = {
        "project_summary": "Build a decomposition workflow",
        "tracks": ["core", "workflow"],
        "modules": ["runtime", "agents"],
        "phases": ["schema", "pack", "template", "smoke"],
        "dependency_order": ["schema", "pack", "template", "smoke"],
        "implementation_waves": [{"wave": "W3-S1", "focus": ["R3-A", "R3-B"]}],
        "recommended_starting_slice": "stabilize_template_shape",
        "risk_zones": ["scope_sprawl"],
        "open_questions": ["Need more real-provider evidence?"],
    }
    if isinstance(final_output_overrides, dict):
        final_output.update(final_output_overrides)
    if reorder_final_output:
        final_output = {
            "tracks": final_output["tracks"],
            "project_summary": final_output["project_summary"],
            "modules": final_output["modules"],
            "phases": final_output["phases"],
            "dependency_order": final_output["dependency_order"],
            "implementation_waves": final_output["implementation_waves"],
            "recommended_starting_slice": final_output["recommended_starting_slice"],
            "risk_zones": final_output["risk_zones"],
            "open_questions": final_output["open_questions"],
        }

    trace_events = [
        _event("e1", run_id, 1, "run_started"),
        _event("e2", run_id, 2, "step_started", step_id="synthesizer", payload={"lane": "manager", "turn_index": 1}),
        _event("e3", run_id, 3, "step_completed", step_id="synthesizer", payload={"lane": "manager", "turn_index": 1}),
        _event("e4", run_id, 4, "run_completed"),
    ]

    run_payload = {
        "run_id": run_id,
        "workflow_id": workflow_id,
        "status": "succeeded",
        "input_payload": {"goal": "Build a decomposition workflow"},
        "output_payload": {
            "step_results": {"synthesizer": {"output": {"ok": True}}},
            "manager_orchestration": {
                "manager_step_id": "synthesizer",
                "worker_step_ids": ["intake", "planner", "architect", "critic"],
                "turns": [
                    {"turn_index": 1, "action": "delegate", "target_step_id": "intake"},
                    {"turn_index": 2, "action": "delegate", "target_step_id": "planner"},
                    {"turn_index": 3, "action": "delegate", "target_step_id": "architect"},
                    {"turn_index": 4, "action": "delegate", "target_step_id": "critic"},
                    {"turn_index": 5, "action": "finalize"},
                ],
            },
            "final_output": final_output,
        },
        "step_results": {"synthesizer": {"output": {"ok": True}}},
        "errors": [],
        "failure": None,
        "context": {},
        "trace_event_ids": [event["event_id"] for event in trace_events],
        "status_transitions": [
            {"status": "pending", "timestamp": "2026-04-14T12:00:00+00:00"},
            {"status": "running", "timestamp": "2026-04-14T12:00:01+00:00"},
            {"status": "succeeded", "timestamp": "2026-04-14T12:00:02+00:00"},
        ],
        "created_at": "2026-04-14T12:00:00+00:00",
        "started_at": "2026-04-14T12:00:01+00:00",
        "completed_at": "2026-04-14T12:00:02+00:00",
        "schema_version": "run_state.v1",
    }

    (runs_dir / f"{run_id}.json").write_text(json.dumps(run_payload, ensure_ascii=True), encoding="utf-8")
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
    payload: dict[str, object] | None = None,
) -> dict[str, object]:
    return {
        "event_id": event_id,
        "run_id": run_id,
        "sequence": sequence,
        "event_type": event_type,
        "timestamp": "2026-04-14T12:00:01+00:00",
        "source": "runtime.executor",
        "step_id": step_id,
        "parent_event_id": None,
        "correlation_id": None,
        "payload": payload or {},
        "schema_version": "trace_event.v1",
    }


if __name__ == "__main__":
    unittest.main()
