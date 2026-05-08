from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.tracing import (
    wave6_evidence_root_dir_path,
    wave6_ledger_artifact_path,
    wave6_loop_dir_path,
    wave6_loops_dir_path,
    wave6_packet_artifact_path,
    wave6_packet_dir_path,
)


class Wave6EvidenceLayoutTests(unittest.TestCase):
    def test_derives_private_wave6_evidence_paths(self) -> None:
        data_dir = Path("data")

        self.assertEqual(Path("data/evidence/wave6"), wave6_evidence_root_dir_path(data_dir=data_dir))
        self.assertEqual(Path("data/evidence/wave6/loops"), wave6_loops_dir_path(data_dir=data_dir))
        self.assertEqual(
            Path("data/evidence/wave6/loops/loop-1"),
            wave6_loop_dir_path(loop_id="loop-1", data_dir=data_dir),
        )
        self.assertEqual(
            Path("data/evidence/wave6/loops/loop-1/packets"),
            wave6_packet_dir_path(loop_id="loop-1", data_dir=data_dir),
        )
        self.assertEqual(
            Path("data/evidence/wave6/loops/loop-1/packets/packet-1.json"),
            wave6_packet_artifact_path(loop_id="loop-1", packet_id="packet-1", data_dir=data_dir),
        )
        self.assertEqual(
            Path("data/evidence/wave6/loops/loop-1/ledger.json"),
            wave6_ledger_artifact_path(loop_id="loop-1", data_dir=data_dir),
        )

    def test_paths_support_custom_data_dir_with_spaces(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal wave6 evidence ") as tmp_dir:
            base = Path(tmp_dir)

            self.assertEqual(
                base / "evidence" / "wave6" / "loops" / "loop-a" / "packets" / "packet-a.json",
                wave6_packet_artifact_path(loop_id="loop-a", packet_id="packet-a", data_dir=base),
            )
            self.assertEqual(
                base / "evidence" / "wave6" / "loops" / "loop-a" / "ledger.json",
                wave6_ledger_artifact_path(loop_id="loop-a", data_dir=base),
            )

    def test_wave6_evidence_paths_do_not_use_run_artifacts_sidecar_root(self) -> None:
        packet_path = wave6_packet_artifact_path(loop_id="loop-1", packet_id="packet-1", data_dir="data")
        ledger_path = wave6_ledger_artifact_path(loop_id="loop-1", data_dir="data")

        self.assertNotIn("data/artifacts", packet_path.as_posix())
        self.assertNotIn("data/artifacts", ledger_path.as_posix())
        self.assertIn("data/evidence/wave6", packet_path.as_posix())
        self.assertIn("data/evidence/wave6", ledger_path.as_posix())

    def test_loop_path_helpers_reject_unsafe_loop_ids(self) -> None:
        for loop_id in (
            "../x",
            "/",
            "\\",
            "x/child",
            "x\\child",
            ".",
            "..",
            " loop-1 ",
            "CON",
            "PRN",
            "AUX",
            "NUL",
            "COM1",
            "LPT1",
        ):
            with self.subTest(loop_id=loop_id):
                with self.assertRaises(ValueError):
                    _ = wave6_loop_dir_path(loop_id=loop_id, data_dir="data")
                with self.assertRaises(ValueError):
                    _ = wave6_packet_dir_path(loop_id=loop_id, data_dir="data")
                with self.assertRaises(ValueError):
                    _ = wave6_ledger_artifact_path(loop_id=loop_id, data_dir="data")

    def test_packet_path_helper_rejects_unsafe_packet_ids(self) -> None:
        for packet_id in (
            "../ledger",
            "/",
            "\\",
            "x/child",
            "x\\child",
            ".",
            "..",
            " packet-1 ",
            "CON",
            "PRN",
            "AUX",
            "NUL",
            "COM1",
            "LPT1",
        ):
            with self.subTest(packet_id=packet_id):
                with self.assertRaises(ValueError):
                    _ = wave6_packet_artifact_path(loop_id="loop-1", packet_id=packet_id, data_dir="data")

    def test_packet_path_helper_rejects_reserved_ledger_packet_name(self) -> None:
        for packet_id in ("ledger", "LEDGER"):
            with self.subTest(packet_id=packet_id):
                with self.assertRaises(ValueError):
                    _ = wave6_packet_artifact_path(loop_id="loop-1", packet_id=packet_id, data_dir="data")


if __name__ == "__main__":
    unittest.main()
