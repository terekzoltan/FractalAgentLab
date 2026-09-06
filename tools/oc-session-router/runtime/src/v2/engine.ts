import type { ActionInput, Effect, Json, Operation, WorkContext } from "./contracts.js";
import { digest, participantKey, StoreError, text } from "./contracts.js";
import { OpenCodeAdapter, type Acknowledgement, type AdapterOptions, type AdapterReply, type OpenCodeCredentials, type OpenCodeMessage, type OpenCodeTarget } from "./opencode-adapter.js";
import { isTerminalMessage, outcomeForMessage, reconcileOperation } from "./reconcile.js";
import { OperationStore } from "./state-store.js";
import { commandRule, readContainedSource, resolveRole, RouterError, sameDirectory, type RouterConfiguration } from "./routing.js";
import { observeSession, type SessionObservationOptions } from "./session-observation.js";
import { alreadyCompacted, captureCompactBaseline, observeCompactCompletion, type CompactBaseline } from "./session-maintenance.js";
import { reconcileLegacyOperation } from "./legacy-import.js";

export type Adapter = Pick<OpenCodeAdapter, "getSession" | "getStatus" | "listCommands" | "getMessage" | "getHistory" | "submitCommand" | "submitMessage" | "summarize"> & Partial<Pick<OpenCodeAdapter, "getModelInfo">>;
export type AdapterFactory = (target: OpenCodeTarget, credentials: OpenCodeCredentials, options?: AdapterOptions) => Adapter;
export type SourceReference = { path: string; sha256?: string } | { operationId: string };
export interface SubmitRequest {
  workId: string;
  actionKey: string;
  recipientRole: string;
  command?: string;
  kind?: "LIFECYCLE" | "CLARIFICATION" | "RESTORE";
  arguments?: string;
  predecessor?: string;
  sources?: SourceReference[];
}

export interface CompactRequest {
  workId: string;
  actionKey: string;
  recipientRole: string;
  predecessor?: string;
  model?: { providerID: string; modelID: string };
}

interface SourceSnapshot {
  sourceClass: "FILE" | "RESULT";
  reference: string;
  sha256: string;
  content: string;
}

/** The orchestrator chooses stages. This class never computes or sends a successor. */
export class RouterEngine {
  constructor(
    readonly store: OperationStore,
    private readonly configuration: RouterConfiguration,
    private readonly credentials: OpenCodeCredentials,
    private readonly adapterFactory: AdapterFactory = (target, credentials, options) => new OpenCodeAdapter(target, credentials, options),
  ) {
    if (!configuration || configuration.schemaVersion !== 2 || !configuration.targets || typeof configuration.targets !== "object" || Array.isArray(configuration.targets)) {
      throw new RouterError("CONFIGURATION_UNSUPPORTED");
    }
  }

  openWork(context: WorkContext) {
    const target = this.configuration.targets[context.target];
    if (!target || !sameDirectory(target.directory, context.directory)) throw new RouterError("TARGET_DIRECTORY_MISMATCH");
    return this.store.openWork(context);
  }

  async observe(workId: string, roleName: string, budgetMs?: number) {
    const work = this.store.getWork(workId);
    const { adapter, role, target } = this.binding(work.context, roleName, budgetMs);
    const options: SessionObservationOptions = {};
    if (role.model) {
      const slash = role.model.indexOf("/");
      if (slash > 0 && slash < role.model.length - 1) {
        options.model = { providerID: role.model.slice(0, slash), modelID: role.model.slice(slash + 1) };
        if (role.contextLimit) options.modelOverride = { ...options.model, contextLimit: role.contextLimit };
      }
    }
    const snapshot = await observeSession(adapter, { session: role.session, directory: target.directory }, options);
    const { nextCursor, ...coverage } = snapshot.history;
    const visible = { ...snapshot, history: { ...coverage, hasMore: nextCursor !== undefined } };
    this.store.recordSessionObservation(workId, roleName, visible as unknown as Record<string, Json>);
    return visible;
  }

