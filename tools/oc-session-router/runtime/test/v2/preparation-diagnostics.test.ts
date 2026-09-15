import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { StoreError, type ActionInput, type WorkContext } from "../../src/v2/contracts.js";
import { PreparationDiagnostics } from "../../src/v2/preparation-diagnostics.js";
import { RouterError } from "../../src/v2/routing.js";
import { AdapterError } from "../../src/v2/opencode-adapter.js";
import { OperationStore } from "../../src/v2/state-store.js";

const privateFailure = "fixture-secret C:/private/owner/request.json ses_private http://private.invalid full input";
function fixture(t: TestContext, checkpoint?: "PREPARE_OPERATION_INSERTED" | "PREPARE_COMMITTED") {
  const root = mkdtempSync(path.join(process.cwd(), ".preparation-fixture-"));
  const store = new OperationStore(path.join(root, "router.sqlite"), { checkpoint: point => { if (point === checkpoint) throw new Error(privateFailure); } });
  t.after(() => { store.close(); rmSync(root, { recursive: true, force: true }); });
  const work: WorkContext = { workId: "diagnostic-work", target: "fixture", directory: root, instructionReference: "owner", scope: "fixture", allowedEffects: ["READ_ONLY"], stoppingPoint: "return" };
  store.openWork(work);
  const action: ActionInput = { workId: work.workId, actionKey: "diagnostic-action", participant: { namespace: "fixture", project: "project", session: "ses_private" }, recipientRole: "Meta", kind: "LIFECYCLE", effect: "READ_ONLY", command: "step-review", predecessor: null, input: {} };
  const diagnostics = new PreparationDiagnostics();
  diagnostics.useStore(store); diagnostics.identify(action);
  return { store, work, action, diagnostics };
}

for (const checkpoint of ["PREPARE_OPERATION_INSERTED", "PREPARE_COMMITTED"] as const) {
  test(`persistence error at ${checkpoint} reports only durable operation facts`, t => {
    const { store, action, diagnostics } = fixture(t, checkpoint);
    diagnostics.at("PERSISTENCE");
    let failure: unknown;
    try { store.prepareAction(action); } catch (error) { failure = error; }
    assert.ok(failure);
    const view = diagnostics.failure(failure).view;
    assert.equal(view.error_code, checkpoint === "PREPARE_COMMITTED" ? "PREPARATION_FAILED" : "STORE_UNAVAILABLE");
    assert.equal(view.phase, "PERSISTENCE");
    assert.equal(view.category, checkpoint === "PREPARE_COMMITTED" ? "UNEXPECTED_FAILURE" : "STORE");
    assert.equal(view.operationCreated, null, "a thrown prepare result cannot attribute creation to this invocation");
    assert.equal(view.operationExists, checkpoint === "PREPARE_COMMITTED");
    assert.equal(view.dispatchStarted, false);
    assert.equal(view.delivery, "NOT_SENT");
    assert.equal(view.factsSource, "STORE_SNAPSHOT");
    assert.equal(view.recovery, checkpoint === "PREPARE_COMMITTED" ? "INSPECT_EXISTING_OPERATION" : "INSPECT_WORK_BEFORE_RETRY");
    assert.ok(!JSON.stringify(view).includes(privateFailure));
    assert.doesNotMatch(JSON.stringify(view), /C:|ses_private|private\.invalid|stack|request\.json/);
  });
}

test("conflicting existing actions retain possible or known delivery", t => {
  const { store, action, diagnostics } = fixture(t);
  const operation = store.prepareAction(action).operation;
  store.startDispatch(operation.operationId);
  diagnostics.at("WORK_CONTEXT");
  const possible = diagnostics.failure(new StoreError("INPUT_CONFLICT")).view;
  assert.equal(possible.operationCreated, false);
  assert.equal(possible.operationId, operation.operationId);
  assert.equal(possible.dispatchStarted, true);
  assert.equal(possible.delivery, "POSSIBLE");
  assert.equal(possible.recovery, "RECONCILE_EXISTING_OPERATION");
  store.acknowledge(operation.operationId, { rootMessageId: operation.messageId });
  const delivered = diagnostics.failure(new StoreError("INPUT_CONFLICT")).view;
  assert.equal(delivered.delivery, "DELIVERED");
  assert.equal(delivered.recovery, "INSPECT_EXISTING_OPERATION");
});

