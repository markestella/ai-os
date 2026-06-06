# AI OS

**Token-optimized AI orchestration CLI for deterministic coding agents.**

AI OS reduces token usage in AI coding workflows by enforcing scoped file access, standardizing agent behavior via versioned registry rules, and providing a deterministic state machine that prevents full repository context loading.

---

## Why AI OS?

Traditional AI coding workflows load your entire repository into context — burning through tokens and reducing accuracy. AI OS enforces strict boundaries:

```
Traditional:  AI Agent ← [entire repo]        = 50,000+ tokens
AI OS:        AI Agent ← [task + scope + plan] = 2,000–5,000 tokens
```

- **10x–50x fewer tokens** per task
- **Higher accuracy** — the agent only sees relevant files
- **Deterministic flow** — no ambiguity about what to do or where
- **Multi-stack support** — Next.js, React, .NET, Svelte, Ionic, Electron
- **Multi-agent support** — Codex, Claude, Copilot with model selection and cost tracking

---

## Installation

```bash
# From npm
npm install -g @macky_aletse/ai-os

# Or from source
git clone https://github.com/macky_aletse/ai-os.git
cd ai-os && bun install && bun link
```

Verify: `ai` should print the help menu.

---

## Quick Start

```bash
# 1. Initialize in your project
cd ~/projects/my-app
ai init

# 2. Configure stack, project type, and AI agent
ai setup --stack=nextjs --type=saas --agent=codex

# 3. Pull rules from registry
ai sync

# 4. Define a task
ai task "Fix auth timeout error in login service"

# 5. Scope the files the AI can touch
ai scope src/services/auth.ts src/middleware/session.ts

# 6. Generate execution plan
ai plan

# 7. Run — select model, see cost estimate, confirm, execute
ai run

# 8. Complete and check results
ai next
ai status
ai reset
```

---

## Supported AI Agents & Models

`ai run` interactively prompts you to select an agent and model before execution:

### OpenAI Codex CLI
```
Install: npm i -g @openai/codex
```

| Model | Input $/1k tokens | Output $/1k tokens |
|-------|-------------------|---------------------|
| o4-mini (Default) | $0.0011 | $0.0044 |
| o3 | $0.0100 | $0.0400 |
| GPT-4.1 | $0.0020 | $0.0080 |
| GPT-4.1 Mini | $0.0004 | $0.0016 |
| GPT-4.1 Nano | $0.0001 | $0.0004 |

### Claude Code CLI
```
Install: npm i -g @anthropic-ai/claude-code
```

| Model | Input $/1k tokens | Output $/1k tokens |
|-------|-------------------|---------------------|
| Claude Sonnet 4 (Default) | $0.0030 | $0.0150 |
| Claude Opus 4 | $0.0150 | $0.0750 |
| Claude Haiku 3.5 | $0.0008 | $0.0040 |

### GitHub Copilot CLI
```
Install: gh extension install github/gh-copilot
```

| Model | Cost |
|-------|------|
| Copilot (Subscription) | Included in GitHub Copilot plan |

---

## Command Reference

| Command | Description |
|---------|-------------|
| `ai` | Show help with all commands, options, and examples |
| `ai init` | Create `/ai` directory structure in current project |
| `ai setup --stack=<name>` | Set technology stack |
| `ai setup --type=<name>` | Set project type |
| `ai setup --agent=<name>` | Set default AI agent |
| `ai sync` | Pull latest rules from registry |
| `ai sync --version 1.0.0` | Pull a specific registry version |
| `ai task "<text>"` | Define the task to execute |
| `ai scope <file1> <file2>` | Set file boundaries (space-separated) |
| `ai plan` | Generate execution plan from task + scope |
| `ai run` | Interactive agent/model selection → cost estimate → execute |
| `ai next` | Advance state machine + show token summary |
| `ai status` | Show phase, checklist, agent, stack, and token history |
| `ai reset` | Clear runtime files (preserves config & token history) |

---

## Execution Flow & State Machine

```
idle → task → scoped → planned → running → done → (reset) → idle
```

```
ai init → ai setup → ai sync → ai task → ai scope → ai plan → ai run → ai next → ai reset
   │          │          │          │          │          │         │         │          │
   ▼          ▼          ▼          ▼          ▼          ▼         ▼         ▼          ▼
 Create    Set stack   Pull      Define    Set file   Generate  Select    Complete    Clear
 /ai dir   & agent    rules     intent    limits     plan      agent     + tokens    runtime
                                                               + model
                                                               + confirm
                                                               + execute
```

---

## Token Tracking

Every `ai run` tracks token usage automatically:

- **Input tokens** — estimated from context size, or parsed from agent output
- **Output tokens** — estimated from agent response, or parsed from agent output
- **Cost estimate** — calculated per model pricing
- **Duration** — wall-clock time for the run
- **History** — cumulative across all runs, persisted in `ai/runtime/TOKENS.json`

View with `ai status` or `ai next` after a run:

```
── Token Usage (5 runs) ──
Input:     10.5k tokens
Output:    3.7k tokens
Total:     14.2k tokens
Avg/run:   2.8k tokens

Last run:  codex | 3.0k tokens | 12.3s
```

---

## Project Structure

After `ai init`, your project gets:

```
your-project/
  ai/
    runtime/              ← Cleared on each reset
      TASK.md               Current task definition
      PLAN.md               Generated execution plan
      STATE.json            Machine-readable state
      ACTIVE_SCOPE.md       File boundary enforcement
      RESULT.md             Execution results + token usage
      TOKENS.json           Token tracking history
    control/              ← Synced from registry
      AGENTS.md             Agent behavioral rules
      RULES.md              Global operational rules
      STACK_RULES.md        Stack-specific rules (after sync)
    memory/               ← Project context
      SYSTEM_CONTEXT.md     Project-level context and notes
    profile/              ← Project configuration
      STACK.md              Technology stack identifier
      PROJECT_TYPE.md       Project type
      CONVENTIONS.md        Project-specific conventions
      AGENT                 Saved AI agent preference
    .ai-version           ← Current registry version
```

---

## Available Stacks

| Stack | Category | Runtime | Use Case |
|-------|----------|---------|----------|
| `nextjs` | fullstack | node | Next.js App Router projects |
| `react-vite` | frontend | node | React SPA with Vite |
| `svelte` | frontend | node | Svelte / SvelteKit |
| `dotnet` | backend | dotnet | ASP.NET Core Web APIs |
| `ionic-capacitor` | mobile | node | Hybrid mobile apps |
| `electron` | desktop | node | Desktop apps with Electron |

---

## Documentation

- [Usage Guide](docs/USAGE.md) — Detailed setup, workflows, agent configuration, troubleshooting
- [Deployment Guide](docs/DEPLOYMENT.md) — VPS setup, Nginx, Certbot, version publishing
- [Architecture](docs/ARCHITECTURE.md) — CLI vs Registry design, token optimization, state machine

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_OS_REGISTRY_URL` | `https://ai-cli-registry.mckbyte.com` | Override registry URL |

---

## Requirements

- [Bun](https://bun.sh) runtime
- At least one AI agent CLI installed (codex, claude, or copilot)
- AI OS Registry (remote at `ai-cli-registry.mckbyte.com` or self-hosted)
