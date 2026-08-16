# Active Route Hydration Consumers Apply Receipt

Plan identity: `awc-active-route-compact-v1-owner-20260805`
Candidate: `active-route-hydration-consumers-global-v1`
Disposition: `RESTART_VERIFIED`
Applied UTC: `2026-08-08T14:47:21Z`

## Exact operations

| Skill | Before SHA-256 | Applied SHA-256 |
|---|---|---|
| `context-onboarding` | `d9f36a4bce93eeab208a2848a4639197852b7330fb2b7a6d23d752057f3e2b40` | `74eacad2c5d29d49965c5f0d1174d4354396c642cd58fd15a8bacb80a7bc0544` |
| `context-restore` | `bde5af43e6733af7758fde055fc7c49f85bc5a7ab2915df4c56d8bd822ce14bd` | `30611ffebdb8c819e8924ac9cf7e2726aebbe3e24ccfc3c5196b1b36c4de6968` |

- Apply bundle SHA-256:
  `8e1a315b1277810d0329db0d9d640b3fb6d929581ad0a486e9eeb140e456f52a`.
- Canon contract SHA-256:
  `e25fb7945d5a62a7aa2066a17711c1db2e2f24a059c2b9387353c4e3981ddf61`.
- Resolver SHA-256:
  `3e718d05ca1a6601ad9b502f48103c0745e56c3ec7a6de5aedf0927cc30781a3`.
- Pack digest:
  `9116d7a7682ff7140f709e28e6ea2f8ed24ab33f61e1441bd217f5500a833a03`.

The apply was exact-baseline guarded, backup-first, and atomic. Private rollback
material exists outside active discovery. No command definition or other global
skill changed.

## Pending gate

The Project Owner confirmed the restart. Fresh pure registry verification passed:
OpenCode `1.18.15`, launcher identity
`7dc7f9e963b88bbfb7a529a82d1922adf642d386f096fc250e891e374884ee8e`,
registry identity
`37837304c69f08e400a592ffcf29140f9cceb4ae64d55971d3dd0ab2a1363bba`,
and `/after-compact` entry identity
`1321868dddde6f034a95728297cc485ba470d8f8bd39154fafa2c33bda263a37`.

Official Toolbox transaction:
`active-route-hydration-consumers-20260808T150524Z-547053f88d10`.
Operational inventory identity:
`11182104266a1ae9e8b8b5f6bad00415736b44727b1a3e6918ce9c0363a68a19`.
The generated Canon tooling snapshot is synchronized with payload digest
`2efa3e99ab9ec45774da3077fdbb9f2f24c7d5782cfd64d24f704abb8e8a4a86`
and contract alignment `MATCH`.

Final independent review remains mandatory. All workflows, compacts, and live
pilots remain frozen.
