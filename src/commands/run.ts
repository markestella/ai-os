import { read, write, exists } from "../core/fs";
import { paths } from "../core/path";
import { getState, setState } from "../core/state";
import { startTokenRun, completeTokenRun, formatTokens, formatDuration } from "../core/tokens";
import { spawn, execSync } from "child_process";
import * as readline from "readline";

// ── Types ──

interface DynamicModel {
  id: string;
  name: string;
}

interface AgentInfo {
  name: string;
  command: string;
  label: string;
  install: string;
  fallbackModels: DynamicModel[];
  fetchModels: () => Promise<DynamicModel[]>;
  buildArgs: (prompt: string, model?: string) => string[];
}

// ── Known Pricing (per 1k tokens) ──

const KNOWN_PRICING: Record<string, { input: number; output: number }> = {
  // OpenAI
  "o4-mini":       { input: 0.0011,  output: 0.0044 },
  "o3":            { input: 0.01,    output: 0.04 },
  "o3-mini":       { input: 0.0011,  output: 0.0044 },
  "gpt-4.1":       { input: 0.002,   output: 0.008 },
  "gpt-4.1-mini":  { input: 0.0004,  output: 0.0016 },
  "gpt-4.1-nano":  { input: 0.0001,  output: 0.0004 },
  "gpt-4o":        { input: 0.0025,  output: 0.01 },
  "gpt-4o-mini":   { input: 0.00015, output: 0.0006 },
  // Anthropic
  "claude-sonnet-4": { input: 0.003,  output: 0.015 },
  "claude-opus-4":   { input: 0.015,  output: 0.075 },
  "claude-haiku-3":  { input: 0.0008, output: 0.004 },
  "sonnet":          { input: 0.003,  output: 0.015 },
  "opus":            { input: 0.015,  output: 0.075 },
  "haiku":           { input: 0.0008, output: 0.004 },
};

function lookupPricing(modelId: string): { input: number; output: number } | null {
  if (KNOWN_PRICING[modelId]) return KNOWN_PRICING[modelId]!;
  for (const [key, pricing] of Object.entries(KNOWN_PRICING)) {
    if (modelId.startsWith(key)) return pricing;
  }
  return null;
}

// ── Dynamic Model Fetching ──

function parseModelCatalog(data: unknown): DynamicModel[] {
  if (Array.isArray(data)) {
    return data
      .filter((m: any) => m && (m.id || m.name || m.model_id))
      .map((m: any) => ({
        id: m.id || m.model_id || m.name,
        name: m.display_name || m.name || m.id || m.model_id,
      }));
  }
  if (data && typeof data === "object") {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.models)) return parseModelCatalog(obj.models);
    if (Array.isArray(obj.data)) return parseModelCatalog(obj.data);
    return Object.entries(obj)
      .filter(([_, val]) => val && typeof val === "object")
      .map(([key, val]: [string, any]) => ({
        id: key,
        name: val?.display_name || val?.name || key,
      }));
  }
  return [];
}

async function fetchCodexModels(): Promise<DynamicModel[]> {
  // 1. Try `codex debug models --bundled` (works without auth)
  try {
    const output = execSync("codex debug models --bundled", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 10000,
    });
    const models = parseModelCatalog(JSON.parse(output.trim()));
    if (models.length > 0) return models;
  } catch {}

  // 2. Fall back to OpenAI API
  const apiKey = process.env.OPENAI_API_KEY || process.env.CODEX_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data: Array<{ id: string }> };
    const relevant = new Set([
      "o4-mini", "o3", "o3-mini",
      "gpt-4.1", "gpt-4.1-mini", "gpt-4.1-nano",
      "gpt-4o", "gpt-4o-mini",
    ]);
    return data.data
      .filter((m) => relevant.has(m.id))
      .map((m) => ({ id: m.id, name: m.id }));
  } catch {
    return [];
  }
}

