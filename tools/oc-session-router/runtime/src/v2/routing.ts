import { existsSync, lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { Effect, Participant } from "./contracts.js";

export type Capability = "DELIVERY" | "META" | "SUPPORT" | "ORCHESTRATOR";
export interface RoleBinding {
  session: string;
  profile: string;
  capability: Capability;
  allowedCommands?: string[];
  agent?: string;
  model?: string;
  variant?: string;
  contextLimit?: number;
}
export interface TargetBinding {
  namespace: string;
  project: string;
  directory: string;
  origin: string;
  roles: Record<string, RoleBinding>;
  /** Reviewed project commands; cannot override the core lifecycle role rules. */
  commands?: Record<string, { capability: Capability; effect: Effect }>;
}
/** Private configuration, enrolled once; not a per-stage capability receipt. */
export interface RouterConfiguration { schemaVersion: 2; targets: Record<string, TargetBinding>; compactThresholdRatio?: number }
export class RouterError extends Error {
  constructor(readonly code: string) { super(code); this.name = "RouterError"; }
}

const rules: Record<string, { capability: Capability; effect: Effect }> = {
  "wave-start": { capability: "META", effect: "WORKSPACE_WRITE" },
  "seq-next": { capability: "DELIVERY", effect: "WORKSPACE_WRITE" },
  "terv-review": { capability: "META", effect: "READ_ONLY" },
  "terv-review-utan": { capability: "DELIVERY", effect: "WORKSPACE_WRITE" },
  "implement": { capability: "DELIVERY", effect: "WORKSPACE_WRITE" },
  "step-review": { capability: "META", effect: "READ_ONLY" },
  "step-review-utan": { capability: "DELIVERY", effect: "WORKSPACE_WRITE" },
  "closeout-commit": { capability: "META", effect: "LOCAL_COMMIT" },
};

export function commandRule(command: string, role: RoleBinding, target?: TargetBinding): Effect {
  const rule = Object.hasOwn(rules, command) ? rules[command]
    : target?.commands && Object.hasOwn(target.commands, command) ? target.commands[command] : undefined;
  if (!rule || rule.capability !== role.capability || !["READ_ONLY", "WORKSPACE_WRITE", "LOCAL_COMMIT"].includes(rule.effect) ||
      (rule.effect === "LOCAL_COMMIT" && role.capability !== "META") || (role.allowedCommands && !role.allowedCommands.includes(command))) {
    throw new RouterError("ROLE_COMMAND_NOT_ALLOWED");
  }
  return rule.effect;
}

export function sameDirectory(left: string, right: string): boolean {
  if (!path.isAbsolute(left) || !path.isAbsolute(right)) return false;
  const normalize = (value: string) => process.platform === "win32" ? path.resolve(value).toLowerCase() : path.resolve(value);
  return normalize(left) === normalize(right);
}

export function resolveRole(configuration: RouterConfiguration, target: string, roleName: string): { target: TargetBinding; role: RoleBinding; participant: Participant } {
  if (configuration.schemaVersion !== 2) throw new RouterError("CONFIGURATION_UNSUPPORTED");
  const binding = Object.hasOwn(configuration.targets, target) ? configuration.targets[target] : undefined;
  const role = binding && Object.hasOwn(binding.roles, roleName) ? binding.roles[roleName] : undefined;
  if (!binding || !role || !["DELIVERY", "META", "SUPPORT", "ORCHESTRATOR"].includes(role.capability) ||
      !binding.namespace || !binding.project || !binding.origin || !path.isAbsolute(binding.directory) ||
      !role.session?.startsWith("ses") || !role.profile) throw new RouterError("PARTICIPANT_NOT_CONFIGURED");
  // A label switch must not turn an author into its independent Meta reviewer.
  for (const other of Object.values(binding.roles)) {
    if (other.session === role.session && new Set([other.capability, role.capability]).has("META") &&
        new Set([other.capability, role.capability]).has("DELIVERY")) throw new RouterError("REVIEWER_AUTHOR_COLLISION");
  }
  return { target: binding, role, participant: { namespace: binding.namespace, project: binding.project, session: role.session } };
}

export function readContainedSource(root: string, relativePath: string): { path: string; sha256: string; content: string } {
  if (!relativePath || path.isAbsolute(relativePath) || relativePath.includes("\0") || relativePath.includes(":")) throw new RouterError("SOURCE_PATH_UNSAFE");
  const full = path.resolve(root, relativePath), relative = path.relative(path.resolve(root), full);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) throw new RouterError("SOURCE_PATH_UNSAFE");
  for (let current = full; ; current = path.dirname(current)) {
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new RouterError("SOURCE_PATH_UNSAFE");
    if (path.dirname(current) === current) break;
  }
  if (!existsSync(full) || !statSync(full).isFile()) throw new RouterError("SOURCE_UNAVAILABLE");
  const actualRelative = path.relative(realpathSync(root), realpathSync(full));
  if (actualRelative === ".." || actualRelative.startsWith(`..${path.sep}`) || path.isAbsolute(actualRelative)) throw new RouterError("SOURCE_PATH_UNSAFE");
  if (statSync(full).size > 8 * 1024 * 1024) throw new RouterError("SOURCE_TOO_LARGE");
  const bytes = readFileSync(full);
  return { path: relative.replaceAll("\\", "/"), sha256: createHash("sha256").update(bytes).digest("hex"), content: bytes.toString("utf8") };
}
