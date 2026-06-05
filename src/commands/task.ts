import { write } from "../core/fs";
import { paths } from "../core/path";
import { setState } from "../core/state";

export async function task(text: string) {
  if (!text || text.trim().length === 0) {
    console.log("❌ Usage: ai task \"<description>\"");
    return;
  }

  const content = `# TASK\n\n${text.trim()}\n\n---\nCreated: ${new Date().toISOString()}\n`;

  await write(paths.task, content);
  await setState({ taskSet: true, phase: "task" });

  console.log("✅ Task defined:");
  console.log(`   "${text.trim()}"`);
  console.log("\n   Next: ai scope <files>");
}