async function fetchClaudeModels(): Promise<DynamicModel[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return [];
  try {
    const res = await fetch("https://api.anthropic.com/v1/models?limit=100", {
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { data: Array<{ id: string; display_name?: string }> };
    return data.data
      .filter((m) => !m.id.includes("embed"))
      .map((m) => ({ id: m.id, name: m.display_name || m.id }));
  } catch {
    return [];
  }
}

async function fetchCopilotModels(): Promise<DynamicModel[]> {
  // Copilot uses subscription-based auto model selection
  // No public API to list available models
  return [];
}

// ── Agent Definitions ──

const AGENTS: AgentInfo[] = [
  {
    name: "codex",
    command: "codex",
    label: "OpenAI Codex CLI",
    install: "npm i -g @openai/codex",
    fallbackModels: [
      { id: "o4-mini", name: "o4-mini" },
      { id: "o3", name: "o3" },
      { id: "gpt-4.1", name: "gpt-4.1" },
      { id: "gpt-4.1-mini", name: "gpt-4.1-mini" },
      { id: "gpt-4.1-nano", name: "gpt-4.1-nano" },
    ],
    fetchModels: fetchCodexModels,
    buildArgs: (prompt, model) => {
      const args = ["exec", "--sandbox", "workspace-write"];
      if (model) args.push("--model", model);
      args.push(prompt);
      return args;
    },
  },
  {
    name: "claude",
    command: "claude",
    label: "Claude Code CLI",
    install: "npm i -g @anthropic-ai/claude-code",
    fallbackModels: [
      { id: "sonnet", name: "Claude Sonnet 4" },
      { id: "opus", name: "Claude Opus 4" },
      { id: "haiku", name: "Claude Haiku 3.5" },
    ],
    fetchModels: fetchClaudeModels,
    buildArgs: (prompt, model) => {
      const args = ["-p"];
      if (model) args.push("--model", model);
      args.push(prompt);
      return args;
    },
  },
  {
    name: "copilot",
    command: "gh",
    label: "GitHub Copilot CLI",
    install: "gh extension install github/gh-copilot",
    fallbackModels: [
      { id: "auto", name: "Auto (default)" },
    ],
    fetchModels: fetchCopilotModels,
    buildArgs: (prompt, model) => {
      const args = ["copilot", "-p", prompt, "--allow-all-tools"];
      if (model && model !== "auto") args.push("--model", model);
      return args;
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

function estimateCostStr(modelId: string, agentName: string, inputTokens: number, outputTokens: number): string {
  const pricing = lookupPricing(modelId);
  if (!pricing) {
    return agentName === "copilot" ? "Included in subscription" : "N/A";
  }
  const total = (inputTokens / 1000) * pricing.input + (outputTokens / 1000) * pricing.output;
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

async function selectModel(agent: AgentInfo, estimatedInputTokens: number): Promise<DynamicModel | null> {
  console.log("\n   Fetching available models...");

  let models = await agent.fetchModels();
  let source = "fetched";

  if (models.length === 0) {
    models = agent.fallbackModels;
    source = "default";
  }

  if (models.length === 1) {
    const model = models[0]!;
    const estimatedOutputTokens = Math.ceil(estimatedInputTokens * 0.5);
    console.log(`   Model: ${model.name}`);
    console.log(`   Est. cost: ${estimateCostStr(model.id, agent.name, estimatedInputTokens, estimatedOutputTokens)}`);
    return model;
  }

  console.log(`   Found ${models.length} models (${source})\n`);
  console.log(`   Select Model for ${agent.label}:\n`);

  const estimatedOutputTokens = Math.ceil(estimatedInputTokens * 0.5);

  for (let i = 0; i < models.length; i++) {
    const model = models[i]!;
    const pricing = lookupPricing(model.id);

    console.log(`   [${i + 1}] ${model.name}`);
    if (pricing) {
      const cost = estimateCostStr(model.id, agent.name, estimatedInputTokens, estimatedOutputTokens);
      console.log(`       Est. cost: ${cost} │ $${pricing.input.toFixed(4)}/1k in, $${pricing.output.toFixed(4)}/1k out`);
    }
  }

  const answer = await askQuestion(`\n   Choice [1-${models.length}]: `);
  const choice = parseInt(answer);

  if (isNaN(choice) || choice < 1 || choice > models.length) {
    console.log("   ❌ Invalid selection.");
    return null;
  }

  return models[choice - 1] ?? null;
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
  model: DynamicModel,
  promptText: string,
  taskSummary: string,
  scopeCount: number,
) {
  const args = agent.buildArgs(promptText, model.id === "auto" ? undefined : model.id);

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
      const cost = estimateCostStr(model.id, agent.name, tokenRun.inputTokens, tokenRun.outputTokens);

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
  const cost = estimateCostStr(selectedModel.id, selectedAgent.name, estimatedInputTokens, estimatedOutputTokens);

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
