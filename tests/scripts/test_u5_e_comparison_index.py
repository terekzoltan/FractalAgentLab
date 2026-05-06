from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.build_u5_e_comparison_index import (
    P4_B_OPENAI_RUN_ID,
    P4_B_OPENROUTER_RUN_ID,
    SCHEMA_VERSION,
    build_comparison_index,
    write_comparison_index,
)


class U5EComparisonIndexTests(unittest.TestCase):
    def test_missing_runs_directory_creates_empty_not_demonstrated_index(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            index = build_comparison_index(data_dir=Path(temp_dir_raw))

            self.assertEqual(SCHEMA_VERSION, index["schema_version"])
            self.assertEqual([], index["run_candidates"])
            self.assertEqual([], index["suggested_pairs"])
            self.assertEqual("not_demonstrated", index["known_evidence_pairs"][0]["local_state"])
            self.assertEqual("BLOCKED", index["known_evidence_pairs"][0]["local_preflight_status"])

    def test_h1_supported_pair_uses_track_e_keys_and_structural_preflight_only(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_run_trace_pair(data_dir, run_id="h1-single", workflow_id="h1.single.v1", input_payload={"idea": "same"})
            _write_run_trace_pair(data_dir, run_id="h1-manager", workflow_id="h1.manager.v1", input_payload={"idea": "same"})

            index = build_comparison_index(data_dir=data_dir)

            self.assertEqual(2, index["summary"]["run_candidate_count"])
            pair = index["suggested_pairs"][0]
            self.assertEqual("h1_structural_variant", pair["target_class"])
            self.assertEqual("PASS", pair["structural_preflight_status"])
            self.assertTrue(pair["display_only"])
            candidate = {row["run_id"]: row for row in index["run_candidates"]}["h1-single"]
            keys = [field["key"] for field in candidate["comparable_output"]["fields"]]
            self.assertIn("clarified_idea", keys)
            self.assertIn("recommended_mvp_direction", keys)
            self.assertLessEqual(len(candidate["comparable_output"]["fields"][0]["preview"]), 160)

    def test_pair_generation_is_bounded_by_deterministic_cap(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            for index in range(5):
                _write_run_trace_pair(data_dir, run_id=f"h1-{index}", workflow_id="h1.manager.v1", input_payload={"idea": "same"})

            comparison_index = build_comparison_index(data_dir=data_dir, max_suggested_pairs=2)

            self.assertEqual(2, comparison_index["summary"]["suggested_pair_count"])
            self.assertEqual(2, len(comparison_index["suggested_pairs"]))

    def test_missing_trace_and_missing_input_do_not_produce_pass(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_run_trace_pair(data_dir, run_id="h1-good", workflow_id="h1.manager.v1", input_payload={"idea": "same"})
            _write_run_only(data_dir, run_id="h1-missing-trace", workflow_id="h1.manager.v1", input_payload={"idea": "same"})
            _write_run_trace_pair(data_dir, run_id="h1-missing-input", workflow_id="h1.manager.v1", input_payload=[])

            index = build_comparison_index(data_dir=data_dir)
            pairs = {pair["pair_id"]: pair for pair in index["suggested_pairs"]}

            missing_trace_pair = next(pair for pair in pairs.values() if "h1-missing-trace" in pair["pair_id"])
            missing_input_pair = next(pair for pair in pairs.values() if "h1-missing-input" in pair["pair_id"])
            self.assertEqual("INVALID", missing_trace_pair["structural_preflight_status"])
            self.assertEqual("BLOCKED", missing_input_pair["structural_preflight_status"])
            self.assertIn("matched_input_not_confirmed", missing_input_pair["status_reasons"])

    def test_h2_gate_failures_are_visible_not_new_track_a_policy(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_run_trace_pair(data_dir, run_id="h2-good", workflow_id="h2.manager.v1", input_payload={"goal": "same"})
            _write_run_trace_pair(
                data_dir,
                run_id="h2-bad-order",
                workflow_id="h2.manager.v1",
                input_payload={"goal": "same"},
                h2_bad_key_order=True,
            )

            index = build_comparison_index(data_dir=data_dir)

            pair = index["suggested_pairs"][0]
            self.assertEqual("h2_structural", pair["target_class"])
            self.assertEqual("FAIL", pair["structural_preflight_status"])
            self.assertTrue(any("h2_key_order_mismatch" in reason for reason in pair["status_reasons"]))

    def test_h2_unknown_intended_corpus_is_warning_when_other_gates_pass(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_run_trace_pair(data_dir, run_id="h2-a", workflow_id="h2.manager.v1", input_payload={"goal": "same"})
            _write_run_trace_pair(data_dir, run_id="h2-b", workflow_id="h2.manager.v1", input_payload={"goal": "same"})

            index = build_comparison_index(data_dir=data_dir)

            pair = index["suggested_pairs"][0]
            self.assertEqual("WARNING", pair["structural_preflight_status"])
            self.assertEqual(["h2_intended_comparable_corpus_unknown"], pair["status_reasons"])

    def test_missing_artifact_outranks_h2_unknown_corpus_warning(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_run_trace_pair(data_dir, run_id="h2-ok", workflow_id="h2.manager.v1", input_payload={"goal": "same"})
            _write_run_only(data_dir, run_id="h2-missing-trace", workflow_id="h2.manager.v1", input_payload={"goal": "same"})

            index = build_comparison_index(data_dir=data_dir)

            pair = next(pair for pair in index["suggested_pairs"] if "h2-missing-trace" in pair["pair_id"])
            self.assertEqual("INVALID", pair["structural_preflight_status"])
            self.assertTrue(any(reason.endswith("missing_trace_artifact") for reason in pair["status_reasons"]))
            self.assertIn("h2_intended_comparable_corpus_unknown", pair["status_reasons"])

    def test_h3_h4_h5_are_not_comparison_ready(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_run_trace_pair(data_dir, run_id="h3", workflow_id="h3.manager.v1")
            _write_run_trace_pair(data_dir, run_id="h4", workflow_id="h4.seq_next.v1")

            index = build_comparison_index(data_dir=data_dir)

            self.assertEqual([], index["suggested_pairs"])
            labels = {row["run_id"]: row["evidence_label"] for row in index["unsupported_targets"]}
            self.assertEqual("manual_rubric_backed", labels["h3"])
            self.assertEqual("not_demonstrated", labels["h4"])
            future_states = {row["run_id"]: row["future_state"] for row in index["unsupported_targets"]}
            self.assertEqual("deferred", future_states["h4"])

    def test_fallback_backed_p4_b_local_pair_does_not_get_local_pass(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_run_trace_pair(data_dir, run_id=P4_B_OPENROUTER_RUN_ID, workflow_id="h1.single.v1", used_fallback=True)
            _write_run_trace_pair(data_dir, run_id=P4_B_OPENAI_RUN_ID, workflow_id="h1.single.v1", used_fallback=False)

            index = build_comparison_index(data_dir=data_dir)

            pair = index["known_evidence_pairs"][0]
            self.assertEqual("PASS", pair["source_reported_status"])
            self.assertEqual("FAIL", pair["local_preflight_status"])
            self.assertIn("local_fallback_observed_source_report_not_recomputed", pair["status_reasons"])

    def test_write_comparison_index_creates_output_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            out_path = Path(temp_dir_raw) / "ui" / "public" / "generated" / "comparison-index.json"

            write_comparison_index(data_dir=Path(temp_dir_raw) / "data", out_path=out_path)

            payload = json.loads(out_path.read_text(encoding="utf-8"))
            self.assertEqual(SCHEMA_VERSION, payload["schema_version"])


def _write_run_trace_pair(
    data_dir: Path,
    *,
    run_id: str,
    workflow_id: str,
    input_payload: object | None = None,
    used_fallback: bool = False,
    h2_bad_key_order: bool = False,
) -> None:
    _write_run_only(
        data_dir,
        run_id=run_id,
        workflow_id=workflow_id,
        input_payload={} if input_payload is None else input_payload,
        used_fallback=used_fallback,
        h2_bad_key_order=h2_bad_key_order,
    )
    _write_trace(data_dir, run_id=run_id)


def _write_run_only(
    data_dir: Path,
    *,
    run_id: str,
    workflow_id: str,
    input_payload: object,
    used_fallback: bool = False,
    h2_bad_key_order: bool = False,
) -> None:
    runs_dir = data_dir / "runs"
    runs_dir.mkdir(parents=True, exist_ok=True)
    output_payload = _output_payload_for(workflow_id=workflow_id, used_fallback=used_fallback, h2_bad_key_order=h2_bad_key_order)
    payload = {
        "run_id": run_id,
        "workflow_id": workflow_id,
        "status": "succeeded",
        "input_payload": input_payload,
        "output_payload": output_payload,
        "step_results": output_payload["step_results"],
        "errors": [],
        "context": {},
        "trace_event_ids": [f"{run_id}-1", f"{run_id}-2", f"{run_id}-3", f"{run_id}-4"],
        "created_at": "2026-05-05T10:00:00+00:00",
        "started_at": "2026-05-05T10:00:01+00:00",
        "completed_at": f"2026-05-05T10:00:{10 + len(run_id):02d}+00:00",
        "schema_version": "run_state.v1",
        "status_transitions": [{"status": "succeeded", "at": "2026-05-05T10:00:02+00:00"}],
    }
    (runs_dir / f"{run_id}.json").write_text(json.dumps(payload, ensure_ascii=True), encoding="utf-8")


def _write_trace(data_dir: Path, *, run_id: str) -> None:
    traces_dir = data_dir / "traces"
    traces_dir.mkdir(parents=True, exist_ok=True)
    events = [
        _trace_event(run_id=run_id, event_id=f"{run_id}-1", sequence=1, event_type="run_started"),
        _trace_event(run_id=run_id, event_id=f"{run_id}-2", sequence=2, event_type="step_started", step_id="synthesizer"),
        _trace_event(run_id=run_id, event_id=f"{run_id}-3", sequence=3, event_type="step_completed", step_id="synthesizer"),
        _trace_event(run_id=run_id, event_id=f"{run_id}-4", sequence=4, event_type="run_completed"),
    ]
    content = "\n".join(json.dumps(event, ensure_ascii=True) for event in events) + "\n"
    (traces_dir / f"{run_id}.jsonl").write_text(content, encoding="utf-8")


def _trace_event(*, run_id: str, event_id: str, sequence: int, event_type: str, step_id: str | None = None) -> dict[str, object]:
    return {
        "event_id": event_id,
        "run_id": run_id,
        "sequence": sequence,
        "event_type": event_type,
        "timestamp": f"2026-05-05T10:00:0{sequence}+00:00",
        "source": "test",
        "step_id": step_id,
        "parent_event_id": None,
        "correlation_id": None,
        "payload": {},
        "schema_version": "trace_event.v1",
    }


def _output_payload_for(*, workflow_id: str, used_fallback: bool, h2_bad_key_order: bool) -> dict[str, object]:
    comparable = {
        "clarified_idea": "A bounded local comparison display.",
        "strongest_assumptions": ["Artifacts exist."],
        "weak_points": ["Display only."],
        "alternatives": ["Manual review."],
        "recommended_mvp_direction": "Show structural preflight facts.",
        "next_3_validation_steps": ["Review", "Build", "Verify"],
    }
    step_result = {
        "output": comparable,
        "provider": "openrouter",
        "model": "test-model",
        "raw": {"fallback": {"used": used_fallback}},
        "used_fallback": used_fallback,
    }
    if workflow_id == "h1.single.v1":
        return {"step_results": {"single": step_result}}
    if workflow_id == "h2.manager.v1":
        h2_fields = {
            "project_summary": "Summary",
            "tracks": ["Track A"],
            "modules": ["ui"],
            "phases": ["U5-E"],
            "dependency_order": ["Track E semantics", "Track A UX"],
            "implementation_waves": [{"wave": "5", "focus": ["Workbench"]}],
            "recommended_starting_slice": "Build display index.",
            "risk_zones": ["overclaim"],
            "open_questions": [],
        }
        if h2_bad_key_order:
            h2_fields = {"open_questions": [], **{key: value for key, value in h2_fields.items() if key != "open_questions"}}
        return {
            "step_results": {"synthesizer": step_result},
            "manager_orchestration": {
                "turns": [
                    {"action": "delegate", "target_step_id": "intake"},
                    {"action": "delegate", "target_step_id": "planner"},
                    {"action": "delegate", "target_step_id": "architect"},
                    {"action": "delegate", "target_step_id": "critic"},
                ],
            },
            "final_output": h2_fields,
        }
    return {"step_results": {"synthesizer": step_result}, "final_output": comparable}


if __name__ == "__main__":
    unittest.main()
