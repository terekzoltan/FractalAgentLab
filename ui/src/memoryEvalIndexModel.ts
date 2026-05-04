export const MEMORY_EVAL_INDEX_SCHEMA_VERSION = "u5_f.memory_eval_index.v1";

export type ProjectMemoryStoreState = "available" | "not_demonstrated" | "no_local_project_memory_store_found";

export interface MemoryEvalIndexSummary {
  project_memory_store_state: ProjectMemoryStoreState;
  memory_project_count: number;
  memory_artifact_count: number;
  eval_summary_count: number;
  warnings_count: number;
}

export interface MemoryProjectRow {
  project_id: string;
  source_path: string;
  schema_version: string;
  updated_at: string | null;
  stable_decision_count: number;
  workflow_learning_count: number;
  prompt_observation_count: number;
}

export type MemoryArtifactKind = "memory_candidates" | "project_memory_update";

export interface MemoryArtifactRow {
  run_id: string;
  source_path: string;
  artifact_kind: MemoryArtifactKind;
  artifact_version: string | null;
  schema_version: string | null;
  workflow_id: string | null;
  session_id: string | null;
  project_id: string | null;
  generated_at: string | null;
  item_count: number;
}

export interface EvalSummaryRow {
  label: string;
  source_path: string;
  report_version: string;
  generated_at: string | null;
  source_reported_outcome: string | null;
  source_reported_summary: Record<string, string | boolean | number | null>;
  known_limits: string[];
}

export interface CuratedReferenceRow {
  label: string;
  source_path: string;
  evidence_label: string;
  note: string;
}

export interface MemoryEvalIndex {
  schema_version: typeof MEMORY_EVAL_INDEX_SCHEMA_VERSION;
  generated_at: string;
  data_dir: string;
  summary: MemoryEvalIndexSummary;
  memory_projects: MemoryProjectRow[];
  memory_artifacts: MemoryArtifactRow[];
  eval_summaries: EvalSummaryRow[];
  curated_references: CuratedReferenceRow[];
  warnings: string[];
}
