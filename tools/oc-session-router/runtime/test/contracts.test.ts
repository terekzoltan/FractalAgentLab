import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  authoritySha256,
  canonicalize,
  parseCloseoutAuthorityInstallRequest,
  parseOutputShape,
  parseStageSourceManifest,
  parseStageRequest,
  canonicalFindingIds,
  resolveCanonPhase,
  validateOutputBinding,
  type RunAuthority,
} from "../src/contracts.js";

test("v29 closeout authority install request is exact and bounded", () => {
  const parsed = parseCloseoutAuthorityInstallRequest({ schema_version: "closeout-authority-install.v1", run_id: "run-1", delivery_operation_id: "op-1", closeout_authority: { schema_version: "closeout-authority-intent.v1" } });
  assert.equal(parsed.run_id, "run-1");
  assert.throws(() => parseCloseoutAuthorityInstallRequest({ ...parsed, target_root: "C:\\foreign" }), /unknown fields/);
  assert.throws(() => parseCloseoutAuthorityInstallRequest({ ...parsed, run_id: "../escape" }), /valid opaque ID/);
});

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../fixtures");

const authority: RunAuthority = {
  schema_version: "run-authority.v1",
  run_id: "run-1",
  created_at: "2026-08-10T00:00:00.000Z",
  target_id: "fal",
  target_identity: "FractalAgentLab",
  worktree_identity: "git:abc",
  wave: "W",
  epic: "E",
  accountable_lane: "Track D",
  accountable_class: "TRACK",
  accountable_profile: "track-d",
  target_profile_identity: "profile-v1",
  target_profile_sha256: "a".repeat(64),
  state_path: "ops/PROJECT_STATE.md",
  state_revision: "state-v1",
  state_sha256: "b".repeat(64),
  combined_path: "ops/Combined.md",
  combined_selector: "HEADING:Current",
  combined_span_sha256: "c".repeat(64),
  pinned_artifact_path: "plans/epic.md",
  pinned_artifact_identity: "plan-v1",
  pinned_artifact_sha256: "d".repeat(64),
  overlay_identity: "overlay-v1",
  accountable_role_identity: "track-d-v1",
  configuration_identity: "config-v1",
  active_route_generation: "UNDECLARED",
  review_cycle: "0",
  stage_source_manifest_path: "plans/stage-sources.json",
  stage_source_manifest_sha256: "e".repeat(64),
  next_command: "/terv-review",
};

test("canonical authority hash ignores insertion order", () => {
  const reversed = Object.fromEntries(Object.entries(authority).reverse()) as unknown as RunAuthority;
  assert.equal(canonicalize(authority), canonicalize(reversed));
  assert.equal(authoritySha256(authority), authoritySha256(reversed));
});

test("review-fix plan phases remain distinct", () => {
  assert.equal(resolveCanonPhase("PLAN_REVIEW", "REVIEW_FIX_PLAN"), "FIX_PLAN_REVIEW");
  assert.equal(resolveCanonPhase("PLAN_REVISION", "REVIEW_FIX_PLAN"), "FIX_PLAN_REVISION");
  assert.equal(resolveCanonPhase("IMPLEMENT", "REVIEW_FIX_PLAN"), "FIX_IMPLEMENT");
});

