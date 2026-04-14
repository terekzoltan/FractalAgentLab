from __future__ import annotations

import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

from fractal_agent_lab.cli.app import run_cli
from fractal_agent_lab.memory import JSONProjectMemoryStore, ProjectMemory, ProjectMemoryEntry


class R3IProjectMemoryCliTests(unittest.TestCase):
    def test_h2_cli_run_loads_project_memory_context_and_updates_canonical_store(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-r3-i-cli-") as tmp_dir:
            data_dir = Path(tmp_dir)
            store = JSONProjectMemoryStore(data_dir=data_dir)
            store.save_project(
                ProjectMemory(
                    project_id="repo-alpha",
                    workflow_learnings=[
                        ProjectMemoryEntry(
                            entry_type="workflow_learning",
                            entry_subtype="merge_risk",
                            content="template-law regression",
                            workflow_id="h3.manager.v1",
                            source_path="output_payload.final_output.merge_risks[]",
                            first_seen_run_id="seed-run",
                            last_seen_run_id="seed-run",
                            last_updated_at="2026-04-14T00:00:00+00:00",
                        ),
                    ],
                ),
            )
            runtime_config = _write_runtime_config(data_dir)

            out = io.StringIO()
            with redirect_stdout(out):
                code = run_cli(
                    [
                        "run",
                        "h2.manager.v1",
                        "--input-json",
                        '{"goal": "Build a decomposition workflow", "project_id": "repo-alpha"}',
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

            run_artifact = json.loads((data_dir / "runs" / f"{run_id}.json").read_text(encoding="utf-8"))
            context = run_artifact["context"]
            self.assertEqual("repo-alpha", context["project_id"])
            self.assertEqual("repo-alpha", context["project_memory"]["project_id"])
            self.assertEqual(
                "template-law regression",
                context["project_memory"]["workflow_learnings"][0]["content"],
            )

            updated_memory = store.load_project(project_id="repo-alpha")
            self.assertIsNotNone(updated_memory)
            assert updated_memory is not None
            stable_decisions = {
                entry.entry_subtype: entry.content for entry in updated_memory.stable_decisions
            }
            self.assertEqual(
                "stabilize_h2_template_contract",
                stable_decisions["recommended_starting_slice"],
            )
            self.assertTrue((data_dir / "artifacts" / run_id / "project_memory_update.json").exists())


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
                "  store_backend: json",
                "  data_subdir: identity",
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
