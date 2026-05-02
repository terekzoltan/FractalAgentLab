# Wave5 W5-S1 TrackA U5-A Web Shell

## Status

Track A implementation delivery note for `U5-A`.

Execution mode: `opencode_assisted`.

Visibility / audit state: git-visible UI scaffold, tests, docs, and generated npm lockfile. No local `data/` artifacts were consumed for the UI conclusions.

## Scope

Implemented a local, fixture-backed evidence observatory shell under `ui/`.

In scope:

- Vite + React + TypeScript scaffold using npm
- local shell layout and navigation
- Wave 5 page model placeholders
- status vocabulary primitives
- explicit fixture disclosure
- responsive CSS for desktop and narrow screens
- component tests for U5-A content-truth boundaries

Out of scope and intentionally not implemented:

- canonical artifact crawling
- real run list or run detail page
- real trace timeline rendering
- workflow launch
- packet generation
- eval comparison implementation
- memory inspection
- backend/API design
- OpenCode automation
- public deployment

## Stack Decision

Selected package manager: npm.

Reason: there was no existing JavaScript package-manager precedent in the repo, npm is installed locally, and the Wave 5 detailed plan recommends a Vite + React + TypeScript shell.

Committed lockfile policy: `ui/package-lock.json` should be committed with the UI package because npm is the selected package manager.

## Route / Page Model

U5-A uses internal React state rather than `react-router-dom`.

Pages:

- Overview: active U5-A shell overview and canonical evidence law
- Runs: placeholder for `U5-B`
- Trace: placeholder for `U5-C`
- Evidence: placeholder for later Track E-defined comparison/eval surfaces
- Packets / Launch: placeholder for `U5-D`, explicitly inactive
- Memory / Eval: placeholder for `U5-F`, explicitly read-only later and not implemented now

## Fixture Policy

U5-A uses small synthetic fixture records only for layout proof.

Rules applied:

- every visible fixture row is labeled as fixture/demo data
- fixture rows use placeholder artifact paths such as `data/runs/<run_id>.json`
- fixture data is not read from local `data/`
- fixture shape anticipates future run/trace/artifact display fields without becoming schema law
- provider/model fields are not ranked or scored

## Status Vocabulary

Initial UI status labels:

- `PASS`
- `FAIL`
- `BLOCKED`
- `PARTIAL`
- `UNKNOWN`
- `MISSING`
- `FIXTURE`
- `NOT IMPLEMENTED`

Status labels are textual and are not represented by color alone.

## Data Seam For U5-B / U5-C

The current shell has no canonical artifact reader.

Expected next seam:

- `U5-B` should replace or extend fixture-backed run rows with a derived artifact index or a local bridge that reads canonical run/trace artifacts.
- `U5-C` should reuse the shell/page model and add strict single-run trace timeline rendering without weakening CLI `trace show` truth semantics.
- Any derived index remains a browse accelerator, not canonical evidence truth.

## Known UI Debt

- No real local artifact index exists yet.
- No route URLs exist yet because U5-A intentionally avoids router dependency.
- Responsive behavior is CSS-based and should receive a live browser/operator smoke before Meta closeout.
- The visual system is intentionally small and may need refinement after real run/trace data lands.

## Validation Commands

Commands run for this implementation:

```bash
npm install
npm audit --audit-level=moderate
npm run typecheck
npm run build
npm test -- --run
```

Results:

- `npm install` completed and generated `ui/package-lock.json`.
- `npm audit --audit-level=moderate` passed with `0` vulnerabilities using lockfile-resolved compatible Vite/Vitest versions.
- `npm run typecheck` passed.
- `npm run build` passed.
- `npm test -- --run` passed with `5` component tests.

## Manual Responsive Smoke

Responsive CSS is implemented for desktop and narrow widths.

Meta/operator responsive smoke result: `PASS`.

Evidence reviewed during closeout:

- iPhone XR narrow viewport screenshot
- iPhone 12 narrow viewport screenshot
- desktop browser overview screenshots
- desktop `Runs` placeholder screenshot
- desktop `Trace` placeholder screenshot

Observed:

- the shell loads on desktop and narrow/mobile widths
- navigation remains usable
- content stacks cleanly on narrow/mobile widths
- status labels remain textual and readable
- fixture/demo disclosure remains visible
- `Runs` and `Trace` placeholders clearly state that real U5-B/U5-C functionality is not implemented yet
- no launch/OpenCode automation surface appears active

Closeout conclusion: responsive smoke satisfies the U5-A acceptance requirement.

## Handoff To U5-B / U5-C

Track A handoff notes:

- U5-B can build the run list/detail UX on this shell after Meta accepts U5-A.
- U5-C can build the trace timeline page on this shell after Meta accepts U5-A.
- U5-B and U5-C should preserve explicit missing/invalid/partial states and avoid hiding degraded artifacts.
- U5-D launch and packet behavior must remain blocked until U5-A, U5-B, and U5-C are accepted.

## Non-Goals Preserved

The UI does not claim:

- real artifact browsing is implemented
- real trace timelines are implemented
- workflow launch is active
- packet generation is active
- OpenCode automation exists
- provider/model ranking exists
- FAL is an autonomous software delivery agent
