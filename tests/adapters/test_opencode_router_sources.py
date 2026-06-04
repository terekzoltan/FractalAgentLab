from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.adapters.opencode_router_sources import (
    DEFAULT_EXCERPT_MAX_CHARS,
    OpenCodeRouterSourceError,
    WARNING_ARTIFACT_REFS_AUDIT_ONLY,
    WARNING_EXCERPT_TRUNCATED,
    WARNING_MARKDOWN_FALLBACK,
    WARNING_MISSING_OPTIONAL_METADATA,
    WARNING_THOUGHT_OMITTED,
    load_selected_output,
    load_selected_outputs,
)


class OpenCodeRouterSourcesTests(unittest.TestCase):
    def test_load_selected_output_normalizes_valid_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            source_path = Path(tmp_dir) / "selected-output.json"
            source_path.write_text(
                json.dumps(
                    {
                        "stage": "meta_step_review_phase1",
                        "source_kind": "router_selected_output",
                        "summary": "Meta review completed with warnings.",
                        "source_session": "meta-1",
                        "message_id": "msg-1",
                        "decision": "fix_required",
                        "selected_text": "Review text",
                        "artifact_refs": ["docs/private/review.md"],
                    }
                ),
                encoding="utf-8",
            )

            result = load_selected_output(source_path, router_root=tmp_dir)

            self.assertEqual("meta_step_review_phase1", result.stage)
            self.assertEqual("router_selected_output", result.source_kind)
            self.assertEqual("meta-1", result.source_session)
            self.assertEqual("msg-1", result.message_id)
            self.assertEqual("fix_required", result.decision)
            self.assertEqual("Review text", result.selected_text_excerpt)
            self.assertFalse(result.excerpt_truncated)
            self.assertIn(WARNING_ARTIFACT_REFS_AUDIT_ONLY, result.warnings)

    def test_load_selected_output_rejects_missing_required_json_field(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            source_path = Path(tmp_dir) / "selected-output.json"
            source_path.write_text(
                json.dumps({"source_kind": "router_selected_output", "summary": "Missing stage"}),
                encoding="utf-8",
            )

            with self.assertRaises(OpenCodeRouterSourceError) as raised:
                load_selected_output(source_path, router_root=tmp_dir)

            self.assertIn("stage", str(raised.exception))

    def test_load_selected_output_rejects_invalid_json(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            source_path = Path(tmp_dir) / "selected-output.json"
            source_path.write_text("{not-json}", encoding="utf-8")

            with self.assertRaises(OpenCodeRouterSourceError) as raised:
                load_selected_output(source_path, router_root=tmp_dir)

            self.assertIn("invalid", str(raised.exception).lower())

    def test_load_selected_output_rejects_invalid_excerpt_max_chars(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            source_path = Path(tmp_dir) / "selected-output.json"
            source_path.write_text(
                json.dumps(
                    {
                        "stage": "track_seq_next",
                        "source_kind": "selected_output_file",
                        "summary": "Invalid excerpt limit",
                    }
                ),
                encoding="utf-8",
            )

            for invalid_value in (None, "4000", True):
                with self.subTest(excerpt_max_chars=invalid_value):
                    with self.assertRaises(OpenCodeRouterSourceError) as raised:
                        load_selected_output(
                            source_path,
                            router_root=tmp_dir,
                            excerpt_max_chars=invalid_value,  # type: ignore[arg-type]
                        )

                    self.assertIn("positive integer", str(raised.exception))

    def test_load_selected_output_rejects_source_outside_router_root(self) -> None:
        with tempfile.TemporaryDirectory() as router_dir, tempfile.TemporaryDirectory() as outside_dir:
            source_path = Path(outside_dir) / "selected-output.json"
            source_path.write_text(
                json.dumps(
                    {
                        "stage": "track_seq_next",
                        "source_kind": "selected_output_file",
                        "summary": "Outside root",
                    }
                ),
                encoding="utf-8",
            )

            with self.assertRaises(OpenCodeRouterSourceError) as raised:
                load_selected_output(source_path, router_root=router_dir)

            self.assertIn("escapes", str(raised.exception))

    def test_load_selected_output_omits_reasoning_fields_and_truncates_excerpt(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            long_text = "x" * (DEFAULT_EXCERPT_MAX_CHARS + 25)
            source_path = Path(tmp_dir) / "selected-output.json"
            source_path.write_text(
                json.dumps(
                    {
                        "stage": "swarm_review",
                        "source_kind": "router_selected_output",
                        "summary": "Swarm review summary",
                        "selected_text": long_text,
                        "reasoning": "should not survive",
                    }
                ),
                encoding="utf-8",
            )

            result = load_selected_output(source_path, router_root=tmp_dir)

            self.assertEqual(DEFAULT_EXCERPT_MAX_CHARS, len(result.selected_text_excerpt or ""))
            self.assertTrue(result.excerpt_truncated)
            self.assertIn(WARNING_EXCERPT_TRUNCATED, result.warnings)
            self.assertIn(WARNING_THOUGHT_OMITTED, result.warnings)
            self.assertIn(WARNING_MISSING_OPTIONAL_METADATA, result.warnings)
            self.assertNotIn("reasoning", result.to_dict())

    def test_load_selected_output_markdown_fallback_is_warning_grade(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            source_path = Path(tmp_dir) / "selected-output.md"
            source_path.write_text("# Review\n\n" + ("y" * 5000), encoding="utf-8")

            result = load_selected_output(source_path, router_root=tmp_dir)

            self.assertIsNone(result.stage)
            self.assertEqual("markdown_excerpt", result.source_kind)
            self.assertIn(WARNING_MARKDOWN_FALLBACK, result.warnings)
            self.assertIn(WARNING_MISSING_OPTIONAL_METADATA, result.warnings)
            self.assertIn(WARNING_EXCERPT_TRUNCATED, result.warnings)
            self.assertTrue(result.excerpt_truncated)

    def test_load_selected_outputs_reads_multiple_sources(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            first = Path(tmp_dir) / "first.json"
            second = Path(tmp_dir) / "second.json"
            first.write_text(
                json.dumps(
                    {
                        "stage": "track_seq_next",
                        "source_kind": "selected_output_file",
                        "summary": "First",
                    }
                ),
                encoding="utf-8",
            )
            second.write_text(
                json.dumps(
                    {
                        "stage": "meta_plan_review",
                        "source_kind": "router_selected_output",
                        "summary": "Second",
                    }
                ),
                encoding="utf-8",
            )

            results = load_selected_outputs([first, second], router_root=tmp_dir)

            self.assertEqual(2, len(results))
            self.assertEqual("track_seq_next", results[0].stage)
            self.assertEqual("meta_plan_review", results[1].stage)

    def test_load_selected_output_has_no_write_side_effects(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            router_root = Path(tmp_dir) / ".opencode-router"
            data_root = Path(tmp_dir) / "data"
            router_root.mkdir()
            data_root.mkdir()
            source_path = router_root / "selected-output.json"
            source_path.write_text(
                json.dumps(
                    {
                        "stage": "meta_final_synthesis",
                        "source_kind": "router_selected_output",
                        "summary": "Done",
                    }
                ),
                encoding="utf-8",
            )
            before_router = sorted(path.relative_to(router_root).as_posix() for path in router_root.rglob("*"))
            before_data = sorted(path.relative_to(data_root).as_posix() for path in data_root.rglob("*"))

            _ = load_selected_output(source_path, router_root=router_root)

            after_router = sorted(path.relative_to(router_root).as_posix() for path in router_root.rglob("*"))
            after_data = sorted(path.relative_to(data_root).as_posix() for path in data_root.rglob("*"))
            self.assertEqual(before_router, after_router)
            self.assertEqual(before_data, after_data)
