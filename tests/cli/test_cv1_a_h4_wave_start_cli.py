from __future__ import annotations

import io
import json
import tempfile
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch

from fractal_agent_lab.cli.app import run_cli


class CV1AH4WaveStartCliTests(unittest.TestCase):
    def test_h4_wave_start_cli_run_writes_context_report_sidecar(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-cv1-a-cli-") as tmp_dir:
            data_dir = Path(tmp_dir)
            runtime_config = _write_runtime_config(data_dir)
            out = io.StringIO()
            err = io.StringIO()

            with redirect_stdout(out), redirect_stderr(err):
                code = run_cli(
                    [
                        "run",
                        "h4.wave_start.v1",
                        "--input-json",
                        '{"goal": "CV1-A wave_start"}',
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
            self.assertEqual("h4.wave_start.v1", run_artifact["workflow_id"])
            self.assertEqual("succeeded", run_artifact["status"])

            context_report_path = data_dir / "artifacts" / run_id / "context_report.json"
            self.assertTrue(context_report_path.exists())

            context_report = json.loads(context_report_path.read_text(encoding="utf-8"))
            self.assertEqual("context_report", context_report["artifact_type"])
            self.assertEqual("1.0", context_report["artifact_version"])
            self.assertEqual(run_id, context_report["run_id"])
            self.assertEqual("h4", context_report["workflow_id"])
            self.assertEqual("h4.wave_start.v1", context_report["workflow_variant"])
            self.assertTrue(context_report["repo_summary"])
            self.assertTrue(context_report["unknowns"])
            self.assertTrue(context_report["next_recommended_action"])
            self.assertIn("shared_zone_cautions", context_report)
            self.assertIn("sequencing_risks", context_report)
            self.assertIn("non_goals", context_report)
            for item in context_report["relevant_code_areas"]:
                self.assertTrue(item.startswith("hypothesis:"))
            for item in context_report["likely_touched_files"]:
                self.assertTrue(item.startswith("hypothesis:"))

    def test_h4_wave_start_cli_warns_when_context_report_fields_are_missing(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-cv1-a-cli-missing-") as tmp_dir:
            data_dir = Path(tmp_dir)
            runtime_config = _write_runtime_config(data_dir)
            out = io.StringIO()
            err = io.StringIO()

            with patch("fractal_agent_lab.cli.app.build_step_runner", return_value=_incomplete_h4_step_runner):
                with redirect_stdout(out), redirect_stderr(err):
                    code = run_cli(
                        [
                            "run",
                            "h4.wave_start.v1",
                            "--input-json",
                            '{"goal": "CV1-A warning path"}',
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
            self.assertIn("Warning: failed to write H4 context report artifact", err.getvalue())
            self.assertFalse((data_dir / "artifacts" / run_id / "context_report.json").exists())


def _scripted_h4_step_runner(*, run_state, workflow, step):
    _ = workflow
    step_results = run_state.step_results

    if step.step_id == "synthesizer":
        if "repo_intake" not in step_results:
            return {
                "control": {
                    "action": "delegate",
                    "target_step_id": "repo_intake",
                    "reason": "missing_repo_intake_output",
                },
            }
        if "architect_critic" not in step_results:
            return {
                "control": {
                    "action": "delegate",
                    "target_step_id": "architect_critic",
                    "reason": "missing_architect_critic_output",
                },
            }

        intake_output = step_results["repo_intake"]
        critic_output = step_results["architect_critic"]
        return {
            "control": {
                "action": "finalize",
                "reason": "all_workers_completed",
                "output": {
                    "repo_summary": intake_output["repo_summary"],
                    "changed_surfaces": intake_output["changed_surfaces"],
                    "relevant_docs": intake_output["relevant_docs"],
                    "relevant_code_areas": intake_output["relevant_code_areas"],
                    "likely_touched_files": intake_output["likely_touched_files"],
                    "assumptions": intake_output["assumptions"],
                    "unknowns": intake_output["unknowns"],
                    "recent_change_notes": intake_output["recent_change_notes"],
                    "current_frontier": intake_output["current_frontier"],
                    "blockers_or_holds": critic_output["blockers_or_holds"],
                    "shared_zone_cautions": critic_output["shared_zone_cautions"],
                    "sequencing_risks": critic_output["sequencing_risks"],
                    "non_goals": critic_output["non_goals"],
                    "next_recommended_action": critic_output["next_recommended_action"],
                },
            },
        }

    if step.step_id == "repo_intake":
        return {
            "repo_summary": "CV1-A wave_start produces repo-aware intake and frontier refresh only.",
            "changed_surfaces": ["ops", "src/fractal_agent_lab/workflows", "src/fractal_agent_lab/agents"],
            "relevant_docs": [
                "ops/Combined-Execution-Sequencing-Plan.md",
                "ops/AGENTS.md",
                "docs/private/Coding-Vertical-Repo-Aware-Planning-Policy-v01.md",
            ],
            "relevant_code_areas": [
                "hypothesis: src/fractal_agent_lab/workflows/h4.py",
                "hypothesis: src/fractal_agent_lab/agents/h4/",
            ],
            "likely_touched_files": [
                "hypothesis: src/fractal_agent_lab/cli/workflow_registry.py",
                "hypothesis: src/fractal_agent_lab/workflows/h4_artifacts.py",
            ],
            "assumptions": ["Track D adapter specialization remains deferred from CV1-A."],
            "unknowns": ["Whether CV1-C should add helper surfaces for packet transport."],
            "recent_change_notes": ["Meta reorientation set packet/compiler-first direction."],
            "current_frontier": "CV1 Step 1 / CV1-A",
        }

    if step.step_id == "architect_critic":
        return {
            "blockers_or_holds": [],
            "shared_zone_cautions": ["cli/app.py touch must stay minimal and additive."],
            "sequencing_risks": ["Do not absorb adapter product work into CV1-A."],
            "non_goals": ["No packet bus or helper-platform expansion in this step."],
            "next_recommended_action": "After CV1-A closes, proceed to CV1-B and CV1-C.",
        }

    return {"output": {}}


def _incomplete_h4_step_runner(*, run_state, workflow, step):
    _ = workflow
    step_results = run_state.step_results

    if step.step_id == "synthesizer":
        if "repo_intake" not in step_results:
            return {
                "control": {
                    "action": "delegate",
                    "target_step_id": "repo_intake",
                    "reason": "missing_repo_intake_output",
                },
            }
        if "architect_critic" not in step_results:
            return {
                "control": {
                    "action": "delegate",
                    "target_step_id": "architect_critic",
                    "reason": "missing_architect_critic_output",
                },
            }

        intake_output = step_results["repo_intake"]
        critic_output = step_results["architect_critic"]
        return {
            "control": {
                "action": "finalize",
                "reason": "all_workers_completed",
                "output": {
                    "repo_summary": intake_output["repo_summary"],
                    "changed_surfaces": intake_output["changed_surfaces"],
                    "relevant_docs": intake_output["relevant_docs"],
                    "relevant_code_areas": intake_output["relevant_code_areas"],
                    "likely_touched_files": intake_output["likely_touched_files"],
                    "assumptions": intake_output["assumptions"],
                    "unknowns": intake_output["unknowns"],
                    "recent_change_notes": intake_output["recent_change_notes"],
                    "current_frontier": intake_output["current_frontier"],
                    "blockers_or_holds": critic_output["blockers_or_holds"],
                    "shared_zone_cautions": critic_output["shared_zone_cautions"],
                    "sequencing_risks": critic_output["sequencing_risks"],
                    "non_goals": critic_output["non_goals"],
                },
            },
        }

    return _scripted_h4_step_runner(run_state=run_state, workflow=workflow, step=step)


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
