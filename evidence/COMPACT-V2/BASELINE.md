# COMPACT-V2 Pre-Implementation Baseline

Plan: `COMPACT-V2-plan-v1.1-final`
Plan SHA-256: `4d2e1d717e31495fc7176bebf55cc9b328bb9702f283c8c1eee3e610ee510de5`
Capture class: sanitized local evidence; no runtime session, credential, endpoint,
port, transcript, or absolute machine-root value is retained here.

## Repository Identities

| Repository | Baseline HEAD |
|---|---|
| Agent Workflow Canon | `f5218825410f0db5a69e970565d0ed475b2b91ca` |
| FractalAgentLab | `f98218454e025edeef6a62578409f225c2d2e641` |

The complete pre-existing Canon working-tree binary diff has SHA-256
`47ddaf84f5d0ff96b036a5672035a184eb865c3f375114067da1c783ba0cebd6`.
Line-ending warnings for the generated snapshot manifest and FAL protected files
are baseline observations, not authority to normalize them.

## Canon Contract Baseline

| Relative path | SHA-256 |
|---|---|
| `canon/CANONICAL-CONTRACT.json` | `b254ec72d7c1a3ea7eb86ac8890cfedb31f3dbd410c73fccb9529f15fff479d9` |
| `canon/CONTEXT-HYDRATION.md` | `875a8a69a3e34b78879bea8fc83532876c9ad0c2fa1f8d826039d485b83ec263` |
| `reference/FAL-CONTROL-PLANE-ADAPTER.md` | `193b1f4dd5ad6b2b4157e2f16e4f95f0f783be273339b2aa657f39b1bac1585f` |
| `reference/SESSION-CONTEXT-TELEMETRY.md` | `6e06c2acbb27167fa2fca11dacb2ba8de56c2f37f096e5244c5d9aa3e3de0c56` |
| `registry/COMPACT-BOUNDARY.schema.json` | `742ca9d46d7e886caeadadfae504770e1f6c0cb16ca84ff9cc2aa14c3142cba5` |
| `registry/HYDRATION-REGISTRY.schema.json` | `a6f86dab259bfb16ac74019e139a3390f3e4987e4c5610cfcac73ea14680fa94` |
| `registry/HYDRATION-REQUEST.schema.json` | `97d1744869e4b136b1a29e9dc018ced21493f61ff105f2c5eb937f566e9f67be` |
| `registry/HYDRATION-RESULT.schema.json` | `826dbe32817088877c75fc5ae6a47b7b61fc4339ccaa25a4a9de6f16db9402b2` |
| `registry/projects/fractal-agent-lab.json` | `0cf7295a68b241d3b49eb908ec018a12ebdc7fdfbd835f55e7978a0ab70f2c33` |
| `scripts/resolve-hydration.ps1` | `0aba6224e6c15ebfa99a9f1e36e70a07b8bcd883e61ebac519a8637c24d8d01b` |
| `scripts/invoke-hydration.ps1` | `dbe171e6030eabfb860324fc8694fb304ad408208bad4e82743410313f0fb944` |
| `scripts/validate-pack.ps1` | `6034dc2021b5d2f59273cdcc675ed3c731b6d817a45e483b1b93cab217f82285` |
| `VERSION.md` | `ade8ccc892d3293b21701adc919a1e725ff1c2eef1f1552029984189f21c4f93` |
| `CHANGELOG.md` | `c31ae75054e716d6197b3a4c8d4bdefb05a40f68d78f134a1ad919e80e8d5711` |
| `MANIFEST.md` | `758c4d0db79f9aaa0d53ab2f323b3cd53976d119022570cafdfa8b93afb0df78` |

## Pre-Existing Canon Dirty Lineage

These paths predate COMPACT-V2. All existing semantics and hunks remain owned by
their prior lifecycle. A path being in the V2 allowlist does not transfer ownership.

| Relative path | Baseline working-tree SHA-256 | Pre-existing patch SHA-256 or disposition |
|---|---|---|
| `canon/PARALLELISM-AND-COORDINATION.md` | `88fd985c6cfaaabde65843880736f825915289cc3b181b5bfe372cdbc21d062f` | read-only outside V2 scope |
| `reference/COMMAND-CATALOG.md` | `6dc4759421a6c1b021a0b810d4a32e9bc0e7bf929dce1801be33a1ea99e977cc` | `1b2cb8edb97a00021677131fa013e9c21035ce51788540930d77499ab91cdc92` |
| `reference/COMMAND-OUTPUT-CONTRACTS.md` | `e8ccb2f7e1a11eed7305f6a6b596e0c5b1a9d048c38af1b3cece66ff9e0b859e` | `e6331a3c4180a4c4739f6e23340694db97df7591ecea04a010166491470bd120` |
| `reference/SKILL-CATALOG.md` | `d16455c4c957dc2385cbace4d21d87881b32ec3c927b288bcf7695622f58b3d7` | `6e7e16f57d79fb4819b13ce528aa5377582a6383bc28983a97f749058336f0e6` |
| `runbooks/AFTER-COMPACT-RUNBOOK.md` | `227620923db6e0f3e9605466d2f1c78b7adcce5daeafcbb5d43160da8341191b` | `03de5299b7beeae09cff8deaa38039905c4d9780212b3f8d1a6bf5b34bd1cb94` |
| `runbooks/CLOSEOUT-RUNBOOK.md` | `fbafa9454b62fae73ad393cec73d12afddda9f0805a3d2d3eb74171f705368a9` | `43050c7816c134bb152c8488847b66fda2ad43dbd8abba69344beb6151523e9a` |

