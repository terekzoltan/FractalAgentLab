from __future__ import annotations

import unittest

from fractal_agent_lab.core.contracts import WorkflowExecutionMode
from fractal_agent_lab.workflows import (
    H1_HANDOFF_ENTRYPOINT_STEP_ID,
    H1_HANDOFF_STEP_IDS,
    H1_HANDOFF_WORKFLOW_ID,
    build_h1_handoff_workflow_spec,
)


class H1HandoffWorkflowSpecTests(unittest.TestCase):
    def test_h1_handoff_workflow_schema_shape_is_explicit(self) -> None:
        workflow = build_h1_handoff_workflow_spec()

        self.assertEqual(H1_HANDOFF_WORKFLOW_ID, workflow.workflow_id)
        self.assertEqual(WorkflowExecutionMode.HANDOFF, workflow.execution_mode)
        self.assertEqual(H1_HANDOFF_ENTRYPOINT_STEP_ID, workflow.entrypoint_step_id)
        self.assertEqual("h1.input.v1", workflow.input_schema_ref)
        self.assertEqual("h1.handoff.output.v1", workflow.output_schema_ref)

        self.assertIsNone(workflow.manager_spec)
        step_ids = [step.step_id for step in workflow.steps]
        self.assertEqual(list(H1_HANDOFF_STEP_IDS), step_ids)
        self.assertEqual(len(step_ids), len(set(step_ids)))
        self.assertEqual(len(workflow.agent_ids), len(set(workflow.agent_ids)))


if __name__ == "__main__":
    unittest.main()
