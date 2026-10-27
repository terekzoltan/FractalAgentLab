# Orchestrator handoff bridge

Status: validated source; deployment and first-send evidence are separate.
No live enrollment, MCP host configuration, installation, runtime rebuild,
session send or product continuation is performed by the presence of these files.
The Owner must authorize the actual deployment and first send.
The [proposal](../../../plans/epics/ORCHESTRATOR-HANDOFF-AND-WORKFLOW-LEARNING.md)
supplies intent, not a live grant.

## Boundary

`Owner -> Codex Chief of Staff -> local stdio MCP -> FAL RouterEngine`
`-> existing enrolled orchestrator -> ordinary FAL lane lifecycle`

This is an explicit `ORCHESTRATOR_HANDOFF` action and effect, not READ_ONLY
clarification. It reuses the single operation store, claims, dispatch latch,
OpenCode adapter, retained executor and reconciliation. It opens a distinct
control work; it never amends/unpauses the product work, selects a successor,
accepts a product or grants commit/push rights.

There is no lane-send, arbitrary URL/session, SQL/shell proxy, session creation,
permission answer, interrupt or model-selection tool. Explicit Owner-delegated
compact/restore uses the separately activated maintenance interface below. The recipient
receives the exact displayed message plus displayed scope/stop/exclusions and
an instruction to load the current orchestration skill. No installed command is
invoked. Recorded agent/model/variant from the last completed normal user turn are frozen;
missing/conflicting evidence fails closed, not back to global/command defaults.
If the user message omits a variant override, use the effective variant recorded
on its exact, stable completed assistant response. Two explicit conflicting
variants still fail; no current provider/configuration default is guessed.
This is not a claim about current unsent UI selection: the Owner must confirm
that selection for the quiescent pilot, because changing it without a new message
is as unobservable to GET history as an unsent browser draft.

## Private operator enrollment

Enrollment is ordinary reviewed **private configuration**, not an exposed MCP
tool. No examples contain real endpoints, credentials or session IDs. The
existing `targets` map must contain:

- A real control target whose directory/project is the orchestrator's home, with
  its verified `ORCHESTRATOR` role. It may be a different repository from the
  product. Its normal `sessionHome` rules are unchanged.
- The governed product target, already enrolled in FAL.

Optional `router-config.json` addition, disabled by default:

```json
{
  "orchestratorBridge": {
    "enabled": false,
    "maintenanceEnabled": false,
    "projects": {
      "named-project": {
        "controlTarget": "existing-control-target",
        "recipientRole": "Orchestrator",
        "governedTarget": "existing-product-target",
        "instructionReference": "actual-owner-enrollment-reference"
      }
    }
  }
}
```

No config field is proof of Owner approval. Enabling this flag requires the
separate rollout envelope and verified host approval policy. Aliases of the same
session on the same loopback server must retain the same project/namespace/home
and orchestrator capability. Do not weaken product lane Git-worktree checks.
New handoffs also check retained unfinished physical server/session claims inside
the store transaction, so replacing a namespace does not bypass an old claim.

## MCP facade

The built entry point is `runtime/dist/src/v2/handoff-mcp.js`. It takes only
`--state-root <absolute-private-root> --config <absolute-private-config>`.
Use Node 22 with `--experimental-sqlite`. Credentials are inherited process
environment (`OPENCODE_SERVER_USERNAME`, `OPENCODE_SERVER_PASSWORD`), never tool
arguments or saved preview fields. Do not put a plaintext password in host config.
No new dependencies or network listener were added.

On Windows use `scripts/Start-OrchestratorHandoff.ps1` from the same immutable
release tree, with absolute `-StateRoot`, `-ConfigurationPath` and
`-CredentialPath` arguments. The credential is an existing Windows DPAPI
PSCredential export. The launcher checks Node 22, loads the credential without
logging it, places it only in the child environment, and relays stdio as raw
bytes. It never builds, installs, enrolls or enables sends. Do not put a password
in Codex configuration or the command line.

The minimal stdio adapter negotiates MCP `2025-03-26` or `2024-11-05`, implements
newline-delimited JSON-RPC initialization/ping/tools, bounds input lines to 64 KiB,
and emits only protocol JSON on stdout. It does not advertise resources/prompts.
Host compatibility and the human approval UI still require the live pilot.

A completed manual compact may be the latest idle boundary when the bounded
history contains an adjacent pure native manual-compaction marker and its exact
completed summary child, immediately after a completed normal turn. The summary
agent/prose is never used as the next dispatch selection or project authority.
Agent/model/reasoning come from the preceding normal turn (one exact parent GET
if necessary), must agree with the manual marker, and all evidence is pinned and
rechecked. Automatic/incomplete/ambiguous compaction remains blocked; no wider
history scan, session mutation, synthetic restore or lifecycle replay is added.

