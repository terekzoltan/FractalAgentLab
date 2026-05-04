import { WORKFLOW_CATALOG_SCHEMA_VERSION, type WorkflowCatalog } from "./workflowCatalogModel";

export type WorkflowCatalogLoadState =
  | { status: "loading" }
  | { status: "ready"; catalog: WorkflowCatalog }
  | { status: "missing_catalog"; message: string }
  | { status: "invalid_catalog"; message: string };

export async function loadWorkflowCatalog(fetchImpl: typeof fetch = fetch): Promise<WorkflowCatalogLoadState> {
  let response: Response;
  try {
    response = await fetchImpl("/generated/workflows.json", { cache: "no-store" });
  } catch (error) {
    return {
      status: "missing_catalog",
      message: error instanceof Error ? error.message : "Unable to fetch generated workflow catalog.",
    };
  }

  if (response.status === 404) {
    return { status: "missing_catalog", message: "Generated workflow catalog was not found." };
  }
  if (!response.ok) {
    return { status: "invalid_catalog", message: `Generated workflow catalog request failed with ${response.status}.` };
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    return {
      status: "invalid_catalog",
      message: error instanceof Error ? error.message : "Generated workflow catalog is not valid JSON.",
    };
  }

  if (!isWorkflowCatalog(payload)) {
    return { status: "invalid_catalog", message: "Generated workflow catalog does not match u5_d.workflow_catalog.v1." };
  }

  return { status: "ready", catalog: payload };
}

function isWorkflowCatalog(value: unknown): value is WorkflowCatalog {
  if (!isRecord(value)) {
    return false;
  }
  return (
    value.schema_version === WORKFLOW_CATALOG_SCHEMA_VERSION &&
    typeof value.generated_at === "string" &&
    Array.isArray(value.workflows) &&
    value.workflows.every(isWorkflowEntry) &&
    Array.isArray(value.warnings) &&
    value.warnings.every((warning) => typeof warning === "string")
  );
}

function isWorkflowEntry(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.workflow_id === "string" &&
    typeof value.name === "string" &&
    typeof value.version === "string" &&
    typeof value.execution_mode === "string" &&
    (typeof value.input_schema_ref === "string" || value.input_schema_ref === null) &&
    (typeof value.output_schema_ref === "string" || value.output_schema_ref === null) &&
    typeof value.step_count === "number" &&
    Number.isInteger(value.step_count) &&
    Array.isArray(value.steps) &&
    value.steps.every(isWorkflowStep) &&
    isWorkflowMetadata(value.metadata)
  );
}

function isWorkflowStep(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.step_id === "string" &&
    typeof value.agent_id === "string" &&
    (typeof value.description === "string" || value.description === null)
  );
}

function isWorkflowMetadata(value: unknown): boolean {
  if (!isRecord(value)) {
    return false;
  }
  return Object.keys(value).every((key) => {
    if (!["hero_workflow", "variant", "schema_contract"].includes(key)) {
      return false;
    }
    const metadataValue = value[key];
    return typeof metadataValue === "string" || metadataValue === null;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
