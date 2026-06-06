import { write, dirExists } from "../core/fs";
import { paths } from "../core/path";
import { execSync } from "child_process";

const VALID_STACKS = [
  "nextjs",
  "react-vite",
  "dotnet",
  "svelte",
  "ionic-capacitor",
  "electron",
];

const AGENTS = [
  { name: "codex", command: "codex", label: "OpenAI Codex CLI", install: "npm i -g @openai/codex" },
  { name: "claude", command: "claude", label: "Claude Code CLI", install: "npm i -g @anthropic-ai/claude-code" },
  { name: "copilot", command: "gh", label: "GitHub Copilot CLI", install: "gh extension install github/gh-copilot" },
];

function isInstalled(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export async function setup(args: string[]) {
  if (!dirExists(paths.root)) {
    console.log("❌ AI OS not initialized. Run: ai init");
    return;
  }

  const stackArg = args.find(a => a.startsWith("--stack="));
  const typeArg = args.find(a => a.startsWith("--type="));
  const agentArg = args.find(a => a.startsWith("--agent="));

  if (!stackArg && !typeArg && !agentArg) {
    console.log("AI OS Setup\n");
    console.log("Usage:");
    console.log("   ai setup --stack=<name>   Set project stack");
    console.log("   ai setup --type=<name>    Set project type");
    console.log("   ai setup --agent=<name>   Set AI agent");
    console.log("\nAvailable stacks:");
    VALID_STACKS.forEach(s => console.log(`   • ${s}`));
    console.log("\nAgents:");
    for (const agent of AGENTS) {
      const installed = isInstalled(agent.command);
      const status = installed ? "✔ installed" : "✗ not found";
      console.log(`   ${installed ? "✔" : "○"} ${agent.name.padEnd(12)} ${agent.label} (${status})`);
      if (!installed) {
        console.log(`     Install: ${agent.install}`);
      }
    }
    console.log("\nExample:");
    console.log('   ai setup --stack=nextjs --type=saas --agent=codex');
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

  if (agentArg) {
    const agentName = agentArg.split("=")[1] ?? "";
    const agentInfo = AGENTS.find(a => a.name === agentName);
    if (!agentInfo) {
      console.log(`❌ Unknown agent: ${agentName}`);
      console.log(`   Valid: ${AGENTS.map(a => a.name).join(", ")}`);
      return;
    }
    if (!isInstalled(agentInfo.command)) {
      console.log(`⚠️  ${agentInfo.label} not found in PATH.`);
      console.log(`   Install: ${agentInfo.install}`);
      console.log(`   Setting anyway — install before running 'ai run'.`);
    }
    await write(paths.agent, agentName);
    console.log(`✅ Agent set: ${agentName}`);
  }

  console.log("\n   Next: ai sync (to pull stack-specific rules)");
}
