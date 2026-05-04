export interface LaunchCommandInput {
  workflowId: string;
  knownWorkflowIds: string[];
  inputJson: string;
  outputFormat: "text" | "json";
  showTrace: boolean;
  runtimeConfigPath: string;
  providersConfigPath: string;
  modelPolicyConfigPath: string;
  providerOverride: string;
}

export type LaunchCommandResult =
  | { ready: true; command: string; normalizedInputJson: string }
  | { ready: false; errors: string[] };

export function buildLaunchCommand(input: LaunchCommandInput): LaunchCommandResult {
  const errors: string[] = [];
  if (!input.knownWorkflowIds.includes(input.workflowId)) {
    errors.push("Selected workflow is not present in the generated workflow catalog.");
  }

  const parsed = parseJsonObject(input.inputJson);
  if (parsed.status === "invalid") {
    errors.push(parsed.message);
  }

  if (!input.runtimeConfigPath.trim()) {
    errors.push("Runtime config path is required.");
  }
  if (!input.providersConfigPath.trim()) {
    errors.push("Providers config path is required.");
  }
  if (!input.modelPolicyConfigPath.trim()) {
    errors.push("Model policy config path is required.");
  }

  if (errors.length > 0 || parsed.status === "invalid") {
    return { ready: false, errors };
  }

  const normalizedInputJson = JSON.stringify(parsed.value);
  const parts = [
    "PYTHONPATH=src",
    "python",
    "-m",
    "fractal_agent_lab.cli",
    "run",
    quoteForBash(input.workflowId),
    "--input-json",
    quoteForBash(normalizedInputJson),
    "--format",
    quoteForBash(input.outputFormat),
    "--runtime-config",
    quoteForBash(input.runtimeConfigPath.trim()),
    "--providers-config",
    quoteForBash(input.providersConfigPath.trim()),
    "--model-policy-config",
    quoteForBash(input.modelPolicyConfigPath.trim()),
  ];
  if (input.showTrace) {
    parts.push("--show-trace");
  }
  if (input.providerOverride.trim()) {
    parts.push("--provider", quoteForBash(input.providerOverride.trim()));
  }

  return { ready: true, command: parts.join(" "), normalizedInputJson };
}

function parseJsonObject(raw: string): { status: "ready"; value: Record<string, unknown> } | { status: "invalid"; message: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return {
      status: "invalid",
      message: error instanceof SyntaxError ? `Input JSON is invalid: ${error.message}` : "Input JSON is invalid.",
    };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { status: "invalid", message: "Input JSON must be a top-level object." };
  }
  return { status: "ready", value: parsed as Record<string, unknown> };
}

function quoteForBash(value: string): string {
  return `'${value.split("'").join("'\"'\"'")}'`;
}
