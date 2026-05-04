import type { EvidenceFixture, WorkbenchPage } from "./workbenchModel";

export const pages: WorkbenchPage[] = [
  {
    id: "overview",
    label: "Overview",
    status: "PARTIAL",
    summary: "Evidence observatory shell for Wave 5 U5-A.",
  },
  {
    id: "runs",
    label: "Runs",
    status: "PASS",
    summary: "Run browsing is active from the generated index.",
  },
  {
    id: "trace",
    label: "Trace",
    status: "PASS",
    summary: "Trace timelines are active from generated trace details.",
  },
  {
    id: "evidence",
    label: "Evidence",
    status: "NOT IMPLEMENTED",
    summary: "Comparison and eval semantics require Track E-defined surfaces later.",
  },
  {
    id: "packets",
    label: "Packets / Launch",
    status: "PARTIAL",
    summary: "Operator-mediated command previews and packet skeletons are active.",
  },
  {
    id: "memory",
    label: "Memory / Eval",
    status: "NOT IMPLEMENTED",
    summary: "Read-only memory and eval inspection land later.",
  },
];

export const evidenceFixtures: EvidenceFixture[] = [
  {
    label: "Run artifact placeholder",
    workflow: "h1.single.v1",
    status: "FIXTURE",
    source: "demo fixture",
    artifactPath: "data/runs/<run_id>.json",
    disclosure: "Synthetic U5-A fixture. Not read from local data.",
  },
  {
    label: "Trace artifact placeholder",
    workflow: "h1.single.v1",
    status: "FIXTURE",
    source: "demo fixture",
    artifactPath: "data/traces/<run_id>.jsonl",
    disclosure: "Synthetic U5-A fixture. Not a live trace timeline.",
  },
  {
    label: "Sidecar artifact placeholder",
    workflow: "h4.seq_next.v1",
    status: "FIXTURE",
    source: "demo fixture",
    artifactPath: "data/artifacts/<run_id>/...",
    disclosure: "Synthetic U5-A fixture. Sidecars are display context, not trace truth.",
  },
];
