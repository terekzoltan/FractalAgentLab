import assert from "node:assert/strict";
import test from "node:test";
import { observeOwnerAttention, waitingForOwner } from "../../src/v2/owner-attention.js";

test("attention distinguishes clear, partial unavailable and pending without granting action", async () => {
  for (const [permissions, questions, state] of [
    [0, 0, "CLEAR"], [null, 0, "UNAVAILABLE"], [0, null, "UNAVAILABLE"],
    [1, null, "WAITING_FOR_OWNER"], [0, 1, "WAITING_FOR_OWNER"],
  ] as const) {
    const actual = await observeOwnerAttention({ getPendingInteractions: async () => ({ permissions, questions }) });
    assert.equal(actual.state, state);
    assert.equal(waitingForOwner(actual), state === "WAITING_FOR_OWNER");
    assert.equal(actual.scope, "EXACT_SESSION_NOT_OPERATION_OR_CHILDREN");
    assert.equal(waitingForOwner(actual, Date.parse(actual.observedAt) + 120001), false);
    assert.equal(waitingForOwner(actual, Date.parse(actual.observedAt) - 1), false);
  }
});

test("missing/throwing optional readers do not fabricate no-pending proof", async () => {
  assert.equal((await observeOwnerAttention({})).state, "UNAVAILABLE");
  assert.equal((await observeOwnerAttention({ getPendingInteractions: async () => { throw Error("private"); } })).state, "UNAVAILABLE");
});
