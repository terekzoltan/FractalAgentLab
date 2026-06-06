from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

import scripts.build_u5_c_trace_details as trace_details
from scripts.build_u5_c_trace_details import SCHEMA_VERSION, build_trace_detail, write_trace_details


class U5CTraceDetailTests(unittest.TestCase):
    def test_builds_valid_trace_detail(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_run_only(data_dir, run_id="trace-run", workflow_id="h1.handoff.v1", status="succeeded")
            _write_trace_events(
                data_dir,
                run_id="trace-run",
                events=[
                    _event("trace-run", 1, "run_started", payload={"lane": "manager", "turn_index": 0}),
                    _event("trace-run", 2, "handoff_decided", payload={"from_step_id": "planner", "to_step_id": "critic"}),
                    _event("trace-run", 3, "run_completed"),
                ],
            )

            detail = build_trace_detail(run_id="trace-run", data_dir=data_dir)

            self.assertEqual(SCHEMA_VERSION, detail["schema_version"])
            self.assertEqual("h1.handoff.v1", detail["workflow_id"])
            self.assertEqual(3, detail["summary"]["total_events"])
            self.assertEqual("ok", detail["validation"]["trace_state"])
            self.assertEqual("manager", detail["events"][0]["lane"])
            self.assertIsNone(detail["opencode_loop"])

    def test_marks_failure_events_and_preserves_unknown_event_type(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_trace_pair(data_dir, run_id="trace-run")
            _write_trace_events(
                data_dir,
                run_id="trace-run",
                events=[
                    _event("trace-run", 1, "run_started"),
                    _event("trace-run", 2, "mystery_event", payload={"foo": "bar"}),
                    _event("trace-run", 3, "step_failed"),
                ],
            )

            detail = build_trace_detail(run_id="trace-run", data_dir=data_dir)

            self.assertEqual("mystery_event", detail["events"][1]["event_type"])
            self.assertFalse(detail["events"][1]["is_failure"])
            self.assertTrue(detail["events"][2]["is_failure"])

    def test_timestamp_warning_keeps_detail_valid(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_trace_pair(data_dir, run_id="time-run")
            _write_trace_events(
                data_dir,
                run_id="time-run",
                events=[
                    _event("time-run", 1, "run_started", timestamp="2026-05-03T10:00:02+00:00"),
                    _event("time-run", 2, "step_completed", timestamp="2026-05-03T10:00:01+00:00"),
                ],
            )

            detail = build_trace_detail(run_id="time-run", data_dir=data_dir)

            self.assertEqual("warning", detail["validation"]["trace_state"])
            self.assertEqual("warning", detail["validation"]["timestamp_order"])
            self.assertTrue(detail["validation"]["warnings"])
            self.assertEqual(1, detail["events"][0]["sequence"])
            self.assertEqual(2, detail["events"][1]["sequence"])

    def test_missing_parent_target_creates_warning(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_trace_pair(data_dir, run_id="parent-run")
            _write_trace_events(
                data_dir,
                run_id="parent-run",
                events=[
                    _event("parent-run", 1, "run_started"),
                    _event("parent-run", 2, "step_completed", parent_event_id="missing-parent"),
                ],
            )

            detail = build_trace_detail(run_id="parent-run", data_dir=data_dir)

            self.assertEqual("warning", detail["validation"]["linkage_state"])
            self.assertIn("missing-parent", detail["validation"]["warnings"][0])

    def test_write_trace_details_skips_invalid_and_missing_traces(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw) / "data"
            out_dir = Path(temp_dir_raw) / "ui" / "public" / "generated" / "traces"
            _write_trace_pair(data_dir, run_id="valid-run")
            _write_run_only(data_dir, run_id="missing-trace", workflow_id="h1.single.v1", status="failed")
            _write_run_only(data_dir, run_id="invalid-run", workflow_id="h1.single.v1", status="failed")
            _write_trace_events(
                data_dir,
                run_id="invalid-run",
                events=[
                    _event("invalid-run", 2, "run_completed"),
                    _event("invalid-run", 1, "run_started"),
                ],
            )

            summary = write_trace_details(data_dir=data_dir, out_dir=out_dir)

            self.assertTrue((out_dir / "valid-run.json").exists())
            self.assertFalse((out_dir / "missing-trace.json").exists())
            self.assertFalse((out_dir / "invalid-run.json").exists())
            self.assertEqual(1, summary["generated_count"])
            self.assertEqual(2, summary["skipped_count"])

    def test_write_trace_details_removes_stale_outputs_for_skipped_runs(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw) / "data"
            out_dir = Path(temp_dir_raw) / "ui" / "public" / "generated" / "traces"
            out_dir.mkdir(parents=True, exist_ok=True)
            _write_trace_detail_sentinel(out_dir)
            stale_path = out_dir / "invalid-run.json"
            stale_path.write_text("{}", encoding="utf-8")

            _write_trace_pair(data_dir, run_id="valid-run")
            _write_run_only(data_dir, run_id="invalid-run", workflow_id="h1.single.v1", status="failed")
            _write_trace_events(
                data_dir,
                run_id="invalid-run",
                events=[
                    _event("invalid-run", 2, "run_completed"),
                    _event("invalid-run", 1, "run_started"),
                ],
            )

            summary = write_trace_details(data_dir=data_dir, out_dir=out_dir)

            self.assertFalse(stale_path.exists())
            self.assertTrue((out_dir / "valid-run.json").exists())
            self.assertEqual(1, summary["generated_count"])

    def test_write_trace_details_initializes_missing_output_dir_with_sentinel(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw) / "data"
            out_dir = Path(temp_dir_raw) / "generated" / "traces"
            _write_trace_pair(data_dir, run_id="valid-run")

            summary = write_trace_details(data_dir=data_dir, out_dir=out_dir)

            self.assertTrue((out_dir / trace_details.GENERATED_TRACE_DETAILS_SENTINEL).exists())
            self.assertTrue((out_dir / "valid-run.json").exists())
            self.assertEqual(1, summary["generated_count"])

    def test_write_trace_details_initializes_empty_output_dir_with_sentinel(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw) / "data"
            out_dir = Path(temp_dir_raw) / "generated" / "traces"
            out_dir.mkdir(parents=True)
            _write_trace_pair(data_dir, run_id="valid-run")

            write_trace_details(data_dir=data_dir, out_dir=out_dir)

            sentinel = out_dir / trace_details.GENERATED_TRACE_DETAILS_SENTINEL
            self.assertEqual(trace_details.GENERATED_TRACE_DETAILS_SENTINEL_CONTENT, sentinel.read_text(encoding="utf-8"))

    def test_write_trace_details_refuses_non_empty_custom_dir_without_sentinel(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw) / "data"
            out_dir = Path(temp_dir_raw) / "custom-output"
            out_dir.mkdir(parents=True)
            existing_json = out_dir / "canonical-looking-run.json"
            existing_content = '{"run_id":"do-not-delete"}'
            existing_json.write_text(existing_content, encoding="utf-8")
            _write_trace_pair(data_dir, run_id="valid-run")

            with self.assertRaises(OSError):
                write_trace_details(data_dir=data_dir, out_dir=out_dir)

            self.assertEqual(existing_content, existing_json.read_text(encoding="utf-8"))
            self.assertFalse((out_dir / "valid-run.json").exists())

    def test_write_trace_details_refuses_canonical_data_dir_even_with_sentinel(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            original_canonical_data_dir = trace_details.CANONICAL_DATA_DIR
            try:
                temp_root = Path(temp_dir_raw)
                trace_details.CANONICAL_DATA_DIR = temp_root / "data"
                data_dir = temp_root / "source-data"
                out_dir = trace_details.CANONICAL_DATA_DIR / "runs"
                out_dir.mkdir(parents=True)
                _write_trace_detail_sentinel(out_dir)
                existing_json = out_dir / "canonical-run.json"
                existing_content = '{"run_id":"canonical"}'
                existing_json.write_text(existing_content, encoding="utf-8")
                _write_trace_pair(data_dir, run_id="valid-run")

                with self.assertRaises(OSError):
                    write_trace_details(data_dir=data_dir, out_dir=out_dir)

                self.assertEqual(existing_content, existing_json.read_text(encoding="utf-8"))
                self.assertFalse((out_dir / "valid-run.json").exists())
            finally:
                trace_details.CANONICAL_DATA_DIR = original_canonical_data_dir

    def test_write_trace_details_bootstraps_exact_default_trace_output_dir(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            original_default_dir = trace_details.DEFAULT_GENERATED_TRACE_DETAILS_DIR
            try:
                data_dir = Path(temp_dir_raw) / "data"
                out_dir = Path(temp_dir_raw) / "ui" / "public" / "generated" / "traces"
                trace_details.DEFAULT_GENERATED_TRACE_DETAILS_DIR = out_dir
                out_dir.mkdir(parents=True)
                stale_path = out_dir / "stale-run.json"
                stale_path.write_text("{}", encoding="utf-8")
                _write_trace_pair(data_dir, run_id="valid-run")

                summary = write_trace_details(data_dir=data_dir, out_dir=out_dir)

                self.assertFalse(stale_path.exists())
                self.assertTrue((out_dir / trace_details.GENERATED_TRACE_DETAILS_SENTINEL).exists())
                self.assertTrue((out_dir / "valid-run.json").exists())
                self.assertEqual(1, summary["generated_count"])
            finally:
                trace_details.DEFAULT_GENERATED_TRACE_DETAILS_DIR = original_default_dir

    def test_payload_summary_and_raw_payload_are_preserved(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_trace_pair(data_dir, run_id="payload-run")
            payload = {"lane": "critic", "turn_index": 3, "alpha": "beta", "nested": {"x": 1}}
            _write_trace_events(data_dir, run_id="payload-run", events=[_event("payload-run", 1, "agent_completed", payload=payload)])

            detail = build_trace_detail(run_id="payload-run", data_dir=data_dir)

            self.assertIn("alpha=beta", detail["events"][0]["payload_summary"])
            self.assertEqual(payload, detail["events"][0]["payload"])

    def test_builds_opencode_loop_drilldown_from_w7_sidecars(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_run_only(data_dir, run_id="ocloop-valid", workflow_id="opencode.meta_track.loop.v1", status="succeeded")
            _write_trace_events(data_dir, run_id="ocloop-valid", events=[_event("ocloop-valid", 1, "run_started")])
            _write_w7_sidecars(data_dir, run_id="ocloop-valid")

            detail = build_trace_detail(run_id="ocloop-valid", data_dir=data_dir)

            opencode_loop = detail["opencode_loop"]
            self.assertIsNotNone(opencode_loop)
            self.assertEqual("ringfall", opencode_loop["summary"]["target_project_id"])
            self.assertTrue(opencode_loop["summary"]["clean_pass_eligible"])
            self.assertEqual(1, len(opencode_loop["packet_ledger_entries"]))
            self.assertEqual("greenlit", opencode_loop["packet_ledger_entries"][0]["decision"])
            self.assertEqual(1, len(opencode_loop["selected_outputs"]))
            self.assertEqual("Bounded accepted excerpt.", opencode_loop["selected_outputs"][0]["excerpt"])
            self.assertEqual(1, len(opencode_loop["approval_checkpoints"]))
            self.assertTrue(opencode_loop["approval_checkpoints"][0]["approved"])
            self.assertEqual("greenlit", opencode_loop["review_synthesis"]["plan_verdict"])
            self.assertEqual([], opencode_loop["warnings"])

    def test_malformed_w7_summary_keeps_trace_detail_visible_with_warning(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_run_only(data_dir, run_id="ocloop-bad-sidecar", workflow_id="opencode.meta_track.loop.v1", status="succeeded")
            _write_trace_events(data_dir, run_id="ocloop-bad-sidecar", events=[_event("ocloop-bad-sidecar", 1, "run_started")])
            sidecar_dir = data_dir / "artifacts" / "ocloop-bad-sidecar"
            sidecar_dir.mkdir(parents=True)
            (sidecar_dir / "opencode_loop_summary.json").write_text("{not-json", encoding="utf-8")

            detail = build_trace_detail(run_id="ocloop-bad-sidecar", data_dir=data_dir)

            self.assertEqual(1, detail["summary"]["total_events"])
            opencode_loop = detail["opencode_loop"]
            self.assertIsNotNone(opencode_loop)
            self.assertIsNone(opencode_loop["summary"])
            self.assertEqual([], opencode_loop["packet_ledger_entries"])
            self.assertEqual([], opencode_loop["selected_outputs"])
            self.assertEqual([], opencode_loop["approval_checkpoints"])
            self.assertIn("Invalid W7 sidecar", opencode_loop["warnings"][0])

    def test_wrong_run_id_w7_summary_does_not_render_structured_rows(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_run_only(data_dir, run_id="ocloop-wrong-summary-run", workflow_id="opencode.meta_track.loop.v1", status="succeeded")
            _write_trace_events(data_dir, run_id="ocloop-wrong-summary-run", events=[_event("ocloop-wrong-summary-run", 1, "run_started")])
            _write_w7_sidecars(data_dir, run_id="ocloop-wrong-summary-run")
            sidecar_dir = data_dir / "artifacts" / "ocloop-wrong-summary-run"
            _write_json(
                sidecar_dir / "opencode_loop_summary.json",
                {
                    "schema_version": "w7.opencode_loop_summary.v1",
                    "run_id": "other-run",
                    "target_project_id": "ringfall",
                    "clean_pass_eligible": True,
                },
            )

            detail = build_trace_detail(run_id="ocloop-wrong-summary-run", data_dir=data_dir)

            opencode_loop = detail["opencode_loop"]
            self.assertIsNotNone(opencode_loop)
            self.assertIsNone(opencode_loop["summary"])
            self.assertEqual([], opencode_loop["packet_ledger_entries"])
            self.assertEqual([], opencode_loop["selected_outputs"])
            self.assertEqual([], opencode_loop["approval_checkpoints"])
            self.assertIsNone(opencode_loop["review_synthesis"])
            self.assertTrue(any("run_id mismatch" in warning for warning in opencode_loop["warnings"]))

    def test_wrong_schema_packet_ledger_does_not_render_packet_rows(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_run_only(data_dir, run_id="ocloop-wrong-packet-schema", workflow_id="opencode.meta_track.loop.v1", status="succeeded")
            _write_trace_events(data_dir, run_id="ocloop-wrong-packet-schema", events=[_event("ocloop-wrong-packet-schema", 1, "run_started")])
            _write_w7_sidecars(data_dir, run_id="ocloop-wrong-packet-schema")
            sidecar_dir = data_dir / "artifacts" / "ocloop-wrong-packet-schema"
            _write_json(
                sidecar_dir / "packet_ledger.json",
                {
                    "schema_version": "w7.other_packet_ledger.v1",
                    "entries": [{"sequence": 1, "decision": "should-not-render"}],
                },
            )

            detail = build_trace_detail(run_id="ocloop-wrong-packet-schema", data_dir=data_dir)

            opencode_loop = detail["opencode_loop"]
            self.assertIsNotNone(opencode_loop)
            self.assertEqual("ringfall", opencode_loop["summary"]["target_project_id"])
            self.assertEqual([], opencode_loop["packet_ledger_entries"])
            self.assertEqual(1, len(opencode_loop["selected_outputs"]))
            self.assertTrue(any("packet_ledger.json" in warning and "schema_version" in warning for warning in opencode_loop["warnings"]))

    def test_wrong_run_id_selected_outputs_do_not_render_selected_output_rows(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_run_only(data_dir, run_id="ocloop-wrong-output-run", workflow_id="opencode.meta_track.loop.v1", status="succeeded")
            _write_trace_events(data_dir, run_id="ocloop-wrong-output-run", events=[_event("ocloop-wrong-output-run", 1, "run_started")])
            _write_w7_sidecars(data_dir, run_id="ocloop-wrong-output-run")
            sidecar_dir = data_dir / "artifacts" / "ocloop-wrong-output-run"
            _write_json(
                sidecar_dir / "selected_outputs.json",
                {
                    "schema_version": "w7.selected_outputs.v1",
                    "run_id": "other-run",
                    "outputs": [
                        {
                            "output_id": "output1",
                            "stage": "meta_plan_review_done",
                            "source_session": "meta-session",
                            "message_id": "message1",
                            "capture_mode": "latest_output_selected",
                            "summary": "Should not render.",
                            "excerpt": "Should not render.",
                            "excerpt_truncated": False,
                            "privacy_classification": "private_coordination",
                        }
                    ],
                },
            )

            detail = build_trace_detail(run_id="ocloop-wrong-output-run", data_dir=data_dir)

            opencode_loop = detail["opencode_loop"]
            self.assertIsNotNone(opencode_loop)
            self.assertEqual(1, len(opencode_loop["packet_ledger_entries"]))
            self.assertEqual([], opencode_loop["selected_outputs"])
            self.assertTrue(any("selected_outputs.json" in warning and "run_id mismatch" in warning for warning in opencode_loop["warnings"]))


def _write_trace_pair(data_dir: Path, *, run_id: str) -> None:
    _write_run_only(data_dir, run_id=run_id, workflow_id="h1.single.v1", status="succeeded")
    _write_trace_events(data_dir, run_id=run_id, events=[_event(run_id, 1, "run_started"), _event(run_id, 2, "run_completed")])


def _write_trace_detail_sentinel(out_dir: Path) -> None:
    (out_dir / trace_details.GENERATED_TRACE_DETAILS_SENTINEL).write_text(
        trace_details.GENERATED_TRACE_DETAILS_SENTINEL_CONTENT,
        encoding="utf-8",
    )


def _write_run_only(data_dir: Path, *, run_id: str, workflow_id: str, status: str) -> None:
    runs_dir = data_dir / "runs"
    runs_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "run_id": run_id,
        "workflow_id": workflow_id,
        "status": status,
        "input_payload": {},
        "output_payload": {},
        "started_at": "2026-05-03T10:00:00+00:00",
        "completed_at": "2026-05-03T10:00:01+00:00",
        "schema_version": "run_state.v1",
    }
    (runs_dir / f"{run_id}.json").write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")


def _write_w7_sidecars(data_dir: Path, *, run_id: str) -> None:
    sidecar_dir = data_dir / "artifacts" / run_id
    sidecar_dir.mkdir(parents=True, exist_ok=True)
    _write_json(
        sidecar_dir / "opencode_loop_summary.json",
        {
            "schema_version": "w7.opencode_loop_summary.v1",
            "run_id": run_id,
            "workflow_id": "opencode.meta_track.loop.v1",
            "target_project_id": "ringfall",
            "target_project_name": "RingFall",
            "external_loop_id": run_id,
            "sequence_ref": "W7-D",
            "overall_outcome": "green",
            "terminal_stage": "step_review_done",
            "final_decision": "accepted",
            "packet_count": 1,
            "approval_count": 1,
            "selected_output_count": 1,
            "review_synthesis_present": True,
            "validation_state": "ok",
            "clean_pass_eligible": True,
            "privacy_audit_state": {
                "retention_mode": "structured_extracts_only",
                "public_export_state": "blocked",
            },
        },
    )
    _write_json(
        sidecar_dir / "packet_ledger.json",
        {
            "schema_version": "w7.packet_ledger.v1",
            "entries": [
                {
                    "sequence": 1,
                    "stage": "meta_plan_review_done",
                    "producer": "meta",
                    "consumer": "track_a",
                    "source_command": "/seq-next",
                    "decision": "greenlit",
                    "summary": "Approved W7-D plan.",
                    "validation_state": "ok",
                    "packet_ref": "packet1",
                    "selected_output_ref": "output1",
                    "approval_ref": "approval1",
                }
            ],
        },
    )
    _write_json(
        sidecar_dir / "selected_outputs.json",
        {
            "schema_version": "w7.selected_outputs.v1",
            "outputs": [
                {
                    "output_id": "output1",
                    "stage": "meta_plan_review_done",
                    "source_session": "meta-session",
                    "message_id": "message1",
                    "capture_mode": "latest_output_selected",
                    "summary": "Meta accepted the plan.",
                    "excerpt": "Bounded accepted excerpt.",
                    "excerpt_truncated": False,
                    "body_path": None,
                    "privacy_classification": "private_coordination",
                }
            ],
        },
    )
    _write_json(
        sidecar_dir / "approval_log.json",
        {
            "schema_version": "w7.approval_log.v1",
            "checkpoints": [
                {
                    "checkpoint_id": "approval1",
                    "action_kind": "packet_route",
                    "target_session": "track-a-session",
                    "stage": "meta_plan_review_done",
                    "approved": True,
                    "approved_at": "2026-06-05T12:00:00+00:00",
                    "approval_mode": "explicit_user_checkpoint",
                }
            ],
        },
    )
    _write_json(
        sidecar_dir / "review_synthesis.json",
        {
            "schema_version": "w7.review_synthesis.v1",
            "plan_review": {"verdict": "greenlit", "summary": "Plan approved."},
            "step_review": {"final_verdict": "accepted", "final_summary": "Implementation accepted.", "swarm_verdict": "approve"},
        },
    )


def _write_json(path: Path, payload: dict[str, object]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")


def _write_trace_events(data_dir: Path, *, run_id: str, events: list[dict[str, object]]) -> None:
    traces_dir = data_dir / "traces"
    traces_dir.mkdir(parents=True, exist_ok=True)
    content = "\n".join(json.dumps(event, ensure_ascii=True) for event in events) + "\n"
    (traces_dir / f"{run_id}.jsonl").write_text(content, encoding="utf-8")


def _event(
    run_id: str,
    sequence: int,
    event_type: str,
    *,
    timestamp: str | None = None,
    payload: dict[str, object] | None = None,
    parent_event_id: str | None = None,
) -> dict[str, object]:
    return {
        "event_id": f"{run_id}-{sequence}",
        "run_id": run_id,
        "sequence": sequence,
        "event_type": event_type,
        "timestamp": timestamp or f"2026-05-03T10:00:0{sequence}+00:00",
        "source": "runtime.executor",
        "step_id": None,
        "parent_event_id": parent_event_id,
        "correlation_id": None,
        "payload": payload or {},
        "schema_version": "trace_event.v1",
    }


if __name__ == "__main__":
    unittest.main()
