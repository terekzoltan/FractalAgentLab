from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.evals.h1_memory_materiality import run_h2_l_h1_memory_materiality
from fractal_agent_lab.memory import JSONSessionMemoryStore, SessionMemory
from scripts.run_h2_l_h1_memory_materiality import is_structural_ready


class H1MemoryMaterialityTests(unittest.TestCase):
    def test_manager_scope_structural_ready_with_seeded_context(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-h2-l-") as tmp_dir:
            report = run_h2_l_h1_memory_materiality(
                input_payload={"idea": "session memory test"},
                session_memory_payload={"sticky": "focus on founder interviews"},
                session_id="thread-h2-l-1",
                provider="mock",
                runtime_config_path="configs/runtime.example.yaml",
                providers_config_path="configs/providers.example.yaml",
                model_policy_config_path="configs/model_policy.example.yaml",
                data_dir=Path(tmp_dir),
                include_single=False,
                include_handoff=False,
            )

        self.assertTrue(is_structural_ready(report))
        summary = report["summary"]
        self.assertEqual(1, summary["pair_count"])
        self.assertTrue(summary["all_seeded_branches_loaded_session_context"])
        self.assertIn(summary["recommendation"], {"encouraging_followup", "needs_more_evidence"})
        pair = report["pairs"][0]
        self.assertFalse(pair["without_memory"]["session_memory_loaded"])
        self.assertTrue(pair["with_memory"]["session_memory_loaded"])
        self.assertEqual([], pair["without_memory"]["session_memory_context_keys"])
        self.assertEqual(["sticky"], pair["with_memory"]["session_memory_context_keys"])
        self.assertIn("materiality_signal", summary)

    def test_optional_variants_are_additive_not_required(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-h2-l-") as tmp_dir:
            report = run_h2_l_h1_memory_materiality(
                input_payload={"idea": "optional variants"},
                session_memory_payload={"sticky": "remember assumptions"},
                session_id="thread-h2-l-2",
                provider="mock",
                runtime_config_path="configs/runtime.example.yaml",
                providers_config_path="configs/providers.example.yaml",
                model_policy_config_path="configs/model_policy.example.yaml",
                data_dir=Path(tmp_dir),
                include_single=True,
                include_handoff=False,
            )

        self.assertTrue(is_structural_ready(report))
        self.assertEqual(2, report["summary"]["pair_count"])

    def test_existing_session_state_is_restored_after_eval(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-h2-l-") as tmp_dir:
            store = JSONSessionMemoryStore(data_dir=tmp_dir)
            store.save_session(
                SessionMemory(
                    session_id="thread-h2-l-restore",
                    memory={"sticky": "original-state"},
                ),
            )

            report = run_h2_l_h1_memory_materiality(
                input_payload={"idea": "restore state"},
                session_memory_payload={"sticky": "temporary-seed"},
                session_id="thread-h2-l-restore",
                provider="mock",
                runtime_config_path="configs/runtime.example.yaml",
                providers_config_path="configs/providers.example.yaml",
                model_policy_config_path="configs/model_policy.example.yaml",
                data_dir=Path(tmp_dir),
            )

            restored = store.load_session(session_id="thread-h2-l-restore")

        self.assertTrue(is_structural_ready(report))
        self.assertIsNotNone(restored)
        assert restored is not None
        self.assertEqual({"sticky": "original-state"}, restored.memory)

    def test_legacy_session_path_is_cleared_for_baseline_and_restored(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-h2-l-") as tmp_dir:
            store = JSONSessionMemoryStore(data_dir=tmp_dir)
            legacy_path = store.root_dir / "sessions" / "thread_7.json"
            legacy_path.parent.mkdir(parents=True, exist_ok=True)
            legacy_path.write_text(
                json.dumps(
                    {
                        "session_id": "thread/7",
                        "memory": {"sticky": "legacy-state"},
                        "schema_version": "session_memory.v1",
                    },
                    ensure_ascii=True,
                ),
                encoding="utf-8",
            )

            report = run_h2_l_h1_memory_materiality(
                input_payload={"idea": "legacy state"},
                session_memory_payload={"sticky": "seeded-state"},
                session_id="thread/7",
                provider="mock",
                runtime_config_path="configs/runtime.example.yaml",
                providers_config_path="configs/providers.example.yaml",
                model_policy_config_path="configs/model_policy.example.yaml",
                data_dir=Path(tmp_dir),
            )

            restored = store.load_session(session_id="thread/7")

        pair = report["pairs"][0]
        self.assertFalse(pair["without_memory"]["session_memory_loaded"])
        self.assertTrue(pair["with_memory"]["session_memory_loaded"])
        self.assertIsNotNone(restored)
        assert restored is not None
        self.assertEqual({"sticky": "legacy-state"}, restored.memory)

    def test_empty_session_id_raises_value_error(self) -> None:
        with self.assertRaises(ValueError):
            _ = run_h2_l_h1_memory_materiality(
                input_payload={"idea": "x"},
                session_memory_payload={"sticky": "x"},
                session_id="",
            )

    def test_empty_session_memory_payload_raises_value_error(self) -> None:
        with self.assertRaises(ValueError):
            _ = run_h2_l_h1_memory_materiality(
                input_payload={"idea": "x"},
                session_memory_payload={},
                session_id="thread-h2-l-empty-seed",
            )

    def test_real_provider_override_is_rejected_in_wave3_scope(self) -> None:
        with self.assertRaises(ValueError):
            _ = run_h2_l_h1_memory_materiality(
                input_payload={"idea": "x"},
                session_memory_payload={"sticky": "x"},
                session_id="thread-h2-l-openrouter",
                provider="openrouter",
            )


if __name__ == "__main__":
    unittest.main()
