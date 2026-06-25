from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from fractal_agent_lab.integrations.router_fal_sync import (
    CHECKPOINT_SYNC_ARTIFACT_SCHEMA_VERSION,
    SYNC_REGISTRY_SCHEMA_VERSION,
    parse_checkpoint_block,
    reconcile_loop,
    sync_checkpoint,
)


class RouterFalSyncTests(unittest.TestCase):
    def test_parse_checkpoint_block_extracts_lists_and_findings(self) -> None:
        text = """
before body
=== FAL CHECKPOINT START ===
CHECKPOINT_STAGE: meta_plan_review_done
TARGET: RF-STATUS-SYNC-01
ORIGIN_SESSION: track-metaops
DECISION: greenlit
SUMMARY: Wave 0 status sync accepted.
NEXT_ACTION: Proceed to /terv-review-utan.
ACCEPTED_SCOPE_SUMMARY: Docs-only sync.
ARTIFACT_REFS:
- docs/plans/Combined-Execution-Sequencing-Plan.md
LEARNING_CANDIDATE_REFS:
- lc-1|doc_cleanup_candidate|proposed|artifacts/run/review_findings_ledger.json#f1
REVIEW_FINDINGS:
- P2-F1|medium|docs_status_drift|true_positive|Wave 0 status wording drift fixed.
=== FAL CHECKPOINT END ===
after body
"""

        parsed = parse_checkpoint_block(text)

        self.assertEqual("meta_plan_review_done", parsed.checkpoint_stage)
        self.assertEqual("RF-STATUS-SYNC-01", parsed.target)
        self.assertEqual("track-metaops", parsed.origin_session)
        self.assertEqual("greenlit", parsed.decision)
        self.assertEqual("Wave 0 status sync accepted.", parsed.summary)
        self.assertEqual(["docs/plans/Combined-Execution-Sequencing-Plan.md"], parsed.artifact_refs)
        assert parsed.learning_candidate_refs is not None
        self.assertEqual("lc-1", parsed.learning_candidate_refs[0].candidate_id)
        assert parsed.review_findings is not None
        self.assertEqual("P2-F1", parsed.review_findings[0].finding_id)
        self.assertEqual("true_positive", parsed.review_findings[0].human_label)

    def test_sync_checkpoint_writes_sidecars_registry_and_active_context(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-router-sync-") as fal_tmp_dir, tempfile.TemporaryDirectory(prefix="ringfall-target-") as target_tmp_dir:
            target_repo = Path(target_tmp_dir)
            artifact_dir = target_repo / ".opencode-router" / "artifacts"
            artifact_dir.mkdir(parents=True)
            source_path = artifact_dir / "latest-track-metaops-20260613.md"
            source_path.write_text(
                """
=== FAL CHECKPOINT START ===
CHECKPOINT_STAGE: meta_plan_review_done
TARGET: RF-STATUS-SYNC-01
ORIGIN_SESSION: track-metaops
DECISION: greenlit
SUMMARY: Wave 0 status sync accepted.
NEXT_ACTION: Proceed to /terv-review-utan.
ACCEPTED_SCOPE_SUMMARY: Docs-only source-of-truth sync.
ARTIFACT_REFS:
- docs/plans/Combined-Execution-Sequencing-Plan.md
REVIEW_FINDINGS:
- P2-F1|medium|docs_status_drift|true_positive|Wave 0 status wording drift fixed.
=== FAL CHECKPOINT END ===

Detailed body after marker.
""".strip()
                + "\n",
                encoding="utf-8",
            )

            result = sync_checkpoint(
                target_repo_path=target_repo,
                project_id="ringfall",
                project_name="RingFall",
                source_session="track-metaops",
                stage="meta_plan_review_done",
                target="RF-STATUS-SYNC-01",
                source_path=source_path,
                data_dir=fal_tmp_dir,
            )

            artifact_root = Path(fal_tmp_dir) / "artifacts" / result.run_id
            self.assertTrue(result.synced)
            self.assertTrue((artifact_root / "opencode_loop_summary.json").exists())
            self.assertTrue((artifact_root / "workflow_metrics.json").exists())
            self.assertTrue((artifact_root / "review_findings_ledger.json").exists())
            self.assertTrue((artifact_root / "context_digest.json").exists())
            checkpoint_payload = json.loads((artifact_root / "fal_checkpoint_sync.json").read_text(encoding="utf-8"))
            self.assertEqual(CHECKPOINT_SYNC_ARTIFACT_SCHEMA_VERSION, checkpoint_payload["schema_version"])

            registry_path = target_repo / ".opencode-router" / "fal-sync-registry.json"
            registry = json.loads(registry_path.read_text(encoding="utf-8"))
            self.assertEqual(SYNC_REGISTRY_SCHEMA_VERSION, registry["schema_version"])
            self.assertEqual(1, len(registry["entries"]))

            active_context_md = target_repo / ".fal" / "ACTIVE_CONTEXT.md"
            active_context_json = target_repo / ".fal" / "ACTIVE_CONTEXT.json"
            self.assertTrue(active_context_md.exists())
            self.assertTrue(active_context_json.exists())
            self.assertIn("RF-STATUS-SYNC-01", active_context_md.read_text(encoding="utf-8"))

    def test_reconcile_loop_is_idempotent_via_registry(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-router-reconcile-") as fal_tmp_dir, tempfile.TemporaryDirectory(prefix="ringfall-target-") as target_tmp_dir:
            target_repo = Path(target_tmp_dir)
            artifact_dir = target_repo / ".opencode-router" / "artifacts"
            processed_dir = target_repo / ".opencode-router" / "processed"
            artifact_dir.mkdir(parents=True)
            processed_dir.mkdir(parents=True)
            source_path = artifact_dir / "latest-meta-20260613.md"
            source_path.write_text(
                """
=== FAL CHECKPOINT START ===
CHECKPOINT_STAGE: step_review_done
TARGET: RF-STATUS-SYNC-01
ORIGIN_SESSION: meta
DECISION: pass
SUMMARY: Step review passed.
NEXT_ACTION: Close loop.
ACCEPTED_SCOPE_SUMMARY: Docs-only sync accepted.
=== FAL CHECKPOINT END ===
""".strip()
                + "\n",
                encoding="utf-8",
            )
            packet_path = processed_dir / "20260613-000001-latest-meta-step_review_done.json"
            packet_path.write_text(
                json.dumps(
                    {
                        "stage": "step_review_done",
                        "target": "RF-STATUS-SYNC-01",
                        "from": "meta",
                        "to": "track-metaops",
                        "risk": "medium",
                        "summary": "Meta final step review to Track MetaOps",
                        "body_path": ".opencode-router/artifacts/latest-meta-20260613.md",
                    },
                    indent=2,
                )
                + "\n",
                encoding="utf-8",
            )

            first = reconcile_loop(target_repo_path=target_repo, project_id="ringfall", data_dir=fal_tmp_dir)
            second = reconcile_loop(target_repo_path=target_repo, project_id="ringfall", data_dir=fal_tmp_dir)

            self.assertEqual(1, first.synced_count)
            self.assertEqual(1, second.skipped_count)
            self.assertEqual("already_synced", second.results[0].reason)

    def test_sync_checkpoint_preserves_review_fix_done_stage(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-router-sync-") as fal_tmp_dir, tempfile.TemporaryDirectory(prefix="ringfall-target-") as target_tmp_dir:
            target_repo = Path(target_tmp_dir)
            run_dir = target_repo / ".opencode-router" / "step-review-runs" / "fix-cycle-1"
            run_dir.mkdir(parents=True)
            source_path = run_dir / "05-meta-final-synthesis.md"
            source_path.write_text(
                """
=== FAL CHECKPOINT START ===
CHECKPOINT_STAGE: review_fix_done
TARGET: RF-REVIEW-FIX-01
ORIGIN_SESSION: meta
DECISION: pass
SUMMARY: Review-fix cycle accepted.
NEXT_ACTION: Proceed to closeout.
ACCEPTED_SCOPE_SUMMARY: Review-fix patch accepted.
=== FAL CHECKPOINT END ===
""".strip()
                + "\n",
                encoding="utf-8",
            )

            result = sync_checkpoint(
                target_repo_path=target_repo,
                project_id="ringfall",
                project_name="RingFall",
                source_session="meta",
                stage="review_fix_done",
                target="RF-REVIEW-FIX-01",
                source_path=source_path,
                data_dir=fal_tmp_dir,
            )

            artifact_root = Path(fal_tmp_dir) / "artifacts" / result.run_id
            checkpoint_payload = json.loads((artifact_root / "fal_checkpoint_sync.json").read_text(encoding="utf-8"))
            synthesis_payload = json.loads((artifact_root / "review_synthesis.json").read_text(encoding="utf-8"))
            self.assertEqual("review_fix_done", checkpoint_payload["checkpoint_stage"])
            self.assertIn("review_fix", synthesis_payload)
            self.assertNotIn("step_review", synthesis_payload)


if __name__ == "__main__":
    unittest.main()
