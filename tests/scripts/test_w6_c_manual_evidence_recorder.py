from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

from tests.evals.test_w6_manual_evidence_recorder import _sample_input


class W6CManualEvidenceRecorderScriptTests(unittest.TestCase):
    def test_valid_operator_json_records_private_outputs(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            temp_dir = Path(temp_dir_raw)
            input_path = temp_dir / "input.json"
            input_path.write_text(json.dumps(_sample_input()), encoding="utf-8")

            result = _run_script(input_path=input_path, data_dir=temp_dir / "data")

            self.assertEqual(0, result.returncode, result.stdout + result.stderr)
            summary = json.loads(result.stdout)
            self.assertTrue(summary["recorded"])
            for output_path in summary["output_paths"].values():
                self.assertIn("data/evidence/wave6", Path(output_path).as_posix())

    def test_invalid_operator_json_exits_non_zero(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            temp_dir = Path(temp_dir_raw)
            input_payload = _sample_input()
            input_payload["packets"][0].pop("packet_id")
            input_path = temp_dir / "input.json"
            input_path.write_text(json.dumps(input_payload), encoding="utf-8")

            result = _run_script(input_path=input_path, data_dir=temp_dir / "data")

            self.assertNotEqual(0, result.returncode)
            summary = json.loads(result.stdout)
            self.assertFalse(summary["recorded"])
            self.assertFalse((temp_dir / "data" / "evidence" / "wave6" / "loops" / "loop-1").exists())

    def test_missing_required_recorder_field_exits_non_zero(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            temp_dir = Path(temp_dir_raw)
            input_payload = _sample_input()
            input_payload.pop("final_status")
            input_path = temp_dir / "input.json"
            input_path.write_text(json.dumps(input_payload), encoding="utf-8")

            result = _run_script(input_path=input_path, data_dir=temp_dir / "data")

            self.assertNotEqual(0, result.returncode)
            self.assertIn("final_status", result.stdout)


def _run_script(*, input_path: Path, data_dir: Path) -> subprocess.CompletedProcess[str]:
    env = os.environ.copy()
    env["PYTHONPATH"] = "src" + os.pathsep + env.get("PYTHONPATH", "")
    return subprocess.run(
        [
            sys.executable,
            "-m",
            "scripts.run_w6_c_manual_evidence_recorder",
            "--input",
            str(input_path),
            "--data-dir",
            str(data_dir),
        ],
        check=False,
        capture_output=True,
        env=env,
        text=True,
    )


if __name__ == "__main__":
    unittest.main()
