from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from tests.evals.test_w6_usefulness_evaluation import _seed_row

W6D_LOOP_ID = "w6d-fal-w6bc-review-fix-20260508"
W6E_LOOP_ID = "w6e-fal-project-state-protocol-20260511"


class W6FUsefulnessEvaluationScriptTests(unittest.TestCase):
    def test_valid_seed_rows_write_private_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            temp_dir = Path(temp_dir_raw)
            row_a = temp_dir / "row-a.json"
            row_b = temp_dir / "row-b.json"
            output_dir = temp_dir / "data" / "evidence" / "wave6" / "eval" / "w6f-usefulness-evaluation-v1"
            row_a.write_text(json.dumps(_seed_row(loop_id=W6D_LOOP_ID, complexity_class="shared_boundary")), encoding="utf-8")
            row_b.write_text(
                json.dumps(_seed_row(loop_id=W6E_LOOP_ID, complexity_class="governance_context_continuity")),
                encoding="utf-8",
            )

            result = _run_script(input_rows=[row_a, row_b], output_dir=output_dir)

            self.assertEqual(0, result.returncode, result.stdout + result.stderr)
            payload = json.loads(result.stdout)
            self.assertTrue(payload["evaluated"])
            self.assertEqual("private_raw", payload["summary"]["privacy_classification"])
            self.assertTrue((output_dir / "usefulness_rows.jsonl").exists())
            self.assertTrue((output_dir / "usefulness_summary.json").exists())

    def test_invalid_seed_row_exits_non_zero(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            temp_dir = Path(temp_dir_raw)
            row_path = temp_dir / "bad-row.json"
            payload = _seed_row(loop_id="bad-row")
            payload["schema_version"] = "wrong"
            row_path.write_text(json.dumps(payload), encoding="utf-8")

            result = _run_script(input_rows=[row_path], output_dir=temp_dir / "out")

            self.assertNotEqual(0, result.returncode)
            summary = json.loads(result.stdout)
            self.assertFalse(summary["evaluated"])
            self.assertIn("schema_version", summary["error"])

    def test_one_input_row_exits_non_zero_with_useful_error(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            temp_dir = Path(temp_dir_raw)
            row_path = temp_dir / "one-row.json"
            row_path.write_text(json.dumps(_seed_row(loop_id=W6D_LOOP_ID)), encoding="utf-8")

            result = _run_script(input_rows=[row_path], output_dir=temp_dir / "out")

            self.assertNotEqual(0, result.returncode)
            summary = json.loads(result.stdout)
            self.assertFalse(summary["evaluated"])
            self.assertIn("requires W6-D + W6-E seed rows", summary["error"])


def _run_script(*, input_rows: list[Path], output_dir: Path) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PYTHONPATH"] = "src" + os.pathsep + env.get("PYTHONPATH", "")
    command = [sys.executable, "-m", "scripts.run_w6_f_usefulness_evaluation"]
    for input_row in input_rows:
        command.extend(["--input-row", str(input_row)])
    command.extend(["--output-dir", str(output_dir)])
    return subprocess.run(
        command,
        check=False,
        capture_output=True,
        env=env,
        text=True,
    )


if __name__ == "__main__":
    unittest.main()
