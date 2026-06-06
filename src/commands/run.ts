import { read, write, exists } from "../core/fs";
import { paths } from "../core/path";
import { getState, setState } from "../core/state";
import { startTokenRun, completeTokenRun, formatTokens, formatDuration } from "../core/tokens";
import { spawn, execSync } from "child_process";
import * as readline from "readline";

// ── Agent & Model Definitions ──

interface ModelInfo {
  id: string;
  name: string;
  inputCostPer1k: number;   // $ per 1k input tokens
  outputCostPer1k: number;  // $ per 1k output tokens
}

interface AgentInfo {
  name: string;
  command: string;
  label: string;
  install: string;
  models: ModelInfo[];
  buildArgs: (prompt: string, model?: string) => string[];
}

const AGENTS: AgentInfo[] = [
  {
    name: "codex",
    command: "codex",
    label: "OpenAI Codex CLI",
    install: "npm i -g @openai/codex",
    models: [
      { id: "o4-mini", name: "o4-mini (Default)", inputCostPer1k: 0.00110, outputCostPer1k: 0.00440 },
      { id: "o3", name: "o3", inputCostPer1k: 0.01000, outputCostPer1k: 0.04000 },
      { id: "gpt-4.1", name: "GPT-4.1", inputCostPer1k: 0.00200, outputCostPer1k: 0.00800 },
      { id: "gpt-4.1-mini", name: "GPT-4.1 Mini", inputCostPer1k: 0.00040, outputCostPer1k: 0.00160 },
      { id: "gpt-4.1-nano", name: "GPT-4.1 Nano", inputCostPer1k: 0.00010, outputCostPer1k: 0.00040 },
    ],
    buildArgs: (prompt, model) => {
      const args = ["--prompt", prompt];
      if (model) args.push("--model", model);
      return args;
    },
  },
  {
    name: "claude",
    command: "claude",
    label: "Claude Code CLI",
    install: "npm i -g @anthropic-ai/claude-code",
    models: [
      { id: "sonnet", name: "Claude Sonnet 4 (Default)", inputCostPer1k: 0.00300, outputCostPer1k: 0.01500 },
      { id: "opus", name: "Claude Opus 4", inputCostPer1k: 0.01500, outputCostPer1k: 0.07500 },
      { id: "haiku", name: "Claude Haiku 3.5", inputCostPer1k: 0.00080, outputCostPer1k: 0.00400 },
    ],
    buildArgs: (prompt, model) => {
      const args = ["--print", prompt];
      if (model) args.push("--model", `claude-${model}`);
      return args;
    },
  },
  {
    name: "copilot",
    command: "gh",
    label: "GitHub Copilot CLI",
    install: "gh extension install github/gh-copilot",
    models: [
      { id: "default", name: "Copilot (Subscription)", inputCostPer1k: 0, outputCostPer1k: 0 },
    ],
    buildArgs: (prompt) => {
      return ["copilot", "suggest", prompt];
    },
  },
];

// ── Utilities ──

