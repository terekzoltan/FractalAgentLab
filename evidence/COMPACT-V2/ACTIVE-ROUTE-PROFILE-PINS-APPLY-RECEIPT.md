# Active Route Profile Pins Apply Receipt

Plan identity: `awc-active-route-compact-v1-owner-20260805`
Candidate: `active-route-profile-pins-global-v1`
Disposition: `APPLIED_AWAITING_RESTART`
Applied UTC: `2026-08-08T12:51:48Z`

## Exact operation

- Target: global `context-restore/SKILL.md` only.
- Before SHA-256:
  `f4f6c815ec40b2f2404f6156dd9134f927e95ce3db6842165e534ec12760ff33`.
- Applied SHA-256:
  `bde5af43e6733af7758fde055fc7c49f85bc5a7ab2915df4c56d8bd822ce14bd`.
- Apply bundle SHA-256:
  `88a1efdb51509cb0f27724a766017f3217074cc274e960a0d5b237ab524a1b07`.
- Canon contract SHA-256:
  `e25fb7945d5a62a7aa2066a17711c1db2e2f24a059c2b9387353c4e3981ddf61`.
- Profile-bound pack digest:
  `9116d7a7682ff7140f709e28e6ea2f8ed24ab33f61e1441bd217f5500a833a03`.

The apply was exact-baseline guarded, backup-first, and atomic. A private rollback
archive exists outside active discovery; its machine path is omitted from durable
evidence. `/after-compact` and every other global file remained unchanged.

## Pending gate

The Project Owner must restart the affected OpenCode instances. Fresh pure command
registry proof, target manifest re-verification, official Toolbox pull, Canon
snapshot sync, and Canon pack validation remain mandatory. All target workflows,
compacts, and pilots remain frozen.
