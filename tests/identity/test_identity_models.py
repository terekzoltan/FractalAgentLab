from __future__ import annotations

import unittest

from fractal_agent_lab.identity.models import IdentityProfile, IdentitySnapshot


class IdentityProfileTests(unittest.TestCase):
    def test_profile_roundtrip_preserves_fields(self) -> None:
        profile = IdentityProfile(
            agent_id="h1_planner_agent",
            profile_version=0,
            vector_version="identity.vector.v0",
            baseline_ref="agent://planner/default",
            caution=0.62,
            initiative=0.47,
            delegation=0.51,
            coherence=0.74,
            reflectiveness=0.68,
            update_count=3,
            last_updated_at="2026-04-03T09:30:00+00:00",
            last_run_id="run-123",
            metadata={"source": "test"},
        )

        restored = IdentityProfile.from_dict(profile.to_dict())

        self.assertEqual(profile.agent_id, restored.agent_id)
        self.assertEqual(profile.profile_version, restored.profile_version)
        self.assertEqual(profile.vector_version, restored.vector_version)
        self.assertEqual(profile.baseline_ref, restored.baseline_ref)
        self.assertEqual(profile.update_count, restored.update_count)
        self.assertEqual(profile.last_updated_at, restored.last_updated_at)
        self.assertEqual(profile.last_run_id, restored.last_run_id)
        self.assertEqual(profile.metadata, restored.metadata)

    def test_profile_clamps_dimensions_to_unit_interval(self) -> None:
        profile = IdentityProfile(
            agent_id="h1_critic_agent",
            caution=4.0,
            initiative=-5.0,
            delegation=1.2,
            coherence=-0.1,
            reflectiveness=0.8,
        )

        self.assertEqual(1.0, profile.caution)
        self.assertEqual(0.0, profile.initiative)
        self.assertEqual(1.0, profile.delegation)
        self.assertEqual(0.0, profile.coherence)
        self.assertEqual(0.8, profile.reflectiveness)

    def test_profile_rejects_negative_update_count(self) -> None:
        with self.assertRaises(ValueError):
            IdentityProfile(agent_id="h1_intake_agent", update_count=-1)


class IdentitySnapshotTests(unittest.TestCase):
    def test_snapshot_roundtrip(self) -> None:
        profile = IdentityProfile(agent_id="h1_synthesizer_agent")
        snapshot = IdentitySnapshot.from_profile(
            profile=profile,
            run_id="run-xyz",
            reason="post_run_capture",
            captured_at="2026-04-03T10:00:00+00:00",
        )

        restored = IdentitySnapshot.from_dict(snapshot.to_dict())
        self.assertEqual("h1_synthesizer_agent", restored.agent_id)
        self.assertEqual("run-xyz", restored.run_id)
        self.assertEqual("post_run_capture", restored.reason)
        self.assertEqual("identity.snapshot.v0", restored.schema_version)
        self.assertEqual("h1_synthesizer_agent", restored.profile.agent_id)

    def test_snapshot_rejects_agent_mismatch(self) -> None:
        with self.assertRaises(ValueError):
            IdentitySnapshot(
                agent_id="h1_planner_agent",
                profile=IdentityProfile(agent_id="h1_critic_agent"),
                captured_at="2026-04-03T10:00:00+00:00",
            )


if __name__ == "__main__":
    unittest.main()
