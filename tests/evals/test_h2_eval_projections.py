from __future__ import annotations

import unittest

from fractal_agent_lab.evals.h2_eval_projections import extract_h2_comparable_output


class H2EvalProjectionsTests(unittest.TestCase):
    def test_extracts_complete_h2_comparable_output_with_canonical_order(self) -> None:
        output_payload = {
            "final_output": {
                "project_summary": "Build a decomposition workflow",
                "tracks": ["core", "workflow"],
                "modules": ["runtime", "agents"],
                "phases": ["schema", "pack", "template", "smoke"],
                "dependency_order": ["schema", "pack", "template", "smoke"],
                "implementation_waves": [{"wave": "W3-S1", "focus": ["R3-A", "R3-B"]}],
                "recommended_starting_slice": "stabilize_template_shape",
                "risk_zones": ["scope_sprawl"],
                "open_questions": ["Do we need more real-provider evidence?"],
            },
        }

        comparable = extract_h2_comparable_output(output_payload)
        self.assertTrue(comparable["present"])
        self.assertTrue(comparable["complete"])
        self.assertEqual([], comparable["missing_keys"])
        self.assertTrue(comparable["key_order_matches"])
        self.assertTrue(comparable["implementation_waves_valid"])
        self.assertTrue(comparable["recommended_starting_slice_present"])

    def test_detects_missing_h2_keys(self) -> None:
        output_payload = {
            "final_output": {
                "project_summary": "Build a decomposition workflow",
            },
        }

        comparable = extract_h2_comparable_output(output_payload)
        self.assertTrue(comparable["present"])
        self.assertFalse(comparable["complete"])
        self.assertIn("tracks", comparable["missing_keys"])

    def test_detects_noncanonical_key_order(self) -> None:
        output_payload = {
            "final_output": {
                "tracks": ["core"],
                "project_summary": "Build a decomposition workflow",
                "modules": ["runtime"],
                "phases": ["schema"],
                "dependency_order": ["schema"],
                "implementation_waves": [{"wave": "W3-S1", "focus": ["R3-A"]}],
                "recommended_starting_slice": "stabilize_template_shape",
                "risk_zones": ["scope_sprawl"],
                "open_questions": ["Q1"],
            },
        }

        comparable = extract_h2_comparable_output(output_payload)
        self.assertTrue(comparable["complete"])
        self.assertFalse(comparable["key_order_matches"])

    def test_detects_invalid_implementation_waves_and_recommended_slice(self) -> None:
        output_payload = {
            "final_output": {
                "project_summary": "Build a decomposition workflow",
                "tracks": ["core"],
                "modules": ["runtime"],
                "phases": ["schema"],
                "dependency_order": ["schema"],
                "implementation_waves": ["wave-1"],
                "recommended_starting_slice": "  ",
                "risk_zones": ["scope_sprawl"],
                "open_questions": ["Q1"],
            },
        }

        comparable = extract_h2_comparable_output(output_payload)
        self.assertFalse(comparable["implementation_waves_valid"])
        self.assertFalse(comparable["recommended_starting_slice_present"])


if __name__ == "__main__":
    unittest.main()
