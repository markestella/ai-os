import { write } from "../core/fs";
import { paths } from "../core/path";
import { resetState } from "../core/state";

export async function reset() {
  await write(paths.task, "# TASK\n\nNo task defined yet.\n");
  await write(paths.plan, "# PLAN\n\nNo plan generated yet.\n");
  await write(paths.scope, "# ACTIVE SCOPE\n\nNo files scoped yet.\n");
  await write(paths.result, "# RESULT\n\nNo results yet.\n");
  await resetState();

  console.log("✅ AI OS runtime reset.");
  console.log("   Task, scope, plan, and state cleared.");
  console.log("   Control files and profile preserved.");
  console.log("\n   Start fresh: ai task \"<description>\"");
}
