# Optional workflow experiments

This standard-library Python CLI adds a small, private measurement ledger beside
FAL Router V2. It never sends a message, changes router state, selects a lifecycle
successor or accepts a product. Installation and ordinary workflow execution do
not activate a study. No service, scheduler, provider call or IC causal-discovery
algorithm is included.

The semantic owner is the adopted Canon's `canon/WORKFLOW-EXPERIMENTS.md` and its
study template. This tool implements immutable study registration, allocation,
typed observations, safe operation links and descriptive reports. AWC keeps all
mandatory review and security floors in both arms. **A is the baseline; B adds
the specifically authorized experimental reviewer.**

## Prerequisites and deployment

Python 3.12+; no packages or environment keys. Run the script from the verified
FAL source revision. It is loaded per invocation, independently of the router's
long-running runtime; no OpenCode/MCP restart or replacement is needed. Keep
private ledgers/requests in an authorized `work-notes/workflow/<study>/` folder,
outside repositories. The directory must already exist. Use absolute paths for
the ledger and inputs. File access follows the current operator's permissions;
the SQLite append-only constraints protect against accidental edits, not a
malicious local administrator.

Run from a FAL checkout:

```powershell
python -B tools/workflow-experiments/workflow_experiments.py --help
python -B -m unittest discover -s tools/workflow-experiments -p 'test_*.py' -v
# Isolated synthetic technical pilot. This path must not exist yet.
python -B tools/workflow-experiments/workflow_experiments.py technical-pilot `
  --ledger "$env:TEMP/fal-experiment-pilot.sqlite"
```

The pilot creates eight synthetic candidate/review units, exercises assignment,
retry, outcomes, missing/failed/aborted cases and a read-only Router fixture link,
then stops its synthetic study. `liveStudiesActivated: 0`, `active: false` and
`reviewerEfficacyEstablished: false` are required. It proves the instrumentation,
not that a reviewer improves real work. Re-running requires a new explicit path;
the existing pilot ledger is never overwritten.

## Operator interface

Every write command emits JSON. An error returns exit 2 with a bounded reason,
`experimentalExtraAllowed: false` and `normalWorkflow: CONTINUE_BASELINE`.
The caller must retain that omission in its normal work receipt if the ledger
is unavailable. **A measurement failure is not a product failure or a new gate.**
Do not invoke `assign` at all unless this task belongs to a separately approved
study. Never create extra reviewers just to populate a study.

| Command | Required input | Effect |
|---|---|---|
| `init-study` | `--ledger`, `--request` | Register immutable contract; inactive by default |
| `activate-study` | `--ledger`, `--request`; live also `--allow-live` | Record explicit activation; no dispatch |
| `stop-study` | `--ledger`, `--request` | End future experimental additions; retain all records |
| `assign` | `--ledger`, `--request` | Persist one pre-outcome unit and random arm, or baseline omission |
| `observe` | `--ledger`, `--request` | Append an idempotent structured observation |
| `link-operation` | `--ledger`, `--study-id`, `--unit-id`, `--router-db`, `--operation-id` | Read exact metadata from Router DB with `mode=ro`, append safe link |
| `report` | `--ledger`, `--study-id` | Read-only arm/stratum summary |
| `export` | `--ledger`, `--study-id` | Read-only typed facts, hashes and pseudonymous references |

`activate-study`/`stop-study` request: `{"studyId":"approved-study","approvalRef":"<64 lowercase hex SHA-256 of the exact Owner decision>"}`.
The recorded hash is an audit reference, **not an authentication token or proof
that permission was granted**. The operator must verify the actual Owner decision
and ordinary FAL/project authority. `--allow-live` is an additional deliberate
activation switch; nothing in this release invokes it for real project work.
A stopped study cannot restart: a new protocol needs its own approval and ID.

Example commands (replace all paths and identifiers with approved ones):

```powershell
python -B tools/workflow-experiments/workflow_experiments.py init-study `
  --ledger 'C:/approved/work-notes/study/ledger.sqlite' `
  --request 'C:/approved/work-notes/study/contract.json'
python -B tools/workflow-experiments/workflow_experiments.py assign `
  --ledger 'C:/approved/work-notes/study/ledger.sqlite' `
  --request 'C:/approved/work-notes/study/pre-outcome.json'
python -B tools/workflow-experiments/workflow_experiments.py report `
  --ledger 'C:/approved/work-notes/study/ledger.sqlite' --study-id approved-study
```

## Exact request shapes

The checked-in [study example](example-study.json),
[assignment example](example-assignment.json) and
[observation example](example-observation.json) are synthetic fixtures and the
executable schemas. Replace the zero observation unit ID with the returned unit
ID and replace the canned actual variant, candidate, findings and evidence hashes
with independently observed facts; example B is not an observed treatment.
Unknown fields, duplicate JSON keys, requests over 64 KiB, nonfinite or
negative metrics and malformed hashes are rejected. There is no freeform
transcript or secret field.