function isInstalled(command: string): boolean {
  try {
    execSync(`which ${command}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function askQuestion(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function estimateCost(model: ModelInfo, inputTokens: number, outputTokens: number): string {
  if (model.inputCostPer1k === 0 && model.outputCostPer1k === 0) {
    return "Included in subscription";
  }
  const inputCost = (inputTokens / 1000) * model.inputCostPer1k;
  const outputCost = (outputTokens / 1000) * model.outputCostPer1k;
  const total = inputCost + outputCost;
  if (total < 0.01) return `~$${total.toFixed(4)}`;
  return `~$${total.toFixed(3)}`;
}

// ── Interactive Selection ──

async function selectAgent(): Promise<AgentInfo | null> {
  console.log("\n   Select AI Agent:\n");

  const available: AgentInfo[] = [];
  const unavailable: AgentInfo[] = [];

  for (const agent of AGENTS) {
    if (isInstalled(agent.command)) {
      available.push(agent);
    } else {
      unavailable.push(agent);
    }
  }

  if (available.length === 0) {
    console.log("   ❌ No AI agents installed.\n");
    console.log("   Install one:");
    for (const agent of AGENTS) {
      console.log(`      ${agent.label}: ${agent.install}`);
    }
    return null;
  }

  let idx = 1;
  for (const agent of available) {
    console.log(`   [${idx}] ${agent.label}`);
    idx++;
  }

  if (unavailable.length > 0) {
    console.log("");
    for (const agent of unavailable) {
      console.log(`   [–] ${agent.label} (not installed)`);
      console.log(`       Install: ${agent.install}`);
    }
  }

  const answer = await askQuestion(`\n   Choice [1-${available.length}]: `);
  const choice = parseInt(answer);

  if (isNaN(choice) || choice < 1 || choice > available.length) {
    console.log("   ❌ Invalid selection.");
    return null;
  }

  return available[choice - 1] ?? null;
}

async function selectModel(agent: AgentInfo, estimatedInputTokens: number): Promise<ModelInfo | null> {
  if (agent.models.length === 1) {
    const model = agent.models[0]!;
    const estimatedOutputTokens = Math.ceil(estimatedInputTokens * 0.5);
    console.log(`\n   Model: ${model.name}`);
    console.log(`   Est. cost: ${estimateCost(model, estimatedInputTokens, estimatedOutputTokens)}`);
    return model;
  }

  console.log(`\n   Select Model for ${agent.label}:\n`);

  const estimatedOutputTokens = Math.ceil(estimatedInputTokens * 0.5);

  for (let i = 0; i < agent.models.length; i++) {
    const model = agent.models[i]!;
    const cost = estimateCost(model, estimatedInputTokens, estimatedOutputTokens);

    let pricing = "";
    if (model.inputCostPer1k > 0) {
      pricing = ` │ $${model.inputCostPer1k.toFixed(4)}/1k in, $${model.outputCostPer1k.toFixed(4)}/1k out`;
    }

    console.log(`   [${i + 1}] ${model.name}`);
    console.log(`       Est. cost: ${cost}${pricing}`);
  }

  const answer = await askQuestion(`\n   Choice [1-${agent.models.length}]: `);
  const choice = parseInt(answer);

  if (isNaN(choice) || choice < 1 || choice > agent.models.length) {
    console.log("   ❌ Invalid selection.");
    return null;
  }

  return agent.models[choice - 1] ?? null;
}

// ── Prompt Builder ──

function buildPrompt(context: string): string {
  return `You are an AI coding agent operating under AI OS.

Execute the task below strictly within the defined scope. Follow all rules and constraints provided.

Do NOT modify files outside of ACTIVE_SCOPE.
Do NOT deviate from the PLAN.
Apply changes step-by-step.

${context}`;
}

// ── Agent Execution ──

async function executeAgent(
  agent: AgentInfo,
  model: ModelInfo,
  promptText: string,
  taskSummary: string,
  scopeCount: number,
) {
  const args = agent.buildArgs(promptText, model.id === "default" ? undefined : model.id);

  await startTokenRun(agent.name, taskSummary, promptText, scopeCount);

  console.log(`\n🤖 Launching ${agent.name} (${model.name})...\n`);

  let capturedOutput = "";

  const child = spawn(agent.command, args, {
    stdio: ["inherit", "pipe", "pipe"],
  });

  child.stdout?.on("data", (data: Buffer) => {
    const text = data.toString();
    capturedOutput += text;
    process.stdout.write(data);
  });

  child.stderr?.on("data", (data: Buffer) => {
    const text = data.toString();
    capturedOutput += text;
    process.stderr.write(data);
  });

  child.on("error", (err) => {
    console.log(`\n❌ Failed to launch ${agent.name}: ${err.message}`);
    console.log(`   Make sure '${agent.command}' is installed and in your PATH.`);
    console.log(`   Install: ${agent.install}`);
  });

  child.on("close", async (code) => {
    const tokenRun = await completeTokenRun(capturedOutput);

    if (code === 0 && tokenRun) {
      const cost = estimateCost(model, tokenRun.inputTokens, tokenRun.outputTokens);

      console.log(`\n${"─".repeat(50)}`);
      console.log(`✅ ${agent.name} (${model.name}) finished\n`);
      console.log(`   Token Usage:`);
      console.log(`   ├─ Input:    ${formatTokens(tokenRun.inputTokens)} tokens`);
      console.log(`   ├─ Output:   ${formatTokens(tokenRun.outputTokens)} tokens`);
      console.log(`   ├─ Total:    ${formatTokens(tokenRun.totalTokens)} tokens`);
      console.log(`   ├─ Cost:     ${cost}`);
      console.log(`   ├─ Duration: ${formatDuration(tokenRun.durationMs)}`);
      console.log(`   └─ Scope:    ${tokenRun.scopeFiles} file(s)`);
      console.log(`\n   Context: ${tokenRun.contextChars.toLocaleString()} chars → ~${formatTokens(tokenRun.inputTokens)} tokens`);
      console.log(`   (vs full repo scan which would load 10x-50x more tokens)\n`);
      console.log(`   Run: ai next`);

      await write(
        paths.result,
        `# RESULT\n\nCompleted: ${new Date().toISOString()}\nAgent: ${agent.name}\nModel: ${model.name}\n\n## Token Usage\n- Input: ${formatTokens(tokenRun.inputTokens)} tokens\n- Output: ${formatTokens(tokenRun.outputTokens)} tokens\n- Total: ${formatTokens(tokenRun.totalTokens)} tokens\n- Cost: ${cost}\n- Duration: ${formatDuration(tokenRun.durationMs)}\n- Scope: ${tokenRun.scopeFiles} file(s)\n\n## Output\n\n\`\`\`\n${capturedOutput.slice(0, 5000)}\n\`\`\`\n`,
      );
    } else if (tokenRun) {
      console.log(`\n⚠️  ${agent.name} exited with code ${code}`);
      console.log(`   Tokens used: ~${formatTokens(tokenRun.totalTokens)}`);
      console.log(`   Run: ai reset to try again`);
    }
  });
}

