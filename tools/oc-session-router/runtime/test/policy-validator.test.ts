import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { sha256, type StageName } from "../src/contracts.js";
import { evaluateOutputPolicy, type OutputBindingExpectation } from "../src/policy-validator.js";

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../fixtures");

function fixture(name: string): string {
  return readFileSync(path.join(fixtures, name), "utf8").replace(/\r\n/g, "\n").trim();
}

const reviewExpected: OutputBindingExpectation = {
  target: "FractalAgentLab",
  epic: "FAL-EXPLICIT-STAGE-ROUTER",
  lane: "Track D / TRACK / track-d",
  plan: "plan-fixture",
  plan_class: "EPIC_PLAN",
};

test("exact canonical output is accepted unchanged in STANDARD and STRICT", () => {
  const raw = fixture("output-plan-review.md");
  for (const mode of ["STANDARD", "STRICT"] as const) {
    const result = evaluateOutputPolicy({ mode, stage: "PLAN_REVIEW", raw, expected: reviewExpected });
    assert.equal(result.disposition, "ACCEPTED_EXACT");
    assert.deepEqual(result.warning_rules, []);
    assert.equal(result.input_sha256, sha256(raw));
    assert.equal(result.normalized_output_sha256, sha256(raw));
    assert.equal(result.parsed_output?.terminal, "GREEN");
  }
});

test("one uniquely bounded wrapped canonical envelope is STANDARD-only", () => {
  const canonical = fixture("output-plan-review.md");
  const raw = fixture("output-plan-review-wrapped.md");
  const standard = evaluateOutputPolicy({ mode: "STANDARD", stage: "PLAN_REVIEW", raw, expected: reviewExpected });
  assert.equal(standard.disposition, "ACCEPTED_NORMALIZED");
  assert.deepEqual(standard.warning_rules, ["UNIQUE_CANONICAL_ENVELOPE"]);
  assert.equal(standard.normalized_output, canonical);
  assert.equal(standard.normalized_output_sha256, sha256(canonical));
  assert.equal(standard.parsed_output?.terminal, "GREEN");

  const strict = evaluateOutputPolicy({ mode: "STRICT", stage: "PLAN_REVIEW", raw, expected: reviewExpected });
  assert.equal(strict.disposition, "BLOCKED_AMBIGUOUS");
  assert.equal(strict.parsed_output, undefined);
});

test("wrapper normalization never discards conflicting authority or verdict fields", () => {
  for (const name of [
    "output-plan-review-wrapped-authority-conflict.md",
    "output-plan-review-wrapped-verdict-conflict.md",
    "output-plan-review-wrapped-prose-authority-conflict.md",
    "output-plan-review-wrapped-prose-verdict-conflict.md",
  ] as const) {
    const raw = fixture(name);
    for (const mode of ["STANDARD", "STRICT"] as const) {
      const result = evaluateOutputPolicy({ mode, stage: "PLAN_REVIEW", raw, expected: reviewExpected });
      assert.equal(result.disposition, "BLOCKED_AMBIGUOUS", `${name} ${mode}`);
      assert.equal(result.parsed_output, undefined);
      assert.deepEqual(result.warning_rules, []);
    }
  }
});