  async observeOptional(workId: string, roleName: string, budgetMs = 15_000): Promise<void> {
    try { await this.observe(workId, roleName, Math.max(0, budgetMs)); }
    catch {
      try { this.store.recordSessionObservation(workId, roleName, { observedAt: new Date().toISOString(), available: false, reason: "OBSERVATION_UNAVAILABLE" }); }
      catch { /* Optional presentation cannot revoke an already-recorded result. */ }
    }
  }

  async prepareCompact(request: CompactRequest) {
    text(request.workId); text(request.actionKey); text(request.recipientRole);
    const normalized = { workId: request.workId, actionKey: request.actionKey, recipientRole: request.recipientRole,
      predecessor: request.predecessor ?? null, model: request.model ?? null };
    const requestDigest = digest(normalized), work = this.store.getWork(request.workId);
    const existing = work.operations.find(operation => operation.action.actionKey === request.actionKey);
    if (existing) {
      if (existing.action.kind !== "COMPACT" || existing.action.input.requestDigest !== requestDigest) throw new StoreError("INPUT_CONFLICT");
      return { operation: existing, created: false, disposition: "EXISTING" };
    }
    if (work.paused) throw new StoreError("WORK_PAUSED");
    const { role, target, participant, adapter } = this.binding(work.context, request.recipientRole);
    if (role.capability === "ORCHESTRATOR") throw new RouterError("ORCHESTRATOR_COMPACT_IS_MANUAL");
    if (!work.context.allowedEffects.includes("SESSION_MAINTENANCE")) throw new StoreError("EFFECT_NOT_ALLOWED");
    await this.verifyParticipant(adapter, work.context.directory, target.project, role.session, true);
    // Observe after freezing the head: a native compact either becomes visible
    // here or changes the head checked immediately before submission.
    const baseline = await captureCompactBaseline(adapter);
    const observation = await this.observe(request.workId, request.recipientRole);
    if (alreadyCompacted(observation)) return { operation: null, created: false, disposition: "ALREADY_COMPACTED", compactionReference: observation.lastCompaction!.messageReference };
    if (baseline.headMessageId === null) return { operation: null, created: false, disposition: "EMPTY_SESSION" };
    const model = request.model ?? observation.model ?? (observation.latestCompletedCall?.providerID && observation.latestCompletedCall.modelID
      ? { providerID: observation.latestCompletedCall.providerID, modelID: observation.latestCompletedCall.modelID } : null);
    if (!model?.providerID || !model.modelID) throw new RouterError("COMPACT_MODEL_UNAVAILABLE");
    const prepared = this.store.prepareAction({
      workId: request.workId, actionKey: request.actionKey, participant, recipientRole: request.recipientRole,
      kind: "COMPACT", effect: "SESSION_MAINTENANCE", command: "compact", predecessor: normalized.predecessor,
      input: { requestDigest, address: { origin: target.origin, directory: target.directory, session: role.session },
        profile: role.profile, sources: [], compactBaseline: baseline as unknown as Json,
        summarize: { providerID: model.providerID, modelID: model.modelID, auto: false } },
    });
    return { ...prepared, disposition: "PREPARED" };
  }

  private binding(work: WorkContext, roleName: string, getBudgetMs?: number) {
    const resolved = resolveRole(this.configuration, work.target, roleName);
    if (!sameDirectory(resolved.target.directory, work.directory)) throw new RouterError("TARGET_DIRECTORY_MISMATCH");
    const adapter = this.adapterFactory({ origin: resolved.target.origin, directory: resolved.target.directory, session: resolved.role.session }, this.credentials,
      getBudgetMs === undefined ? undefined : { getBudgetMs });
    return { ...resolved, adapter };
  }

