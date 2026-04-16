from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.evals.r3_p_h1_real_provider_smoke import inspect_r3_p_h1_real_provider_run
from scripts.run_r3_p_h1_real_provider_smoke import (
    is_real_provider_smoke_passed,
    is_track_e_evidence_ready,
)


class R3PH1RealProviderSmokeTests(unittest.TestCase):
    def test_openrouter_success_passes_real_provider_smoke(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base = Path(tmp_dir)
            _write_success_run(
                base,
                run_id="r3p-openrouter-pass",
                executed_provider="openrouter",
                fallback_used=False,
                provider_attempts=[{"provider": "openrouter", "outcome": "succeeded"}],
            )

            report = inspect_r3_p_h1_real_provider_run(run_id="r3p-openrouter-pass", data_dir=base)

        self.assertTrue(is_track_e_evidence_ready(report))
        self.assertTrue(is_real_provider_smoke_passed(report))
        self.assertEqual("PASS", report["summary"]["smoke_outcome"])
        self.assertEqual("openrouter", report["run_truth"]["selected_provider"])
        self.assertEqual("openrouter", report["run_truth"]["executed_provider"])
        self.assertFalse(report["run_truth"]["fallback_used"])

    def test_fallback_backed_success_stays_non_pass(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base = Path(tmp_dir)
            _write_success_run(
                base,
                run_id="r3p-fallback-success",
                executed_provider="mock",
                fallback_used=True,
                provider_attempts=[
                    {
                        "provider": "openrouter",
                        "outcome": "failed",
                        "fallback_eligible": True,
                        "error_type": "StepExecutionError",
                        "error": "OpenRouter returned a non-success status.",
                    },
                    {"provider": "mock", "outcome": "succeeded"},
                ],
            )

            report = inspect_r3_p_h1_real_provider_run(run_id="r3p-fallback-success", data_dir=base)

        self.assertTrue(is_track_e_evidence_ready(report))
        self.assertFalse(is_real_provider_smoke_passed(report))
        self.assertEqual("FAIL", report["summary"]["smoke_outcome"])
        self.assertIsNone(report["summary"]["blocked_reason"])
        self.assertTrue(report["run_truth"]["fallback_used"])
        self.assertEqual("openrouter", report["run_truth"]["selected_provider"])
        self.assertEqual("mock", report["run_truth"]["executed_provider"])

    def test_missing_api_key_failure_reports_blocked(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base = Path(tmp_dir)
            _write_failed_missing_key_run(base, run_id="r3p-blocked-key")

            report = inspect_r3_p_h1_real_provider_run(run_id="r3p-blocked-key", data_dir=base)

        self.assertFalse(is_real_provider_smoke_passed(report))
        self.assertFalse(is_track_e_evidence_ready(report))
        self.assertEqual("BLOCKED", report["summary"]["smoke_outcome"])
        self.assertEqual("missing_openrouter_api_key", report["summary"]["blocked_reason"])
        self.assertEqual("openrouter", report["run_truth"]["selected_provider"])
        self.assertIsNone(report["run_truth"]["executed_provider"])


def _write_success_run(
    base: Path,
    *,
    run_id: str,
    executed_provider: str,
    fallback_used: bool,
    provider_attempts: list[dict[str, object]],
) -> None:
    runs_dir = base / "runs"
    traces_dir = base / "traces"
    runs_dir.mkdir(parents=True, exist_ok=True)
    traces_dir.mkdir(parents=True, exist_ok=True)

    output = {
        "clarified_idea": "AI founder copilot",
        "strongest_assumptions": ["need"],
        "weak_points": ["fit"],
        "alternatives": ["niche"],
        "recommended_mvp_direction": "start narrow",
        "next_3_validation_steps": ["interview", "pilot", "measure"],
    }

    step_payload = {
        "provider": executed_provider,
        "model": "openrouter/test-model" if executed_provider == "openrouter" else None,
        "agent_id": "h1_single_agent",
        "step_id": "single",
        "output": output,
        "raw": {
            "openrouter": executed_provider == "openrouter",
            "requested_model": "openrouter/test-model",
            "response_model": "openrouter/test-model" if executed_provider == "openrouter" else None,
            "routing": {
                "selected_provider": "openrouter",
                "selection_source": "default_provider",
                "selection_mode": "explicit_v1",
                "model_policy_ref": "finalizer",
                "selected_model": "openrouter/test-model",
                "fallback_policy": "conservative_mock" if fallback_used else "none",
            },
            "provider_attempts": provider_attempts,
            "fallback": {
                "used": fallback_used,
                "policy": "conservative_mock" if fallback_used else "none",
                "from_provider": "openrouter",
                "to_provider": "mock" if fallback_used else None,
                "reason": "recoverable_failure" if fallback_used else None,
            },
        },
    }

    trace_events = [
        _event("e1", run_id, 1, "run_started"),
        _event("e2", run_id, 2, "step_started", step_id="single"),
        _event("e3", run_id, 3, "step_completed", step_id="single"),
        _event("e4", run_id, 4, "run_completed"),
    ]

    run_payload = {
        "run_id": run_id,
        "workflow_id": "h1.single.v1",
        "status": "succeeded",
        "input_payload": {"idea": "AI founder copilot"},
        "output_payload": {
            "step_results": {
                "single": {
                    "output": output,
                },
            },
        },
        "step_results": {
            "single": step_payload,
        },
        "errors": [],
        "failure": None,
        "context": {},
        "trace_event_ids": [event["event_id"] for event in trace_events],
        "status_transitions": [
            {"status": "pending", "timestamp": "2026-04-16T12:00:00+00:00"},
            {"status": "running", "timestamp": "2026-04-16T12:00:01+00:00"},
            {"status": "succeeded", "timestamp": "2026-04-16T12:00:02+00:00"},
        ],
        "created_at": "2026-04-16T12:00:00+00:00",
        "started_at": "2026-04-16T12:00:01+00:00",
        "completed_at": "2026-04-16T12:00:02+00:00",
        "schema_version": "run_state.v1",
    }

    (runs_dir / f"{run_id}.json").write_text(json.dumps(run_payload, ensure_ascii=True), encoding="utf-8")
    (traces_dir / f"{run_id}.jsonl").write_text(
        "\n".join(json.dumps(event, ensure_ascii=True) for event in trace_events) + "\n",
        encoding="utf-8",
    )


def _write_failed_missing_key_run(base: Path, *, run_id: str) -> None:
    runs_dir = base / "runs"
    traces_dir = base / "traces"
    runs_dir.mkdir(parents=True, exist_ok=True)
    traces_dir.mkdir(parents=True, exist_ok=True)

    trace_events = [
        _event("e1", run_id, 1, "run_started"),
        _event("e2", run_id, 2, "step_started", step_id="single"),
        _event("e3", run_id, 3, "run_failed"),
    ]

    run_payload = {
        "run_id": run_id,
        "workflow_id": "h1.single.v1",
        "status": "failed",
        "input_payload": {"idea": "AI founder copilot"},
        "output_payload": None,
        "step_results": {},
        "errors": ["OpenRouter API key is missing from env var 'OPENROUTER_API_KEY'."],
        "failure": {
            "code": "runtime_boundary_error",
            "message": "OpenRouter API key is missing from env var 'OPENROUTER_API_KEY'.",
            "category": "runtime_boundary",
            "error_type": "RuntimeBoundaryError",
            "details": {
                "selected_provider": "openrouter",
                "selection_source": "default_provider",
                "selection_mode": "explicit_v1",
                "fallback_policy": "none",
                "provider_attempts": [
                    {
                        "provider": "openrouter",
                        "outcome": "failed",
                        "fallback_eligible": False,
                        "error_type": "RuntimeBoundaryError",
                        "error": "OpenRouter API key is missing from env var 'OPENROUTER_API_KEY'.",
                    },
                ],
            },
            "recoverable": False,
            "schema_version": "runtime_error_envelope.v1",
        },
        "context": {},
        "trace_event_ids": [event["event_id"] for event in trace_events],
        "status_transitions": [
            {"status": "pending", "timestamp": "2026-04-16T12:00:00+00:00"},
            {"status": "running", "timestamp": "2026-04-16T12:00:01+00:00"},
            {
                "status": "failed",
                "timestamp": "2026-04-16T12:00:02+00:00",
                "reason": "OpenRouter API key is missing from env var 'OPENROUTER_API_KEY'.",
            },
        ],
        "created_at": "2026-04-16T12:00:00+00:00",
        "started_at": "2026-04-16T12:00:01+00:00",
        "completed_at": "2026-04-16T12:00:02+00:00",
        "schema_version": "run_state.v1",
    }

    (runs_dir / f"{run_id}.json").write_text(json.dumps(run_payload, ensure_ascii=True), encoding="utf-8")
    (traces_dir / f"{run_id}.jsonl").write_text(
        "\n".join(json.dumps(event, ensure_ascii=True) for event in trace_events) + "\n",
        encoding="utf-8",
    )


def _event(event_id: str, run_id: str, sequence: int, event_type: str, *, step_id: str | None = None) -> dict[str, object]:
    return {
        "event_id": event_id,
        "run_id": run_id,
        "sequence": sequence,
        "event_type": event_type,
        "timestamp": "2026-04-16T12:00:01+00:00",
        "source": "runtime.executor",
        "step_id": step_id,
        "parent_event_id": None,
        "correlation_id": None,
        "payload": {},
        "schema_version": "trace_event.v1",
    }


if __name__ == "__main__":
    unittest.main()
