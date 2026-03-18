from __future__ import annotations

import unittest

from fractal_agent_lab.core.contracts import WorkflowExecutionMode
from fractal_agent_lab.workflows import (
    H1_SINGLE_AGENT_ID,
    H1_SINGLE_STEP_ID,
    H1_SINGLE_WORKFLOW_ID,
    build_h1_single_workflow_spec,
)


class H1SingleWorkflowSpecTests(unittest.TestCase):
    def test_h1_single_workflow_is_single_step_baseline_contract(self) -> None:
        workflow = build_h1_single_workflow_spec()

        self.assertEqual(H1_SINGLE_WORKFLOW_ID, workflow.workflow_id)
        self.assertEqual(WorkflowExecutionMode.LINEAR, workflow.execution_mode)
        self.assertEqual("1.0.0", workflow.version)
        self.assertEqual("h1.input.v1", workflow.input_schema_ref)
        self.assertEqual("h1.single.output.v1", workflow.output_schema_ref)
        self.assertIsNone(workflow.manager_spec)

        self.assertEqual(1, len(workflow.steps))
        step = workflow.steps[0]
        self.assertEqual(H1_SINGLE_STEP_ID, step.step_id)
        self.assertEqual(H1_SINGLE_AGENT_ID, step.agent_id)

        self.assertEqual("single_agent_baseline", workflow.metadata.get("variant"))
        self.assertEqual("h1.manager.v1", workflow.metadata.get("baseline_for"))


if __name__ == "__main__":
    unittest.main()
