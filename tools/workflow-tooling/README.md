# Versioned workflow tooling installer

`Invoke-WorkflowTooling.ps1` is the single installer entrypoint for Git-owned AWC
OpenCode commands, skills and review agents, and Workflow Operations Codex skills.
AWC5 release installation and Toolbox writer retirement are recorded in
plans/epics/FAL-ROUTER-V2-RELEASE.md at the repository root. The interface below
still distinguishes source, installed files and separately observed loaded state.

## Interface

Run in Windows PowerShell 5.1 or later. The public script returns structured
PowerShell objects. One mapping names one manifest and one disjoint install root;
source paths are relative to the manifest directory. Supply just the affected
mapping(s); a Codex skill change does not require a Canon release or deployment.

```powershell
$mapping = @(
    @{ ManifestPath = 'C:/reviewed/AWC/tooling/opencode/managed-files.json'; InstallRoot = 'C:/isolated/opencode' },
    @{ ManifestPath = 'C:/reviewed/WOps/skills/managed-files.json'; InstallRoot = 'C:/isolated/codex/skills' }
)
$installer = './Invoke-WorkflowTooling.ps1'
$state = 'C:/private-app-data/workflow-tooling'
$plan = & $installer -Action Plan -Mapping $mapping -StateRoot $state
# Review the returned exact files, before/after identities and blocked/issues.
$receipt = & $installer -Action Apply -PlanId $plan.id -StateRoot $state -ServerState Absent
& $installer -Action Status -Mapping $mapping -StateRoot $state -ServerState Absent
# After interruption, use the returned plan id as the transaction id:
& $installer -Action Resume -TransactionId $plan.id -StateRoot $state
# Deliberately restore the transaction's touched files to their prior state:
& $installer -Action Restore -TransactionId $plan.id -StateRoot $state
```

The default StateRoot is the current user's local application data under
`FractalAgentLab/workflow-tooling`. Production use must keep this operational
directory private and outside Git. Source, installation and state roots must be
disjoint and cannot contain links/reparse points. Use the same StateRoot for
ongoing maintenance; its installed index is the known-drift baseline.

The manifest schema is deliberately small:

```json
{
  "schemaVersion": 1,
  "files": [
    {"source": "commands/after-compact.md", "target": "commands/after-compact.md", "kind": "command"},
    {"source": "skills/workflow-fix/SKILL.md", "target": "skills/workflow-fix/SKILL.md", "kind": "skill"},
    {"source": "agents/review-correctness.md", "target": "agents/review-correctness.md", "kind": "agent"}
  ],
  "retire": [{"target": "commands/retired-alias.md", "kind": "command"}]
}
```

Every file is exact and allowlisted; no directory enumeration imports global
definitions. Commands and review agents are Markdown. Skill support files may
be Markdown, Python, PowerShell, JSON, YAML, text or shell source. Provider/auth
configuration and unrelated definitions are outside the managed path contract.
The maintainer still reviews source content for private material before Git
import. Omission from a newer manifest never means deletion. Retirement is a
separate explicit list, backed up and recoverable.

The WOps manifest lives inside its `skills` directory and uses skill-relative
paths such as `workflow-systems-steward/SKILL.md`; map its install root directly
to the Codex skills directory. AWC uses the shown `skills/...` prefix under its
OpenCode root. Existing mixed-case command aliases remain valid.

First installation refuses to replace an existing differing file unless Plan
uses `-AdoptExisting`. This flag records an explicitly reviewed first-adoption
baseline; inspect/import intended local edits before using it. It never bypasses
drift against an existing installed index. Subsequent local drift is preserved:
reconcile source and the private recorded baseline deliberately in maintenance,
then create a fresh Plan. There is no force-overwrite or automatic global import.

## Source, installed and loaded facts

Plan records a selected source generation, exact operations and source hashes.
Its returned `id` is the SHA-256 digest of the immutable plan content; pass that
value to `-PlanId` or `-TransactionId`. It is checked before the first Apply as
well as recovery, so editing a saved plan invalidates the reviewed identity.
Apply checks the plan's source and installed baseline, freezes source payloads,
backs up changed existing files only, replaces files atomically where supported,
and verifies every managed after-state. A private source-derived readable
reference is produced at `StateRoot/references/<plan-id>.md`. It is explicitly a
source reference and is not an active Canon authority or a loaded registry.

