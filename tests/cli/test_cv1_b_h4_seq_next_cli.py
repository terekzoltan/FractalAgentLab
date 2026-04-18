from __future__ import annotations

import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch

from fractal_agent_lab.cli.app import run_cli


class CV1BH4SeqNextCliTests(unittest.TestCase):
    def test_h4_seq_next_cli_run_writes_required_plan_artifacts(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-cv1-b-cli-") as tmp_dir:
            data_dir = Path(tmp_dir)
            runtime_config = _write_runtime_config(data_dir)
            out = io.StringIO()
            err = io.StringIO()

            with patch("fractal_agent_lab.cli.app.build_step_runner", return_value=_scripted_h4_seq_next_step_runner):
                with redirect_stdout(out), redirect_stderr(err):
                    code = run_cli(
                        [
                            "run",
                            "h4.seq_next.v1",
                            "--input-json",
                            '{"goal": "CV1-B seq_next"}',
                            "--format",
                            "json",
                            "--runtime-config",
                            runtime_config.as_posix(),
                            "--providers-config",
                            "configs/providers.example.yaml",
                            "--model-policy-config",
                            "configs/model_policy.example.yaml",
                        ],
                    )

            self.assertEqual(0, code)
            self.assertEqual("", err.getvalue())

            payload = json.loads(out.getvalue())
            run_id = payload["summary"]["run_id"]

            run_artifact = json.loads((data_dir / "runs" / f"{run_id}.json").read_text(encoding="utf-8"))
            self.assertEqual("h4.seq_next.v1", run_artifact["workflow_id"])
            self.assertEqual("succeeded", run_artifact["status"])

            implementation_plan = data_dir / "artifacts" / run_id / "implementation_plan.md"
            self.assertTrue(implementation_plan.exists())
            plan_text = implementation_plan.read_text(encoding="utf-8")
            self.assertIn("artifact_type: implementation_plan", plan_text)
            self.assertIn("workflow_variant: h4.seq_next.v1", plan_text)
            self.assertIn("## Risks", plan_text)
            self.assertIn("## Shared-Zone Cautions", plan_text)
            self.assertIn("## Sequencing Risks", plan_text)
            self.assertIn("## Functional Checks", plan_text)
            self.assertIn("## Tests Required", plan_text)
            self.assertIn("## Docs Required", plan_text)

            acceptance_checks = data_dir / "artifacts" / run_id / "acceptance_checks.json"
            self.assertTrue(acceptance_checks.exists())
            acceptance_payload = json.loads(acceptance_checks.read_text(encoding="utf-8"))
            self.assertEqual("acceptance_checks", acceptance_payload["artifact_type"])
            self.assertEqual("h4", acceptance_payload["workflow_id"])
            self.assertEqual("h4.seq_next.v1", acceptance_payload["workflow_variant"])
            self.assertTrue(acceptance_payload["functional_checks"])
            self.assertIsInstance(acceptance_payload["blocking_conditions"], list)

    def test_h4_seq_next_cli_warns_when_required_plan_fields_are_missing(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-cv1-b-cli-missing-") as tmp_dir:
            data_dir = Path(tmp_dir)
            runtime_config = _write_runtime_config(data_dir)
            out = io.StringIO()
            err = io.StringIO()

            with patch("fractal_agent_lab.cli.app.build_step_runner", return_value=_incomplete_h4_seq_next_step_runner):
                with redirect_stdout(out), redirect_stderr(err):
                    code = run_cli(
                        [
                            "run",
                            "h4.seq_next.v1",
                            "--input-json",
                            '{"goal": "CV1-B missing fields"}',
                            "--format",
                            "json",
                            "--runtime-config",
                            runtime_config.as_posix(),
                            "--providers-config",
                            "configs/providers.example.yaml",
                            "--model-policy-config",
                            "configs/model_policy.example.yaml",
                        ],
                    )

            self.assertEqual(0, code)
            payload = json.loads(out.getvalue())
            run_id = payload["summary"]["run_id"]
            self.assertIn("Warning: failed to write H4 implementation plan artifact", err.getvalue())
            self.assertIn("Warning: failed to write H4 acceptance checks artifact", err.getvalue())

            artifact_dir = data_dir / "artifacts" / run_id
            self.assertFalse((artifact_dir / "implementation_plan.md").exists())
            self.assertFalse((artifact_dir / "acceptance_checks.json").exists())

    def test_h4_seq_next_cli_allows_empty_blocking_conditions(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-cv1-b-cli-empty-blockers-") as tmp_dir:
            data_dir = Path(tmp_dir)
            runtime_config = _write_runtime_config(data_dir)
            out = io.StringIO()
            err = io.StringIO()

            with patch("fractal_agent_lab.cli.app.build_step_runner", return_value=_empty_blocking_conditions_step_runner):
                with redirect_stdout(out), redirect_stderr(err):
                    code = run_cli(
                        [
                            "run",
                            "h4.seq_next.v1",
                            "--input-json",
                            '{"goal": "CV1-B empty blocking conditions"}',
                            "--format",
                            "json",
                            "--runtime-config",
                            runtime_config.as_posix(),
                            "--providers-config",
                            "configs/providers.example.yaml",
                            "--model-policy-config",
                            "configs/model_policy.example.yaml",
                        ],
                    )

            self.assertEqual(0, code)
            self.assertEqual("", err.getvalue())
            payload = json.loads(out.getvalue())
            run_id = payload["summary"]["run_id"]

            acceptance_checks = json.loads(
                (data_dir / "artifacts" / run_id / "acceptance_checks.json").read_text(encoding="utf-8"),
            )
            self.assertEqual([], acceptance_checks["blocking_conditions"])

    def test_h4_seq_next_cli_warns_on_malformed_risk_register_row_shape(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-cv1-b-cli-bad-risk-shape-") as tmp_dir:
            data_dir = Path(tmp_dir)
            runtime_config = _write_runtime_config(data_dir)
            out = io.StringIO()
            err = io.StringIO()

            with patch("fractal_agent_lab.cli.app.build_step_runner", return_value=_malformed_risk_register_step_runner):
                with redirect_stdout(out), redirect_stderr(err):
                    code = run_cli(
                        [
                            "run",
                            "h4.seq_next.v1",
                            "--input-json",
                            '{"goal": "CV1-B malformed risk row"}',
                            "--format",
                            "json",
                            "--runtime-config",
                            runtime_config.as_posix(),
                            "--providers-config",
                            "configs/providers.example.yaml",
                            "--model-policy-config",
                            "configs/model_policy.example.yaml",
                        ],
                    )

            self.assertEqual(0, code)
            self.assertIn("Warning: failed to write H4 implementation plan artifact", err.getvalue())
            payload = json.loads(out.getvalue())
            run_id = payload["summary"]["run_id"]
            artifact_dir = data_dir / "artifacts" / run_id
            self.assertFalse((artifact_dir / "implementation_plan.md").exists())
            self.assertTrue((artifact_dir / "acceptance_checks.json").exists())


def _scripted_h4_seq_next_step_runner(*, run_state, workflow, step):
    _ = workflow
    step_results = run_state.step_results

    if step.step_id == "synthesizer":
        if "repo_intake" not in step_results:
            return {"control": {"action": "delegate", "target_step_id": "repo_intake", "reason": "missing"}}
        if "planner" not in step_results:
            return {"control": {"action": "delegate", "target_step_id": "planner", "reason": "missing"}}
        if "architect_critic" not in step_results:
            return {
                "control": {
                    "action": "delegate",
                    "target_step_id": "architect_critic",
                    "reason": "missing",
                },
            }

        intake_output = step_results["repo_intake"]
        planner_output = step_results["planner"]
        critic_output = step_results["architect_critic"]
        return {
            "control": {
                "action": "finalize",
                "reason": "all_workers_completed",
                "output": {
                    "task_summary": intake_output["task_summary"],
                    "intent": intake_output["intent"],
                    "repo_summary": intake_output["repo_summary"],
                    "changed_surfaces": intake_output["changed_surfaces"],
                    "relevant_docs": intake_output["relevant_docs"],
                    "relevant_code_areas": intake_output["relevant_code_areas"],
                    "likely_touched_files": intake_output["likely_touched_files"],
                    "assumptions": intake_output["assumptions"],
                    "unknowns": intake_output["unknowns"],
                    "recent_change_notes": intake_output["recent_change_notes"],
                    "current_frontier": intake_output["current_frontier"],
                    "step_order": planner_output["step_order"],
                    "dependencies": planner_output["dependencies"],
                    "test_plan": planner_output["test_plan"],
                    "documentation_obligations": planner_output["documentation_obligations"],
                    "risk_register": planner_output["risk_register"],
                    "open_questions": planner_output["open_questions"],
                    "blockers_or_holds": critic_output["blockers_or_holds"],
                    "shared_zone_cautions": critic_output["shared_zone_cautions"],
                    "sequencing_risks": critic_output["sequencing_risks"],
                    "non_goals": critic_output["non_goals"],
                    "functional_checks": critic_output["functional_checks"],
                    "tests_required": critic_output["tests_required"],
                    "docs_required": critic_output["docs_required"],
                    "blocking_conditions": critic_output["blocking_conditions"],
                    "next_recommended_action": critic_output["next_recommended_action"],
                },
            },
        }

    if step.step_id == "repo_intake":
        return {
            "task_summary": "CV1-B seq_next planning artifact implementation",
            "intent": "Generate inspectable plan and acceptance-check artifacts",
            "repo_summary": "CV1-A context report baseline is available",
            "changed_surfaces": ["src/fractal_agent_lab/workflows", "src/fractal_agent_lab/agents", "tests"],
            "relevant_docs": ["ops/Combined-Execution-Sequencing-Plan.md", "ops/AGENTS.md"],
            "relevant_code_areas": ["hypothesis: src/fractal_agent_lab/workflows/h4.py"],
            "likely_touched_files": ["hypothesis: src/fractal_agent_lab/workflows/h4_artifacts.py"],
            "assumptions": ["CV1-C helper scope remains separate from Track C implementation."],
            "unknowns": ["Adapter seam may need explicit checkpoint later."],
            "recent_change_notes": ["CV1-A closeout hardened canonical sidecar warning behavior."],
            "current_frontier": "CV1 Step 2 / CV1-B",
        }

    if step.step_id == "planner":
        return {
            "step_order": ["workflow", "pack", "artifacts", "tests"],
            "dependencies": ["CV1-A complete"],
            "test_plan": ["workflow spec tests", "pack tests", "CLI integration tests"],
            "documentation_obligations": ["Track C CV1-B delivery note", "Combined/AGENTS status updates"],
            "risk_register": [
                {
                    "id": "R1",
                    "title": "Shared-boundary drift",
                    "severity": "medium",
                    "type": "scope",
                    "description": "Do not silently absorb Track D adapter/helper ownership.",
                    "mitigation": "Keep adapter seam as explicit cross-track checkpoint.",
                    "owner": "track-c",
                },
            ],
            "open_questions": ["Need narrow exception if default-mock canonical proof blocks."],
        }

    if step.step_id == "architect_critic":
        return {
            "blockers_or_holds": [],
            "shared_zone_cautions": ["cli/app.py remains a narrow shared-boundary hook."],
            "sequencing_risks": ["CV1-B scope drift into CV1-C helper platform."],
            "non_goals": ["No packet bus or H5 spillover in CV1-B."],
            "functional_checks": ["implementation_plan.md exists for successful seq_next runs"],
            "tests_required": ["tests/cli/test_cv1_b_h4_seq_next_cli.py"],
            "docs_required": ["docs/wave3/Wave3-CV1-B-TrackC-H4-Seq-Next-v1.md"],
            "blocking_conditions": ["missing required plan/acceptance fields"],
            "next_recommended_action": "Proceed with CV1-C in parallel and then run CV1-D.",
        }

    return {"output": {}}


def _incomplete_h4_seq_next_step_runner(*, run_state, workflow, step):
    result = _scripted_h4_seq_next_step_runner(run_state=run_state, workflow=workflow, step=step)
    if step.step_id != "synthesizer":
        return result

    control = result.get("control")
    if not isinstance(control, dict):
        return result
    output = control.get("output")
    if not isinstance(output, dict):
        return result
    output.pop("risk_register", None)
    output.pop("functional_checks", None)
    return result


def _empty_blocking_conditions_step_runner(*, run_state, workflow, step):
    result = _scripted_h4_seq_next_step_runner(run_state=run_state, workflow=workflow, step=step)
    if step.step_id != "synthesizer":
        return result

    control = result.get("control")
    if not isinstance(control, dict):
        return result
    output = control.get("output")
    if not isinstance(output, dict):
        return result
    output["blocking_conditions"] = []
    return result


def _malformed_risk_register_step_runner(*, run_state, workflow, step):
    result = _scripted_h4_seq_next_step_runner(run_state=run_state, workflow=workflow, step=step)
    if step.step_id != "synthesizer":
        return result

    control = result.get("control")
    if not isinstance(control, dict):
        return result
    output = control.get("output")
    if not isinstance(output, dict):
        return result
    output["risk_register"] = [
        {
            "id": "R1",
            "title": "Malformed row",
            "severity": "medium",
            "type": "scope",
            "description": "Missing mitigation and owner fields should fail row-shape validation.",
        },
    ]
    return result


def _write_runtime_config(data_dir: Path) -> Path:
    runtime_config = data_dir / "runtime.yaml"
    runtime_config.write_text(
        "\n".join(
            [
                "runtime:",
                "  default_timeout_seconds: 60",
                "  max_retries: 2",
                "identity:",
                "  enabled: false",
                "paths:",
                f"  data_dir: {data_dir.as_posix()}",
            ],
        )
        + "\n",
        encoding="utf-8",
    )
    return runtime_config


if __name__ == "__main__":
    unittest.main()
