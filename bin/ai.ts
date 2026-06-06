#!/usr/bin/env bun

import { init } from "../src/commands/init";
import { task } from "../src/commands/task";
import { scope } from "../src/commands/scope";
import { plan } from "../src/commands/plan";
import { run } from "../src/commands/run";
import { next } from "../src/commands/next";
import { status } from "../src/commands/status";
import { reset } from "../src/commands/reset";
import { setup } from "../src/commands/setup";
import { sync } from "../src/commands/sync";

const [, , cmd, ...args] = process.argv;

switch (cmd) {
  case "init":
    await init();
    break;

  case "task":
    await task(args.join(" "));
    break;

  case "scope":
    await scope(args);
    break;

  case "plan":
    await plan();
    break;

  case "run":
    await run();
    break;

  case "status":
    await status();
    break;

  case "next":
    await next();
    break;

  case "reset":
    await reset();
    break;

  case "setup":
    await setup(args);
    break;

  case "sync":
    await sync(args);
    break;

  default:
    console.log(`
AI OS — Token Optimized Coding Agent Framework
Version: 1.0.0

Usage: ai <command> [options]

Getting Started:
  init                          Create /ai directory structure in current project
  setup [options]               Configure project stack, type, and AI agent
  sync [--version <ver>]        Pull rules from remote registry

Task Lifecycle:
  task "<description>"          Define what needs to be done
  scope <file1> <file2> ...     Set which files the AI can touch
  plan                          Generate an execution plan from task + scope
  run                           Select agent & model, then execute the plan
  next                          Advance to next phase / mark complete
  status                        Show current state, tokens, and checklist
  reset                         Clear runtime (keeps config & token history)

Setup Options:
  --stack=<name>                nextjs | react-vite | svelte | dotnet | ionic-capacitor | electron
  --type=<name>                 saas | api | frontend | mobile | desktop | library
  --agent=<name>                codex | claude | copilot

Supported AI Agents:
  codex       OpenAI Codex CLI         npm i -g @openai/codex
  claude      Claude Code CLI          npm i -g @anthropic-ai/claude-code
  copilot     GitHub Copilot CLI       gh extension install github/gh-copilot

Execution Flow:
  init → setup → sync → task → scope → plan → run → next → reset

Examples:
  ai init
  ai setup --stack=nextjs --type=saas --agent=codex
  ai sync
  ai task "Fix auth timeout in login service"
  ai scope src/services/auth.ts src/middleware/session.ts
  ai plan
  ai run
  ai next
  ai status

Docs: https://github.com/macky_aletse/ai-os
`);
}