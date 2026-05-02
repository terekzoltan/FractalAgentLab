export type WorkbenchStatus =
  | "PASS"
  | "FAIL"
  | "BLOCKED"
  | "PARTIAL"
  | "UNKNOWN"
  | "MISSING"
  | "FIXTURE"
  | "NOT IMPLEMENTED";

export type WorkbenchPageId =
  | "overview"
  | "runs"
  | "trace"
  | "evidence"
  | "packets"
  | "memory";

export interface WorkbenchPage {
  id: WorkbenchPageId;
  label: string;
  status: WorkbenchStatus;
  summary: string;
}

export interface EvidenceFixture {
  label: string;
  workflow: string;
  status: WorkbenchStatus;
  source: "demo fixture";
  artifactPath: string;
  disclosure: string;
}