// ── Main Run Command ──

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

  // Load context
  const task = await read(paths.task);
  const scope = await read(paths.scope);
  const plan = await read(paths.plan);

  let rules = "";
  if (await exists(paths.rules)) rules = await read(paths.rules);

  let agentsContent = "";
  if (await exists(paths.agents)) agentsContent = await read(paths.agents);

  let stackRules = "";
  const stackRulesPath = `${paths.control}/STACK_RULES.md`;
  if (await exists(stackRulesPath)) stackRules = await read(stackRulesPath);

  const scopeLines = scope.split("\n").filter(l => l.trim().startsWith("-"));
  const scopeCount = scopeLines.length;

  const context = `# AI OS EXECUTION CONTEXT

${agentsContent}

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

  const estimatedInputTokens = Math.ceil(context.length / 4);
  const taskLine = task.split("\n").filter(l => l.trim() && !l.startsWith("#") && !l.startsWith("---") && !l.startsWith("Created"))[0]?.trim() || "unknown";

  // ── Show execution summary ──

  console.log("🚀 AI OS Run\n");
  console.log("   Context loaded:");
  console.log("   • TASK.md · ACTIVE_SCOPE.md · PLAN.md");
  console.log("   • AGENTS.md · RULES.md" + (stackRules ? " · STACK_RULES.md" : ""));
  console.log(`\n   ~${formatTokens(estimatedInputTokens)} input tokens | ${scopeCount} file(s) scoped`);
  console.log(`   Task: "${taskLine}"`);

  // ── Select agent ──

  let selectedAgent: AgentInfo | null = null;

  // Check saved agent first
  if (await exists(paths.agent)) {
    const savedName = (await read(paths.agent)).trim();
    const found = AGENTS.find(a => a.name === savedName);
    if (found && isInstalled(found.command)) {
      selectedAgent = found;
      console.log(`\n   Saved agent: ${found.label}`);
      const useSaved = await askQuestion("   Use saved agent? (Y/n): ");
      if (useSaved.toLowerCase() === "n") {
        selectedAgent = null;
      }
    }
  }

  if (!selectedAgent) {
    selectedAgent = await selectAgent();
    if (!selectedAgent) {
      return;
    }
    // Save for next time
    await write(paths.agent, selectedAgent.name);
  }

  // ── Select model ──

  const selectedModel = await selectModel(selectedAgent, estimatedInputTokens);
  if (!selectedModel) {
    return;
  }

  // ── Confirm ──

  const estimatedOutputTokens = Math.ceil(estimatedInputTokens * 0.5);
  const cost = estimateCost(selectedModel, estimatedInputTokens, estimatedOutputTokens);

  console.log(`\n   ${"─".repeat(40)}`);
  console.log(`   Agent:      ${selectedAgent.label}`);
  console.log(`   Model:      ${selectedModel.name}`);
  console.log(`   Input:      ~${formatTokens(estimatedInputTokens)} tokens`);
  console.log(`   Est. cost:  ${cost}`);
  console.log(`   ${"─".repeat(40)}`);

  const confirm = await askQuestion("\n   Start execution? (Y/n): ");
  if (confirm.toLowerCase() === "n") {
    console.log("   Cancelled. State unchanged.");
    return;
  }

  // ── Execute ──

  await setState({ phase: "running" });
  await write(paths.result, `# RESULT\n\nExecution started: ${new Date().toISOString()}\n\nStatus: IN PROGRESS\n`);

  const promptText = buildPrompt(context);
  await executeAgent(selectedAgent, selectedModel, promptText, taskLine, scopeCount);
}
