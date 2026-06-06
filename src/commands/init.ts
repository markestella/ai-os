import { write, dirExists } from "../core/fs";
import { paths } from "../core/path";
import { resetState } from "../core/state";

export async function init() {
  if (dirExists(paths.root)) {
    console.log("⚠️  AI OS already initialized. Use 'ai reset' to start fresh.");
    return;
  }

  console.log("Initializing AI OS...\n");

  // Runtime
  await write(paths.task, "# TASK\n\nNo task defined yet.\n");
  await write(paths.plan, "# PLAN\n\nNo plan generated yet.\n");
  await write(paths.scope, "# ACTIVE SCOPE\n\nNo files scoped yet.\n");
  await write(paths.result, "# RESULT\n\nNo results yet.\n");
  await resetState();

  // Control
  await write(paths.agents, "# AGENTS\n\nRun `ai sync` to pull agent rules from registry.\n");
  await write(paths.rules, "# RULES\n\nRun `ai sync` to pull rules from registry.\n");

  // Memory
  await write(paths.systemContext, "# SYSTEM CONTEXT\n\nProject context not yet configured.\n");

  // Profile
  await write(paths.stack, "# STACK\n\nnot-set\n");
  await write(paths.projectType, "# PROJECT TYPE\n\nnot-set\n");
  await write(paths.conventions, "# CONVENTIONS\n\nNo project conventions defined yet.\n");

  console.log("📁 Created /ai structure:");
  console.log("   /ai/runtime   → TASK, PLAN, STATE, SCOPE, RESULT");
  console.log("   /ai/control   → AGENTS, RULES");
  console.log("   /ai/memory    → SYSTEM_CONTEXT");
  console.log("   /ai/profile   → STACK, PROJECT_TYPE, CONVENTIONS");
  console.log("");
  console.log("✅ AI OS initialized. Next steps:");
  console.log("   1. ai setup          → configure stack & project type");
  console.log("   2. ai sync           → pull rules from registry");
  console.log("   3. ai task \"<text>\"   → define a task");
}