  private async verifyParticipant(adapter: Adapter, directory: string, project: string, sessionId: string, requireIdle: boolean): Promise<void> {
    const session = await adapter.getSession();
    if (session.problem || !session.value || session.value.id !== sessionId || !sameDirectory(session.value.directory, directory) || session.value.projectID !== project) {
      throw new RouterError("PARTICIPANT_IDENTITY_MISMATCH");
    }
    if (!requireIdle) return;
    const activity = await adapter.getStatus();
    if (activity.problem || !activity.value || activity.value === "UNKNOWN") throw new RouterError("SESSION_ACTIVITY_UNAVAILABLE");
    if (activity.value !== "IDLE") throw new RouterError("PARTICIPANT_BUSY");
    // Optional context/token telemetry is not a dispatch admission condition.
  }

  private sourceSnapshots(work: WorkContext, references: SourceReference[]): SourceSnapshot[] {
    return references.map(reference => {
      if ("path" in reference) {
        const source = readContainedSource(work.directory, reference.path);
        if (reference.sha256 !== undefined && reference.sha256 !== source.sha256) throw new RouterError("SOURCE_CHANGED");
        return { sourceClass: "FILE", reference: source.path, sha256: source.sha256, content: source.content };
      }
      const operation = this.store.getOperation(reference.operationId);
      const content = operation.outcome?.response?.text ?? operation.outcome?.artifact?.text;
      if (operation.action.workId !== work.workId || !operation.completedAt || content === undefined || !operation.resultDigest) {
        throw new RouterError("RESULT_SOURCE_UNAVAILABLE");
      }
      return { sourceClass: "RESULT", reference: reference.operationId, sha256: operation.resultDigest, content };
    });
  }

