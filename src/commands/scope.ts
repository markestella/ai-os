import { write } from "../core/fs";
import { paths } from "../core/path";
import { setState, getState } from "../core/state";

export async function scope(files: string[]) {
  if (!files || files.length === 0) {
    console.log("❌ Usage: ai scope <file1> <file2> ...");
    return;
  }

  const state = await getState();
  if (!state.taskSet) {
    console.log("⚠️  Define a task first: ai task \"<description>\"");
    return;
  }

  const header = "# ACTIVE SCOPE\n\nOnly these files may be read or modified:\n\n";
  const content = header + files.map(f => `- ${f}`).join("\n") + "\n";

  await write(paths.scope, content);
  await setState({ scopeSet: true, phase: "scoped" });

  console.log("✅ Scope set:");
  files.forEach(f => console.log(`   • ${f}`));
  console.log("\n   Next: ai plan");
}