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

Usage: ai <command> [args]

Commands:
  init                  Initialize AI OS in current project
  setup --stack=<name>  Configure project stack & type
  sync                  Pull latest rules from registry
  task "<text>"         Define a task
  scope <files>         Set file boundaries
  plan                  Generate execution plan
  run                   Execute the plan
  next                  Advance execution state
  status                Show current state
  reset                 Reset runtime (keep config)

Flow: init → setup → sync → task → scope → plan → run → next
`);
}