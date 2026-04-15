from __future__ import annotations

import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

from fractal_agent_lab.cli.app import run_cli


class R3NProviderOverridePolicyCliTests(unittest.TestCase):
    def test_run_rejects_unsupported_provider_override(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-r3-n-cli-") as tmp_dir:
            runtime_config = _write_runtime_config(Path(tmp_dir))
            out = io.StringIO()
            with redirect_stdout(out):
                code = run_cli(
                    [
                        "run",
                        "h1.single.v1",
                        "--input-json",
                        '{"idea":"Provider override policy"}',
                        "--format",
                        "json",
                        "--runtime-config",
                        runtime_config.as_posix(),
                        "--provider",
                        "openai",
                    ],
                )

        self.assertEqual(2, code)
        self.assertIn("Unsupported provider 'openai'", out.getvalue())

    def test_run_accepts_supported_mock_provider_override(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-r3-n-cli-") as tmp_dir:
            runtime_config = _write_runtime_config(Path(tmp_dir))
            out = io.StringIO()
            with redirect_stdout(out):
                code = run_cli(
                    [
                        "run",
                        "h1.single.v1",
                        "--input-json",
                        '{"idea":"Provider override policy"}',
                        "--format",
                        "json",
                        "--runtime-config",
                        runtime_config.as_posix(),
                        "--provider",
                        "mock",
                    ],
                )

        self.assertEqual(0, code)
        payload = json.loads(out.getvalue())
        self.assertEqual("succeeded", payload["summary"]["status"])


def _write_runtime_config(data_dir: Path) -> Path:
    runtime_config = data_dir / "runtime.yaml"
    runtime_config.write_text(
        "\n".join(
            [
                "runtime:",
                "  default_timeout_seconds: 60",
                "  max_retries: 1",
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
