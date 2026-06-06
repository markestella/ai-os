import { paths } from "./path";
import { readJSON, writeJSON, exists } from "./fs";

export interface TokenRun {
  timestamp: string;
  agent: string;
  task: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  scopeFiles: number;
  contextChars: number;
}

export interface TokenHistory {
  currentRun: TokenRun | null;
  runs: TokenRun[];
  totals: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    runs: number;
  };
}

const EMPTY_HISTORY: TokenHistory = {
  currentRun: null,
  runs: [],
  totals: { inputTokens: 0, outputTokens: 0, totalTokens: 0, runs: 0 },
};

// Rough token estimation: ~4 chars per token for English text
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export async function getTokenHistory(): Promise<TokenHistory> {
  if (!(await exists(paths.tokens))) {
    return { ...EMPTY_HISTORY, runs: [], totals: { ...EMPTY_HISTORY.totals } };
  }
  return await readJSON<TokenHistory>(paths.tokens);
}

export async function startTokenRun(
  agent: string,
  task: string,
  context: string,
  scopeFiles: number,
): Promise<void> {
  const history = await getTokenHistory();
  const inputTokens = estimateTokens(context);

  history.currentRun = {
    timestamp: new Date().toISOString(),
    agent,
    task,
    inputTokens,
    outputTokens: 0,
    totalTokens: inputTokens,
    durationMs: 0,
    scopeFiles,
    contextChars: context.length,
  };

  await writeJSON(paths.tokens, history);
}

export async function completeTokenRun(output: string): Promise<TokenRun | null> {
  const history = await getTokenHistory();
  if (!history.currentRun) return null;

  const run = history.currentRun;

  // Parse token info from agent output
  const parsed = parseAgentTokens(output, run.agent);
  run.outputTokens = parsed.outputTokens || estimateTokens(output);
  run.totalTokens = (parsed.inputTokens || run.inputTokens) + run.outputTokens;
  if (parsed.inputTokens) run.inputTokens = parsed.inputTokens;

  const startTime = new Date(run.timestamp).getTime();
  run.durationMs = Date.now() - startTime;

  // Add to history
  history.runs.push({ ...run });
  history.totals.inputTokens += run.inputTokens;
  history.totals.outputTokens += run.outputTokens;
  history.totals.totalTokens += run.totalTokens;
  history.totals.runs += 1;
  history.currentRun = null;

  await writeJSON(paths.tokens, history);
  return run;
}

function parseAgentTokens(
  output: string,
  agent: string,
): { inputTokens?: number; outputTokens?: number } {
  const result: { inputTokens?: number; outputTokens?: number } = {};

  if (agent === "claude") {
    const inputMatch = output.match(/input[\s_]tokens?[:\s]+(\d[\d,]*)/i);
    const outputMatch = output.match(/output[\s_]tokens?[:\s]+(\d[\d,]*)/i);
    if (inputMatch?.[1]) result.inputTokens = parseInt(inputMatch[1].replace(/,/g, ""));
    if (outputMatch?.[1]) result.outputTokens = parseInt(outputMatch[1].replace(/,/g, ""));
  }

  if (agent === "codex") {
    const tokenMatch = output.match(/tokens?[\s:]+(\d[\d,]*)/i);
    const inputMatch = output.match(/input[\s_]tokens?[:\s]+(\d[\d,]*)/i);
    const outputMatch = output.match(/output[\s_]tokens?[:\s]+(\d[\d,]*)/i);
    if (inputMatch?.[1]) result.inputTokens = parseInt(inputMatch[1].replace(/,/g, ""));
    if (outputMatch?.[1]) result.outputTokens = parseInt(outputMatch[1].replace(/,/g, ""));
    if (!result.outputTokens && tokenMatch?.[1]) {
      result.outputTokens = parseInt(tokenMatch[1].replace(/,/g, ""));
    }
  }

  return result;
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = ms / 1000;
  if (secs < 60) return `${secs.toFixed(1)}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = Math.floor(secs % 60);
  return `${mins}m ${remainSecs}s`;
}
