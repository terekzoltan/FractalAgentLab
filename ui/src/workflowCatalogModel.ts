export const WORKFLOW_CATALOG_SCHEMA_VERSION = "u5_d.workflow_catalog.v1";

export interface WorkflowCatalogStep {
  step_id: string;
  agent_id: string;
  description: string | null;
}

export interface WorkflowCatalogMetadata {
  hero_workflow?: string | null;
  variant?: string | null;
  schema_contract?: string | null;
}

export interface WorkflowCatalogEntry {
  workflow_id: string;
  name: string;
  version: string;
  execution_mode: string;
  input_schema_ref: string | null;
  output_schema_ref: string | null;
  step_count: number;
  steps: WorkflowCatalogStep[];
  metadata: WorkflowCatalogMetadata;
}

export interface WorkflowCatalog {
  schema_version: typeof WORKFLOW_CATALOG_SCHEMA_VERSION;
  generated_at: string;
  workflows: WorkflowCatalogEntry[];
  warnings: string[];
}