test("implementation output follows the AWC 4.1.1 combined candidate/worktree field", () => {
  const valid = [
    "IMPLEMENTATION RESULT",
    "Target: FractalAgentLab",
    "Epic: E1",
    "Accountable Lane / class / profile: Track D / TRACK / track-d",
    "Plan/fix-plan identity: plan-1",
    "Changed artifacts: fixture",
    "Explicit non-changes: protected surfaces",
    "Acceptance mapping: PASS",
    "Checks/results: PASS",
    "Candidate identity/worktree limitations: candidate-1; uncommitted candidate, dirty unrelated files preserved",
    "Diff self-review: PASS",
    "Unresolved risks/findings: none",
    "Exact route: Meta /step-review",
    "REVIEW_READY",
  ].join("\n");
  const parsed = parseOutputShape("IMPLEMENT", valid);
  validateOutputBinding(parsed, { target: "FractalAgentLab", epic: "E1", lane: "Track D / TRACK / track-d" });
  assert.equal(parsed.fields["Candidate identity/worktree limitations"], "candidate-1; uncommitted candidate, dirty unrelated files preserved");
  assert.doesNotThrow(() => validateOutputBinding(parsed, { target: "FractalAgentLab", epic: "E1", lane: "Track D / TRACK / track-d", candidate: "candidate-1" }));
  assert.throws(() => validateOutputBinding(parsed, { target: "FractalAgentLab", epic: "E1", lane: "Track D / TRACK / track-d", candidate: "candidate-other" }), /Candidate identity\/worktree limitations binding mismatch/);

  const noncanonicalSplit = valid.replace("Candidate identity/worktree limitations: candidate-1; uncommitted candidate, dirty unrelated files preserved", "Candidate identity: candidate-1\nWorktree limitations: dirty unrelated files preserved");
  assert.throws(() => parseOutputShape("IMPLEMENT", noncanonicalSplit), /missing required field Candidate identity\/worktree limitations/);
  const legacyFreeForm = parseOutputShape("IMPLEMENT", valid.replace("candidate-1; uncommitted candidate", "candidate-1 uncommitted candidate"));
  assert.doesNotThrow(() => validateOutputBinding(legacyFreeForm, { target: "FractalAgentLab", epic: "E1", lane: "Track D / TRACK / track-d", candidate: "candidate-1" }));
  const exactOnly = parseOutputShape("IMPLEMENT", valid.replace("candidate-1; uncommitted candidate, dirty unrelated files preserved", "candidate-1"));
  assert.doesNotThrow(() => validateOutputBinding(exactOnly, { target: "FractalAgentLab", epic: "E1", lane: "Track D / TRACK / track-d", candidate: "candidate-1" }));
  assert.throws(() => validateOutputBinding(parseOutputShape("IMPLEMENT", valid.replace("candidate-1;", "candidate-1-other;")), { target: "FractalAgentLab", epic: "E1", lane: "Track D / TRACK / track-d", candidate: "candidate-1" }), /binding mismatch/);
});

test("binding is independent from shape", () => {
  const raw = readFileSync(path.join(fixtures, "output-plan-review.md"), "utf8").replace("Target: FractalAgentLab", "Target: Other");
  const parsed = parseOutputShape("PLAN_REVIEW", raw);
  assert.throws(() => validateOutputBinding(parsed, { target: "FractalAgentLab", epic: "FAL-EXPLICIT-STAGE-ROUTER", lane: "Track D / TRACK / track-d" }), /Target binding mismatch/);
  const displayAlias = parseOutputShape("PLAN_REVIEW", readFileSync(path.join(fixtures, "output-plan-review.md"), "utf8").replace("Target: FractalAgentLab", "Target: FRACTALAGENTLAB repository"));
  assert.doesNotThrow(() => validateOutputBinding(displayAlias, { target: "FractalAgentLab", epic: "FAL-EXPLICIT-STAGE-ROUTER", lane: "Track D / TRACK / track-d" }));
});

test("binding requires target and epic and uses the candidate identity field", () => {
  assert.throws(() => parseOutputShape("PLAN_REVIEW", [
    "META PLAN REVIEW",
    "Epic: E1",
    "Overall verdict: GREEN",
  ].join("\n")), /Plan class|missing required field Target/);

  const candidate = parseOutputShape("CLOSEOUT", [
    "CLOSEOUT + COMMIT RESULT",
    "Target: FractalAgentLab",
    "Epic: E1",
    "Accountable Lane / class / profile: Track D / TRACK / track-d",
    "workflow_verdict: COMPLETE",
    "domain_verdict: ACCEPTED",
    "routing_verdict: CLOSED",
    "next_role_action: NONE",
    "State/Combined/findings/evidence reconciliation: result=PASS; details=fixture",
    "Candidate identity: other-candidate",
    "Staged explicit paths: NONE",
    "Verification: result=PASS; candidate=other-candidate; committed_tree=NOT_APPLICABLE; details=fixture",
    "Commit: NO_COMMIT reason=fixture",
    "Push: NOT_PERFORMED",
  ].join("\n"));
  assert.throws(() => validateOutputBinding(candidate, { target: "FractalAgentLab", epic: "E1", lane: "Track D / TRACK / track-d", candidate: "candidate-1" }), /Candidate identity binding mismatch/);
});

test("plan review and implementation bind the exact plan lineage", () => {
  const review = parseOutputShape("PLAN_REVIEW", readFileSync(path.join(fixtures, "output-plan-review.md"), "utf8"));
  assert.throws(() => validateOutputBinding(review, { target: "FractalAgentLab", epic: "FAL-EXPLICIT-STAGE-ROUTER", lane: "Track D / TRACK / track-d", plan: "other-plan" }), /Plan artifact binding mismatch/);
  const implement = parseOutputShape("IMPLEMENT", readFileSync(path.join(fixtures, "output-implement.md"), "utf8"));
  assert.throws(() => validateOutputBinding(implement, { target: "FractalAgentLab", epic: "FAL-EXPLICIT-STAGE-ROUTER", lane: "Track D / TRACK / track-d", plan: "other-plan" }), /Plan\/fix-plan identity binding mismatch/);
});

