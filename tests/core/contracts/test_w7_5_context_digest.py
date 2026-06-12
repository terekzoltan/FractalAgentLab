from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.core.contracts.w7_5_context_digest import (
    W7_5_CONTEXT_DIGEST_CLAIM_BOUNDARY,
    W7_5_CONTEXT_DIGEST_SCHEMA_VERSION,
    W75ContextDigestError,
    build_context_digest,
    write_context_digest,
)


class W75ContextDigestTests(unittest.TestCase):
    def test_build_context_digest_uses_safe_defaults(self) -> None:
        payload = build_context_digest("run-1")

        self.assertEqual(W7_5_CONTEXT_DIGEST_SCHEMA_VERSION, payload["schema_version"])
        self.assertEqual("run-1", payload["run_id"])
        self.assertEqual(W7_5_CONTEXT_DIGEST_CLAIM_BOUNDARY, payload["claim_boundary"])
        self.assertFalse(payload["public_safe"])
        self.assertFalse(payload["raw_transcript_retained"])
        self.assertFalse(payload["raw_selected_output_body_retained"])
        self.assertEqual("L0", payload["hydration_level"])
        self.assertEqual([], payload["loaded_context_refs"])
        self.assertEqual([], payload["deferred_context_refs"])
        self.assertIsNone(payload["token_estimate"])
        self.assertEqual([], payload["manual_restore_steps"])
        self.assertEqual("unknown", payload["recovery_success_label"])
        self.assertIsNone(payload["operator_notes"])

    def test_write_context_digest_writes_explicit_contract_values(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w75-context-digest-") as tmp_dir:
            path = write_context_digest(
                "run-1",
                data_dir=tmp_dir,
                hydration_level="L1",
                loaded_context_refs=["ops/PROJECT_STATE.md"],
                deferred_context_refs=["ops/Combined-Execution-Sequencing-Plan.md"],
                token_estimate=1200,
                manual_restore_steps=["Read hot context first."],
                recovery_success_label="partially_restored",
                operator_notes="Operator restored current step context.",
            )
            payload = json.loads(path.read_text(encoding="utf-8"))
            serialized = path.read_text(encoding="utf-8")

        self.assertEqual(Path(tmp_dir) / "artifacts" / "run-1" / "context_digest.json", path)
        self.assertEqual("L1", payload["hydration_level"])
        self.assertEqual(["ops/PROJECT_STATE.md"], payload["loaded_context_refs"])
        self.assertEqual(["ops/Combined-Execution-Sequencing-Plan.md"], payload["deferred_context_refs"])
        self.assertEqual(1200, payload["token_estimate"])
        self.assertEqual(["Read hot context first."], payload["manual_restore_steps"])
        self.assertEqual("partially_restored", payload["recovery_success_label"])
        self.assertEqual("Operator restored current step context.", payload["operator_notes"])
        self.assertTrue(serialized.endswith("\n"))
        self.assertNotIn("PRIVATE SELECTED OUTPUT BODY", serialized)

    def test_unsafe_run_ids_reject_before_path_write(self) -> None:
        unsafe_ids = [
            "../escaped-run",
            "..\\escaped-run",
            r"C:\escaped-run",
            " run-1 ",
            "CON",
        ]
        with tempfile.TemporaryDirectory(prefix="fal-w75-context-unsafe-") as tmp_dir:
            for run_id in unsafe_ids:
                with self.subTest(run_id=run_id):
                    with self.assertRaises(W75ContextDigestError):
                        write_context_digest(run_id, data_dir=tmp_dir)
                    self.assertFalse((Path(tmp_dir) / "escaped-run").exists())
                    self.assertFalse((Path(tmp_dir) / "artifacts" / "escaped-run").exists())

    def test_write_context_digest_rejects_overwrite(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-w75-context-overwrite-") as tmp_dir:
            write_context_digest("run-1", data_dir=tmp_dir)

            with self.assertRaisesRegex(W75ContextDigestError, "does not support overwrite"):
                write_context_digest("run-1", data_dir=tmp_dir)

    def test_invalid_hydration_level_rejected(self) -> None:
        with self.assertRaisesRegex(W75ContextDigestError, "hydration_level"):
            build_context_digest("run-1", hydration_level="L4")

    def test_context_refs_must_be_string_lists(self) -> None:
        invalid_values = [
            "ops/PROJECT_STATE.md",
            ("ops/PROJECT_STATE.md",),
            [""],
            [{"ref": "ops/PROJECT_STATE.md", "heat": "hot"}],
        ]

        for value in invalid_values:
            with self.subTest(value=value):
                with self.assertRaises(W75ContextDigestError):
                    build_context_digest("run-1", loaded_context_refs=value)  # type: ignore[arg-type]

    def test_token_estimate_must_be_positive_int_not_bool(self) -> None:
        for token_estimate in (True, False, 0, -1):
            with self.subTest(token_estimate=token_estimate):
                with self.assertRaisesRegex(W75ContextDigestError, "token_estimate"):
                    build_context_digest("run-1", token_estimate=token_estimate)  # type: ignore[arg-type]

    def test_invalid_manual_restore_step_rejected(self) -> None:
        with self.assertRaisesRegex(W75ContextDigestError, "manual_restore_steps"):
            build_context_digest("run-1", manual_restore_steps=["Read state", ""])

    def test_invalid_recovery_success_label_rejected(self) -> None:
        with self.assertRaisesRegex(W75ContextDigestError, "recovery_success_label"):
            build_context_digest("run-1", recovery_success_label="quality_score_green")

    def test_operator_notes_must_be_string_or_none(self) -> None:
        with self.assertRaisesRegex(W75ContextDigestError, "operator_notes"):
            build_context_digest("run-1", operator_notes=123)  # type: ignore[arg-type]


if __name__ == "__main__":
    unittest.main()
