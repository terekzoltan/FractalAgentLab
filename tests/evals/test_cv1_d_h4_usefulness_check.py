from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.evals.cv1_d_h4_usefulness_check import inspect_cv1_d_h4_usefulness
from scripts.run_cv1_d_h4_usefulness_check import (
    BLOCKED_EXIT_CODE,
    FAIL_EXIT_CODE,
    PASS_EXIT_CODE,
    exit_code_for_report,
    is_h4_usefulness_passed,
    is_track_e_evidence_ready,
    report_outcome,
)


class CV1DH4UsefulnessCheckTests(unittest.TestCase):
    def test_passes_main_usefulness_without_wave_start_lane(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base = Path(tmp_dir)
            _write_h4_run_and_trace(base=base, run_id="seq-pass", workflow_id="h4.seq_next.v1", status="succeeded")
            _write_seq_next_artifacts(base=base, run_id="seq-pass", structurally_complete=True)
            baseline_path = base / "baseline.md"
            baseline_path.write_text("Quick idea: implement a plan quickly.", encoding="utf-8")

            report = inspect_cv1_d_h4_usefulness(
                seq_next_run_id="seq-pass",
                baseline_plan_path=baseline_path,
                comparison_task_intent="Evaluate H4 planning for the same CV1 task.",
                wave_start_run_id=None,
                data_dir=base,
            )

        self.assertTrue(is_track_e_evidence_ready(report))
        self.assertTrue(is_h4_usefulness_passed(report))
        self.assertEqual("PASS", report["summary"]["eval_outcome"])
        self.assertFalse(report["summary"]["packet_legibility_demonstrated"])
        self.assertEqual("NOT_DEMONSTRATED", report["wave_start_lane"]["summary"]["lane_outcome"])

    def test_packet_sidecar_missing_does_not_block_main_verdict(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base = Path(tmp_dir)
            _write_h4_run_and_trace(base=base, run_id="seq-pass-2", workflow_id="h4.seq_next.v1", status="succeeded")
            _write_seq_next_artifacts(base=base, run_id="seq-pass-2", structurally_complete=True)

            _write_h4_run_and_trace(base=base, run_id="wave-no-packet", workflow_id="h4.wave_start.v1", status="succeeded")
            _write_context_report_artifact(base=base, run_id="wave-no-packet")

            baseline_path = base / "baseline.md"
            baseline_path.write_text("Small freeform plan with little detail.", encoding="utf-8")

            report = inspect_cv1_d_h4_usefulness(
                seq_next_run_id="seq-pass-2",
                baseline_plan_path=baseline_path,
                comparison_task_intent="Same task intent for H4 and baseline.",
                wave_start_run_id="wave-no-packet",
                data_dir=base,
            )

        self.assertEqual("PASS", report["summary"]["eval_outcome"])
        self.assertTrue(report["summary"]["h4_usefulness_passed"])
        self.assertFalse(report["summary"]["packet_legibility_demonstrated"])
        self.assertEqual("NOT_DEMONSTRATED", report["wave_start_lane"]["summary"]["lane_outcome"])

    def test_fails_when_seq_next_artifacts_are_structurally_inadequate(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base = Path(tmp_dir)
            _write_h4_run_and_trace(base=base, run_id="seq-fail", workflow_id="h4.seq_next.v1", status="succeeded")
            _write_seq_next_artifacts(base=base, run_id="seq-fail", structurally_complete=False)
            baseline_path = base / "baseline.md"
            baseline_path.write_text("Very weak baseline plan.", encoding="utf-8")

            report = inspect_cv1_d_h4_usefulness(
                seq_next_run_id="seq-fail",
                baseline_plan_path=baseline_path,
                comparison_task_intent="Matched task intent is asserted.",
                data_dir=base,
            )

        self.assertEqual("FAIL", report["summary"]["eval_outcome"])
        self.assertTrue(is_track_e_evidence_ready(report))
        self.assertFalse(is_h4_usefulness_passed(report))
        self.assertFalse(report["seq_next_lane"]["canonical_artifact_checks"]["structural_adequacy"])

    def test_blocks_when_required_seq_next_input_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base = Path(tmp_dir)
            baseline_path = base / "baseline.md"
            baseline_path.write_text("Baseline exists.", encoding="utf-8")

            report = inspect_cv1_d_h4_usefulness(
                seq_next_run_id=None,
                baseline_plan_path=baseline_path,
                comparison_task_intent="Matched task intent.",
                data_dir=base,
            )

        self.assertEqual("BLOCKED", report["summary"]["eval_outcome"])
        self.assertEqual("missing_seq_next_run", report["summary"]["blocked_reason"])
        self.assertFalse(is_track_e_evidence_ready(report))
        self.assertFalse(is_h4_usefulness_passed(report))

    def test_failed_seq_next_run_cannot_pass_even_if_artifacts_exist(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base = Path(tmp_dir)
            _write_h4_run_and_trace(base=base, run_id="seq-run-failed", workflow_id="h4.seq_next.v1", status="failed")
            _write_seq_next_artifacts(base=base, run_id="seq-run-failed", structurally_complete=True)
            baseline_path = base / "baseline.md"
            baseline_path.write_text("Minimal one-shot baseline.", encoding="utf-8")

            report = inspect_cv1_d_h4_usefulness(
                seq_next_run_id="seq-run-failed",
                baseline_plan_path=baseline_path,
                comparison_task_intent="Same task intent is asserted.",
                data_dir=base,
            )

        self.assertEqual("FAIL", report["summary"]["eval_outcome"])
        self.assertFalse(report["summary"]["h4_usefulness_passed"])
        self.assertFalse(report["seq_next_lane"]["canonical_artifact_checks"]["run_succeeded"])

    def test_empty_baseline_blocks_main_comparison(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base = Path(tmp_dir)
            _write_h4_run_and_trace(base=base, run_id="seq-block-empty", workflow_id="h4.seq_next.v1", status="succeeded")
            _write_seq_next_artifacts(base=base, run_id="seq-block-empty", structurally_complete=True)
            baseline_path = base / "baseline.md"
            baseline_path.write_text("   \n\t", encoding="utf-8")

            report = inspect_cv1_d_h4_usefulness(
                seq_next_run_id="seq-block-empty",
                baseline_plan_path=baseline_path,
                comparison_task_intent="Same task intent is asserted.",
                data_dir=base,
            )

        self.assertEqual("BLOCKED", report["summary"]["eval_outcome"])
        self.assertEqual("empty_baseline_plan", report["summary"]["blocked_reason"])

    def test_minimal_context_report_does_not_pass_wave_start_lane(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base = Path(tmp_dir)
            _write_h4_run_and_trace(base=base, run_id="seq-pass-3", workflow_id="h4.seq_next.v1", status="succeeded")
            _write_seq_next_artifacts(base=base, run_id="seq-pass-3", structurally_complete=True)
            _write_h4_run_and_trace(base=base, run_id="wave-minimal", workflow_id="h4.wave_start.v1", status="succeeded")
            _write_minimal_context_report_artifact(base=base, run_id="wave-minimal")
            _write_wave_start_packet_artifacts(base=base, run_id="wave-minimal")
            baseline_path = base / "baseline.md"
            baseline_path.write_text("Baseline plan text", encoding="utf-8")

            report = inspect_cv1_d_h4_usefulness(
                seq_next_run_id="seq-pass-3",
                baseline_plan_path=baseline_path,
                comparison_task_intent="Same task intent for H4 and baseline.",
                wave_start_run_id="wave-minimal",
                data_dir=base,
            )

        self.assertEqual("PASS", report["summary"]["eval_outcome"])
        self.assertEqual("NOT_DEMONSTRATED", report["wave_start_lane"]["summary"]["lane_outcome"])
        self.assertFalse(report["summary"]["packet_legibility_demonstrated"])
        self.assertEqual(
            "context_report_structurally_inadequate",
            report["wave_start_lane"]["canonical_artifact_check"]["reason"],
        )

    def test_script_exit_codes_distinguish_blocked_and_fail(self) -> None:
        pass_report = {"summary": {"eval_outcome": "PASS"}}
        fail_report = {"summary": {"eval_outcome": "FAIL"}}
        blocked_report = {"summary": {"eval_outcome": "BLOCKED"}}

        self.assertEqual("PASS", report_outcome(pass_report))
        self.assertEqual("FAIL", report_outcome(fail_report))
        self.assertEqual("BLOCKED", report_outcome(blocked_report))

        self.assertEqual(PASS_EXIT_CODE, exit_code_for_report(pass_report))
        self.assertEqual(FAIL_EXIT_CODE, exit_code_for_report(fail_report))
        self.assertEqual(BLOCKED_EXIT_CODE, exit_code_for_report(blocked_report))


def _write_h4_run_and_trace(*, base: Path, run_id: str, workflow_id: str, status: str) -> None:
    runs_dir = base / "runs"
    traces_dir = base / "traces"
    runs_dir.mkdir(parents=True, exist_ok=True)
    traces_dir.mkdir(parents=True, exist_ok=True)

    trace_events = [
        _event("e1", run_id, 1, "run_started", payload={"execution_mode": "manager"}),
        _event("e2", run_id, 2, "step_started", step_id="synthesizer"),
        _event("e3", run_id, 3, "step_completed", step_id="synthesizer"),
        _event("e4", run_id, 4, "run_completed" if status == "succeeded" else "run_failed"),
    ]

    output_payload = {
        "step_results": {
            "synthesizer": {
                "output": {
                    "ok": True,
                },
            },
        },
        "final_output": {
            "task_summary": "Plan CV1-D",
        },
    }

    run_payload = {
        "run_id": run_id,
        "workflow_id": workflow_id,
        "status": status,
        "input_payload": {"goal": "cv1"},
        "output_payload": output_payload if status == "succeeded" else None,
        "step_results": {
            "synthesizer": {
                "provider": "mock",
                "model": "gpt-5.4-mini",
                "agent_id": "h4_synthesizer_agent",
                "step_id": "synthesizer",
                "output": {"ok": True},
                "raw": {"mock": True},
            },
        },
        "errors": [] if status == "succeeded" else ["run failed"],
        "failure": None if status == "succeeded" else {
            "code": "step_execution_error",
            "message": "run failed",
            "category": "step_execution",
            "error_type": "StepExecutionError",
            "details": {"workflow_id": workflow_id},
            "recoverable": False,
            "schema_version": "runtime_error_envelope.v1",
        },
        "context": {},
        "trace_event_ids": [event["event_id"] for event in trace_events],
        "status_transitions": [
            {"status": "pending", "timestamp": "2026-04-19T12:00:00+00:00"},
            {"status": "running", "timestamp": "2026-04-19T12:00:01+00:00"},
            {"status": status, "timestamp": "2026-04-19T12:00:02+00:00"},
        ],
        "created_at": "2026-04-19T12:00:00+00:00",
        "started_at": "2026-04-19T12:00:01+00:00",
        "completed_at": "2026-04-19T12:00:02+00:00",
        "schema_version": "run_state.v1",
    }

    (runs_dir / f"{run_id}.json").write_text(json.dumps(run_payload, ensure_ascii=True), encoding="utf-8")
    (traces_dir / f"{run_id}.jsonl").write_text(
        "\n".join(json.dumps(event, ensure_ascii=True) for event in trace_events) + "\n",
        encoding="utf-8",
    )


def _write_seq_next_artifacts(*, base: Path, run_id: str, structurally_complete: bool) -> None:
    artifact_dir = base / "artifacts" / run_id
    artifact_dir.mkdir(parents=True, exist_ok=True)

    plan_text = """
---
artifact_type: implementation_plan
artifact_version: 1.0
run_id: {run_id}
workflow_id: h4
workflow_variant: h4.seq_next.v1
generated_at: 2026-04-19T12:00:03+00:00
---

# Implementation Plan

## Task Summary
Build CV1-D check.

## Intent
Inspect bounded H4 usefulness.

## Current Repo Context
H4 artifacts are required.

## Affected Surfaces
- src/fractal_agent_lab/evals

## Likely Touched Files
- src/fractal_agent_lab/evals/cv1_d_h4_usefulness_check.py

## Step Order
- implement helper

## Dependencies
- CV1-B

## Test Plan
- run unittest

## Documentation Obligations
- add wave3 note

## Risks
- scope creep

## Open Questions
- none

## Shared-Zone Cautions
- keep additive only

## Sequencing Risks
- none

## Functional Checks
- helper outputs lane split

## Tests Required
- tests/evals/test_cv1_d_h4_usefulness_check.py

## Docs Required
- docs/wave3/Wave3-CV1-D-TrackE-H4-Usefulness-Check-v1.md

## Blocking Conditions
- missing seq_next evidence

## Non-Goals
- no H5 spillover
""".strip().format(run_id=run_id)

    if not structurally_complete:
        plan_text = plan_text.replace("## Docs Required\n- docs/wave3/Wave3-CV1-D-TrackE-H4-Usefulness-Check-v1.md\n\n", "")

    (artifact_dir / "implementation_plan.md").write_text(plan_text + "\n", encoding="utf-8")

    acceptance_payload = {
        "artifact_type": "acceptance_checks",
        "artifact_version": "1.0",
        "run_id": run_id,
        "workflow_id": "h4",
        "workflow_variant": "h4.seq_next.v1",
        "generated_at": "2026-04-19T12:00:03+00:00",
        "functional_checks": ["lane split present"],
        "tests_required": ["tests/evals/test_cv1_d_h4_usefulness_check.py"],
        "docs_required": ["docs/wave3/Wave3-CV1-D-TrackE-H4-Usefulness-Check-v1.md"],
        "non_goals": ["no packet bus"],
        "blocking_conditions": ["missing seq_next evidence"],
    }
    if not structurally_complete:
        acceptance_payload["tests_required"] = []

    (artifact_dir / "acceptance_checks.json").write_text(
        json.dumps(acceptance_payload, ensure_ascii=True),
        encoding="utf-8",
    )


def _write_context_report_artifact(*, base: Path, run_id: str) -> None:
    artifact_dir = base / "artifacts" / run_id
    artifact_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "artifact_type": "context_report",
        "artifact_version": "1.0",
        "run_id": run_id,
        "workflow_id": "h4",
        "workflow_variant": "h4.wave_start.v1",
        "generated_at": "2026-04-19T12:00:03+00:00",
        "current_frontier": "cv1",
        "blockers_or_holds": [],
        "next_recommended_action": "run cv1-d",
        "changed_surfaces": ["ops"],
        "likely_touched_files": ["src/fractal_agent_lab/evals/cv1_d_h4_usefulness_check.py"],
        "shared_zone_cautions": ["ops"],
        "sequencing_risks": ["none"],
        "non_goals": ["no bus"],
        "assumptions": ["same task"],
        "unknowns": ["none"],
    }
    (artifact_dir / "context_report.json").write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")


def _write_minimal_context_report_artifact(*, base: Path, run_id: str) -> None:
    artifact_dir = base / "artifacts" / run_id
    artifact_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "artifact_type": "context_report",
        "artifact_version": "1.0",
        "run_id": run_id,
        "workflow_id": "h4",
        "workflow_variant": "h4.wave_start.v1",
        "generated_at": "2026-04-19T12:00:03+00:00",
    }
    (artifact_dir / "context_report.json").write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")


def _write_wave_start_packet_artifacts(*, base: Path, run_id: str) -> None:
    packet_dir = base / "artifacts" / run_id / "packets"
    packet_dir.mkdir(parents=True, exist_ok=True)
    packet_json = {
        "packet_type": "wave_start",
        "packet_version": "1.0",
        "role": "track_d.helper",
        "source_ref": f"artifacts/{run_id}/context_report.json",
        "frontier_ref": "cv1",
        "execution_mode": "actual_fal_workflow_run",
        "visibility_audit_state": {
            "git_visible_only": False,
            "non_canonical_inputs_used": [f"artifacts/{run_id}/context_report.json"],
            "depends_on_local_data_artifacts": True,
        },
        "status": "derived_transport_packet",
        "generated_at": "2026-04-19T12:00:03+00:00",
        "content": {
            "current_frontier": "cv1",
            "blockers_or_holds": [],
            "next_recommended_action": "run",
            "changed_surfaces": ["ops"],
            "likely_touched_files": ["src/fractal_agent_lab/evals/cv1_d_h4_usefulness_check.py"],
            "shared_zone_cautions": ["ops"],
            "sequencing_risks": ["none"],
            "non_goals": ["no bus"],
            "assumptions": ["same task"],
            "unknowns": ["none"],
        },
        "upstream": {
            "artifact_type": "context_report",
            "artifact_version": "1.0",
            "run_id": run_id,
            "workflow_id": "h4",
            "workflow_variant": "h4.wave_start.v1",
            "generated_at": "2026-04-19T12:00:03+00:00",
        },
    }
    (packet_dir / "wave_start.packet.json").write_text(json.dumps(packet_json, ensure_ascii=True), encoding="utf-8")
    (packet_dir / "wave_start.packet.md").write_text(
        "# Packet: wave_start\n\n## Wave Start\n- Current frontier: cv1\n",
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
        "timestamp": "2026-04-19T12:00:01+00:00",
        "source": "runtime.executor",
        "step_id": step_id,
        "parent_event_id": None,
        "correlation_id": None,
        "payload": payload or {},
        "schema_version": "trace_event.v1",
    }


if __name__ == "__main__":
    unittest.main()