The remaining pre-existing dirty paths are generated tooling snapshots and are
read-only until the reviewed live-global apply plus verified snapshot sync:

| Relative path | Working-tree SHA-256 |
|---|---|
| `reference/tooling-snapshot/MANIFEST.json` | `e36cfbb3c8b3d8f8fb4bac158b34ec8a0f3869d39a86b53308fd4bd518abc9e2` |
| `reference/tooling-snapshot/commands/after-compact.md` | `84d6d1159d941c6db3dd9310c0cc8a14b40dfa5b66adbce9ebe266b4072aca61` |
| `reference/tooling-snapshot/commands/closeout-commit.md` | `89a83c3a4f538cd4092f6c03e72b9281e31d365240433332e05ac019b4236f3f` |
| `reference/tooling-snapshot/commands/implement.md` | `a5f37ad9b4ca7e808cb8a8820808678b57496dfb313c732d6261454f83649a61` |
| `reference/tooling-snapshot/commands/seq-next.md` | `4143dd850443e896527795b358a455cd1766b50ed2b4c5892b7f678021c69187` |
| `reference/tooling-snapshot/commands/terv-review-utan.md` | `e247341c96a88adf52b3606a9c06702bec536c655b52b294339e7d5829fa855e` |
| `reference/tooling-snapshot/skills/closeout-commit/SKILL.md` | `13f7f615c7674dbb05b6a230093cb9c6bddbff66d6b12deffb6433391efbb23e` |
| `reference/tooling-snapshot/skills/context-restore/SKILL.md` | `30d2bf80665c644a6dd15fee106375c59f419c255337174b18077f51143cfa69` |
| `reference/tooling-snapshot/skills/implementation-execution/SKILL.md` | `e84f8ba098ad6197e64237b9c88ab94a94738e1eb151e0b9dc268375967ad3e3` |
| `reference/tooling-snapshot/skills/sequence-planning/SKILL.md` | `ca98cc40bcfb98f62d5e387f9741f959e8e122dca766903d7a5e37d9cf6fe61e` |

## Live-Global Candidate Baseline

The global policy file is absent before this Epic. Existing live payload hashes are:

| Config-root-relative path | SHA-256 |
|---|---|
| `commands/after-compact.md` | `84d6d1159d941c6db3dd9310c0cc8a14b40dfa5b66adbce9ebe266b4072aca61` |
| `commands/wave-start.md` | `e438be9175fe37fbc8592e41c1c94d06aec7ccf1d8905c0ef20ed04684ac82b8` |
| `commands/fal-orchestrate-target.md` | `d8c7b74c80c3bc5384ccb9bf4e1d2ed71850278e94cc24e87688c628af9dda69` |
| `skills/context-restore/SKILL.md` | `30d2bf80665c644a6dd15fee106375c59f419c255337174b18077f51143cfa69` |
| `skills/context-onboarding/SKILL.md` | `698c31dc6c1ca15ba5daeb729f97b19c5318e77d44c055bb977a4009ab2e1131` |
| `skills/fal-orchestrate-target/SKILL.md` | `c814c3951bb014dcf16bbc62a11cf9d694693fa134b1bc13e190ff3608334ade` |
| `skills/closeout-commit/SKILL.md` | `13f7f615c7674dbb05b6a230093cb9c6bddbff66d6b12deffb6433391efbb23e` |

## FAL Protected Scope

| Relative path | Working-tree SHA-256 |
|---|---|
| `src/fractal_agent_lab/integrations/router_fal_sync.py` | `58c99c1c34fbf38aadb3d6ec4d62143456676a302cc6e08465f3deed03ae46a3` |
| `tests/integrations/test_router_fal_sync.py` | `1f5d4e24410b34ab76c08363aed2603be2c4bca986516615b347feebf4fdebab` |

Their combined pre-existing binary diff SHA-256 is
`c1178c1e364a7f03582a334e433459210f8f16e0584473b085626d6afeb0a12c`.
Any change to either working-tree hash or this combined patch identity stops
COMPACT-V2 before candidate freeze.