  async prepare(request: SubmitRequest): Promise<{ operation: Operation; created: boolean }> {
    text(request.workId); text(request.actionKey); text(request.recipientRole);
    const kind = request.kind ?? "LIFECYCLE";
    const command = kind === "RESTORE" ? "after-compact" : kind === "CLARIFICATION" ? "clarification" : (request.command ?? "").replace(/^\//, "");
    text(command);
    const normalized = {
      workId: request.workId, actionKey: request.actionKey, recipientRole: request.recipientRole,
      kind, command, arguments: request.arguments ?? "", predecessor: request.predecessor ?? null, sources: request.sources ?? [],
    };
    const requestDigest = digest(normalized);
    const work = this.store.getWork(request.workId);
    const existing = work.operations.find(operation => operation.action.actionKey === request.actionKey);
    if (existing) {
      if (existing.action.input.requestDigest !== requestDigest) throw new StoreError("INPUT_CONFLICT");
      return { operation: existing, created: false };
    }
    if (work.paused) throw new StoreError("WORK_PAUSED");
    const { role, target, participant, adapter } = this.binding(work.context, request.recipientRole);
    const effect: Effect = kind === "LIFECYCLE" ? commandRule(command, role, target) : kind === "RESTORE" ? "SESSION_MAINTENANCE" : "READ_ONLY";
    if (!work.context.allowedEffects.includes(effect)) throw new StoreError("EFFECT_NOT_ALLOWED");
    if (!["LIFECYCLE", "CLARIFICATION", "RESTORE"].includes(kind)) throw new RouterError("ACTION_KIND_UNSUPPORTED");
    await this.verifyParticipant(adapter, work.context.directory, target.project, role.session, true);
    await this.observeOptional(request.workId, request.recipientRole);
    const sources = this.sourceSnapshots(work.context, normalized.sources);
    let argument = kind === "RESTORE" ? `${work.context.target} ${role.profile}` : normalized.arguments;
    if (kind === "RESTORE") {
      const recent = work.operations.slice(-3).map(operation => ({ operationId: operation.operationId, role: operation.action.recipientRole,
        command: operation.action.command, completed: operation.completedAt !== null, decision: operation.interpretation?.decision ?? null }));
      argument += `\n\nRestore context only; do not start or repeat lifecycle work.\nCurrent work reference: ${work.context.workId}\nOwner scope: ${work.context.scope}\nStopping point: ${work.context.stoppingPoint}\nRecent observed operations (not new authority): ${JSON.stringify(recent)}`;
    }
    if (kind === "CLARIFICATION") {
      text(argument);
      argument = `Clarify the existing work only. Do not implement again, change acceptance, commit, or expand scope.\nOwner scope: ${work.context.scope}\nQuestion: ${argument}`;
    }
    if (sources.length) argument += sources.map(source => `\n\nReference data (${source.reference}):\n${source.content}`).join("");
    const input: ActionInput["input"] = {
      requestDigest, arguments: argument, sources: sources as unknown as Json,
      address: { origin: target.origin, directory: target.directory, session: role.session },
      profile: role.profile,
    };
    for (const key of ["agent", "model", "variant"] as const) if (role[key]) input[key] = role[key]!;
    if (kind !== "CLARIFICATION") {
      const registry = await adapter.listCommands();
      const matches = registry.value?.filter(item => item.name === command) ?? [];
      if (registry.problem || matches.length !== 1) throw new RouterError("COMMAND_UNAVAILABLE");
      // Freeze selected command semantics only, never the entire live registry.
      const selected = matches[0]!;
      input.commandDefinition = { name: selected.name, template: selected.template };
      for (const key of ["agent", "model", "subtask"] as const) {
        if (selected[key] !== undefined) (input.commandDefinition as Record<string, Json>)[key] = selected[key]!;
      }
    }
    return this.store.prepareAction({
      workId: request.workId, actionKey: request.actionKey, participant,
      recipientRole: request.recipientRole, kind, effect, command,
      predecessor: normalized.predecessor, input,
    });
  }

  private adapterForOperation(operation: Operation, sending: boolean): Adapter {
    const work = this.store.getWork(operation.action.workId).context;
    try {
      const configured = this.binding(work, operation.action.recipientRole);
      if (participantKey(configured.participant) !== operation.participantKey) throw new RouterError("PARTICIPANT_BINDING_CHANGED");
      if (sending && operation.action.kind === "LIFECYCLE" && commandRule(operation.action.command, configured.role, configured.target) !== operation.action.effect) {
        throw new RouterError("COMMAND_EFFECT_CHANGED");
      }
      return configured.adapter;
    } catch (error) {
      if (sending) throw error;
      // Historical reads may use the frozen address; no new send authority follows.
      const address = operation.action.input.address as unknown as OpenCodeTarget;
      if (!address || !sameDirectory(address.directory, work.directory) || address.session !== operation.action.participant.session) throw new RouterError("RECOVERY_ADDRESS_UNAVAILABLE");
      return this.adapterFactory(address, this.credentials);
    }
  }

  private recordHttpFact(operation: Operation, fact: Acknowledgement): void {
    const previous = this.store.getOperation(operation.operationId).observation;
    this.store.observe(operation.operationId, {
      observedAt: fact.observedAt, activity: previous?.activity ?? "UNKNOWN",
      ...(previous?.cursor === undefined ? {} : { cursor: previous.cursor }),
      context: { ...previous?.context, httpStatus: fact.status },
    });
    if (fact.rootMessageId === operation.messageId) {
      const correlation: { rootMessageId: string; responseMessageId?: string } = { rootMessageId: fact.rootMessageId };
      if (fact.responseMessageId) correlation.responseMessageId = fact.responseMessageId;
      this.store.acknowledge(operation.operationId, correlation);
    }
  }

  /** Runs in the retaining transport process, never under an observation deadline. */
  async execute(operationId: string): Promise<Operation> {
    const operation = this.store.getOperation(operationId);
    if (operation.action.kind === "LEGACY") return operation; // Imported history is never executable.
    if (operation.completedAt || operation.dispatchStartedAt) return operation;
    const work = this.store.getWork(operation.action.workId);
    if (work.paused) throw new StoreError("WORK_PAUSED");
    const adapter = this.adapterForOperation(operation, true);
    await this.verifyParticipant(adapter, work.context.directory, operation.action.participant.project, operation.action.participant.session, true);
    for (const source of operation.action.input.sources as unknown as SourceSnapshot[]) {
      if (source.sourceClass === "FILE" && readContainedSource(work.context.directory, source.reference).sha256 !== source.sha256) throw new RouterError("SOURCE_CHANGED");
    }
    if (operation.action.kind === "COMPACT") {
      const configured = this.binding(work.context, operation.action.recipientRole);
      if (configured.role.capability === "ORCHESTRATOR") throw new RouterError("ORCHESTRATOR_COMPACT_IS_MANUAL");
      const baseline = operation.action.input.compactBaseline as unknown as CompactBaseline;
      const current = await captureCompactBaseline(adapter);
      if (!baseline || current.session !== baseline.session || !sameDirectory(current.directory, baseline.directory) || current.headMessageId !== baseline.headMessageId) {
        throw new RouterError("MAINTENANCE_BASELINE_CHANGED");
      }
      const payload = operation.action.input.summarize as unknown as Parameters<Adapter["summarize"]>[0];
      if (!payload?.providerID || !payload.modelID || payload.auto !== false) throw new RouterError("MODEL_CONFIGURATION_INVALID");
      if (!this.store.startDispatch(operationId)) return this.store.getOperation(operationId);
      try {
        const reply = await adapter.summarize(payload, fact => this.recordHttpFact(operation, fact));
        this.store.observe(operationId, { observedAt: new Date().toISOString(), activity: "UNKNOWN",
          context: { httpStatus: reply.status, reason: reply.problem ?? "COMPACT_RESPONSE_RECEIVED", bodySha256: reply.bodySha256 } });
      } catch (error) {
        const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "COMPACT_TRANSPORT_UNCERTAIN";
        this.store.observe(operationId, { observedAt: new Date().toISOString(), activity: "UNKNOWN", context: { reason: code } });
      }
      const result = await this.reconcileCompact(operationId, adapter);
      await this.observeOptional(operation.action.workId, operation.action.recipientRole);
      return result.operation;
    }
    if (operation.action.kind !== "CLARIFICATION") {
      const registry = await adapter.listCommands();
      const matches = registry.value?.filter(command => command.name === operation.action.command) ?? [];
      if (registry.problem || matches.length !== 1) throw new RouterError("COMMAND_UNAVAILABLE");
      const selected = matches[0]!;
      const actual: Record<string, Json> = { name: selected.name, template: selected.template };
      for (const key of ["agent", "model", "subtask"] as const) if (selected[key] !== undefined) actual[key] = selected[key]!;
      if (digest(actual) !== digest(operation.action.input.commandDefinition)) throw new RouterError("COMMAND_CHANGED_BEFORE_SEND");
    }
    const input = operation.action.input;
    const common: { messageID: string; agent?: string; variant?: string } = { messageID: operation.messageId };
    if (typeof input.agent === "string") common.agent = input.agent;
    if (typeof input.variant === "string") common.variant = input.variant;
    const onAcknowledgement = (fact: Acknowledgement) => this.recordHttpFact(operation, fact);
    let submit: () => Promise<AdapterReply<OpenCodeMessage>>;
    if (operation.action.kind === "CLARIFICATION") {
      const message: Parameters<Adapter["submitMessage"]>[0] = { ...common, text: String(input.arguments) };
      if (typeof input.model === "string") {
        const slash = input.model.indexOf("/");
        if (slash <= 0 || slash === input.model.length - 1) throw new RouterError("MODEL_CONFIGURATION_INVALID");
        message.model = { providerID: input.model.slice(0, slash), modelID: input.model.slice(slash + 1) };
      }
      submit = () => adapter.submitMessage(message, onAcknowledgement);
    } else {
      const command: Parameters<Adapter["submitCommand"]>[0] = { ...common, command: operation.action.command, arguments: String(input.arguments) };
      if (typeof input.model === "string") command.model = input.model;
      submit = () => adapter.submitCommand(command, onAcknowledgement);
    }
    if (!this.store.startDispatch(operationId)) return this.store.getOperation(operationId);
    try {
      const reply = await submit();
      if (reply.value && !reply.problem) this.acceptReturnedMessage(operation, reply.value);
      else this.store.observe(operationId, { observedAt: new Date().toISOString(), activity: "UNKNOWN", context: { httpStatus: reply.status, reason: reply.problem ?? "RESPONSE_REQUIRES_OBSERVATION", bodySha256: reply.bodySha256 } });
    } catch (error) {
      const code = error && typeof error === "object" && "code" in error && typeof error.code === "string" ? error.code : "TRANSPORT_UNCERTAIN";
      this.store.observe(operationId, { observedAt: new Date().toISOString(), activity: "UNKNOWN", context: { reason: code } });
    }
    await this.observeOptional(operation.action.workId, operation.action.recipientRole);
    return this.store.getOperation(operationId);
  }

  private acceptReturnedMessage(operation: Operation, message: OpenCodeMessage): void {
    if (message.role !== "assistant" || message.session !== operation.action.participant.session || message.parentId !== operation.messageId) throw new RouterError("RESPONSE_IDENTITY_MISMATCH");
    this.store.acknowledge(operation.operationId, { rootMessageId: operation.messageId, responseMessageId: message.id });
    // A synchronous installed-command response is attributable; interpretation stays separate.
    if (isTerminalMessage(message)) this.store.finish(operation.operationId, outcomeForMessage(message));
  }

  async reconcile(operationId: string) {
    const operation = this.store.getOperation(operationId);
    if (operation.completedAt || (!operation.dispatchStartedAt && operation.action.kind !== "LEGACY")) return { operation, disposition: operation.completedAt ? "STORED" : "PREPARED" };
    const adapter = this.adapterForOperation(operation, false);
    if (operation.action.kind === "LEGACY") return reconcileLegacyOperation(this.store, operationId, adapter);
    if (operation.action.kind === "COMPACT") return this.reconcileCompact(operationId, adapter);
    return reconcileOperation(this.store, operationId, adapter);
  }

  private async reconcileCompact(operationId: string, adapter: Adapter) {
    const operation = this.store.getOperation(operationId);
    if (operation.completedAt) return { operation, disposition: "STORED" };
    const work = this.store.getWork(operation.action.workId);
    const model = operation.action.input.summarize as unknown as { providerID: string; modelID: string };
    const result = await observeCompactCompletion(adapter, operation.action.input.compactBaseline as unknown as CompactBaseline,
      { session: operation.action.participant.session, directory: work.context.directory, providerID: model.providerID, modelID: model.modelID });
    const latest = this.store.getOperation(operationId);
    if (latest.completedAt) return { operation: latest, disposition: "STORED" };
    this.store.observe(operationId, { observedAt: new Date().toISOString(), activity: result.activity,
      ...(result.coverage.nextCursor === undefined ? {} : { cursor: result.coverage.nextCursor }),
      context: { ...latest.observation?.context, reason: result.reason, compactProvenance: result.provenance,
        model: result.model as unknown as Json, limitations: result.limitations } });
    if ((result.state === "COMPLETE" || result.state === "FAILED") && result.markerMessageId && result.summaryMessageId && result.evidenceReferences) {
      this.store.acknowledge(operationId, { rootMessageId: result.markerMessageId, responseMessageId: result.summaryMessageId });
      return { operation: this.store.finish(operationId, { execution: result.state === "COMPLETE" ? "COMPLETED" : "FAILED",
        evidenceReferences: result.evidenceReferences, reason: result.reason }), disposition: result.state };
    }
    return { operation: this.store.getOperation(operationId), disposition: result.state };
  }
}