test("FSR-010: canonical revision headers preserve plan class", () => {
  const epic = parseOutputShape("PLAN_REVISION", readFileSync(path.join(fixtures, "output-plan-revision.md"), "utf8"));
  assert.equal(epic.plan_class, "EPIC_PLAN");
  const fix = parseOutputShape("PLAN_REVISION", readFileSync(path.join(fixtures, "output-review-fix-plan-revision.md"), "utf8"));
  assert.equal(fix.plan_class, "REVIEW_FIX_PLAN");
  assert.throws(() => validateOutputBinding(fix, { target: "FractalAgentLab", epic: "FAL-EXPLICIT-STAGE-ROUTER", lane: "Track D / TRACK / track-d", plan_class: "EPIC_PLAN" }), /Plan class binding mismatch/);
  assert.throws(() => parseOutputShape("PLAN_REVISION", readFileSync(path.join(fixtures, "output-plan-revision.md"), "utf8").replace("REVISED EPIC IMPLEMENTATION PLAN", "REVISED GENERIC PLAN")), /canonical plan header/);
});

test("output parsing rejects duplicate authority fields", () => {
  assert.throws(() => parseOutputShape("PLAN_REVIEW", [
    "META PLAN REVIEW",
    "Target: FractalAgentLab",
    "Target: Other",
    "Epic: E1",
    "Overall verdict: GREEN",
  ].join("\n")), /Duplicate output field/);
});

test("output shape validation rejects incomplete and prefixed terminal artifacts", () => {
  assert.throws(() => parseOutputShape("PLAN_REVIEW", [
    "META PLAN REVIEW",
    "Target: FractalAgentLab",
    "Epic: E1",
    "Overall verdict: GREEN",
  ].join("\n")), /Plan class|missing required field/);
  assert.throws(() => parseOutputShape("DELIVERY_RESPONSE", "progress\nACK_ONLY"), /exact bare ACK_ONLY/);
});

test("output shape validation enforces cross-field lifecycle invariants", () => {
  const revision = readFileSync(path.join(fixtures, "output-plan-revision.md"), "utf8").replace("Final plan artifact: plan-fixture", "Final plan artifact: other-plan");
  assert.throws(() => parseOutputShape("PLAN_REVISION", revision), /plan identity mismatch/);

  const implement = readFileSync(path.join(fixtures, "output-implement.md"), "utf8").replace("Exact route: Meta /step-review", "Exact route: nowhere");
  assert.throws(() => parseOutputShape("IMPLEMENT", implement), /REVIEW_READY route/);

  const closeout = readFileSync(path.join(fixtures, "output-closeout.md"), "utf8").replace("candidate=candidate-fixture", "candidate=other-candidate");
  assert.throws(() => parseOutputShape("CLOSEOUT", closeout), /candidate identity mismatch/);

  const incompleteFix = [
    "FIX_PLAN_REQUIRED",
    "Target: FractalAgentLab",
    "Epic: E1",
    "Candidate: candidate-1",
    "Accountable Lane / class / profile: Track D / TRACK / track-d",
    "Accepted finding IDs: [\"F1\"]",
    "Allowed surfaces: fixture",
    "Forbidden surfaces: protected",
    "Finding -> change -> acceptance/check: F1 -> fix -> test",
    "Dependencies: none",
    "Fix-plan artifact: fix-plan-1",
  ].join("\n");
  assert.throws(() => parseOutputShape("DELIVERY_RESPONSE", incompleteFix), /FIX_PLAN_READY_FOR_IMPLEMENT/);
});

test("closeout shape maps both NO_COMMIT and committed receipts without ambiguity", () => {
  const noCommit = readFileSync(path.join(fixtures, "output-closeout.md"), "utf8");
  assert.equal(parseOutputShape("CLOSEOUT", noCommit).kind, "CLOSEOUT");
  assert.throws(() => parseOutputShape("CLOSEOUT", noCommit.replace("Staged explicit paths: NONE", "Staged explicit paths: [\"file.txt\"]")), /NO_COMMIT requires Staged explicit paths: NONE/);

  const hash = "a".repeat(40);
  const committed = noCommit
    .replace("Staged explicit paths: NONE", "Staged explicit paths: [\"file.txt\"]")
    .replace("committed_tree=NOT_APPLICABLE", `committed_tree=${hash}`)
    .replace("Commit: NO_COMMIT reason=fixture", `Commit: sha=${hash}; tree=${hash}; message=fixture`);
  assert.doesNotThrow(() => parseOutputShape("CLOSEOUT", committed));
});