For a connection-only rollout before the first-send grant, keep the private
`enabled` switch false and restrict the host's enabled tools to inspection and
preparation. Keep both `send_handoff` and `reconcile_handoff` unavailable.
Verify initialize/tool discovery and bounded inspection only; do not create
a dummy live preview. Side-by-side versioned distribution avoids replacing
the primary runtime underneath existing project workers.

| Tool | Effect |
|---|---|
| `read_session_context(project, role, count?)` | Bounded GET-only completed output, activity and attention for enrolled orchestrator/Meta/lanes; [limits and evidence semantics](session-context-mcp.md). No store open/write. |
| `inspect_orchestrator(project)` | Bounded GET readiness/selection check; no store open/write. |
| `prepare_handoff(project, handoffKey, scope, stoppingPoint, exclusions, message, instructionReference)` | Local immutable preview only; no operation or participant claim. |
| `send_handoff(handoffId)` | Approval-required exact send through FAL; returns promptly. |
| `inspect_handoff(handoffId)` | Retained facts via explicitly read-only SQLite connection; no migration/reconciliation. |
| `reconcile_handoff(handoffId)` | Explicit local evidence mutation from bounded GETs; no POST/resend. |
| `prepare_orchestrator_maintenance(project, maintenanceKey, mode, instructionReference, packet)` | Freeze named-work context and exact restore preview; no operation/claim/send. |
| `compact_orchestrator(maintenanceId)` | Approval-required one native compact; no restore successor. |
| `restore_orchestrator(maintenanceId)` | Approval-required exact context-only message, preserving selection. |
| `inspect_orchestrator_maintenance(maintenanceId)` | Read both retained phase facts without writes. |
| `reconcile_orchestrator_maintenance(maintenanceId, phase)` | Bounded GET recovery of the named compact/restore phase; local evidence mutation. |

Configure the host to **prompt for `send_handoff` and `reconcile_handoff`**.
Do not treat tool annotations (`readOnlyHint: false`) as enforced approval.
`prepare_handoff` is also labeled a local mutation. The first pilot must verify
that the host displays the exact preview and that deliberate authorization
covers that target/scope/stop. If it cannot, retain copyable/browser handoff mode.
No `approved: true` field or instruction-reference string is an attestation.

## Owner-delegated orchestrator maintenance

This capability requires both bridge `enabled:true` and the additional private
`maintenanceEnabled:true`; absence defaults to off. Installation does not activate
it. Configure the host to require approval for `compact_orchestrator`,
`restore_orchestrator` and `reconcile_orchestrator_maintenance`. The exact preview
and current Owner instruction must cover the phase. There is no background trigger
or self-compaction policy. Ordinary lane `compact` remains forbidden for an
ORCHESTRATOR, and ordinary `restore` cannot bypass this preview boundary.

The private bridge may additionally set `orchestratorBridge.frontierConfigurationPath`
to the absolute path of its existing canonical Router V2 configuration. This is
read-only lookup of the **explicitly named work targets only**, so later enrolled
worktrees do not require copying every target into the bridge snapshot. It never
merges targets, discovers recipients, changes bridge activation, or uses that file
for the orchestrator's send address/model. The bridge's own governed-project and
control-session enrollment remain authoritative. Named target project/namespace
and work-directory identity must agree. The selected target entry and configuration
reference are digest-bound in the preview; changing an unrelated canonical target
does not invalidate it. Missing/invalid source or named target blocks preparation,
without fallback. Relative paths and symlink/reparse traversal are rejected.
When this optional pointer is absent, existing bridge-target lookup is unchanged;
operators must then refresh its explicit snapshot for newly enrolled work targets.

Example prepare input (illustrative names, not runtime identity):

```json
{
  "project": "named-project",
  "maintenanceKey": "owner-maintenance-1",
  "mode": "compact_restore",
  "instructionReference": "current-owner-request",
  "packet": {
    "frontiers": [
      {"workId": "existing-data-work", "statePath": "ops/PROJECT_STATE.md", "combinedPath": "docs/Combined.md"},
      {"workId": "existing-ui-work", "statePath": "ops/PROJECT_STATE.md"}
    ],
    "note": "OCoS observation at <time>, source <retained result/file section>: <short excerpt>. Interpretation: <uncertainty and first unfinished action>. This is advisory, not new authority."
  }
}
```

`mode` is `compact_restore` or `restore` (including after Owner manual compact).
The packet accepts 1–8 explicit work references and an optional note of at most
4096 UTF-8 bytes. Relative `.md` State/Combined locators are optional and pinned
under each verified configured execution root; no arbitrary path or project is
accepted. Named works must belong to the governed project/namespace.
The configured root is not execution-readiness attestation: the packet explicitly
reports `executionRootVerified:false`. A missing contained Markdown source is
recorded as UNAVAILABLE, preserving basic role restore and the dependent stream's
blocker; unsafe traversal/symlink paths are rejected. Availability changes invalidate
the frozen preview just like content changes.
Authority, pause and operation facts are derived from FAL, not supplied by the note. The
packet retains every pending operation and latest completed result per role,
explicit total/omitted-history counts and a digest of retained operation facts.
It does not attest all project work was selected, product acceptance or loaded
instructions. OCoS must choose the full relevant parallel frontier using fresh
session context and durable references. No transcript crawl or primary-root guess.

