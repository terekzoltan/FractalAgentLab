from __future__ import annotations

import io
import json
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

from fractal_agent_lab.cli.app import run_cli


class R3NProviderOverridePolicyCliTests(unittest.TestCase):
    def test_run_rejects_unknown_provider_override(self) -> None:
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
                        "unknown-provider",
                    ],
                )

        self.assertEqual(2, code)
        self.assertIn("Unsupported provider 'unknown-provider'", out.getvalue())

    def test_run_accepts_supported_openai_provider_override(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-r3-n-cli-") as tmp_dir:
            runtime_config = _write_runtime_config(Path(tmp_dir))
            out = io.StringIO()
            fake_response = _FakeHTTPResponse(
                status_code=200,
                body_text=json.dumps(
                    {
                        "id": "resp-openai-override",
                        "model": "openai/test-model",
                        "choices": [
                            {
                                "message": {
                                    "content": json.dumps(
                                        {
                                            "clarified_idea": "Provider override policy",
                                            "strongest_assumptions": ["assumption"],
                                            "weak_points": ["weak"],
                                            "alternatives": ["alt"],
                                            "recommended_mvp_direction": "mvp",
                                            "next_3_validation_steps": ["s1", "s2", "s3"],
                                        },
                                    ),
                                },
                            },
                        ],
                    },
                ),
            )
            with (
                patch.dict("os.environ", {"OPENAI_API_KEY": "test-key"}, clear=False),
                patch(
                    "fractal_agent_lab.adapters.openai.adapter.urlopen",
                    return_value=fake_response,
                ),
                redirect_stdout(out),
            ):
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

        self.assertEqual(0, code)
        payload = json.loads(out.getvalue())
        self.assertEqual("succeeded", payload["summary"]["status"])
        output_payload = payload["summary"]["output_payload"]
        step_payload = output_payload["step_results"]["single"]
        self.assertEqual("openai", step_payload["provider"])
        self.assertTrue(step_payload["raw"]["openai"])
        self.assertEqual("openai", step_payload["raw"]["routing"]["selected_provider"])
        self.assertFalse(step_payload["raw"]["fallback"]["used"])

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

    def test_run_rejects_provider_override_when_providers_block_is_malformed(self) -> None:
        for provider in ("openai", "openrouter"):
            with self.subTest(provider=provider):
                with tempfile.TemporaryDirectory(prefix="fal-r3-n-cli-") as tmp_dir:
                    tmp_path = Path(tmp_dir)
                    runtime_config = _write_runtime_config(tmp_path)
                    providers_config = _write_malformed_providers_config(tmp_path)
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
                                "--providers-config",
                                providers_config.as_posix(),
                                "--provider",
                                provider,
                            ],
                        )

                self.assertEqual(2, code)
                self.assertIn("providers.providers must be a mapping", out.getvalue())


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


def _write_malformed_providers_config(data_dir: Path) -> Path:
    providers_config = data_dir / "providers.json"
    providers_config.write_text(json.dumps({"providers": "not-a-mapping"}), encoding="utf-8")
    return providers_config


class _FakeHTTPResponse:
    def __init__(self, *, status_code: int, body_text: str) -> None:
        self._status_code = status_code
        self._body = body_text.encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb) -> None:
        _ = exc_type
        _ = exc
        _ = tb

    def getcode(self) -> int:
        return self._status_code

    def read(self) -> bytes:
        return self._body


if __name__ == "__main__":
    unittest.main()
