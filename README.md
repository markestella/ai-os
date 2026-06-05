# AI OS

Token-optimized AI orchestration CLI for deterministic coding agents.

## What It Does

- Reduces token usage by enforcing scoped file access
- Standardizes AI coding behavior via versioned rules
- Supports multi-stack development (Next.js, React, .NET, Svelte, Ionic, Electron)
- Provides a deterministic state machine: TASK → SCOPE → PLAN → RUN → DONE

## Quick Start

```bash
# Install
bun link

# In any project
ai init
ai setup --stack=nextjs
ai sync
ai task "Fix auth timeout bug"
ai scope src/auth.ts src/middleware.ts
ai plan
ai run
```

## Commands

| Command | Description |
|---------|-------------|
| `ai init` | Initialize /ai structure |
| `ai setup` | Configure stack and project type |
| `ai sync` | Pull rules from registry |
| `ai task` | Define a task |
| `ai scope` | Set file boundaries |
| `ai plan` | Generate execution plan |
| `ai run` | Execute the plan |
| `ai next` | Advance state |
| `ai status` | Show current state |
| `ai reset` | Reset runtime |

## Documentation

- [Usage Guide](docs/USAGE.md)
- [Deployment Guide](docs/DEPLOYMENT.md)
- [Architecture](docs/ARCHITECTURE.md)

## Requirements

- [Bun](https://bun.sh) runtime
- AI OS Registry (remote or local)
