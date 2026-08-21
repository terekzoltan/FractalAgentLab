import { sha256, stageRequestFromInvocation } from "./contracts.js";
import type { AuthorityResolver, ResolvedStageAuthority, SnapshotReader } from "./stage-engine.js";
import { StateStore } from "./state-store.js";
import { InstalledSnapshotClient, isValidTransportIdentity, type SnapshotBaseline, type SnapshotCandidate, type TransportReceipt } from "./transport.js";

interface PersistedIntent {
  schema_version: "dispatch-intent.v1";
  operation_id: string;
  baseline?: SnapshotBaseline;
  capability_receipt_sha256?: string;
}

export class InstalledSnapshotReader implements SnapshotReader {
  constructor(
    private readonly store: StateStore,
    private readonly resolver: AuthorityResolver,
    private readonly client: InstalledSnapshotClient,
  ) {}

  async captureBaseline(resolved: ResolvedStageAuthority): Promise<SnapshotBaseline> {
    if (resolved.capability.mode !== "P0B_ISOLATED" && resolved.capability.mode !== "PRODUCTION_RESPONSE_FIRST") throw new Error("Installed snapshot baseline requires an active production capability");
    return this.client.captureBaseline(resolved.transport, 15_000);
  }

  async collect(runId: string, operationId: string): Promise<SnapshotCandidate[]> {
    const loaded = this.store.loadRun(runId);
    const operation = this.store.loadOperation(runId, operationId);
    const intent = this.store.loadIntent<PersistedIntent>(runId, operationId);
    const mode = operation.invocation.snapshot_correlation ?? "DIAGNOSTIC_ONLY";
    try {
      if (!intent.baseline || intent.operation_id !== operationId) throw new Error("Operation has no exact pre-send snapshot baseline");
      const resolved = await this.resolver.resolveStageAuthority(loaded.authority, stageRequestFromInvocation(operation.invocation));
      if (resolved.capability.mode !== "P0B_ISOLATED" && resolved.capability.mode !== "PRODUCTION_RESPONSE_FIRST") throw new Error("Installed snapshot reader is disabled");
      if (resolved.capability.identity_sha256 !== operation.invocation.capability_receipt_sha256 || sha256(resolved.transport.session_id) !== operation.invocation.recipient_session_sha256) throw new Error("Snapshot authority drifted");
      const snapshot = await this.client.collect(resolved.transport, intent.baseline, mode, 15_000);
      const transportReceipt = this.store.loadTransportReceipt<TransportReceipt>(runId, operationId);
      const correlated = transportReceipt && isValidTransportIdentity(transportReceipt.parent_id) ? snapshot.candidates.filter((candidate) =>
        isValidTransportIdentity(candidate.parent_id)
        && candidate.id === transportReceipt.message_id
        && candidate.parent_id === transportReceipt.parent_id
        && sha256(candidate.session_id) === transportReceipt.session_sha256
        && sha256(candidate.text) === transportReceipt.terminal_sha256,
      ) : [];
      const result = !snapshot.baseline_present ? "BASELINE_MISSING"
        : snapshot.candidates.length === 0 ? "NO_CANDIDATE"
          : correlated.length > 1 ? "AMBIGUOUS"
            : mode === "EXACT_PARENT_LINK" && correlated.length === 1 ? "EXACT_CANDIDATE"
              : "DIAGNOSTIC_CANDIDATE";
      this.store.writeSnapshotDiagnostic(runId, operationId, {
        schema_version: "router-snapshot-diagnostic.v1",
        run_id: runId,
        operation_id: operationId,
        mode,
        baseline_identity_sha256: intent.baseline.identity_sha256,
        message_set_sha256: snapshot.message_set_sha256,
        candidate_count: snapshot.candidates.length,
        correlated_candidate_count: correlated.length,
        result,
        captured_at: snapshot.captured_at,
        raw_snapshot_persisted: false,
      });
      return snapshot.candidates;
    } catch (error) {
      this.store.writeSnapshotDiagnostic(runId, operationId, {
        schema_version: "router-snapshot-diagnostic.v1",
        run_id: runId,
        operation_id: operationId,
        mode,
        baseline_identity_sha256: intent.baseline?.identity_sha256 ?? sha256("BASELINE_UNAVAILABLE"),
        message_set_sha256: sha256("SNAPSHOT_READ_FAILED"),
        candidate_count: 0,
        correlated_candidate_count: 0,
        result: "READ_FAILED",
        captured_at: new Date().toISOString(),
        raw_snapshot_persisted: false,
      });
      throw error;
    }
  }
}
