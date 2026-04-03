from __future__ import annotations

import json
import tempfile
import unittest

from fractal_agent_lab.adapters import build_step_runner
from fractal_agent_lab.adapters.base import AdapterStepRequest, AdapterStepResult
from fractal_agent_lab.core.contracts import (
    AgentKind,
    AgentSpec,
    WorkflowExecutionMode,
    WorkflowSpec,
    WorkflowStepSpec,
)
from fractal_agent_lab.core.models import RunStatus
from fractal_agent_lab.memory import (
    JSONSessionMemoryStore,
    SessionMemory,
    load_session_memory_context,
    write_session_memory_snapshot_artifact,
)
from fractal_agent_lab.runtime import WorkflowExecutor


class SessionMemoryTests(unittest.TestCase):
    def test_json_store_roundtrip(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-memory-") as tmp_dir:
            store = JSONSessionMemoryStore(data_dir=tmp_dir)
            memory = SessionMemory(
                session_id="session-123",
                memory={"last_summary": "keep founder scope narrow"},
                updated_at="2026-04-03T10:00:00+00:00",
            )

            saved_path = store.save_session(memory)
            loaded = store.load_session(session_id="session-123")

            self.assertTrue(saved_path.exists())
            self.assertIsNotNone(loaded)
            assert loaded is not None
            self.assertEqual("session-123", loaded.session_id)
            self.assertEqual("keep founder scope narrow", loaded.memory["last_summary"])

    def test_load_session_memory_context_with_existing_record(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-memory-") as tmp_dir:
            store = JSONSessionMemoryStore(data_dir=tmp_dir)
            store.save_session(
                SessionMemory(
                    session_id="thread-7",
                    memory={"open_questions": ["which founder segment?"]},
                ),
            )

            context = load_session_memory_context(
                input_payload={"idea": "x", "session_id": "thread-7"},
                data_dir=tmp_dir,
            )

            self.assertEqual("thread-7", context["session_id"])
            self.assertIn("session_memory", context)
            self.assertEqual("thread-7", context["session_memory"]["session_id"])

    def test_load_session_memory_context_without_session_id_returns_empty(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-memory-") as tmp_dir:
            context = load_session_memory_context(input_payload={"idea": "x"}, data_dir=tmp_dir)
            self.assertEqual({}, context)

    def test_load_session_memory_context_missing_record_returns_session_only(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-memory-") as tmp_dir:
            context = load_session_memory_context(
                input_payload={"session_id": "missing-session"},
                data_dir=tmp_dir,
            )

            self.assertEqual({"session_id": "missing-session"}, context)

    def test_load_session_memory_context_invalid_record_does_not_crash(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-memory-") as tmp_dir:
            store = JSONSessionMemoryStore(data_dir=tmp_dir)
            path = store.session_path(session_id="broken")
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text("not-json", encoding="utf-8")

            context = load_session_memory_context(
                input_payload={"session_id": "broken"},
                data_dir=tmp_dir,
            )

            self.assertEqual({"session_id": "broken"}, context)

    def test_step_runner_context_passes_through_loaded_session_memory(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-memory-") as tmp_dir:
            store = JSONSessionMemoryStore(data_dir=tmp_dir)
            store.save_session(
                SessionMemory(
                    session_id="continuity-1",
                    memory={"decision_notes": ["stay with manager path"]},
                ),
            )
            run_context = load_session_memory_context(
                input_payload={"session_id": "continuity-1"},
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
                workflow_id="memory.probe.v1",
                name="Memory Probe",
                steps=[WorkflowStepSpec(step_id="probe", agent_id="probe_agent")],
                execution_mode=WorkflowExecutionMode.LINEAR,
            )

            run_state = WorkflowExecutor(step_runner=step_runner).execute(
                workflow=workflow,
                input_payload={"session_id": "continuity-1"},
                context=run_context,
            )

            self.assertEqual(RunStatus.SUCCEEDED, run_state.status)
            self.assertEqual("continuity-1", probe.last_request_context["session_id"])
            self.assertIn("session_memory", probe.last_request_context)
            self.assertEqual(
                "continuity-1",
                probe.last_request_context["session_memory"]["session_id"],
            )

    def test_snapshot_artifact_is_optional_and_noncanonical(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-memory-") as tmp_dir:
            missing = write_session_memory_snapshot_artifact(
                run_id="run-1",
                workflow_id="h1.manager.v1",
                run_context={"session_id": "x"},
                data_dir=tmp_dir,
            )
            self.assertIsNone(missing)

            path = write_session_memory_snapshot_artifact(
                run_id="run-2",
                workflow_id="h1.manager.v1",
                run_context={
                    "session_id": "x",
                    "session_memory": {
                        "session_id": "x",
                        "memory": {"n": 1},
                        "updated_at": None,
                        "schema_version": "session_memory.v1",
                    },
                },
                data_dir=tmp_dir,
            )
            self.assertIsNotNone(path)
            assert path is not None
            self.assertTrue(path.exists())
            payload = json.loads(path.read_text(encoding="utf-8"))
            self.assertEqual("run-2", payload["run_id"])
            self.assertEqual("x", payload["session_id"])

    def test_session_paths_are_distinct_for_special_character_ids(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-memory-") as tmp_dir:
            store = JSONSessionMemoryStore(data_dir=tmp_dir)
            paths = {
                store.session_path(session_id="thread/7").name,
                store.session_path(session_id="thread:7").name,
                store.session_path(session_id="thread_7").name,
            }

            self.assertEqual(3, len(paths))

    def test_load_session_supports_legacy_sanitized_filename(self) -> None:
        with tempfile.TemporaryDirectory(prefix="fal-memory-") as tmp_dir:
            store = JSONSessionMemoryStore(data_dir=tmp_dir)
            legacy_path = store.root_dir / "sessions" / "thread_7.json"
            legacy_path.parent.mkdir(parents=True, exist_ok=True)
            legacy_path.write_text(
                '{"session_id": "thread/7", "memory": {}, "schema_version": "session_memory.v1"}',
                encoding="utf-8",
            )

            loaded = store.load_session(session_id="thread/7")

            self.assertIsNotNone(loaded)
            assert loaded is not None
            self.assertEqual("thread/7", loaded.session_id)


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
