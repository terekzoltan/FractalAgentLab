from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.identity import IdentityProfile, IdentitySnapshot, JSONIdentityStore


class JSONIdentityStoreTests(unittest.TestCase):
    def test_save_and_load_profile_roundtrip(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-identity-") as tmp_dir:
            store = JSONIdentityStore(data_dir=tmp_dir)
            profile = IdentityProfile(
                agent_id="h1_planner_agent",
                caution=0.66,
                update_count=2,
                last_run_id="run-2",
            )

            path = store.save_profile(profile)
            loaded = store.load_profile(agent_id="h1_planner_agent")

            self.assertTrue(path.exists())
            self.assertIsNotNone(loaded)
            assert loaded is not None
            self.assertEqual(profile.agent_id, loaded.agent_id)
            self.assertEqual(profile.caution, loaded.caution)
            self.assertEqual(profile.update_count, loaded.update_count)
            self.assertEqual(profile.last_run_id, loaded.last_run_id)

    def test_load_profile_returns_none_when_missing(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-identity-") as tmp_dir:
            store = JSONIdentityStore(data_dir=tmp_dir)
            loaded = store.load_profile(agent_id="missing-agent")
            self.assertIsNone(loaded)

    def test_list_agent_ids_reads_saved_profiles(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-identity-") as tmp_dir:
            store = JSONIdentityStore(data_dir=tmp_dir)
            store.save_profile(IdentityProfile(agent_id="h1_intake_agent"))
            store.save_profile(IdentityProfile(agent_id="h1_critic_agent"))

            self.assertEqual(
                ["h1_critic_agent", "h1_intake_agent"],
                sorted(store.list_agent_ids()),
            )

    def test_save_and_load_snapshots_roundtrip(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-identity-") as tmp_dir:
            store = JSONIdentityStore(data_dir=tmp_dir)
            profile = IdentityProfile(agent_id="h1_synthesizer_agent")
            snapshot = IdentitySnapshot.from_profile(
                profile=profile,
                run_id="run-77",
                reason="test",
                captured_at="2026-04-03T10:00:00+00:00",
            )

            snapshot_path = store.save_snapshot(snapshot)
            loaded = store.load_snapshots(agent_id="h1_synthesizer_agent")

            self.assertTrue(snapshot_path.exists())
            self.assertEqual(1, len(loaded))
            self.assertEqual("run-77", loaded[0].run_id)
            self.assertEqual("h1_synthesizer_agent", loaded[0].agent_id)

    def test_invalid_profile_json_raises_value_error(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-identity-") as tmp_dir:
            store = JSONIdentityStore(data_dir=tmp_dir)
            invalid_path = store.profile_path(agent_id="broken")
            invalid_path.parent.mkdir(parents=True, exist_ok=True)
            invalid_path.write_text("{not-valid-json", encoding="utf-8")

            with self.assertRaises(ValueError):
                _ = store.load_profile(agent_id="broken")

    def test_invalid_snapshot_line_raises_value_error(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-identity-") as tmp_dir:
            store = JSONIdentityStore(data_dir=tmp_dir)
            snapshot_path = store.snapshots_path(agent_id="broken")
            snapshot_path.parent.mkdir(parents=True, exist_ok=True)
            snapshot_path.write_text("not-json\n", encoding="utf-8")

            with self.assertRaises(ValueError):
                _ = store.load_snapshots(agent_id="broken")

    def test_store_uses_identity_subdir_under_data_dir(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-identity-") as tmp_dir:
            store = JSONIdentityStore(data_dir=tmp_dir)
            profile = IdentityProfile(agent_id="h1_intake_agent")
            path = store.save_profile(profile)

            expected_root = Path(tmp_dir) / "identity"
            self.assertTrue(path.is_relative_to(expected_root))

    def test_profile_paths_are_distinct_for_special_character_ids(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-identity-") as tmp_dir:
            store = JSONIdentityStore(data_dir=tmp_dir)
            paths = {
                store.profile_path(agent_id="agent/7").name,
                store.profile_path(agent_id="agent:7").name,
                store.profile_path(agent_id="agent_7").name,
            }

            self.assertEqual(3, len(paths))

    def test_load_profile_supports_legacy_sanitized_filename(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-identity-") as tmp_dir:
            store = JSONIdentityStore(data_dir=tmp_dir)
            legacy_path = Path(tmp_dir) / "identity" / "agent_7.json"
            legacy_path.parent.mkdir(parents=True, exist_ok=True)
            legacy_path.write_text(
                '{"agent_id": "agent/7", "vector_version": "identity.vector.v0"}',
                encoding="utf-8",
            )

            loaded = store.load_profile(agent_id="agent/7")

            self.assertIsNotNone(loaded)
            assert loaded is not None
            self.assertEqual("agent/7", loaded.agent_id)


if __name__ == "__main__":
    unittest.main()
