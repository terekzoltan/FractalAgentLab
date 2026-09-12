import { type OpenCodeMessage } from "./opencode-adapter.js";

/** Bounded metadata only; no prompts, tool outputs or summaries in the scan cache. */
export function linkFacts(m: OpenCodeMessage): OpenCodeMessage {
  return { id: m.id, session: m.session, role: m.role, text: "", hasCompactionPart: m.hasCompactionPart,
    ...(m.parentId === undefined ? {} : { parentId: m.parentId }),
    ...(m.timeCreated === undefined ? {} : { timeCreated: m.timeCreated }),
    ...(m.timeCompleted === undefined ? {} : { timeCompleted: m.timeCompleted }),
    ...(m.finish === undefined ? {} : { finish: m.finish }),
    summary: m.summary === true, error: m.error === true,
    autoCompaction: m.autoCompaction === true, compactionContinue: m.compactionContinue === true };
}

export interface ContinuationProof { candidates: string[]; anchors: OpenCodeMessage[]; parent?: string }
export function nativeContinuation(messages: OpenCodeMessage[], rootId: string, terminal: (m: OpenCodeMessage) => boolean): ContinuationProof {
  const ordered = [...messages].sort((a,b) => a.timeCreated! - b.timeCreated! || a.id.localeCompare(b.id));
  const start = ordered.findIndex(m => m.id === rootId);
  const empty = (): ContinuationProof => ({ candidates: [], anchors: [] });
  if (start < 0 || ordered.some(m => !Number.isFinite(m.timeCreated))) return empty();
  let parent = rootId, progress: OpenCodeMessage | undefined, marker: OpenCodeMessage | undefined, summary: OpenCodeMessage | undefined;
  let hops = 0;
  const anchors = [ordered[start]!], candidates: string[] = [];
  for (const m of ordered.slice(start + 1)) {
    if (m.session !== ordered[start]!.session) return empty();
    if (m.role === "user") {
      if (m.parentId !== undefined) break;
      if (m.autoCompaction && m.hasCompactionPart && progress && progress.timeCompleted! <= m.timeCreated! && !marker && !candidates.length && hops < 8) {
        marker = m; anchors.push(progress, m); continue;
      }
      if (m.compactionContinue && !m.hasCompactionPart && marker && summary) {
        parent = m.id; anchors.push(summary, m); marker = summary = progress = undefined; hops++; continue;
      }
      break; // Manual prompts, replay copies and unrelated requests are hard lineage boundaries.
    }
    if (marker) {
      if (summary || !m.summary || m.parentId !== marker.id || m.error || !Number.isFinite(m.timeCompleted) ||
        m.finish !== "stop" || m.timeCompleted! < m.timeCreated! || m.timeCompleted! > (ordered[ordered.indexOf(m) + 1]?.timeCreated ?? Infinity)) return empty();
      summary = m; continue;
    }
    if (m.parentId !== parent || m.summary || m.hasCompactionPart) {
      if (candidates.length && m.parentId === rootId && terminal(m)) return { candidates: [...candidates, m.id], anchors, parent };
      return empty();
    }
    if (terminal(m)) {
      if (!hops) return empty(); // A finished original turn cannot donate a later compact answer.
      candidates.push(m.id);
    } else if (m.finish === "tool-calls" && !m.error && Number.isFinite(m.timeCompleted) && m.timeCompleted! >= m.timeCreated!) progress = m;
    else return empty();
  }
  return { candidates, anchors, parent };
}
