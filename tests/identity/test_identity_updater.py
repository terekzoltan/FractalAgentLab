from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fractal_agent_lab.core.events import TraceEvent, TraceEventType
from fractal_agent_lab.core.models import RunState, RunStatus
from fractal_agent_lab.identity import JSONIdentityStore, run_post_run_identity_update


class IdentityUpdaterTests(unittest.TestCase):
    def test_explicit_signals_take_precedence_over_derived_fallback(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-identity-updater-") as tmp_dir:
            store = JSONIdentityStore(data_dir=tmp_dir)
            existing = store.load_profile(agent_id="h1_intake_agent")
            self.assertIsNone(existing)

            run_state = RunState(run_id="run-1", workflow_id="h1.manager.v1")
            run_state.status = RunStatus.SUCCEEDED
            run_state.step_results = {
                "intake": {
                    "agent_id": "h1_intake_agent",
                    "step_id": "intake",
                    "output": {
                        "identity_signals": {
                            "schema_version": "identity.signal.v0",
                            "source": "step_output",
                            "signals": {
                                "delegated": False,
                                "needed_revision": False,
                                "coherence_score": 0.9,
                                "confidence": 0.8,
                            },
                        },
                    },
                },
            }
            run_state.output_payload = {
                "manager_orchestration": {
                    "turns": [
                        {
                            "action": "delegate",
                            "target_agent_id": "h1_intake_agent",
                        },
                    ],
                },
            }
            trace_events = [
                TraceEvent(
                    run_id="run-1",
                    event_type=TraceEventType.STEP_COMPLETED,
                    sequence=1,
                    source="test",
                    step_id="intake",
                    payload={"attempts": 3},
                ),
            ]

            result = run_post_run_identity_update(
                run_state=run_state,
                trace_events=trace_events,
                runtime_config={"identity": {"enabled": True, "store_backend": "json"}},
                data_dir=tmp_dir,
            )

            self.assertIsNotNone(result)
            assert result is not None
            self.assertEqual(["h1_intake_agent"], result.updated_agent_ids)
            profile = store.load_profile(agent_id="h1_intake_agent")
            self.assertIsNotNone(profile)
            assert profile is not None
            self.assertEqual(0.5, profile.delegation)
            self.assertGreater(profile.coherence, 0.5)
            self.assertGreater(profile.initiative, 0.5)

    def test_malformed_signal_payload_is_ignored_safely(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-identity-updater-") as tmp_dir:
            run_state = RunState(run_id="run-2", workflow_id="h1.single.v1")
            run_state.status = RunStatus.SUCCEEDED
            run_state.step_results = {
                "single": {
                    "agent_id": "h1_single_agent",
                    "step_id": "single",
                    "output": {"identity_signals": "not-an-object"},
                },
            }
            run_state.output_payload = {"final_output": {"clarified_idea": "x"}}

            result = run_post_run_identity_update(
                run_state=run_state,
                trace_events=[],
                runtime_config={"identity": {"enabled": True, "store_backend": "json"}},
                data_dir=tmp_dir,
            )

            self.assertIsNotNone(result)
            assert result is not None
            self.assertEqual([], result.updated_agent_ids)
            self.assertTrue(result.artifact_path.exists())
            payload = json.loads(result.artifact_path.read_text(encoding="utf-8"))
            self.assertEqual([], payload["updates"])

    def test_derived_failure_fallback_updates_profile(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-identity-updater-") as tmp_dir:
            run_state = RunState(run_id="run-3", workflow_id="h1.manager.v1")
            run_state.status = RunStatus.FAILED
            run_state.step_results = {
                "planner": {
                    "agent_id": "h1_planner_agent",
                    "step_id": "planner",
                    "output": {"message": "x"},
                },
            }
            run_state.output_payload = None

            result = run_post_run_identity_update(
                run_state=run_state,
                trace_events=[],
                runtime_config={"identity": {"enabled": True, "store_backend": "json"}},
                data_dir=tmp_dir,
            )

            self.assertIsNotNone(result)
            assert result is not None
            store = JSONIdentityStore(data_dir=tmp_dir)
            profile = store.load_profile(agent_id="h1_planner_agent")
            self.assertIsNotNone(profile)
            assert profile is not None
            self.assertGreater(profile.caution, 0.5)
            self.assertLess(profile.coherence, 0.5)

    def test_manager_delegation_fallback_updates_manager_not_worker(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-identity-updater-") as tmp_dir:
            run_state = RunState(run_id="run-3b", workflow_id="h1.manager.v1")
            run_state.status = RunStatus.SUCCEEDED
            run_state.step_results = {
                "synthesizer": {
                    "agent_id": "h1_synthesizer_agent",
                    "step_id": "synthesizer",
                    "output": {"ok": True},
                },
                "planner": {
                    "agent_id": "h1_planner_agent",
                    "step_id": "planner",
                    "output": {"ok": True},
                },
            }
            run_state.output_payload = {
                "manager_orchestration": {
                    "manager_step_id": "synthesizer",
                    "turns": [
                        {
                            "action": "delegate",
                            "target_step_id": "planner",
                            "target_agent_id": "h1_planner_agent",
                        },
                    ],
                },
            }

            result = run_post_run_identity_update(
                run_state=run_state,
                trace_events=[],
                runtime_config={"identity": {"enabled": True, "store_backend": "json"}},
                data_dir=tmp_dir,
            )

            self.assertIsNotNone(result)
            assert result is not None
            self.assertEqual(["h1_synthesizer_agent"], result.updated_agent_ids)
            store = JSONIdentityStore(data_dir=tmp_dir)
            manager_profile = store.load_profile(agent_id="h1_synthesizer_agent")
            worker_profile = store.load_profile(agent_id="h1_planner_agent")
            self.assertIsNotNone(manager_profile)
            assert manager_profile is not None
            self.assertGreater(manager_profile.delegation, 0.5)
            self.assertIsNone(worker_profile)

    def test_all_false_explicit_signals_do_not_create_update_churn(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-identity-updater-") as tmp_dir:
            run_state = RunState(run_id="run-3c", workflow_id="h1.single.v1")
            run_state.status = RunStatus.SUCCEEDED
            run_state.step_results = {
                "single": {
                    "agent_id": "h1_single_agent",
                    "step_id": "single",
                    "output": {
                        "identity_signals": {
                            "schema_version": "identity.signal.v0",
                            "signals": {
                                "delegated": False,
                                "needed_revision": False,
                            },
                        },
                    },
                },
            }
            run_state.output_payload = {"step_results": {"single": {"output": {}}}}

            result = run_post_run_identity_update(
                run_state=run_state,
                trace_events=[],
                runtime_config={"identity": {"enabled": True, "store_backend": "json"}},
                data_dir=tmp_dir,
            )

            self.assertIsNotNone(result)
            assert result is not None
            self.assertEqual([], result.updated_agent_ids)
            store = JSONIdentityStore(data_dir=tmp_dir)
            self.assertIsNone(store.load_profile(agent_id="h1_single_agent"))
            payload = json.loads(result.artifact_path.read_text(encoding="utf-8"))
            self.assertEqual([], payload["updates"])

    def test_disabled_identity_config_skips_updater(self) -> None:
        run_state = RunState(run_id="run-4", workflow_id="h1.single.v1")
        run_state.step_results = {}

        result = run_post_run_identity_update(
            run_state=run_state,
            trace_events=[],
            runtime_config={"identity": {"enabled": False}},
            data_dir=Path("data"),
        )
        self.assertIsNone(result)


class IdentityUpdaterCliSafetyTests(unittest.TestCase):
    def test_cli_continues_successfully_when_identity_updater_raises(self) -> None:
        from fractal_agent_lab.cli.app import run_cli

        with tempfile.TemporaryDirectory(prefix="fal-identity-updater-cli-") as tmp_dir:
            runtime_config = Path(tmp_dir) / "runtime.yaml"
            runtime_config.write_text(
                "\n".join(
                    [
                        "runtime:",
                        "  default_timeout_seconds: 60",
                        "  max_retries: 2",
                        "identity:",
                        "  enabled: true",
                        "  store_backend: json",
                        "  data_subdir: identity",
                        "paths:",
                        f"  data_dir: {tmp_dir.replace('\\', '/')}",
                    ],
                )
                + "\n",
                encoding="utf-8",
            )

            with patch(
                "fractal_agent_lab.cli.app.run_post_run_identity_update",
                side_effect=ValueError("bad identity payload"),
            ):
                with patch("sys.stderr") as mock_stderr:
                    code = run_cli(
                        [
                            "run",
                            "h1.single.v1",
                            "--input-json",
                            '{"idea": "identity updater safety"}',
                            "--runtime-config",
                            runtime_config.as_posix(),
                            "--providers-config",
                            "configs/providers.example.yaml",
                            "--model-policy-config",
                            "configs/model_policy.example.yaml",
                        ],
                    )

            self.assertEqual(0, code)
            self.assertTrue(mock_stderr.write.called)


if __name__ == "__main__":
    unittest.main()
