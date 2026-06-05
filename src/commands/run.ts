import { read, write, exists } from "../core/fs";
import { paths } from "../core/path";
import { getState, setState } from "../core/state";

export async function run() {
  const state = await getState();

  if (!state.planGenerated) {
    console.log("❌ No plan generated. Run: ai plan");
    return;
  }

  if (state.phase === "running") {
    console.log("⚠️  Already running. Use 'ai next' to advance or 'ai reset' to restart.");
    return;
  }

  if (state.phase === "done") {
    console.log("⚠️  Task already completed. Use 'ai reset' to start a new task.");
    return;
  }

  await setState({ phase: "running" });

  // Load context for the agent
  const task = await read(paths.task);
  const scope = await read(paths.scope);
  const plan = await read(paths.plan);

  let rules = "";
  if (await exists(paths.rules)) {
    rules = await read(paths.rules);
  }

  let agents = "";
  if (await exists(paths.agents)) {
    agents = await read(paths.agents);
  }

  let stackRules = "";
  const stackRulesPath = `${paths.control}/STACK_RULES.md`;
  if (await exists(stackRulesPath)) {
    stackRules = await read(stackRulesPath);
  }

  // Build the execution context
  const context = `# AI OS EXECUTION CONTEXT

${agents}

---

${rules}

${stackRules ? `---\n\n# STACK-SPECIFIC RULES\n\n${stackRules}` : ""}

---

${task}

---

${scope}

---

${plan}
`;

  await write(paths.result, `# RESULT\n\nExecution started: ${new Date().toISOString()}\n\nStatus: IN PROGRESS\n`);

  console.log("🚀 AI OS Execution Context Ready\n");
  console.log("Loaded:");
  console.log("   • TASK.md");
  console.log("   • ACTIVE_SCOPE.md");
  console.log("   • PLAN.md");
  console.log("   • AGENTS.md");
  console.log("   • RULES.md");
  if (stackRules) console.log("   • STACK_RULES.md");
  console.log("\n   The AI agent should now execute the plan within scope.");
  console.log("   When done, run: ai next (to mark complete)");
}