Status compares current source against current installed bytes without writing
anything. Receipt `phase=COMPLETE` means installation/reference/receipt closure;
`loaded.activationPending` is a separate activation dependency. The installer
never contacts a server, starts/restarts it, aborts a session, or sends lifecycle
commands. `-ServerState Absent` is an explicit caller-supplied observation and
permits source/install closure without starting an unnecessary process. Without
an observation, loaded state is `UNKNOWN`.

If relevant, maintenance may supply `-ServerState Running -LoadedEvidencePath`
with a sanitized observation from an independently authorized read-only registry
check. Only the following fields are consumed; no process/session identity,
endpoint, credentials or raw response enters the receipt:

```json
{"observedAt":"2026-09-06T00:00:00Z","sourceGeneration":"<generation for exactly the selected mappings>"}
```

The provider of that observation must actually establish loaded generation; an
installed hash is not evidence. A mismatched generation is `STALE_LOADED`, and an
observation older than five minutes or dated in the future is `STALE_EVIDENCE`.
A fresh matching supplied observation is only `MATCH_AT_OBSERVATION`, never a
claim of an independently queried current process. Re-run Resume with fresh
evidence after an Owner-managed reload. Ordinary restart adds no P0B gate.

## Recovery and implementation notes

One journal records `INSTALLING -> REFERENCE -> RECEIPT -> COMPLETE`, with
per-path `PENDING -> PREPARED -> APPLIED` writes. A crash after a write but before
its receipt can reconcile exact before/after hashes. Resume validates all known
partial states before continuing, and preserves unexpected edits. It resumes
reference/receipt closure from frozen source without repeating deployment even
if the working source has since advanced; Status shows that later source drift.
Restore handles incomplete apply and interrupted restore, rejects unknown
content, and restores only exact touched files. It does not remove directories.
Keep private objects/journals until recovery and needed history are resolved.
Backup and source objects use a flat content-addressed private directory, avoiding
unnecessary path depth on Windows while safely sharing identical archived bytes.

The mechanics reuse Toolbox's durable temporary writes and File.Replace,
hash-verified touched-file backups, reparse rejection, exclusive writer lock and
known-partial-state reconciliation patterns. No Toolbox script is invoked.
Named installation mutexes also exclude concurrent instances using different
state directories. Locks coordinate this installer; external editors are caught
by precondition and after-state checks, not an OS-wide editor lock. The actual
displaced file is hash-checked after Replace or retirement's quarantine Move.
If an edit raced that atomic boundary, both versions are retained and the journal
enters `DRIFT` with an exact private recovery path. Resume/Restore refuse to
overwrite it automatically: maintenance must compare/import the preserved edit
and deliberately reconcile that transaction. Do not delete a `.wt-*.replaced`
or `.wt-retired-*` recovery file as generic temporary-file cleanup. No
multi-repository atomic commit, duplicate snapshot publisher or new lifecycle is
introduced. Publication remains maintenance's authorized responsibility.

## Verification and integration handoff

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools/workflow-tooling/tests/Test-WorkflowTooling.ps1
```

The process-only execution-policy option does not change machine/user settings.
Tests generate one isolated temporary root, assert write/cleanup containment,
and remove only that root. Fault injection exists only as a module-private test
hook. No global installation or server is used.

Coordinator-owned integration still needs:

- A Windows offline CI invocation and exact review/staging of these four source
  files (script, module, README and test). They are currently visible as untracked
  files; a coordinator-owned `.gitignore` allowlist is optional future curation,
  not a prerequisite to source visibility.
- The AWC and WOps managed manifests/source candidates and active instruction
  links, plus relevant integrated Canon pack validation. No validator stub is
  supplied here.
- At authorized cutover, retire or forward old Toolbox mutation entrypoints so
  this is the sole writer; keep old archives recoverable. Neither old writer
  activation nor live retirement is part of this local candidate task.
- Independently authorized loaded-registry observation/qualification and any
  necessary Owner-managed reload. A source-derived reference cannot substitute
  for that evidence.
