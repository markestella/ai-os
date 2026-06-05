import { paths } from "./path";
import { readJSON, writeJSON, exists } from "./fs";

export interface AIState {
  step: number;
  phase: "idle" | "task" | "scoped" | "planned" | "running" | "done";
  taskSet: boolean;
  scopeSet: boolean;
  planGenerated: boolean;
  lastUpdated: string;
}

const DEFAULT_STATE: AIState = {
  step: 0,
  phase: "idle",
  taskSet: false,
  scopeSet: false,
  planGenerated: false,
  lastUpdated: new Date().toISOString(),
};

export async function getState(): Promise<AIState> {
  if (!(await exists(paths.state))) {
    return { ...DEFAULT_STATE };
  }
  return await readJSON<AIState>(paths.state);
}

export async function setState(updates: Partial<AIState>): Promise<AIState> {
  const current = await getState();
  const next: AIState = {
    ...current,
    ...updates,
    lastUpdated: new Date().toISOString(),
  };
  await writeJSON(paths.state, next);
  return next;
}

export async function resetState(): Promise<AIState> {
  const fresh = { ...DEFAULT_STATE, lastUpdated: new Date().toISOString() };
  await writeJSON(paths.state, fresh);
  return fresh;
}

export function resolvePhase(state: AIState): AIState["phase"] {
  if (state.phase === "done") return "done";
  if (state.phase === "running") return "running";
  if (state.planGenerated) return "planned";
  if (state.scopeSet) return "scoped";
  if (state.taskSet) return "task";
  return "idle";
}
