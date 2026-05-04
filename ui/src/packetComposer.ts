export interface LaunchPacketInput {
  targetRole: string;
  workflowId: string;
  inputJson: string;
  commandPreview: string;
  runtimeConfigPath: string;
  providersConfigPath: string;
  modelPolicyConfigPath: string;
  providerOverride: string;
  sourceArtifactRefs: string[];
}

export function buildLaunchPacket(input: LaunchPacketInput): string {
  const refs = input.sourceArtifactRefs.length > 0
    ? input.sourceArtifactRefs.map((ref) => `- ${ref}`).join("\n")
    : "- none supplied";
  const provider = input.providerOverride.trim() || "none";

  return [
    "# U5-D Operator-Mediated Launch Packet",
    "",
    `Target role/Track: ${input.targetRole}`,
    `Workflow id: ${input.workflowId}`,
    `Runtime config: ${input.runtimeConfigPath}`,
    `Providers config: ${input.providersConfigPath}`,
    `Model policy config: ${input.modelPolicyConfigPath}`,
    `Provider override: ${provider}`,
    "",
    "Input JSON:",
    "```json",
    input.inputJson,
    "```",
    "",
    "OpenCode/bash terminal command preview:",
    "```bash",
    input.commandPreview,
    "```",
    "",
    "Source run/artifact references:",
    refs,
    "",
    "Boundary:",
    "- This packet is advisory and operator-mediated.",
    "- This packet is not a gate or completed Track decision.",
    "- This packet does not launch OpenCode or control an OpenCode session.",
    "- This packet does not perform commits, pushes, autonomous dispatch, or background execution.",
  ].join("\n");
}
