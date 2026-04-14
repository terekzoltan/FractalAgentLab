from __future__ import annotations

import json
import tempfile
import unittest

from fractal_agent_lab.adapters import build_step_runner
from fractal_agent_lab.adapters.base import AdapterStepRequest, AdapterStepResult
from fractal_agent_lab.core.contracts import AgentKind, AgentSpec, WorkflowExecutionMode, WorkflowSpec, WorkflowStepSpec
from fractal_agent_lab.core.models import RunStatus
from fractal_agent_lab.memory import (
    JSONProjectMemoryStore,
    ProjectMemory,
    ProjectMemoryEntry,
    load_project_memory_context,
)
from fractal_agent_lab.runtime import WorkflowExecutor


class ProjectMemoryTests(unittest.TestCase):
    def test_json_project_store_roundtrip(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-project-memory-") as tmp_dir:
            store = JSONProjectMemoryStore(data_dir=tmp_dir)
            project_memory = ProjectMemory(
                project_id="repo-main",
                stable_decisions=[
                    ProjectMemoryEntry(
                        entry_type="stable_decision",
                        entry_subtype="recommended_starting_slice",
                        content="stabilize_h2_template_contract",
                        workflow_id="h2.manager.v1",
                        source_path="output_payload.final_output.recommended_starting_slice",
                        first_seen_run_id="run-1",
                        last_seen_run_id="run-1",
                        last_updated_at="2026-04-14T00:00:00+00:00",
                    ),
                ],
            )

            saved_path = store.save_project(project_memory)
            loaded = store.load_project(project_id="repo-main")

            self.assertTrue(saved_path.exists())
            self.assertIsNotNone(loaded)
            assert loaded is not None
            self.assertEqual("repo-main", loaded.project_id)
            self.assertEqual(1, len(loaded.stable_decisions))
            self.assertEqual(
                "stabilize_h2_template_contract",
                loaded.stable_decisions[0].content,
            )

    def test_load_project_memory_context_with_existing_record(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-project-memory-") as tmp_dir:
            store = JSONProjectMemoryStore(data_dir=tmp_dir)
            store.save_project(
                ProjectMemory(
                    project_id="repo-a",
                    workflow_learnings=[
                        ProjectMemoryEntry(
                            entry_type="workflow_learning",
                            entry_subtype="merge_risk",
                            content="template-law regression",
                            workflow_id="h3.manager.v1",
                            source_path="output_payload.final_output.merge_risks[]",
                            first_seen_run_id="run-2",
                            last_seen_run_id="run-2",
                            last_updated_at="2026-04-14T01:00:00+00:00",
                        ),
                    ],
                ),
            )

            context = load_project_memory_context(
                input_payload={"project_id": "repo-a"},
                data_dir=tmp_dir,
            )

            self.assertEqual("repo-a", context.get("project_id"))
            self.assertIn("project_memory", context)
            project_memory = context.get("project_memory")
            assert isinstance(project_memory, dict)
            self.assertEqual("repo-a", project_memory.get("project_id"))

    def test_load_project_memory_context_without_project_id_returns_empty(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-project-memory-") as tmp_dir:
            context = load_project_memory_context(input_payload={"goal": "x"}, data_dir=tmp_dir)
            self.assertEqual({}, context)

    def test_load_project_memory_context_missing_record_returns_project_id_only(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-project-memory-") as tmp_dir:
            context = load_project_memory_context(input_payload={"project_id": "missing"}, data_dir=tmp_dir)
            self.assertEqual({"project_id": "missing"}, context)

    def test_load_project_memory_context_invalid_record_does_not_crash(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-project-memory-") as tmp_dir:
            store = JSONProjectMemoryStore(data_dir=tmp_dir)
            path = store.project_path(project_id="broken")
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("not-json", encoding="utf-8")

            context = load_project_memory_context(input_payload={"project_id": "broken"}, data_dir=tmp_dir)
            self.assertEqual({"project_id": "broken"}, context)

    def test_project_paths_are_distinct_for_special_character_ids(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-project-memory-") as tmp_dir:
            store = JSONProjectMemoryStore(data_dir=tmp_dir)
            paths = {
                store.project_path(project_id="repo/main").name,
                store.project_path(project_id="repo:main").name,
                store.project_path(project_id="repo_main").name,
            }
            self.assertEqual(3, len(paths))

    def test_load_project_supports_legacy_sanitized_filename(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-project-memory-") as tmp_dir:
            store = JSONProjectMemoryStore(data_dir=tmp_dir)
            legacy_path = store.root_dir / "projects" / "repo_main.json"
            legacy_path.parent.mkdir(parents=True, exist_ok=True)
            legacy_payload = {
                "project_id": "repo/main",
                "stable_decisions": [],
                "workflow_learnings": [],
                "prompt_observations": [],
                "schema_version": "project_memory.v1",
            }
            legacy_path.write_text(json.dumps(legacy_payload), encoding="utf-8")

            loaded = store.load_project(project_id="repo/main")
            self.assertIsNotNone(loaded)
            assert loaded is not None
            self.assertEqual("repo/main", loaded.project_id)

    def test_step_runner_context_passes_through_loaded_project_memory(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-project-memory-") as tmp_dir:
            store = JSONProjectMemoryStore(data_dir=tmp_dir)
            store.save_project(ProjectMemory(project_id="repo-a"))
            run_context = load_project_memory_context(
                input_payload={"project_id": "repo-a"},
                data_dir=tmp_dir,
            )

            probe = _ContextProbeAdapter()
            step_runner = build_step_runner(
                agent_specs_by_id={
                    "probe_agent": AgentSpec(
                        agent_id="probe_agent",
                        role="probe",
                        kind=AgentKind.MOCK,
                        model_policy_ref="specialist",
                        handoff_targets=[],
                        metadata={},
                    ),
                },
                providers_config={"default_provider": "mock"},
                model_policy_config={"tier_defaults": {"specialist": "gpt-4o-mini"}},
                adapters_by_provider={"mock": probe},
            )
            workflow = WorkflowSpec(
                workflow_id="project.memory.probe.v1",
                name="Project Memory Probe",
                steps=[WorkflowStepSpec(step_id="probe", agent_id="probe_agent")],
                execution_mode=WorkflowExecutionMode.LINEAR,
            )

            run_state = WorkflowExecutor(step_runner=step_runner).execute(
                workflow=workflow,
                input_payload={"project_id": "repo-a"},
                context=run_context,
            )

            self.assertEqual(RunStatus.SUCCEEDED, run_state.status)
            self.assertEqual("repo-a", probe.last_request_context.get("project_id"))
            self.assertIn("project_memory", probe.last_request_context)


class _ContextProbeAdapter:
    name = "probe"

    def __init__(self) -> None:
        self.last_request_context: dict[str, object] = {}

    def execute_step(self, request: AdapterStepRequest) -> AdapterStepResult:
        self.last_request_context = dict(request.context)
        return AdapterStepResult(
            provider="mock",
            model=request.model,
            output={"ok": True},
            raw={"probe": True},
        )


if __name__ == "__main__":
    unittest.main()