test("strict JSON rejects non-JSON whitespace and non-finite numbers", async () => {
  const { parseStrictJson } = await import("../src/contracts.js");
  assert.throws(() => parseStrictJson("{\u00a0\"a\":1}"), /Expected JSON string/);
  assert.throws(() => parseStrictJson("1e9999"), /finite/);
});

test("all canonical output fixtures are shape-classifiable", () => {
  const names = [
    ["SEQ_NEXT", "output-seq-next.md"],
    ["PLAN_REVIEW", "output-plan-review.md"],
    ["PLAN_REVISION", "output-plan-revision.md"],
    ["IMPLEMENT", "output-implement.md"],
    ["STEP_REVIEW", "output-step-review.md"],
    ["DELIVERY_RESPONSE", "output-delivery-response.md"],
    ["CLOSEOUT", "output-closeout.md"],
  ] as const;
  for (const [stage, name] of names) assert.equal(parseOutputShape(stage, readFileSync(path.join(fixtures, name), "utf8")).kind, stage);
});

test("stage request fixture passes the closed schema", () => {
  const parsed = parseStageRequest(JSON.parse(readFileSync(path.join(fixtures, "stage-request-valid.json"), "utf8")));
  assert.equal(parsed.requested_stage, "IMPLEMENT");
  assert.equal(parsed.expected_sources.length, 1);
});

test("FSR-020: finding IDs are unique and ordinal-canonical", () => {
  assert.deepEqual(canonicalFindingIds(["FSR-020", "FSR-003", "FSR-011"]), ["FSR-003", "FSR-011", "FSR-020"]);
  assert.throws(() => canonicalFindingIds(["FSR-020", "FSR-020"]), /duplicates/);
  assert.throws(() => canonicalFindingIds(["not a finding"]), /opaque ID/);
});

test("FSR-012: stage source manifest is closed, ordered, and duplicate-free", () => {
  const source = {
    path: "plans/revised.md",
    source_class: "REVISED_PLAN",
    logical_identity: "plan-fixture",
    producer: "target-state",
    sha256: "d".repeat(64),
    order: 0,
  };
  const valid = {
    schema_version: "stage-source-manifest.v1",
    target_id: "FractalAgentLab",
    epic: "FAL-EXPLICIT-STAGE-ROUTER",
    candidate_identity: "candidate-fixture",
    entries: [{ stage: "IMPLEMENT", plan_class: "EPIC_PLAN", sources: [source] }],
  };
  assert.equal(parseStageSourceManifest(valid).entries[0]?.sources[0]?.path, "plans/revised.md");
  assert.throws(() => parseStageSourceManifest({ ...valid, unexpected: true }), /missing or unknown fields/);
  assert.throws(() => parseStageSourceManifest({ ...valid, entries: [...valid.entries, ...valid.entries] }), /duplicate/i);
  assert.throws(() => parseStageSourceManifest({ ...valid, entries: [{ ...valid.entries[0], sources: [source, { ...source, order: 1 }] }] }), /duplicate/i);
});

test("FSR-026: reopened AC evidence pointers name existing exact test labels", (context) => {
  const runtimeRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const repoRoot = path.resolve(runtimeRoot, "../../..");
  const ledgerPath = path.join(repoRoot, "ops/temp/fal-explicit-stage-router-implementation-evidence/ACCEPTANCE-RECONCILIATION.md");
  if (!existsSync(ledgerPath)) {
    context.skip("private acceptance-reconciliation evidence is not distributed in a clean worktree");
    return;
  }
  const ledger = readFileSync(ledgerPath, "utf8");
  const affected = ["AC36", "AC46", "AC47", "AC49", "AC54", "AC57", "AC67", "AC73", "AC84", "AC85", "AC86"];
  for (const ac of affected) {
    const row = ledger.split(/\r?\n/).find((line) => line.startsWith(`| ${ac} |`));
    assert.ok(row, `${ac} ledger row is missing`);
    for (const match of row.matchAll(/`([^`]+\.(?:test\.ts|md))`(?:: `([^`]+)`)?/g)) {
      const pointer = match[1]!;
      const filePath = pointer.includes("/") ? path.join(repoRoot, pointer) : pointer.endsWith(".test.ts") ? path.join(runtimeRoot, "test", pointer) : path.join(repoRoot, "ops/temp/fal-explicit-stage-router-implementation-evidence", pointer);
      assert.equal(existsSync(filePath), true, `${ac} pointer file does not exist: ${pointer}`);
      if (match[2]) assert.match(readFileSync(filePath, "utf8"), new RegExp(match[2]!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${ac} test label does not exist: ${match[2]}`);
    }
  }
});
