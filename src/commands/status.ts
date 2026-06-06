import { getState, resolvePhase } from "../core/state";
import { read, exists } from "../core/fs";
import { paths } from "../core/path";
import { getTokenHistory, formatTokens, formatDuration } from "../core/tokens";

export async function status() {
  const state = await getState();
  const phase = resolvePhase(state);

  console.log("AI OS Status\n");

  // Version
  if (await exists(paths.version)) {
    const version = (await read(paths.version)).trim();
    console.log(`   Registry: v${version}`);
  } else {
    console.log("   Registry: not synced");
  }

  // Stack
  if (await exists(paths.stack)) {
    const stackRaw = await read(paths.stack);
    const stackName = stackRaw.split("\n").filter(l => l.trim() && !l.startsWith("#"))[0]?.trim();
    console.log(`   Stack:    ${stackName || "not-set"}`);
  }

  // Agent
  if (await exists(paths.agent)) {
    const agent = (await read(paths.agent)).trim();
    console.log(`   Agent:    ${agent}`);
  } else {
    console.log("   Agent:    not-set");
  }

  console.log(`   Phase:    ${phase}`);
  console.log(`   Step:     ${state.step}`);
  console.log(`   Updated:  ${state.lastUpdated}`);

  console.log("\n   Checklist:");
  console.log(`   ${state.taskSet ? "✔" : "○"} Task defined`);
  console.log(`   ${state.scopeSet ? "✔" : "○"} Scope set`);
  console.log(`   ${state.planGenerated ? "✔" : "○"} Plan generated`);
  console.log(`   ${phase === "running" ? "▶" : phase === "done" ? "✔" : "○"} Execution`);

  // Show task if set
  if (state.taskSet && (await exists(paths.task))) {
    const taskRaw = await read(paths.task);
    const taskLine = taskRaw.split("\n").filter(l => l.trim() && !l.startsWith("#") && !l.startsWith("---") && !l.startsWith("Created"))[0]?.trim();
    if (taskLine) {
      console.log(`\n   Task: "${taskLine}"`);
    }
  }

  // Token usage
  const history = await getTokenHistory();
  if (history.totals.runs > 0) {
    console.log(`\n   ── Token Usage (${history.totals.runs} run${history.totals.runs > 1 ? "s" : ""}) ──`);
    console.log(`   Input:     ${formatTokens(history.totals.inputTokens)} tokens`);
    console.log(`   Output:    ${formatTokens(history.totals.outputTokens)} tokens`);
    console.log(`   Total:     ${formatTokens(history.totals.totalTokens)} tokens`);
    if (history.totals.runs > 1) {
      const avg = Math.round(history.totals.totalTokens / history.totals.runs);
      console.log(`   Avg/run:   ${formatTokens(avg)} tokens`);
    }

    const lastRun = history.runs.at(-1);
    if (lastRun) {
      console.log(`\n   Last run:  ${lastRun.agent} | ${formatTokens(lastRun.totalTokens)} tokens | ${formatDuration(lastRun.durationMs)}`);
      console.log(`             "${lastRun.task}"`);
    }
  }
}
