from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.cli.workflow_registry import list_workflow_ids
from scripts.build_u5_d_workflow_catalog import (
    SAFE_METADATA_KEYS,
    SCHEMA_VERSION,
    build_workflow_catalog,
    write_workflow_catalog,
)


class U5DWorkflowCatalogTests(unittest.TestCase):
    def test_builds_registry_derived_catalog(self) -> None:
        catalog = build_workflow_catalog()

        self.assertEqual(SCHEMA_VERSION, catalog["schema_version"])
        self.assertEqual(list_workflow_ids(), [entry["workflow_id"] for entry in catalog["workflows"]])
        self.assertEqual([], catalog["warnings"])

    def test_entries_include_required_workflow_fields(self) -> None:
        catalog = build_workflow_catalog()
        entry = next(entry for entry in catalog["workflows"] if entry["workflow_id"] == "h4.seq_next.v1")

        self.assertEqual("H4 Seq Next Planning Manager Baseline", entry["name"])
        self.assertEqual("manager", entry["execution_mode"])
        self.assertEqual("h4.seq_next.input.v1", entry["input_schema_ref"])
        self.assertEqual("h4.seq_next.output.v1", entry["output_schema_ref"])
        self.assertGreaterEqual(entry["step_count"], 1)
        self.assertTrue(entry["steps"])
        self.assertIn("step_id", entry["steps"][0])
        self.assertIn("agent_id", entry["steps"][0])

    def test_metadata_is_allowlisted(self) -> None:
        catalog = build_workflow_catalog()

        for entry in catalog["workflows"]:
            self.assertLessEqual(set(entry["metadata"]), set(SAFE_METADATA_KEYS))
        h1 = next(entry for entry in catalog["workflows"] if entry["workflow_id"] == "h1.manager.v1")
        self.assertEqual("H1", h1["metadata"]["hero_workflow"])
        self.assertNotIn("source", h1["metadata"])

    def test_write_workflow_catalog_creates_output_file(self) -> None:
        with tempfile.TemporaryDirectory() as temp_dir_raw:
            out_path = Path(temp_dir_raw) / "ui" / "public" / "generated" / "workflows.json"

            write_workflow_catalog(out_path=out_path)

            payload = json.loads(out_path.read_text(encoding="utf-8"))
            self.assertEqual(SCHEMA_VERSION, payload["schema_version"])


if __name__ == "__main__":
    unittest.main()
