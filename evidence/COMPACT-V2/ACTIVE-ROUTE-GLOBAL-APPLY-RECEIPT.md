# Active Route Global Apply Receipt

Plan identity: `awc-active-route-compact-v1-owner-20260805`
Candidate: `active-route-global-nondispatch-v1`
Disposition: `POST_RESTART_VERIFIED_AND_SNAPSHOT_SYNCED`
Applied UTC: `2026-08-08T09:37:22Z`

## Applied identities

| Surface | Before SHA-256 | Applied SHA-256 |
|---|---|---|
| `/after-compact` command | `16a9499f6c43bd312f01bbbdf5d5b95dcca592e7fe4af4b1739bc881d9c80082` | `c7651acd07143dc4e554f187ff90f689e4ce36895d1e2da8822e43f0b02ca37f` |
| `context-restore` skill | `a7b18d4222b1aaf82c7d7cf5ffce68c20a2b57a5cbd03e3c79ed77240c51e155` | `f4f6c815ec40b2f2404f6156dd9134f927e95ce3db6842165e534ec12760ff33` |

The apply was baseline-hash guarded, backup-first, and atomically replaced each
exact target. A private rollback archive exists outside active discovery. Its
machine path is intentionally omitted from durable evidence.

## Behavior

- V2 legacy `resume_mode: AUTO_RESUME` remains readable.
- Hydration emits non-sending `ROUTE_READY` instead of `AUTO_RESUME` action.
- `/after-compact` and `context-restore` remain read-only and never dispatch the
  next project workflow command.
- Canon `3.1.0` six-schema pins and pack digest are bound in the live definitions.

## Post-restart closure

The Project Owner restart was confirmed. Fresh pure OpenCode command discovery
passed with OpenCode `1.18.15`, command-registry identity
`b38ab52b6d20f285a69e6402c0e64d52c47b32ae3f7fe3946f9f18ded8de01d6`, and
`after-compact` entry identity
`1321868dddde6f034a95728297cc485ba470d8f8bd39154fafa2c33bda263a37`.

The server HTTP registry probe stopped on authentication failure and was not
retried or counted as PASS. The official Toolbox disk-contract validation and
pull passed with 15 commands, 20 skills, 35 files, and inventory SHA-256
`12e79c9fd573653ee4a0385808a7f4c757b262053ea6b308c43b11284af8cf85`.
The generated Canon snapshot was atomically synchronized with contract alignment
`MATCH` and payload digest
`edfb183dc6889626a451d5f9312d72e1c00d328b098b013e262062c3ed75c312`.
Canon `3.1.0` pack validation passed with release readiness `READY`.

Offline target migration checks remain mandatory. Compact and all affected
project workflows remain frozen.
