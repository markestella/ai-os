import { getState, resolvePhase } from "../core/state";
import { read, exists } from "../core/fs";
import { paths } from "../core/path";

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
}