test("unavailable fact reads preserve proven delivery without inventing an unsent state", t => {
  const { store, action, diagnostics } = fixture(t);
  const prepared = store.prepareAction(action);
  diagnostics.prepared(prepared);
  diagnostics.at("EXECUTOR_START");
  const unavailable = { getWork() { throw new Error(privateFailure); }, getOperation() { throw new Error(privateFailure); } };
  diagnostics.useStore(unavailable);
  const unsentSnapshot = diagnostics.failure(new RouterError("EXECUTOR_START_FAILED")).view;
  assert.equal(unsentSnapshot.operationCreated, true);
  assert.equal(unsentSnapshot.operationExists, true);
  assert.equal(unsentSnapshot.dispatchStarted, null);
  assert.equal(unsentSnapshot.delivery, "UNKNOWN");
  assert.equal(unsentSnapshot.factsSource, "PREPARE_RESULT");
  store.startDispatch(prepared.operation.operationId);
  store.acknowledge(prepared.operation.operationId, { rootMessageId: prepared.operation.messageId });
  diagnostics.prepared({ operation: store.getOperation(prepared.operation.operationId), created: false });
  assert.equal(diagnostics.failure(new Error(privateFailure)).view.delivery, "DELIVERED");
  const conflict = new PreparationDiagnostics();
  conflict.useStore(store); conflict.identify(action);
  conflict.useStore(unavailable); conflict.at("WORK_CONTEXT");
  const retainedConflict = conflict.failure(new StoreError("INPUT_CONFLICT")).view;
  assert.equal(retainedConflict.delivery, "DELIVERED");
  assert.equal(retainedConflict.dispatchStarted, true);
  assert.equal(retainedConflict.factsSource, "PRIOR_STORE_SNAPSHOT");
  const withoutResult = new PreparationDiagnostics();
  withoutResult.useStore(unavailable); withoutResult.identify(action);
  assert.equal(withoutResult.failure(new Error(privateFailure)).view.operationExists, null);
  assert.equal(withoutResult.failure(new Error(privateFailure)).view.delivery, "UNKNOWN");
});

test("malformed identity and arbitrary error properties cannot become public diagnostics", () => {
  for (const error of [new Error(privateFailure), new RouterError(privateFailure), { code: "SOURCE_REFERENCE_INVALID", message: privateFailure, stack: privateFailure }]) {
    const diagnostics = new PreparationDiagnostics();
    diagnostics.at("REQUEST_VALIDATION"); diagnostics.identify(null);
    const view = diagnostics.failure(error).view;
    assert.equal(view.error_code, "PREPARATION_FAILED");
    assert.equal(view.category, "UNEXPECTED_FAILURE");
    assert.equal(view.operationCreated, false);
    assert.equal(view.operationExists, null);
    assert.equal(view.dispatchStarted, null);
    assert.equal(view.delivery, "UNKNOWN");
    assert.equal(view.recovery, "INSPECT_WORK_BEFORE_RETRY");
    assert.doesNotMatch(JSON.stringify(view), /fixture-secret|private|stack|message|input/);
  }
});

test("expected adapter failures retain a separate bounded category", () => {
  for (const code of ["INVALID_INPUT", "GET_TIMEOUT", "NETWORK_ERROR", "RESPONSE_TOO_LARGE", "ACKNOWLEDGEMENT_FAILED"] as const) {
    const diagnostics = new PreparationDiagnostics();
    diagnostics.at("COMPACT_BASELINE");
    const error = new AdapterError(code, 503);
    error.message = privateFailure; error.stack = privateFailure;
    const view = diagnostics.failure(error).view;
    assert.equal(view.error_code, code);
    assert.equal(view.category, "ADAPTER");
    assert.equal(view.phase, "COMPACT_BASELINE");
    assert.equal(view.operationCreated, false);
    assert.equal(view.delivery, "UNKNOWN");
    assert.doesNotMatch(JSON.stringify(view), /fixture-secret|private|stack|message|status|503/);
  }
});
