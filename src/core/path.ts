import { join } from "path";

const AI_ROOT = "ai";

export const paths = {
  root: AI_ROOT,

  // Runtime
  runtime: join(AI_ROOT, "runtime"),
  task: join(AI_ROOT, "runtime", "TASK.md"),
  plan: join(AI_ROOT, "runtime", "PLAN.md"),
  state: join(AI_ROOT, "runtime", "STATE.json"),
  result: join(AI_ROOT, "runtime", "RESULT.md"),
  scope: join(AI_ROOT, "runtime", "ACTIVE_SCOPE.md"),

  // Control
  control: join(AI_ROOT, "control"),
  agents: join(AI_ROOT, "control", "AGENTS.md"),
  rules: join(AI_ROOT, "control", "RULES.md"),

  // Memory
  memory: join(AI_ROOT, "memory"),
  systemContext: join(AI_ROOT, "memory", "SYSTEM_CONTEXT.md"),

  // Profile
  profile: join(AI_ROOT, "profile"),
  stack: join(AI_ROOT, "profile", "STACK.md"),
  projectType: join(AI_ROOT, "profile", "PROJECT_TYPE.md"),
  conventions: join(AI_ROOT, "profile", "CONVENTIONS.md"),

  // Meta
  version: join(AI_ROOT, ".ai-version"),
};
