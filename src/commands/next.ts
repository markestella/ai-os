import { getState, setState, resolvePhase } from "../core/state";
import { getTokenHistory, formatTokens, formatDuration } from "../core/tokens";

export async function next() {
  const state = await getState();
  const currentPhase = resolvePhase(state);

  const transitions: Record<string, { next: string; message: string }> = {
    idle: { next: "task", message: "Define a task: ai task \"<description>\"" },
    task: { next: "scoped", message: "Set scope: ai scope <files>" },
    scoped: { next: "planned", message: "Generate plan: ai plan" },
    planned: { next: "running", message: "Execute: ai run" },
    running: { next: "done", message: "Execution complete" },
    done: { next: "idle", message: "Reset for next task: ai reset" },
  };

  const transition = transitions[currentPhase];
  if (!transition) {
    console.log("⚠️  Unknown phase. Run 'ai reset' to start fresh.");
    return;
  }

  const nextState = await setState({
    step: state.step + 1,
    phase: transition.next as typeof state.phase,
  });

  console.log(`Step ${nextState.step}: ${currentPhase} → ${transition.next}`);
  console.log(`   ${transition.message}`);

  // Show token summary when completing a run
  if (currentPhase === "running") {
    const history = await getTokenHistory();
    const lastRun = history.runs.at(-1);
    if (lastRun) {
      console.log(`\n   ── Last Run ──`);
      console.log(`   Agent:    ${lastRun.agent}`);
      console.log(`   Input:    ${formatTokens(lastRun.inputTokens)} tokens`);
      console.log(`   Output:   ${formatTokens(lastRun.outputTokens)} tokens`);
      console.log(`   Total:    ${formatTokens(lastRun.totalTokens)} tokens`);
      console.log(`   Duration: ${formatDuration(lastRun.durationMs)}`);

      if (history.totals.runs > 1) {
        console.log(`\n   ── All Time (${history.totals.runs} runs) ──`);
        console.log(`   Total tokens: ${formatTokens(history.totals.totalTokens)}`);
        const avgTokens = Math.round(history.totals.totalTokens / history.totals.runs);
        console.log(`   Avg/run:      ${formatTokens(avgTokens)}`);
      }
    }
  }
}