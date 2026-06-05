import { write, exists } from "../core/fs";
import { paths } from "../core/path";

const VALID_STACKS = [
  "nextjs",
  "react-vite",
  "dotnet",
  "svelte",
  "ionic-capacitor",
  "electron",
];

export async function setup(args: string[]) {
  if (!(await exists(paths.root))) {
    console.log("❌ AI OS not initialized. Run: ai init");
    return;
  }

  const stackArg = args.find(a => a.startsWith("--stack="));
  const typeArg = args.find(a => a.startsWith("--type="));

  if (!stackArg && !typeArg) {
    console.log("AI OS Setup\n");
    console.log("Usage:");
    console.log("   ai setup --stack=<name>   Set project stack");
    console.log("   ai setup --type=<name>    Set project type");
    console.log("\nAvailable stacks:");
    VALID_STACKS.forEach(s => console.log(`   • ${s}`));
    console.log("\nExample:");
    console.log('   ai setup --stack=nextjs --type=saas');
    return;
  }

  if (stackArg) {
    const stack = stackArg.split("=")[1] ?? "";
    if (!VALID_STACKS.includes(stack)) {
      console.log(`❌ Unknown stack: ${stack}`);
      console.log(`   Valid: ${VALID_STACKS.join(", ")}`);
      return;
    }
    await write(paths.stack, `# STACK\n\n${stack}\n`);
    console.log(`✅ Stack set: ${stack}`);
  }

  if (typeArg) {
    const projectType = typeArg.split("=")[1];
    await write(paths.projectType, `# PROJECT TYPE\n\n${projectType}\n`);
    console.log(`✅ Project type set: ${projectType}`);
  }

  console.log("\n   Next: ai sync (to pull stack-specific rules)");
}
