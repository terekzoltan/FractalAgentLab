from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from scripts.build_u5_f_memory_eval_index import SCHEMA_VERSION, build_memory_eval_index, write_memory_eval_index


class U5FMemoryEvalIndexTests(unittest.TestCase):
    def test_missing_memory_and_artifacts_create_valid_empty_index(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            index = build_memory_eval_index(data_dir=Path(temp_dir_raw))

            self.assertEqual(SCHEMA_VERSION, index["schema_version"])
            self.assertEqual("no_local_project_memory_store_found", index["summary"]["project_memory_store_state"])
            self.assertEqual([], index["memory_projects"])
            self.assertEqual([], index["memory_artifacts"])
            self.assertEqual([], index["eval_summaries"])
            self.assertEqual(0, index["summary"]["warnings_count"])

    def test_detects_project_memory_and_known_sidecars(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            _write_project_memory(data_dir, project_id="fal")
            _write_memory_candidates(data_dir, run_id="run-h1")
            _write_project_memory_update(data_dir, run_id="run-h2", project_id="fal")

            index = build_memory_eval_index(data_dir=data_dir)

            self.assertEqual("available", index["summary"]["project_memory_store_state"])
            self.assertEqual(1, index["summary"]["memory_project_count"])
            self.assertEqual(2, index["summary"]["memory_artifact_count"])
            self.assertEqual("fal", index["memory_projects"][0]["project_id"])
            kinds = {row["artifact_kind"] for row in index["memory_artifacts"]}
            self.assertEqual({"memory_candidates", "project_memory_update"}, kinds)

    def test_malformed_project_memory_json_is_warning_not_fake_row(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            projects_dir = data_dir / "memory" / "projects"
            projects_dir.mkdir(parents=True)
            (projects_dir / "bad.json").write_text("{not-json", encoding="utf-8")

            index = build_memory_eval_index(data_dir=data_dir)

            self.assertEqual([], index["memory_projects"])
            self.assertEqual(1, index["summary"]["warnings_count"])
            self.assertIn("Malformed project memory", index["warnings"][0])

    def test_malformed_sidecar_json_is_warning_not_fake_row(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            artifact_dir = data_dir / "artifacts" / "run-bad"
            artifact_dir.mkdir(parents=True)
            (artifact_dir / "memory_candidates.json").write_text("{not-json", encoding="utf-8")

            index = build_memory_eval_index(data_dir=data_dir)

            self.assertEqual([], index["memory_artifacts"])
            self.assertEqual(1, index["summary"]["warnings_count"])
            self.assertIn("Malformed memory candidate sidecar", index["warnings"][0])

    def test_allowlisted_eval_report_extracts_source_reported_fields_only(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            report_dir = data_dir / "artifacts" / "run-eval"
            report_dir.mkdir(parents=True)
            (report_dir / "h4_usefulness.json").write_text(
                json.dumps(
                    {
                        "report_version": "cv1_d.h4_usefulness_check.v1",
                        "created_at": "2026-05-04T12:00:00+00:00",
                        "summary": {
                            "track_e_evidence_ready": True,
                            "eval_outcome": "PASS",
                            "nested": {"ignored": True},
                        },
                        "known_limits": ["Source report only."],
                    },
                ),
                encoding="utf-8",
            )

            index = build_memory_eval_index(data_dir=data_dir)

            self.assertEqual(1, index["summary"]["eval_summary_count"])
            summary = index["eval_summaries"][0]
            self.assertEqual("cv1_d.h4_usefulness_check.v1", summary["report_version"])
            self.assertEqual("eval_outcome: PASS", summary["source_reported_outcome"])
            self.assertIn("track_e_evidence_ready", summary["source_reported_summary"])
            self.assertNotIn("nested", summary["source_reported_summary"])

    def test_arbitrary_non_report_json_without_report_version_is_ignored_without_warning(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            sidecar_dir = data_dir / "artifacts" / "run-sidecar"
            sidecar_dir.mkdir(parents=True)
            (sidecar_dir / "notes.json").write_text(
                json.dumps({"artifact_type": "operator_note", "summary": {"text": "not an eval report"}}),
                encoding="utf-8",
            )

            index = build_memory_eval_index(data_dir=data_dir)

            self.assertEqual([], index["eval_summaries"])
            self.assertEqual([], index["warnings"])
            self.assertEqual(0, index["summary"]["eval_summary_count"])
            self.assertEqual(0, index["summary"]["warnings_count"])

    def test_unsupported_eval_report_version_warns(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            report_dir = data_dir / "artifacts" / "run-eval"
            report_dir.mkdir(parents=True)
            (report_dir / "unknown.json").write_text(
                json.dumps({"report_version": "unknown.eval.v1", "summary": {"eval_outcome": "PASS"}}),
                encoding="utf-8",
            )

            index = build_memory_eval_index(data_dir=data_dir)

            self.assertEqual([], index["eval_summaries"])
            self.assertEqual(1, index["summary"]["warnings_count"])
            self.assertIn("Skipped unsupported eval report shape", index["warnings"][0])

    def test_identity_update_is_excluded_from_first_slice(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            data_dir = Path(temp_dir_raw)
            artifact_dir = data_dir / "artifacts" / "run-identity"
            artifact_dir.mkdir(parents=True)
            (artifact_dir / "identity_update.json").write_text(
                json.dumps({"report_version": "h2_o.identity_drift_smoke.v1", "summary": {"drift_smoke_passed": True}}),
                encoding="utf-8",
            )

            index = build_memory_eval_index(data_dir=data_dir)

            self.assertEqual([], index["eval_summaries"])
            self.assertEqual([], index["warnings"])

    def test_write_memory_eval_index_creates_output_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            out_path = Path(temp_dir_raw) / "ui" / "public" / "generated" / "memory-eval-index.json"

            write_memory_eval_index(data_dir=Path(temp_dir_raw) / "data", out_path=out_path)

            payload = json.loads(out_path.read_text(encoding="utf-8"))
            self.assertEqual(SCHEMA_VERSION, payload["schema_version"])


def _write_project_memory(data_dir: Path, *, project_id: str) -> None:
    projects_dir = data_dir / "memory" / "projects"
    projects_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "project_id": project_id,
        "stable_decisions": [
            {
                "entry_type": "stable_decision",
                "entry_subtype": "recommended_starting_slice",
                "content": "Start with U5-F read-only inventory.",
                "workflow_id": "h2.manager.v1",
                "source_path": "output_payload.final_output.recommended_starting_slice",
                "first_seen_run_id": "run-h2",
                "last_seen_run_id": "run-h2",
                "times_observed": 1,
                "confidence": "medium",
                "last_updated_at": "2026-05-04T12:00:00+00:00",
                "schema_version": "project_memory.entry.v1",
            },
        ],
        "workflow_learnings": [],
        "prompt_observations": [],
        "updated_at": "2026-05-04T12:00:00+00:00",
        "schema_version": "project_memory.v1",
    }
    (projects_dir / f"{project_id}.json").write_text(json.dumps(payload), encoding="utf-8")


def _write_memory_candidates(data_dir: Path, *, run_id: str) -> None:
    artifact_dir = data_dir / "artifacts" / run_id
    artifact_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "artifact_type": "memory_candidates",
        "artifact_version": "1.0",
        "candidate_schema_version": "memory.candidate.v1",
        "run_id": run_id,
        "workflow_id": "h1.manager.v1",
        "generated_at": "2026-05-04T12:00:00+00:00",
        "session_id": "session-1",
        "candidate_count": 1,
        "candidates": [],
    }
    (artifact_dir / "memory_candidates.json").write_text(json.dumps(payload), encoding="utf-8")


def _write_project_memory_update(data_dir: Path, *, run_id: str, project_id: str) -> None:
    artifact_dir = data_dir / "artifacts" / run_id
    artifact_dir.mkdir(parents=True, exist_ok=True)
    payload = {
        "artifact_type": "project_memory_update",
        "artifact_version": "1.0",
        "project_memory_schema_version": "project_memory.v1",
        "run_id": run_id,
        "workflow_id": "h2.manager.v1",
        "project_id": project_id,
        "generated_at": "2026-05-04T12:00:00+00:00",
        "created_count": 1,
        "updated_count": 0,
        "skipped_count": 0,
        "applied_entries": [],
    }
    (artifact_dir / "project_memory_update.json").write_text(json.dumps(payload), encoding="utf-8")


if __name__ == "__main__":
    unittest.main()
