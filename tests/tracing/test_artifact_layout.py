from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.tracing import (
    artifacts_root_dir_path,
    run_artifact_dir_path,
    run_artifact_path,
    runs_dir_path,
    trace_artifact_path,
    traces_dir_path,
)


class ArtifactLayoutTests(unittest.TestCase):
    def test_derives_canonical_run_and_trace_paths(self) -> None:
        data_dir = Path("data")
        run_id = "run-123"

        self.assertEqual(Path("data/runs"), runs_dir_path(data_dir=data_dir))
        self.assertEqual(Path("data/traces"), traces_dir_path(data_dir=data_dir))
        self.assertEqual(Path("data/runs/run-123.json"), run_artifact_path(run_id=run_id, data_dir=data_dir))
        self.assertEqual(
            Path("data/traces/run-123.jsonl"),
            trace_artifact_path(run_id=run_id, data_dir=data_dir),
        )

    def test_derives_additive_artifact_sidecar_paths(self) -> None:
        data_dir = Path("data")
        run_id = "run-sidecar"

        self.assertEqual(Path("data/artifacts"), artifacts_root_dir_path(data_dir=data_dir))
        self.assertEqual(
            Path("data/artifacts/run-sidecar"),
            run_artifact_dir_path(run_id=run_id, data_dir=data_dir),
        )

    def test_paths_support_custom_data_dir_with_spaces(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal layout ") as tmp_dir:
            base = Path(tmp_dir)
            run_id = "abc"

            run_path = run_artifact_path(run_id=run_id, data_dir=base)
            trace_path = trace_artifact_path(run_id=run_id, data_dir=base)
            sidecar_path = run_artifact_dir_path(run_id=run_id, data_dir=base)

            self.assertEqual(base / "runs" / "abc.json", run_path)
            self.assertEqual(base / "traces" / "abc.jsonl", trace_path)
            self.assertEqual(base / "artifacts" / "abc", sidecar_path)


if __name__ == "__main__":
    unittest.main()
