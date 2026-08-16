# Active Route Post-Restart And Snapshot Receipt

Plan identity: `awc-active-route-compact-v1-owner-20260805`
Candidate: `active-route-global-nondispatch-v1`
Transaction: `active-route-20260808T102027Z-de6b59278ee1`
Disposition: `SNAPSHOT_SYNC_VERIFIED`

## Fresh registry evidence

- Owner restart confirmation: received.
- OpenCode version: `1.18.15`.
- Launcher SHA-256:
  `7dc7f9e963b88bbfb7a529a82d1922adf642d386f096fc250e891e374884ee8e`.
- Pure command-registry SHA-256:
  `b38ab52b6d20f285a69e6402c0e64d52c47b32ae3f7fe3946f9f18ded8de01d6`.
- `/after-compact` entry SHA-256:
  `1321868dddde6f034a95728297cc485ba470d8f8bd39154fafa2c33bda263a37`.
- Pure command count: `17`, including built-in/external entries.
- Server HTTP registry probe: `BLOCKED_AUTHENTICATION_NO_RETRY`; not counted as
  successful evidence.

## Operational snapshot

- Official Toolbox contract validation: `PASS`.
- Active managed inventory: `15 commands / 20 skills / 35 files`.
- Live and operational snapshot inventory SHA-256:
  `12e79c9fd573653ee4a0385808a7f4c757b262053ea6b308c43b11284af8cf85`.
- Applied `/after-compact` SHA-256:
  `c7651acd07143dc4e554f187ff90f689e4ce36895d1e2da8822e43f0b02ca37f`.
- Applied `context-restore` SHA-256:
  `f4f6c815ec40b2f2404f6156dd9134f927e95ce3db6842165e534ec12760ff33`.

The operational snapshot includes the full current live managed inventory. Only
the two files above are attributed to the Active Route candidate; other current
definitions retain their prior lineage.

## Canon publication

- Canon snapshot contract alignment: `MATCH`.
- Canon snapshot payload digest:
  `edfb183dc6889626a451d5f9312d72e1c00d328b098b013e262062c3ed75c312`.
- Canon contract: `2.0.0`.
- Canon candidate: `3.1.0`.
- Focused active-route hydration test: `PASS`.
- Pack validation: `PASS`.
- Release readiness: `READY`.

No target pilot, lifecycle dispatch, commit, push, PR, merge, deploy, or public
action occurred.

SNAPSHOT_SYNC_VERIFIED
