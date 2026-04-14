from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.memory import JSONProjectMemoryStore, ProjectMemory
from fractal_agent_lab.evals.r3_l_evidence_curation import curate_r3_l_evidence
from scripts.run_r3_l_evidence_curation import is_track_a_handoff_ready


class R3LEvidenceCurationTests(unittest.TestCase):
    def test_honest_current_state_report_with_h2_not_ready(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base = Path(tmp_dir)
            _write_h1_single_run(base, run_id="h1-single")
            _write_h1_manager_run(base, run_id="h1-manager")
            _write_h1_handoff_run(base, run_id="h1-handoff")
            _write_h2_run(base, run_id="h2-good-a")
            _write_h2_run(base, run_id="h2-bad-order", reorder_final_output=True)
            _write_h3_run(base, run_id="h3-primary")

            report = curate_r3_l_evidence(
                h1_single_run_id="h1-single",
                h1_manager_run_id="h1-manager",
                h1_handoff_run_id="h1-handoff",
                h2_run_ids=["h2-good-a", "h2-bad-order"],
                h3_run_id="h3-primary",
                data_dir=base,
            )

        self.assertTrue(is_track_a_handoff_ready(report))
        self.assertFalse(report["h2_evidence"]["comparison_ready"])
        self.assertEqual("H2 current corpus is not comparison-ready.", report["h2_evidence"]["truth_statement"])
        self.assertIn("all_key_orders_match", report["h2_evidence"]["failed_gates"])
        self.assertFalse(report["project_memory_evidence"]["demonstrated"])
        self.assertEqual(
            "M2 project-memory evidence is not demonstrated in the current curated run set.",
            report["project_memory_evidence"]["truth_statement"],
        )

    def test_h1_manifest_labels_historical_schema(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base = Path(tmp_dir)
            _write_h1_single_run(base, run_id="h1-single")
            _write_h1_manager_run(base, run_id="h1-manager")
            _write_h1_handoff_run(base, run_id="h1-handoff")
            _write_h2_run(base, run_id="h2-good-a")
            _write_h2_run(base, run_id="h2-good-b")
            _write_h3_run(base, run_id="h3-primary")

            report = curate_r3_l_evidence(
                h1_single_run_id="h1-single",
                h1_manager_run_id="h1-manager",
                h1_handoff_run_id="h1-handoff",
                h2_run_ids=["h2-good-a", "h2-good-b"],
                h3_run_id="h3-primary",
                data_dir=base,
            )

        for row in report["selected_runs"]["h1"]:
            self.assertEqual("run_state.v0", row["artifact_schema_version"])
            self.assertEqual("replay_backed_historical", row["evidence_backing"]["classification"])

    def test_project_memory_evidence_uses_encoded_store_path_for_special_character_project_id(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base = Path(tmp_dir)
            _write_h1_single_run(base, run_id="h1-single")
            _write_h1_manager_run(base, run_id="h1-manager")
            _write_h1_handoff_run(base, run_id="h1-handoff")
            _write_h2_run(base, run_id="h2-good-a")
            _write_h2_run(base, run_id="h2-good-b")
            _write_h3_run(
                base,
                run_id="h3-primary",
                input_project_id="stale-input-id",
                context_project_id="repo/alpha 1",
            )
            _write_project_memory_artifacts(base, run_id="h3-primary", project_id="repo/alpha 1")

            report = curate_r3_l_evidence(
                h1_single_run_id="h1-single",
                h1_manager_run_id="h1-manager",
                h1_handoff_run_id="h1-handoff",
                h2_run_ids=["h2-good-a", "h2-good-b"],
                h3_run_id="h3-primary",
                data_dir=base,
            )

        memory_rows = {row["run_id"]: row for row in report["project_memory_evidence"]["runs"]}
        h3_memory = memory_rows["h3-primary"]
        self.assertEqual("repo/alpha 1", h3_memory["project_id"])
        self.assertTrue(h3_memory["canonical_project_store_present"])
        self.assertTrue(h3_memory["project_memory_update_sidecar_present"])
        self.assertTrue(h3_memory["demonstrated_for_run"])
        self.assertTrue(report["project_memory_evidence"]["demonstrated"])
        self.assertEqual(
            (base / "memory" / "projects" / "repo%2Falpha%201.json").as_posix(),
            h3_memory["canonical_project_store_path"],
        )

    def test_requires_h2_run_ids(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base = Path(tmp_dir)
            _write_h1_single_run(base, run_id="h1-single")
            _write_h1_manager_run(base, run_id="h1-manager")
            _write_h1_handoff_run(base, run_id="h1-handoff")
            _write_h3_run(base, run_id="h3-primary")

            with self.assertRaisesRegex(ValueError, "At least one --h2-run-id"):
                _ = curate_r3_l_evidence(
                    h1_single_run_id="h1-single",
                    h1_manager_run_id="h1-manager",
                    h1_handoff_run_id="h1-handoff",
                    h2_run_ids=[],
                    h3_run_id="h3-primary",
                    data_dir=base,
                )


def _write_h1_single_run(base: Path, *, run_id: str) -> None:
    output = {
        "clarified_idea": "Idea",
        "strongest_assumptions": ["a"],
        "weak_points": ["b"],
        "alternatives": ["c"],
        "recommended_mvp_direction": "d",
        "next_3_validation_steps": ["e"],
    }
    _write_run_and_trace(
        base,
        run_id=run_id,
        workflow_id="h1.single.v1",
        schema_version="run_state.v0",
        output_payload={"step_results": {"single": {"output": output}}},
    )


def _write_h1_manager_run(base: Path, *, run_id: str) -> None:
    output = {
        "clarified_idea": "Idea",
        "strongest_assumptions": ["a"],
        "weak_points": ["b"],
        "alternatives": ["c"],
        "recommended_mvp_direction": "d",
        "next_3_validation_steps": ["e"],
    }
    _write_run_and_trace(
        base,
        run_id=run_id,
        workflow_id="h1.manager.v1",
        schema_version="run_state.v0",
        output_payload={
            "step_results": {"synthesizer": {"output": {"ok": True}}},
            "final_output": output,
            "manager_orchestration": {
                "manager_step_id": "synthesizer",
                "worker_step_ids": ["intake", "planner", "critic"],
                "turns": [
                    {"turn_index": 1, "action": "delegate", "target_step_id": "intake"},
                    {"turn_index": 2, "action": "delegate", "target_step_id": "planner"},
                    {"turn_index": 3, "action": "delegate", "target_step_id": "critic"},
                    {"turn_index": 4, "action": "finalize"},
                ],
            },
        },
    )


def _write_h1_handoff_run(base: Path, *, run_id: str) -> None:
    output = {
        "clarified_idea": "Idea",
        "strongest_assumptions": ["a"],
        "weak_points": ["b"],
        "alternatives": ["c"],
        "recommended_mvp_direction": "d",
        "next_3_validation_steps": ["e"],
    }
    _write_run_and_trace(
        base,
        run_id=run_id,
        workflow_id="h1.handoff.v1",
        schema_version="run_state.v0",
        output_payload={
            "step_results": {"synthesizer": {"output": {"ok": True}}},
            "final_output": output,
            "handoff_orchestration": {
                "entrypoint_step_id": "intake",
                "path": ["intake", "planner", "critic", "synthesizer"],
                "handoff_count": 3,
                "final_step_id": "synthesizer",
                "turns": [
                    {"handoff_index": 1, "from_step_id": "intake", "target_step_id": "planner", "action": "handoff"},
                    {"handoff_index": 2, "from_step_id": "planner", "target_step_id": "critic", "action": "handoff"},
                    {"handoff_index": 3, "from_step_id": "critic", "target_step_id": "synthesizer", "action": "handoff"},
                ],
            },
        },
        linked_trace=True,
    )


def _write_h2_run(base: Path, *, run_id: str, reorder_final_output: bool = False) -> None:
    final_output: dict[str, object] = {
        "project_summary": "Build a decomposition workflow",
        "tracks": ["core"],
        "modules": ["workflow"],
        "phases": ["contract"],
        "dependency_order": ["workflow_schema"],
        "implementation_waves": [{"wave": "W3-S1", "focus": ["R3-A"]}],
        "recommended_starting_slice": "slice",
        "risk_zones": ["drift"],
        "open_questions": ["q"],
    }
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
    _write_run_and_trace(
        base,
        run_id=run_id,
        workflow_id="h2.manager.v1",
        schema_version="run_state.v1",
        output_payload={
            "step_results": {"synthesizer": {"output": {"ok": True}}},
            "final_output": final_output,
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
        },
    )


def _write_h3_run(
    base: Path,
    *,
    run_id: str,
    input_project_id: str | None = None,
    context_project_id: str | None = None,
) -> None:
    _write_run_and_trace(
        base,
        run_id=run_id,
        workflow_id="h3.manager.v1",
        schema_version="run_state.v1",
        input_payload={"goal": "x", **({"project_id": input_project_id} if input_project_id else {})},
        context={**({"project_id": context_project_id} if context_project_id else {})},
        output_payload={
            "step_results": {"synthesizer": {"output": {"ok": True}}},
            "final_output": {
                "strengths": ["s"],
                "bottlenecks": ["b"],
                "merge_risks": ["m"],
                "refactor_ideas": ["r"],
            },
            "manager_orchestration": {
                "manager_step_id": "synthesizer",
                "worker_step_ids": ["intake", "planner", "systems", "critic"],
                "turns": [
                    {"turn_index": 1, "action": "delegate", "target_step_id": "intake"},
                    {"turn_index": 2, "action": "delegate", "target_step_id": "planner"},
                    {"turn_index": 3, "action": "delegate", "target_step_id": "systems"},
                    {"turn_index": 4, "action": "delegate", "target_step_id": "critic"},
                    {"turn_index": 5, "action": "finalize"},
                ],
            },
        },
    )


def _write_run_and_trace(
    base: Path,
    *,
    run_id: str,
    workflow_id: str,
    schema_version: str,
    input_payload: dict[str, object] | None = None,
    context: dict[str, object] | None = None,
    output_payload: dict[str, object],
    linked_trace: bool = False,
) -> None:
    runs_dir = base / "runs"
    traces_dir = base / "traces"
    runs_dir.mkdir(parents=True, exist_ok=True)
    traces_dir.mkdir(parents=True, exist_ok=True)

    trace_events = _trace_events(run_id=run_id, linked_trace=linked_trace)
    run_payload: dict[str, object] = {
        "run_id": run_id,
        "workflow_id": workflow_id,
        "status": "succeeded",
        "input_payload": input_payload or {"goal": "x"},
        "output_payload": output_payload,
        "step_results": {"synthesizer": {"output": {"ok": True}}},
        "errors": [],
        "context": context or {},
        "trace_event_ids": [event["event_id"] for event in trace_events],
        "created_at": "2026-04-14T12:00:00+00:00",
        "started_at": "2026-04-14T12:00:01+00:00",
        "completed_at": "2026-04-14T12:00:02+00:00",
        "schema_version": schema_version,
    }
    if schema_version == "run_state.v1":
        run_payload["failure"] = None
        run_payload["status_transitions"] = [
            {"status": "pending", "timestamp": "2026-04-14T12:00:00+00:00"},
            {"status": "running", "timestamp": "2026-04-14T12:00:01+00:00"},
            {"status": "succeeded", "timestamp": "2026-04-14T12:00:02+00:00"},
        ]

    (runs_dir / f"{run_id}.json").write_text(json.dumps(run_payload, ensure_ascii=True), encoding="utf-8")
    (traces_dir / f"{run_id}.jsonl").write_text(
        "\n".join(json.dumps(event, ensure_ascii=True) for event in trace_events) + "\n",
        encoding="utf-8",
    )


def _trace_events(*, run_id: str, linked_trace: bool) -> list[dict[str, object]]:
    events: list[dict[str, object]] = [
        _event("e1", run_id, 1, "run_started"),
        _event("e2", run_id, 2, "step_started", step_id="synthesizer"),
        _event("e3", run_id, 3, "step_completed", step_id="synthesizer"),
        _event("e4", run_id, 4, "run_completed"),
    ]
    if linked_trace:
        events[2]["parent_event_id"] = "e2"
        events[2]["correlation_id"] = "corr-1"
    return events


def _event(event_id: str, run_id: str, sequence: int, event_type: str, *, step_id: str | None = None) -> dict[str, object]:
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
        "payload": {},
        "schema_version": "trace_event.v1",
    }


def _write_project_memory_artifacts(base: Path, *, run_id: str, project_id: str) -> None:
    store = JSONProjectMemoryStore(data_dir=base)
    store.save_project(ProjectMemory(project_id=project_id))
    artifact_dir = base / "artifacts" / run_id
    artifact_dir.mkdir(parents=True, exist_ok=True)
    (artifact_dir / "project_memory_update.json").write_text("{}", encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
