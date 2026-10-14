import type { OpenCodeAdapter } from "./opencode-adapter.js";

export interface OwnerAttention {
  observedAt: string;
  state: "WAITING_FOR_OWNER" | "CLEAR" | "UNAVAILABLE";
  permissions: number | null;
  questions: number | null;
  scope: "EXACT_SESSION_NOT_OPERATION_OR_CHILDREN";
}

export async function observeOwnerAttention(reader: Partial<Pick<OpenCodeAdapter, "getPendingInteractions">>): Promise<OwnerAttention> {
  let permissions: number | null = null, questions: number | null = null;
  try {
    const result = await reader.getPendingInteractions?.();
    const valid = (n: unknown): n is number => Number.isSafeInteger(n) && Number(n) >= 0 && Number(n) <= 4096;
    permissions = valid(result?.permissions) ? result!.permissions : null;
    questions = valid(result?.questions) ? result!.questions : null;
  } catch { /* Optional status cannot change transport or acceptance facts. */ }
  return {
    observedAt: new Date().toISOString(),
    state: (permissions ?? 0) + (questions ?? 0) > 0 ? "WAITING_FOR_OWNER"
      : permissions !== null && questions !== null ? "CLEAR" : "UNAVAILABLE",
    permissions, questions, scope: "EXACT_SESSION_NOT_OPERATION_OR_CHILDREN",
  };
}

export function waitingForOwner(attention: OwnerAttention | undefined, now = Date.now()): boolean {
  const age = attention ? now - Date.parse(attention.observedAt) : NaN;
  return attention?.state === "WAITING_FOR_OWNER" && Number.isFinite(age) && age >= 0 && age <= 120_000;
}
