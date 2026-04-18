from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.tools.h4_packet_compiler import (
    compile_wave_start_packet_from_context_report,
    render_wave_start_packet_markdown,
    write_wave_start_packet_sidecars_from_context_report,
)


class H4PacketCompilerTests(unittest.TestCase):
    def test_compile_wave_start_packet_from_context_report(self) -> None:
        packet = compile_wave_start_packet_from_context_report(
            context_report=_sample_context_report(),
            source_ref="data/artifacts/run-1/context_report.json",
        )

        self.assertEqual("wave_start", packet["packet_type"])
        self.assertEqual("1.0", packet["packet_version"])
        self.assertEqual("track_d.helper", packet["role"])
        self.assertEqual("actual_fal_workflow_run", packet["execution_mode"])
        self.assertEqual("Track D", packet["track"])
        self.assertEqual("CV1-C", packet["step_ref"])
        self.assertEqual("h4.wave_start.v1", packet["upstream"]["workflow_variant"])
        self.assertEqual("CV1 Step 1 / CV1-A", packet["frontier_ref"])
        self.assertNotIn("completed_previous_steps", packet["content"])

    def test_compile_wave_start_packet_fails_on_missing_required_field(self) -> None:
        context_report = _sample_context_report()
        del context_report["changed_surfaces"]

        with self.assertRaises(ValueError):
            _ = compile_wave_start_packet_from_context_report(
                context_report=context_report,
                source_ref="data/artifacts/run-1/context_report.json",
            )

    def test_render_wave_start_packet_markdown_contains_expected_sections(self) -> None:
        packet = compile_wave_start_packet_from_context_report(
            context_report=_sample_context_report(),
            source_ref="data/artifacts/run-1/context_report.json",
        )

        rendered = render_wave_start_packet_markdown(packet)

        self.assertIn("# Packet: wave_start", rendered)
        self.assertIn("## Wave Start", rendered)
        self.assertIn("## Changed Surfaces", rendered)
        self.assertIn("## Non-Goals", rendered)

    def test_write_packet_sidecars_from_context_report(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-h4-packet-") as tmp_dir:
            data_dir = Path(tmp_dir)
            run_id = "run-sidecar"
            artifact_dir = data_dir / "artifacts" / run_id
            artifact_dir.mkdir(parents=True, exist_ok=True)

            context_report_path = artifact_dir / "context_report.json"
            context_report_path.write_text(
                json.dumps(_sample_context_report(run_id=run_id), ensure_ascii=True),
                encoding="utf-8",
            )

            json_path, markdown_path = write_wave_start_packet_sidecars_from_context_report(
                context_report_path=context_report_path,
                run_id=run_id,
                data_dir=data_dir,
            )

            self.assertEqual(artifact_dir / "packets" / "wave_start.packet.json", json_path)
            self.assertEqual(artifact_dir / "packets" / "wave_start.packet.md", markdown_path)
            self.assertTrue(json_path.exists())
            self.assertTrue(markdown_path.exists())

    def test_write_packet_sidecars_fails_on_run_id_mismatch(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-h4-packet-") as tmp_dir:
            data_dir = Path(tmp_dir)
            artifact_dir = data_dir / "artifacts" / "run-a"
            artifact_dir.mkdir(parents=True, exist_ok=True)

            context_report_path = artifact_dir / "context_report.json"
            context_report_path.write_text(
                json.dumps(_sample_context_report(run_id="run-a"), ensure_ascii=True),
                encoding="utf-8",
            )

            with self.assertRaises(ValueError):
                _ = write_wave_start_packet_sidecars_from_context_report(
                    context_report_path=context_report_path,
                    run_id="run-b",
                    data_dir=data_dir,
                )


def _sample_context_report(*, run_id: str = "run-1") -> dict[str, object]:
    return {
        "artifact_type": "context_report",
        "artifact_version": "1.0",
        "run_id": run_id,
        "workflow_id": "h4",
        "workflow_variant": "h4.wave_start.v1",
        "generated_at": "2026-04-18T12:00:00+00:00",
        "repo_summary": "Summary",
        "changed_surfaces": ["ops", "src/fractal_agent_lab/workflows"],
        "relevant_docs": ["ops/Combined-Execution-Sequencing-Plan.md"],
        "relevant_code_areas": ["hypothesis: src/fractal_agent_lab/workflows/h4.py"],
        "likely_touched_files": ["hypothesis: src/fractal_agent_lab/cli/app.py"],
        "assumptions": ["CV1-A is complete before CV1-C."],
        "unknowns": ["Whether packet markdown should include extra sections."],
        "recent_change_notes": ["CV1-A landed context_report sidecar writing."],
        "current_frontier": "CV1 Step 1 / CV1-A",
        "blockers_or_holds": ["CV1-B remains pending."],
        "shared_zone_cautions": ["Keep cli/app.py additive."],
        "sequencing_risks": ["Do not widen into queue/session-bus scope."],
        "non_goals": ["No packet bus.", "No queue."],
        "next_recommended_action": "Proceed with CV1-B and CV1-C in parallel.",
    }


if __name__ == "__main__":
    unittest.main()
