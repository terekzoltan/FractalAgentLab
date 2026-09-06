import assert from 'node:assert/strict';
import test from 'node:test';
import { operationView } from '../../src/v2/cli.js';
import type { Operation } from '../../src/v2/contracts.js';

test('terminal facts do not display an earlier busy/no-terminal observation as a current blocker', () => {
  const pending: Operation = {
    operationId: 'op-fixture', messageId: 'msg_fixture', participantKey: 'fixture', inputDigest: 'fixture',
    createdAt: '2026-01-01T00:00:00Z', dispatchStartedAt: '2026-01-01T00:00:01Z', acknowledgedAt: '2026-01-01T00:00:02Z',
    completedAt: null, correlation: {}, resultDigest: null, outcome: null, interpretation: null,
    action: { workId: 'fixture', actionKey: 'action', recipientRole: 'delivery', kind: 'LIFECYCLE', effect: 'WORKSPACE_WRITE',
      command: 'implement', predecessor: null, input: {}, participant: { namespace: 'fixture', project: 'fixture', session: 'ses_fixture' } },
    observation: { observedAt: '2026-01-01T00:00:03Z', activity: 'BUSY', context: { reason: 'NO_TERMINAL_CHILD' } },
  };
  assert.equal(operationView(pending).reason, 'NO_TERMINAL_CHILD');
  assert.equal(operationView(pending).activity, 'BUSY');
  const done: Operation = { ...pending, completedAt: '2026-01-01T00:00:04Z', outcome: { execution: 'COMPLETED', evidenceReferences: ['fixture'] } };
  assert.equal(operationView(done).activity, 'COMPLETED');
  assert.equal(operationView(done).reason, null);
  assert.equal(operationView(done).execution, 'COMPLETED');
  const failed: Operation = { ...done, outcome: { execution: 'FAILED', evidenceReferences: ['fixture'], reason: 'REMOTE_EXECUTION_FAILED' } };
  assert.equal(operationView(failed).activity, 'FAILED');
  assert.equal(operationView(failed).reason, 'REMOTE_EXECUTION_FAILED');
});
