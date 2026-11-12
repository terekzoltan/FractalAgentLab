import { StoreError } from "./contracts.js";
export type SpeedMode = "standard" | "fast";
export function speedMode(value: unknown): SpeedMode {
  if (value === undefined) return "standard";
  if (value !== "standard" && value !== "fast") throw new StoreError("INVALID_INPUT");
  return value;
}
const models = new Set(["gpt-6.1-sol", "gpt-6.1-terra", "gpt-6-luna", "gpt-6-sol", "gpt-6-astra"]);
/** Catalog aliases request a tier; they are not proof of the tier served. */
export function speedModel(model: string, value: unknown): string {
  const mode = speedMode(value), base = model.replace(/-fast$/, "");
  if (!base.startsWith("openai/") || !models.has(base.slice(7))) {
    if (mode === "fast") throw new StoreError("INVALID_INPUT");
    return model;
  }
  return mode === "fast" ? base + "-fast" : base;
}
