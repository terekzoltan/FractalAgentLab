from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.evals.identity_drift_smoke import run_h2_o_identity_drift_smoke
from fractal_agent_lab.identity import JSONIdentityStore
from fractal_agent_lab.identity.models import IdentityProfile, IdentitySnapshot
from scripts.run_h2_o_identity_drift_smoke import is_drift_smoke_passed


class IdentityDriftSmokeTests(unittest.TestCase):
    def test_orphan_update_is_warning_only(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-h2-o-") as tmp_dir:
            base = Path(tmp_dir)
            _write_identity_update_sidecar(
                base,
                run_id="run-orphan",
                workflow_id="h1.manager.v1",
                updates=[
                    {
                        "agent_id": "h1_planner_agent",
                        "delta": {
                            "coherence": {
                                "before": 0.5,
                                "after": 0.53,
                            },
                        },
                    },
                ],
            )
            _write_profile_and_snapshot(base, agent_id="h1_planner_agent")

            report = run_h2_o_identity_drift_smoke(run_ids=["run-orphan"], data_dir=base)

        self.assertTrue(is_drift_smoke_passed(report))
        self.assertTrue(report["summary"]["orphan_updates_detected"])
        self.assertTrue(report["summary"]["has_update_evidence"])

    def test_missing_sidecar_fails_smoke(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-h2-o-") as tmp_dir:
            base = Path(tmp_dir)
            _write_run_trace_pair(base, run_id="run-missing-sidecar", workflow_id="h1.manager.v1")

            report = run_h2_o_identity_drift_smoke(run_ids=["run-missing-sidecar"], data_dir=base)

        self.assertFalse(is_drift_smoke_passed(report))
        self.assertFalse(report["summary"]["all_runs_have_update_sidecar"])

    def test_empty_updates_fail_for_insufficient_evidence(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-h2-o-") as tmp_dir:
            base = Path(tmp_dir)
            _write_run_trace_pair(base, run_id="run-empty-updates", workflow_id="h1.manager.v1")
            _write_identity_update_sidecar(
                base,
                run_id="run-empty-updates",
                workflow_id="h1.manager.v1",
                updates=[],
            )

            report = run_h2_o_identity_drift_smoke(run_ids=["run-empty-updates"], data_dir=base)

        self.assertFalse(is_drift_smoke_passed(report))
        self.assertFalse(report["summary"]["has_update_evidence"])
        self.assertFalse(report["summary"]["all_runs_have_update_evidence"])

    def test_mixed_run_set_requires_update_evidence_for_each_requested_run(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-h2-o-") as tmp_dir:
            base = Path(tmp_dir)
            _write_run_trace_pair(base, run_id="run-has-updates", workflow_id="h1.manager.v1")
            _write_identity_update_sidecar(
                base,
                run_id="run-has-updates",
                workflow_id="h1.manager.v1",
                updates=[
                    {
                        "agent_id": "h1_planner_agent",
                        "delta": {
                            "coherence": {
                                "before": 0.5,
                                "after": 0.53,
                            },
                        },
                    },
                ],
            )
            _write_profile_and_snapshot(base, agent_id="h1_planner_agent")
            _write_run_trace_pair(base, run_id="run-empty-updates-mixed", workflow_id="h1.manager.v1")
            _write_identity_update_sidecar(
                base,
                run_id="run-empty-updates-mixed",
                workflow_id="h1.manager.v1",
                updates=[],
            )

            report = run_h2_o_identity_drift_smoke(
                run_ids=["run-has-updates", "run-empty-updates-mixed"],
                data_dir=base,
            )

        self.assertFalse(is_drift_smoke_passed(report))
        self.assertFalse(report["summary"]["all_runs_have_update_evidence"])

    def test_concerning_drift_fails_smoke(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-h2-o-") as tmp_dir:
            base = Path(tmp_dir)
            _write_run_trace_pair(base, run_id="run-drift", workflow_id="h1.manager.v1")
            _write_identity_update_sidecar(
                base,
                run_id="run-drift",
                workflow_id="h1.manager.v1",
                updates=[
                    {
                        "agent_id": "h1_planner_agent",
                        "delta": {
                            "coherence": {
                                "before": 0.1,
                                "after": 0.5,
                            },
                        },
                    },
                ],
            )
            _write_profile_and_snapshot(base, agent_id="h1_planner_agent")

            report = run_h2_o_identity_drift_smoke(run_ids=["run-drift"], data_dir=base)

        self.assertFalse(is_drift_smoke_passed(report))
        self.assertFalse(report["summary"]["no_runaway_drift"])
        self.assertFalse(report["summary"]["all_deltas_bounded"])

    def test_parse_error_fails_smoke(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-h2-o-") as tmp_dir:
            base = Path(tmp_dir)
            _write_run_trace_pair(base, run_id="run-bad-json", workflow_id="h1.manager.v1")
            artifact_dir = base / "artifacts" / "run-bad-json"
            artifact_dir.mkdir(parents=True, exist_ok=True)
            (artifact_dir / "identity_update.json").write_text("not-json", encoding="utf-8")

            report = run_h2_o_identity_drift_smoke(run_ids=["run-bad-json"], data_dir=base)

        self.assertFalse(is_drift_smoke_passed(report))
        self.assertFalse(report["summary"]["all_updates_parseable"])

    def test_custom_identity_subdir_is_supported(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-h2-o-") as tmp_dir:
            base = Path(tmp_dir)
            _write_run_trace_pair(base, run_id="run-custom-subdir", workflow_id="h1.manager.v1")
            _write_identity_update_sidecar(
                base,
                run_id="run-custom-subdir",
                workflow_id="h1.manager.v1",
                updates=[
                    {
                        "agent_id": "h1_planner_agent",
                        "delta": {
                            "coherence": {
                                "before": 0.5,
                                "after": 0.54,
                            },
                        },
                    },
                ],
            )
            _write_profile_and_snapshot(
                base,
                agent_id="h1_planner_agent",
                data_subdir="identity-custom",
            )

            report = run_h2_o_identity_drift_smoke(
                run_ids=["run-custom-subdir"],
                data_dir=base,
                identity_data_subdir="identity-custom",
            )

        self.assertTrue(is_drift_smoke_passed(report))
        self.assertEqual("identity-custom", report["run_scope"]["identity_data_subdir"])

    def test_missing_persisted_profile_or_snapshot_fails_smoke(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-h2-o-") as tmp_dir:
            base = Path(tmp_dir)
            _write_run_trace_pair(base, run_id="run-missing-store", workflow_id="h1.manager.v1")
            _write_identity_update_sidecar(
                base,
                run_id="run-missing-store",
                workflow_id="h1.manager.v1",
                updates=[
                    {
                        "agent_id": "h1_planner_agent",
                        "delta": {
                            "coherence": {
                                "before": 0.5,
                                "after": 0.53,
                            },
                        },
                    },
                ],
            )

            report = run_h2_o_identity_drift_smoke(run_ids=["run-missing-store"], data_dir=base)

        self.assertFalse(is_drift_smoke_passed(report))
        self.assertFalse(report["summary"]["all_updated_agents_have_profiles"])
        self.assertFalse(report["summary"]["all_updated_agents_have_snapshots"])

    def test_sidecar_payload_must_match_requested_run(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-h2-o-") as tmp_dir:
            base = Path(tmp_dir)
            _write_run_trace_pair(base, run_id="run-sidecar-mismatch", workflow_id="h1.manager.v1")
            _write_identity_update_sidecar(
                base,
                run_id="run-sidecar-mismatch",
                workflow_id="h1.manager.v1",
                updates=[
                    {
                        "agent_id": "h1_planner_agent",
                        "delta": {
                            "coherence": {
                                "before": 0.5,
                                "after": 0.53,
                            },
                        },
                    },
                ],
                payload_run_id="run-other",
            )
            _write_profile_and_snapshot(base, agent_id="h1_planner_agent")

            report = run_h2_o_identity_drift_smoke(run_ids=["run-sidecar-mismatch"], data_dir=base)

        self.assertFalse(is_drift_smoke_passed(report))
        self.assertFalse(report["summary"]["all_sidecars_match_requested_runs"])

    def test_invalid_canonical_artifacts_fail_smoke(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-h2-o-") as tmp_dir:
            base = Path(tmp_dir)
            runs_dir = base / "runs"
            runs_dir.mkdir(parents=True, exist_ok=True)
            (runs_dir / "run-invalid.json").write_text("{}", encoding="utf-8")
            _write_identity_update_sidecar(
                base,
                run_id="run-invalid",
                workflow_id="h1.manager.v1",
                updates=[
                    {
                        "agent_id": "h1_planner_agent",
                        "delta": {
                            "coherence": {
                                "before": 0.5,
                                "after": 0.53,
                            },
                        },
                    },
                ],
            )
            _write_profile_and_snapshot(base, agent_id="h1_planner_agent")

            report = run_h2_o_identity_drift_smoke(run_ids=["run-invalid"], data_dir=base)

        self.assertFalse(is_drift_smoke_passed(report))
        self.assertFalse(report["summary"]["all_present_canonical_artifacts_valid"])


def _write_run_trace_pair(base: Path, *, run_id: str, workflow_id: str) -> None:
    runs_dir = base / "runs"
    traces_dir = base / "traces"
    runs_dir.mkdir(parents=True, exist_ok=True)
    traces_dir.mkdir(parents=True, exist_ok=True)

    run_payload = {
        "run_id": run_id,
        "workflow_id": workflow_id,
        "status": "succeeded",
        "input_payload": {"idea": "x"},
        "output_payload": {
            "final_output": {"clarified_idea": "x"},
            "step_results": {
                "single": {
                    "agent_id": "h1_single_agent",
                    "step_id": "single",
                    "output": {"clarified_idea": "x"},
                },
            },
        },
        "step_results": {
            "single": {
                "agent_id": "h1_single_agent",
                "step_id": "single",
                "output": {"clarified_idea": "x"},
            },
        },
        "errors": [],
        "context": {},
        "trace_event_ids": ["e1", "e2", "e3", "e4"],
        "created_at": "2026-04-04T10:00:00+00:00",
        "started_at": "2026-04-04T10:00:01+00:00",
        "completed_at": "2026-04-04T10:00:02+00:00",
        "schema_version": "run_state.v0",
    }
    trace_events = [
        {
            "event_id": "e1",
            "run_id": run_id,
            "sequence": 1,
            "event_type": "run_started",
            "timestamp": "2026-04-04T10:00:00+00:00",
            "source": "runtime.executor",
            "step_id": None,
            "parent_event_id": None,
            "correlation_id": None,
            "payload": {},
            "schema_version": "trace_event.v0",
        },
        {
            "event_id": "e2",
            "run_id": run_id,
            "sequence": 2,
            "event_type": "step_started",
            "timestamp": "2026-04-04T10:00:01+00:00",
            "source": "runtime.executor",
            "step_id": "single",
            "parent_event_id": "e1",
            "correlation_id": "corr-1",
            "payload": {},
            "schema_version": "trace_event.v0",
        },
        {
            "event_id": "e3",
            "run_id": run_id,
            "sequence": 3,
            "event_type": "step_completed",
            "timestamp": "2026-04-04T10:00:01.500000+00:00",
            "source": "runtime.executor",
            "step_id": "single",
            "parent_event_id": "e2",
            "correlation_id": "corr-1",
            "payload": {"attempts": 1},
            "schema_version": "trace_event.v0",
        },
        {
            "event_id": "e4",
            "run_id": run_id,
            "sequence": 4,
            "event_type": "run_completed",
            "timestamp": "2026-04-04T10:00:02+00:00",
            "source": "runtime.executor",
            "step_id": None,
            "parent_event_id": None,
            "correlation_id": None,
            "payload": {},
            "schema_version": "trace_event.v0",
        },
    ]

    (runs_dir / f"{run_id}.json").write_text(json.dumps(run_payload, ensure_ascii=True), encoding="utf-8")
    (traces_dir / f"{run_id}.jsonl").write_text(
        "\n".join(json.dumps(event, ensure_ascii=True) for event in trace_events) + "\n",
        encoding="utf-8",
    )


def _write_identity_update_sidecar(
    base: Path,
    *,
    run_id: str,
    workflow_id: str,
    updates: list[dict[str, object]],
    payload_run_id: str | None = None,
    payload_workflow_id: str | None = None,
) -> None:
    artifact_dir = base / "artifacts" / run_id
    artifact_dir.mkdir(parents=True, exist_ok=True)
    (artifact_dir / "identity_update.json").write_text(
        json.dumps(
            {
                "artifact_type": "identity_update",
                "artifact_version": "1.0",
                "run_id": payload_run_id or run_id,
                "workflow_id": payload_workflow_id or workflow_id,
                "generated_at": "2026-04-04T10:00:00+00:00",
                "updates": updates,
            },
            ensure_ascii=True,
        ),
        encoding="utf-8",
    )


def _write_profile_and_snapshot(
    base: Path,
    *,
    agent_id: str,
    data_subdir: str = "identity",
) -> None:
    store = JSONIdentityStore(data_dir=base, data_subdir=data_subdir)
    profile = IdentityProfile(agent_id=agent_id, coherence=0.53, update_count=1, profile_version=1)
    store.save_profile(profile)
    store.save_snapshot(
        IdentitySnapshot.from_profile(
            profile=profile,
            run_id="seed-run",
            reason="test",
        ),
    )


if __name__ == "__main__":
    unittest.main()