Study registration requires question, A/B definitions, preserved mandatory checks,
explicit `allowedWorkIds`, eligible task/risk classes and predefined strata,
primary outcome, maximum sample, expiry/stop rule, follow-up days, human-readable
budget/evaluation rule, approval-reference hash and workflow/model/prompt hashes.
Only low-risk work is currently eligible. Sample count and expiry are enforced;
the human-readable monetary/token budget and stop rule remain the responsible
operator's obligation because this tool does not execute or bill model calls.
The model hash identifies the declared complete model/effort configuration for
both variants, not a model roster embedded in this tool.

Assignment must precede treatment and outcome knowledge. `preOutcome: true` and
the eligibility evidence hash are accountable operator attestations; the tool
cannot prove unobserved session history. Units use the original work plus stable
review-family identity and bind the original candidate digest. Repairs, retries,
rechecks and recovery reuse that exact request. A changed candidate/family
cannot silently overwrite allocation; candidate aliases within a study/work
are rejected, including known repaired candidates. Never rename a work/family
to manufacture an independent observation. Batch/shared sessions also require
an explicit dependency/carryover limitation in the study evaluation.

Allocation is cryptographically randomized in permuted blocks of four (`AABB`)
inside predefined strata. A transaction commits the unit and block atomically.
Concurrent submissions cannot reroll or consume duplicate samples. The private
ledger contains the remaining block sequence; keep it from reviewers and do not
choose future eligibility from predicted labels. Partial blocks may be unequal.
Only a successful durable B assignment with `experimentalExtraAllowed: true`
permits the **already authorized** extra. Reused assignments do not authorize a
repeat send. After stop/expiry they return their historical arm with extra false.
Active-study exclusions/expiry/cap/version drift produce idempotent omission
records, separate from the assigned-unit denominator. Disabled studies create no
units. A failed unavailable-ledger call must be recorded by the caller's receipt.

Observations are cumulative snapshots for one unit (not per-call increments).
They distinguish state, actual variant, current candidate plus lineage evidence,
deviations, version drift, carryover, evaluator independence/blinding and
accepted/rejected/unresolved findings. Material finding counts require an
independent evaluation with evidence hash and are primary only for terminal
cases. Missing evaluation stays missing, including pending partial findings.
Repaired candidate evidence links to the original unit; it is not another sample.
Every correction names the preceding observation digest and has an explicit
`correction` deviation. All previous observations remain in export.

Actual native reviewer model/effort is a separate hash/effort/quality/evidence
record (`reported`, `observed`, `unknown`). Router metadata does not prove which
native reviewers ran. Reviewer receipt owners must supply those facts. Usage
may be `provider_reported`, `billed` or `unknown`; unknown quantities are null.
Context-window estimates are deliberately unsupported as usage or billing.
Elapsed time is a reported measured cost, not an automatic workflow timeout.
Follow-up zero is meaningful only with observation days and evidence; report
separates completed follow-up from missing/short follow-up.

## Router facts and privacy

`link-operation` queries only scalar work/input/result identities, timestamps,
kind/command, delivery and execution fields from a consistent read-only Router
V2 SQLite snapshot. It never selects session/message IDs, full inputs, results,
credentials, permission responses or chat history. Work identity must match the
unit; one operation cannot populate another unit. A terminal result predating
assignment is rejected, avoiding retrospective outcome-selected enrollment.
The operator still must bind the right candidate/review in its evidence: same
work alone does not prove semantic candidate identity. Later snapshots of the
same operation preserve failed/recovery history without editing Router facts.
`COMPLETED` stays a transport observation, never product acceptance.

This supported adapter is deliberately read-only and never initializes or
migrates the Router database. Using a Router database as the experiment ledger
is rejected before any write. The experiment database uses its own application
ID, schema, WAL and short transactions; it acquires no router participant claim
or write transaction. Its short SQLite read snapshot may take a normal read lock.

Reports/exports omit private contract prose, allowlisted work names, raw operation
IDs, paths and source output. References are salted hashes. They retain typed
categories, digests and dates for comparison. Exported metadata may still be
sensitive; this is data minimization, not permission to publish or a guarantee of
anonymity. Protect the local ledger and approve its destination separately.

## Interpretation and limits

Reports show assigned denominators (intent-to-treat population), missing outcomes,
failures/aborts, actual-treatment counts, omissions, independently evaluated
outcomes, observed costs, version/carryover flags and follow-up completeness by
arm and stratum. Complete-case means are clearly labelled and not causal
estimates. Do not silently drop failed or omitted-extra units, pool incompatible
versions or count retries as independent samples. Study-level totals are
descriptive bookkeeping; use the predeclared question and stratification for
analysis. There is no automatic winner, significance claim or routing change.

The Evidence Analyst proposes an effect/uncertainty assessment with alternative
explanations or insufficient evidence. Later defects can be appended under the
same correction chain. Owner/independent review decides any maintenance candidate.
Agentic Engineer work is separately scoped; the author cannot accept/deploy its
own experimental conclusion. This first version supports controlled comparisons,
not inductive-causation structure discovery from observational logs.