Flow: prepare exact preview → explicitly approved compact call → inspect and,
if needed, reconcile the **same** compact → after verified native marker/summary
completion, explicitly approved restore call → inspect/reconcile the same restore.
Restore is an ordinary message using the captured agent/model/reasoning; it loads
the shared orchestrator restore method without invoking command model defaults.
The dedicated control work has only SESSION_MAINTENANCE. Product works, pauses,
scope, results and claims are not amended. No lifecycle is sent automatically.

Fresh idle/attention/head/enrollment/selection and named-frontier checks happen
before preparation and again in the retained executor. Missing terminal output,
busy/unknown state, a pending handoff claim or a changed frontier blocks mutation.
Do not dismiss a handoff claim merely because its session is idle: recover that
existing operation through its supported path first. Native summarize has no
caller-chosen root; completion uses the existing unique post-baseline effect proof,
not a universal exactly-once claim. A timeout retains uncertainty, never a retry.

Previews expire after ten minutes. Same key/content returns the same preview and
same dispatched phase returns its retained operation even after expiry or disable.
If compact completed but a lane/frontier changed or the preview expired, preserve
the completed compact and prepare a **new `restore`-only preview**, referencing
that prior maintenance/result in the advisory note and freshly gathered context.
Never compact again to refresh a packet. If a pre-send worker check fails, it
records unsent FAILED and releases only its own claim; possible sends keep theirs.
Inspect this disposition before preparing any replacement. Changed context is not
permission to unpause works or widen continuation. Restore reports context quality
and stops; a separate authorized handoff may continue the lifecycle afterward.

## Safety, recovery and limits

Previews expire after 10 minutes. Stable `(project, handoffKey)` returns the same
preview; changed content conflicts. Abandoned previews do not hold session claims.
The private `handoff-previews` directory contains bounded exact approved text and
provenance; it is not portable/public evidence. No automatic preview cleanup.

Before preparing a send and again in the worker, verify the actual session and
directory/project, idle status, clear permission/question channels and two stable
bounded history reads (latest 12 messages), with an exact-parent lookup and
confirmation rather than a history scan when a long turn's root is outside that
page. The latest assistant must terminate
the latest normal user root, with no error/compaction/revert ambiguity. New input,
changed binding/selection, missing attention/selection, busy or unknown state
means no send. This candidate does not queue waiting handoffs.

A preview can be stale without the session being busy. Conversely, a repeated
send first returns its existing operation, even if the session is now busy, the
bridge has been disabled or today's config/credentials are unavailable. Thus a
prior possible send is never disguised as a fresh refusal.

After the dispatch latch, interruption/disconnect retains POSSIBLE until actual
evidence settles delivery. The detached existing FAL executor outlives the MCP
client. Reconcile the same handle; do not create a new key to retry uncertainty.
Before any POST, failed worker preflight records an unsent FAILED disposition and
releases the claim; it does not retry an idle/busy check for an hour.

Completion/acknowledgement is an orchestrator response, **not** proof that the
product stop was reached. No automatic acceptance interpretation is created.
Prepared previews, unobservable UI drafts and manual sends remain outside the
session claim protocol; this cannot provide globally exactly-once UI semantics.
An unavailable exact parent is a blocker: keep copyable mode rather than
expanding history automatically. Same-user agents with unrestricted
shell/filesystem access are not isolated by this bridge.

## Verification and rollout

Offline tests cover explicit type/effect, unchanged product pause/scope, observed
model/agent/variant, wrong identity/capability, busy/unknown/attention, incomplete
turn/compact/revert, stale head/config, exact preview/idempotency, concurrent
claims/dispatch, uncertain send and reopened-store recovery. Wire tests cover
actual stdio negotiation, unsupported methods, malformed/bounded input, redacted
errors and MCP EOF while a fake HTTP POST remains retained by its worker.

The standard runtime suite covers existing operation/store crash boundaries;
the bridge does not add a parallel transport. Host permission interaction,
installed-version compatibility, actual OpenCode profile/variant behavior and
first useful live handoff are **not** established by offline fixtures.

Deploy only at a safe runtime boundary; do not clean/rebuild a live `dist` under
an executor. Existing source runtime remains untouched until separately approved.
This adds an action/effect without a new SQL schema migration. Older executors
must not execute the new action: deploy compatible readers/executors together.
Rollback disables new sends, preserves previews/operations and keeps compatible
recovery available. No stateProjection writes are made for handoff control work.
