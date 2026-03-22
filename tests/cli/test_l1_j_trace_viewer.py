from __future__ import annotations

import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

from fractal_agent_lab.adapters import build_step_runner
from fractal_agent_lab.cli.app import run_cli
from fractal_agent_lab.cli.workflow_registry import get_workflow_agent_specs, get_workflow_spec
from fractal_agent_lab.runtime import WorkflowExecutor
from fractal_agent_lab.tracing import InMemoryTraceEmitter, write_run_artifact, write_trace_artifact


class L1JTraceViewerTests(unittest.TestCase):
    def test_trace_show_text_renders_linkage_aware_timeline(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            run_id = _generate_handoff_artifacts(data_dir)

            out = io.StringIO()
            with redirect_stdout(out):
                code = run_cli(
                    [
                        "trace",
                        "show",
                        "--run-id",
                        run_id,
                        "--data-dir",
                        data_dir.as_posix(),
                    ],
                )

            rendered = out.getvalue()
            self.assertEqual(0, code)
            self.assertIn("Trace Viewer", rendered)
            self.assertIn("handoff_decided", rendered)
            self.assertIn("parent=", rendered)
            self.assertIn("corr=handoff:", rendered)

    def test_trace_show_json_preserves_linkage_fields(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            run_id = _generate_handoff_artifacts(data_dir)

            out = io.StringIO()
            with redirect_stdout(out):
                code = run_cli(
                    [
                        "trace",
                        "show",
                        "--run-id",
                        run_id,
                        "--data-dir",
                        data_dir.as_posix(),
                        "--format",
                        "json",
                    ],
                )

            payload = json.loads(out.getvalue())
            self.assertEqual(0, code)
            self.assertEqual(run_id, payload["run_id"])
            self.assertIn("summary", payload)
            self.assertIn("events", payload)
            self.assertTrue(payload["events"])
            self.assertTrue(any(event.get("parent_event_id") for event in payload["events"]))
            self.assertTrue(any(event.get("correlation_id") for event in payload["events"]))

    def test_trace_show_returns_error_for_missing_trace(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)

            out = io.StringIO()
            with redirect_stdout(out):
                code = run_cli(
                    [
                        "trace",
                        "show",
                        "--run-id",
                        "missing-run",
                        "--data-dir",
                        data_dir.as_posix(),
                    ],
                )

            self.assertEqual(2, code)
            self.assertIn("Trace artifact not found", out.getvalue())


def _generate_handoff_artifacts(data_dir: Path) -> str:
    workflow_id = "h1.handoff.v1"
    workflow = get_workflow_spec(workflow_id)
    agent_specs = get_workflow_agent_specs(workflow_id)

    emitter = InMemoryTraceEmitter()
    executor = WorkflowExecutor(
        step_runner=build_step_runner(
            agent_specs_by_id=agent_specs,
            providers_config={"default_provider": "mock"},
            model_policy_config={
                "tier_defaults": {
                    "cheap_worker": "gpt-4o-mini",
                    "specialist": "gpt-5.4-nano",
                    "finalizer": "gpt-5.4-mini",
                },
            },
        ),
        emitter=emitter,
    )

    run_state = executor.execute(workflow=workflow, input_payload={"idea": "trace viewer test"})
    write_run_artifact(run_state, data_dir=data_dir)
    write_trace_artifact(emitter.events, run_id=run_state.run_id, data_dir=data_dir)
    return run_state.run_id


if __name__ == "__main__":
    unittest.main()
