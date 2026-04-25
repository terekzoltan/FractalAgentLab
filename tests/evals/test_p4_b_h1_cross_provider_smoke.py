from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.evals.p4_b_h1_cross_provider_smoke import inspect_p4_b_h1_cross_provider_smoke
from scripts.run_p4_b_h1_cross_provider_smoke import (
    BLOCKED_EXIT_CODE,
    FAIL_EXIT_CODE,
    PASS_EXIT_CODE,
    comparison_outcome,
    exit_code_for_report,
    is_cross_provider_smoke_passed,
    is_track_e_evidence_ready,
    run_ids_from_live_execution,
)


class P4BH1CrossProviderSmokeTests(unittest.TestCase):
    def test_passes_with_matching_real_provider_runs(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-p4-b-pass-") as tmp_dir:
            base = Path(tmp_dir)
            input_payload = {"idea": "AI founder assistant"}
            _write_h1_run_and_trace(base=base, run_id="or-pass", provider="openrouter", input_payload=input_payload)
            _write_h1_run_and_trace(base=base, run_id="oa-pass", provider="openai", input_payload=input_payload)

            report = inspect_p4_b_h1_cross_provider_smoke(
                openrouter_run_id="or-pass",
                openai_run_id="oa-pass",
                data_dir=base,
                comparison_task_intent="same H1 provider smoke input",
                openrouter_model_policy_config_path="configs/openrouter-models.yaml",
                openai_model_policy_config_path="configs/openai-models.yaml",
            )

        self.assertTrue(is_track_e_evidence_ready(report))
        self.assertTrue(is_cross_provider_smoke_passed(report))
        self.assertEqual("PASS", comparison_outcome(report))
        self.assertEqual("configs/openrouter-models.yaml", report["provider_runs"]["openrouter"]["model_policy_config_path"])
        self.assertEqual("configs/openai-models.yaml", report["provider_runs"]["openai"]["model_policy_config_path"])

    def test_fallback_backed_success_fails_not_blocks(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-p4-b-fallback-") as tmp_dir:
            base = Path(tmp_dir)
            input_payload = {"idea": "AI founder assistant"}
            _write_h1_run_and_trace(
                base=base,
                run_id="or-fallback",
                provider="openrouter",
                input_payload=input_payload,
                executed_provider="mock",
                fallback_used=True,
            )
            _write_h1_run_and_trace(base=base, run_id="oa-pass", provider="openai", input_payload=input_payload)

            report = inspect_p4_b_h1_cross_provider_smoke(
                openrouter_run_id="or-fallback",
                openai_run_id="oa-pass",
                data_dir=base,
            )

        self.assertEqual("FAIL", comparison_outcome(report))
        self.assertFalse(is_cross_provider_smoke_passed(report))
        self.assertEqual("FAIL", report["provider_runs"]["openrouter"]["summary"]["provider_smoke_outcome"])

    def test_missing_run_artifact_blocks_comparison(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-p4-b-missing-") as tmp_dir:
            base = Path(tmp_dir)
            _write_h1_run_and_trace(base=base, run_id="or-pass", provider="openrouter", input_payload={"idea": "x"})

            report = inspect_p4_b_h1_cross_provider_smoke(
                openrouter_run_id="or-pass",
                openai_run_id="missing-openai",
                data_dir=base,
            )

        self.assertEqual("BLOCKED", comparison_outcome(report))
        self.assertEqual("openai:missing_canonical_run_trace_pair", report["summary"]["blocked_reason"])
        self.assertFalse(is_track_e_evidence_ready(report))

    def test_input_payload_mismatch_blocks_comparison(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-p4-b-input-mismatch-") as tmp_dir:
            base = Path(tmp_dir)
            _write_h1_run_and_trace(base=base, run_id="or-pass", provider="openrouter", input_payload={"idea": "x"})
            _write_h1_run_and_trace(base=base, run_id="oa-pass", provider="openai", input_payload={"idea": "y"})

            report = inspect_p4_b_h1_cross_provider_smoke(
                openrouter_run_id="or-pass",
                openai_run_id="oa-pass",
                data_dir=base,
            )

        self.assertEqual("BLOCKED", comparison_outcome(report))
        self.assertEqual("input_payload_mismatch", report["summary"]["blocked_reason"])

    def test_incomplete_comparable_output_fails(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-p4-b-incomplete-") as tmp_dir:
            base = Path(tmp_dir)
            input_payload = {"idea": "AI founder assistant"}
            _write_h1_run_and_trace(base=base, run_id="or-pass", provider="openrouter", input_payload=input_payload)
            _write_h1_run_and_trace(
                base=base,
                run_id="oa-incomplete",
                provider="openai",
                input_payload=input_payload,
                complete_output=False,
            )

            report = inspect_p4_b_h1_cross_provider_smoke(
                openrouter_run_id="or-pass",
                openai_run_id="oa-incomplete",
                data_dir=base,
            )

        self.assertEqual("FAIL", comparison_outcome(report))
        self.assertFalse(report["provider_runs"]["openai"]["checks"]["comparable_single_output_complete"])

    def test_missing_model_provenance_fails(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-p4-b-model-prov-") as tmp_dir:
            base = Path(tmp_dir)
            input_payload = {"idea": "AI founder assistant"}
            _write_h1_run_and_trace(base=base, run_id="or-pass", provider="openrouter", input_payload=input_payload)
            _write_h1_run_and_trace(
                base=base,
                run_id="oa-no-model-prov",
                provider="openai",
                input_payload=input_payload,
                include_model_provenance=False,
            )

            report = inspect_p4_b_h1_cross_provider_smoke(
                openrouter_run_id="or-pass",
                openai_run_id="oa-no-model-prov",
                data_dir=base,
            )

        self.assertEqual("FAIL", comparison_outcome(report))
        self.assertFalse(report["provider_runs"]["openai"]["checks"]["model_provenance_present"])

    def test_missing_api_key_failed_run_blocks(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-p4-b-missing-key-") as tmp_dir:
            base = Path(tmp_dir)
            input_payload = {"idea": "AI founder assistant"}
            _write_h1_run_and_trace(base=base, run_id="or-pass", provider="openrouter", input_payload=input_payload)
            _write_failed_h1_run_and_trace(
                base=base,
                run_id="oa-missing-key",
                provider="openai",
                input_payload=input_payload,
                message="OpenAI API key is missing from env var 'OPENAI_API_KEY'.",
            )

            report = inspect_p4_b_h1_cross_provider_smoke(
                openrouter_run_id="or-pass",
                openai_run_id="oa-missing-key",
                data_dir=base,
            )

        self.assertEqual("BLOCKED", comparison_outcome(report))
        self.assertEqual("openai:missing_openai_api_key", report["summary"]["blocked_reason"])

    def test_new_router_missing_model_message_blocks(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-p4-b-missing-model-") as tmp_dir:
            base = Path(tmp_dir)
            input_payload = {"idea": "AI founder assistant"}
            _write_h1_run_and_trace(base=base, run_id="or-pass", provider="openrouter", input_payload=input_payload)
            _write_failed_h1_run_and_trace(
                base=base,
                run_id="oa-missing-model",
                provider="openai",
                input_payload=input_payload,
                message="Real provider selection requires a resolved non-empty model.",
            )

            report = inspect_p4_b_h1_cross_provider_smoke(
                openrouter_run_id="or-pass",
                openai_run_id="oa-missing-model",
                data_dir=base,
            )

        self.assertEqual("BLOCKED", comparison_outcome(report))
        self.assertEqual("openai:missing_model_mapping", report["summary"]["blocked_reason"])

    def test_missing_response_model_provenance_fails(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-p4-b-response-model-") as tmp_dir:
            base = Path(tmp_dir)
            input_payload = {"idea": "AI founder assistant"}
            _write_h1_run_and_trace(base=base, run_id="or-pass", provider="openrouter", input_payload=input_payload)
            _write_h1_run_and_trace(
                base=base,
                run_id="oa-no-response-model",
                provider="openai",
                input_payload=input_payload,
                include_response_model=False,
            )

            report = inspect_p4_b_h1_cross_provider_smoke(
                openrouter_run_id="or-pass",
                openai_run_id="oa-no-response-model",
                data_dir=base,
            )

        self.assertEqual("FAIL", comparison_outcome(report))
        self.assertFalse(report["provider_runs"]["openai"]["checks"]["model_provenance_present"])
        self.assertIsNone(report["provider_runs"]["openai"]["run_truth"]["response_model"])

    def test_live_execution_uses_run_id_from_cli_without_raw_stdout(self) -> None:
        live_execution = {
            "openrouter": {"run_id_from_cli": "or-live", "cli_exit_code": 0},
            "openai": {"run_id_from_cli": "oa-live", "cli_exit_code": 1},
        }

        self.assertEqual(("or-live", "oa-live"), run_ids_from_live_execution(live_execution))

    def test_live_execution_failed_run_id_uses_artifact_classification(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-p4-b-live-failed-run-") as tmp_dir:
            base = Path(tmp_dir)
            input_payload = {"idea": "AI founder assistant"}
            _write_h1_run_and_trace(base=base, run_id="or-live-pass", provider="openrouter", input_payload=input_payload)
            _write_failed_h1_run_and_trace(
                base=base,
                run_id="oa-live-missing-key",
                provider="openai",
                input_payload=input_payload,
                message="OpenAI API key is missing from env var 'OPENAI_API_KEY'.",
            )
            live_execution = {
                "openrouter": {"run_id_from_cli": "or-live-pass", "cli_exit_code": 0},
                "openai": {"run_id_from_cli": "oa-live-missing-key", "cli_exit_code": 1},
            }
            openrouter_run_id, openai_run_id = run_ids_from_live_execution(live_execution)

            report = inspect_p4_b_h1_cross_provider_smoke(
                openrouter_run_id=openrouter_run_id,
                openai_run_id=openai_run_id,
                data_dir=base,
                live_execution=live_execution,
            )

        self.assertEqual("BLOCKED", comparison_outcome(report))
        self.assertEqual("openai:missing_openai_api_key", report["summary"]["blocked_reason"])
        self.assertNotEqual("live_run_did_not_emit_run_id", report["summary"]["blocked_reason"])
        self.assertEqual(1, report["provider_runs"]["openai"]["live_execution"]["cli_exit_code"])

    def test_script_outcome_and_exit_code_helpers(self) -> None:
        pass_report = {"summary": {"comparison_outcome": "PASS"}}
        fail_report = {"summary": {"comparison_outcome": "FAIL"}}
        blocked_report = {"summary": {"comparison_outcome": "BLOCKED"}}

        self.assertEqual("PASS", comparison_outcome(pass_report))
        self.assertEqual("FAIL", comparison_outcome(fail_report))
        self.assertEqual("BLOCKED", comparison_outcome(blocked_report))
        self.assertEqual(PASS_EXIT_CODE, exit_code_for_report(pass_report))
        self.assertEqual(FAIL_EXIT_CODE, exit_code_for_report(fail_report))
        self.assertEqual(BLOCKED_EXIT_CODE, exit_code_for_report(blocked_report))


def _write_h1_run_and_trace(
    *,
    base: Path,
    run_id: str,
    provider: str,
    input_payload: dict[str, object],
    executed_provider: str | None = None,
    fallback_used: bool = False,
    complete_output: bool = True,
    include_model_provenance: bool = True,
    include_response_model: bool = True,
) -> None:
    executed = executed_provider or provider
    model = f"{executed}/test-model" if executed != "mock" else "mock-model"
    selected_model = f"{provider}/test-model"
    output = _h1_output(complete=complete_output)
    raw = {
        provider: provider in {"openai", "openrouter"},
        "routing": {
            "selected_provider": provider,
            "selection_source": "default_provider",
            "selection_mode": "explicit_v1",
            "model_policy_ref": "finalizer",
            "selected_model": selected_model,
            "fallback_policy": "conservative_mock" if fallback_used else "none",
        },
        "provider_attempts": [
            {"provider": provider, "outcome": "failed" if fallback_used else "succeeded", "fallback_eligible": fallback_used},
        ],
        "fallback": {
            "used": fallback_used,
            "policy": "conservative_mock" if fallback_used else "none",
            "from_provider": provider,
            "to_provider": "mock" if fallback_used else None,
            "reason": "recoverable_provider_failure:http_status" if fallback_used else None,
        },
    }
    if fallback_used:
        raw["provider_attempts"].append({"provider": "mock", "outcome": "succeeded", "fallback_eligible": False})
    if include_model_provenance:
        raw["requested_model"] = selected_model
    if include_model_provenance and include_response_model:
        raw["response_model"] = model

    step_payload = {
        "provider": executed,
        "model": model,
        "agent_id": "h1_single_agent",
        "step_id": "single",
        "output": output,
        "raw": raw,
    }
    _write_run_and_trace(
        base=base,
        run_id=run_id,
        workflow_id="h1.single.v1",
        status="succeeded",
        input_payload=input_payload,
        step_payload=step_payload,
    )


def _write_failed_h1_run_and_trace(
    *,
    base: Path,
    run_id: str,
    provider: str,
    input_payload: dict[str, object],
    message: str,
) -> None:
    failure = {
        "code": "runtime_boundary_error",
        "message": message,
        "category": "runtime_boundary",
        "error_type": "RuntimeBoundaryError",
        "details": {
            "selected_provider": provider,
            "selection_source": "default_provider",
            "selection_mode": "explicit_v1",
            "fallback_policy": "none",
            "provider_attempts": [{"provider": provider, "outcome": "failed", "fallback_eligible": False}],
        },
        "recoverable": False,
        "schema_version": "runtime_error_envelope.v1",
    }
    _write_run_and_trace(
        base=base,
        run_id=run_id,
        workflow_id="h1.single.v1",
        status="failed",
        input_payload=input_payload,
        step_payload=None,
        failure=failure,
        errors=[message],
    )


def _write_run_and_trace(
    *,
    base: Path,
    run_id: str,
    workflow_id: str,
    status: str,
    input_payload: dict[str, object],
    step_payload: dict[str, object] | None,
    failure: dict[str, object] | None = None,
    errors: list[str] | None = None,
) -> None:
    runs_dir = base / "runs"
    traces_dir = base / "traces"
    runs_dir.mkdir(parents=True, exist_ok=True)
    traces_dir.mkdir(parents=True, exist_ok=True)
    terminal_event = "run_completed" if status == "succeeded" else "run_failed"
    trace_events = [
        _event(f"{run_id}-e1", run_id, 1, "run_started", payload={"execution_mode": "linear"}),
        _event(f"{run_id}-e2", run_id, 2, "step_started", step_id="single"),
    ]
    if status == "succeeded":
        trace_events.append(_event(f"{run_id}-e3", run_id, 3, "step_completed", step_id="single"))
        trace_events.append(_event(f"{run_id}-e4", run_id, 4, terminal_event))
    else:
        trace_events.append(_event(f"{run_id}-e3", run_id, 3, "step_failed", step_id="single"))
        trace_events.append(_event(f"{run_id}-e4", run_id, 4, terminal_event))

    step_results = {"single": step_payload} if isinstance(step_payload, dict) else {}
    run_payload = {
        "run_id": run_id,
        "workflow_id": workflow_id,
        "status": status,
        "input_payload": input_payload,
        "output_payload": {"step_results": step_results} if status == "succeeded" else None,
        "step_results": step_results,
        "errors": errors or [],
        "context": {},
        "trace_event_ids": [event["event_id"] for event in trace_events],
        "status_transitions": [
            {"status": "pending", "timestamp": "2026-04-25T12:00:00+00:00"},
            {"status": "running", "timestamp": "2026-04-25T12:00:01+00:00"},
            {"status": status, "timestamp": "2026-04-25T12:00:02+00:00"},
        ],
        "created_at": "2026-04-25T12:00:00+00:00",
        "started_at": "2026-04-25T12:00:01+00:00",
        "completed_at": "2026-04-25T12:00:02+00:00",
        "schema_version": "run_state.v1",
    }
    if failure is not None:
        run_payload["failure"] = failure

    (runs_dir / f"{run_id}.json").write_text(json.dumps(run_payload, ensure_ascii=True), encoding="utf-8")
    (traces_dir / f"{run_id}.jsonl").write_text(
        "\n".join(json.dumps(event, ensure_ascii=True) for event in trace_events) + "\n",
        encoding="utf-8",
    )


def _h1_output(*, complete: bool) -> dict[str, object]:
    output: dict[str, object] = {
        "clarified_idea": "AI founder assistant",
        "strongest_assumptions": ["Founders need structured refinement."],
        "weak_points": ["Positioning is broad."],
        "alternatives": ["Narrow to interview prep."],
        "recommended_mvp_direction": "Start with a constrained refinement workflow.",
        "next_3_validation_steps": ["Interview founders", "Run trials", "Measure decision speed"],
    }
    if not complete:
        output.pop("alternatives")
    return output


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
        "timestamp": "2026-04-25T12:00:01+00:00",
        "source": "runtime.executor",
        "step_id": step_id,
        "parent_event_id": None,
        "correlation_id": None,
        "payload": payload or {},
        "schema_version": "trace_event.v1",
    }


if __name__ == "__main__":
    unittest.main()
