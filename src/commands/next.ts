import { getState, setState, resolvePhase } from "../core/state";

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
}