test("finite non-authority defaults are recovered only in STANDARD", () => {
  const cases: readonly {
    stage: StageName;
    fixture: string;
    missingFixture?: string;
    removed: readonly string[];
    expected: OutputBindingExpectation;
  }[] = [
    { stage: "PLAN_REVIEW", fixture: "output-plan-review.md", missingFixture: "output-plan-review-missing-optional.md", removed: ["Non-blocking improvements"], expected: reviewExpected },
    { stage: "PLAN_REVISION", fixture: "output-plan-revision.md", removed: ["Rejected/unclear items"], expected: { target: "FractalAgentLab", epic: "FAL-EXPLICIT-STAGE-ROUTER", lane: "Track D / TRACK / track-d", plan_class: "EPIC_PLAN" } },
    { stage: "IMPLEMENT", fixture: "output-implement.md", removed: ["Explicit non-changes", "Unresolved risks/findings"], expected: { target: "FractalAgentLab", epic: "FAL-EXPLICIT-STAGE-ROUTER", lane: "Track D / TRACK / track-d", plan: "plan-fixture", candidate: "candidate-fixture", plan_class: "EPIC_PLAN" } },
    { stage: "STEP_REVIEW", fixture: "output-step-review.md", removed: ["Rejected/downgraded findings"], expected: { target: "FractalAgentLab", epic: "FAL-EXPLICIT-STAGE-ROUTER", lane: "Track D / TRACK / track-d", candidate: "candidate-fixture" } },
  ];

  for (const item of cases) {
    const raw = item.missingFixture
      ? fixture(item.missingFixture)
      : fixture(item.fixture).split("\n").filter((line) => !item.removed.some((field) => line.startsWith(`${field}:`))).join("\n");
    const standard = evaluateOutputPolicy({ mode: "STANDARD", stage: item.stage, raw, expected: item.expected });
    assert.equal(standard.disposition, "ACCEPTED_NORMALIZED", `${item.stage} should normalize`);
    assert.deepEqual(standard.warning_rules, ["DETERMINISTIC_OPTIONAL_DEFAULT"]);
    assert.deepEqual(standard.normalized_fields, item.removed);
    for (const field of item.removed) assert.match(standard.normalized_output ?? "", new RegExp(`^${field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: NONE$`, "m"));
    assert.ok(standard.parsed_output);

    const strict = evaluateOutputPolicy({ mode: "STRICT", stage: item.stage, raw, expected: item.expected });
    assert.equal(strict.disposition, "BLOCKED_AMBIGUOUS", `${item.stage} must not default in STRICT`);
    assert.equal(strict.parsed_output, undefined);
  }
});

test("multiple canonical envelopes are ambiguous even in STANDARD", () => {
  const raw = fixture("output-plan-review-ambiguous.md");
  for (const mode of ["STANDARD", "STRICT"] as const) {
    const result = evaluateOutputPolicy({ mode, stage: "PLAN_REVIEW", raw, expected: reviewExpected });
    assert.equal(result.disposition, "BLOCKED_AMBIGUOUS", mode);
    assert.equal(result.parsed_output, undefined);
  }
});

test("binding mismatch remains authority-blocked in both policies", () => {
  const raw = fixture("output-plan-review-authority-drift.md");
  for (const mode of ["STANDARD", "STRICT"] as const) {
    const result = evaluateOutputPolicy({ mode, stage: "PLAN_REVIEW", raw, expected: reviewExpected });
    assert.equal(result.disposition, "BLOCKED_AUTHORITY");
    assert.match(result.reason, /Target binding mismatch/);
    assert.equal(result.parsed_output, undefined);
  }
});

test("deterministic defaults never conceal authority drift", () => {
  const raw = fixture("output-plan-review-missing-optional-authority-drift.md");
  for (const mode of ["STANDARD", "STRICT"] as const) {
    const result = evaluateOutputPolicy({ mode, stage: "PLAN_REVIEW", raw, expected: reviewExpected });
    assert.equal(result.disposition, "BLOCKED_AUTHORITY");
    assert.match(result.reason, /Target binding mismatch/);
    assert.deepEqual(result.warning_rules, []);
    assert.deepEqual(result.normalized_fields, []);
    assert.equal(result.parsed_output, undefined);
  }
});

test("one well-bound terminal with a missing required fact has no successor only in STANDARD", () => {
  const raw = fixture("output-plan-review-missing-required.md");
  const standard = evaluateOutputPolicy({ mode: "STANDARD", stage: "PLAN_REVIEW", raw, expected: reviewExpected });
  assert.equal(standard.disposition, "ACCEPTED_NO_SUCCESSOR");
  assert.deepEqual(standard.warning_rules, ["REQUIRED_SEMANTIC_FACT_MISSING"]);
  assert.equal(standard.parsed_output, undefined);
  assert.match(standard.reason, /missing required field Acceptance\/evidence decision/);

  const strict = evaluateOutputPolicy({ mode: "STRICT", stage: "PLAN_REVIEW", raw, expected: reviewExpected });
  assert.equal(strict.disposition, "BLOCKED_AMBIGUOUS");
  assert.deepEqual(strict.warning_rules, []);
  assert.equal(strict.parsed_output, undefined);
});
