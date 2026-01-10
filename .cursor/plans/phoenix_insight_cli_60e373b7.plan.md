---
name: Phoenix Insight CLI
overview: Build a TypeScript CLI that ingests Phoenix data into a filesystem and uses an AI agent with bash tools to answer queries. Supports sandbox mode (just-bash, safe) and local mode (real bash, ~/.phoenix-insight) with incremental caching.
todos:
  # Phase 1: Package Setup
  - id: scaffold-package
    content: "Create js/packages/phoenix-insight: package.json with deps, tsconfig, bin entry, README"
    status: pending
  - id: scaffold-structure
    content: "Create src/ directory structure: cli.ts, modes/, snapshot/, commands/, agent/, prompts/"
    status: pending
    dependencies:
      - scaffold-package

  # Phase 2: Execution Modes
  - id: execution-mode-interface
    content: "Define ExecutionMode interface: writeFile, exec, getBashTool, cleanup methods"
    status: pending
    dependencies:
      - scaffold-structure
  - id: sandbox-mode
    content: "Implement SandboxMode using just-bash with InMemoryFs, integrate bash-tool"
    status: pending
    dependencies:
      - execution-mode-interface
  - id: local-mode
    content: "Implement LocalMode with ~/.phoenix-insight/ directory and child_process bash"
    status: pending
    dependencies:
      - execution-mode-interface

  # Phase 3: Data Ingestion
  - id: phoenix-client-integration
    content: "Create snapshot/client.ts: wrapper around @arizeai/phoenix-client with error handling"
    status: pending
    dependencies:
      - scaffold-structure
  - id: snapshot-projects
    content: "Implement snapshot/projects.ts: fetch projects list, write to /projects/index.jsonl"
    status: pending
    dependencies:
      - phoenix-client-integration
  - id: snapshot-spans
    content: "Implement snapshot/spans.ts: fetch spans with time filtering, pagination, limits"
    status: pending
    dependencies:
      - snapshot-projects
  - id: snapshot-datasets
    content: "Implement snapshot/datasets.ts: fetch datasets and examples"
    status: pending
    dependencies:
      - phoenix-client-integration
  - id: snapshot-experiments
    content: "Implement snapshot/experiments.ts: fetch experiments and runs"
    status: pending
    dependencies:
      - phoenix-client-integration
  - id: snapshot-prompts
    content: "Implement snapshot/prompts.ts: fetch prompts and versions as markdown"
    status: pending
    dependencies:
      - phoenix-client-integration
  - id: snapshot-context
    content: "Implement snapshot/context.ts: generate _context.md summary file"
    status: pending
    dependencies:
      - snapshot-projects
      - snapshot-spans
      - snapshot-datasets
      - snapshot-experiments
      - snapshot-prompts
  - id: snapshot-orchestrator
    content: "Implement snapshot/index.ts: orchestrate all fetchers, write _meta/snapshot.json"
    status: pending
    dependencies:
      - snapshot-context

  # Phase 4: Incremental Updates (Local Mode)
  - id: snapshot-incremental
    content: "Add incremental logic: compare timestamps, fetch only new/updated data"
    status: pending
    dependencies:
      - snapshot-orchestrator
      - local-mode

  # Phase 5: Custom Commands
  - id: px-fetch-more-spans
    content: "Implement px-fetch-more spans command: fetch additional spans on-demand"
    status: pending
    dependencies:
      - snapshot-spans
  - id: px-fetch-more-trace
    content: "Implement px-fetch-more trace command: fetch specific trace by ID"
    status: pending
    dependencies:
      - snapshot-spans

  # Phase 6: Agent Setup
  - id: system-prompt
    content: "Create prompts/system.ts: INSIGHT_SYSTEM_PROMPT with _context.md instructions"
    status: pending
    dependencies:
      - scaffold-structure
  - id: agent-setup
    content: "Implement agent/index.ts: ToolLoopAgent with bash tool and custom commands"
    status: pending
    dependencies:
      - sandbox-mode
      - local-mode
      - system-prompt
      - px-fetch-more-spans
      - px-fetch-more-trace

  # Phase 7: CLI Interface
  - id: cli-single-query
    content: "Implement CLI single-query mode: phoenix-insight 'query' with --sandbox/--local"
    status: pending
    dependencies:
      - agent-setup
      - snapshot-orchestrator
  - id: cli-flags
    content: "Add CLI flags: --base-url, --api-key, --refresh, --limit, --stream"
    status: pending
    dependencies:
      - cli-single-query
  - id: cli-interactive
    content: "Implement interactive mode: REPL for multiple queries in one session"
    status: pending
    dependencies:
      - cli-flags

  # Phase 8: Polish
  - id: error-handling
    content: "Add comprehensive error handling: network errors, auth failures, invalid responses"
    status: pending
    dependencies:
      - cli-flags
  - id: progress-indicators
    content: "Add progress indicators for snapshot fetching and agent thinking"
    status: pending
    dependencies:
      - cli-flags
  - id: documentation
    content: "Write README.md with usage examples, configuration, and troubleshooting"
    status: pending
    dependencies:
      - cli-interactive
---

# Phoenix Insight CLI

A filesystem-native AI agent CLI for querying Phoenix instances using the "bash + files" paradigm from [Vercel's agent architecture](https://vercel.com/blog/how-to-build-agents-with-filesystems-and-bash).

## Execution Modes

The CLI supports two execution modes, selectable via flags:

| Mode | Flag | Filesystem | Bash Execution | Safety | Use Case |

|------|------|------------|----------------|--------|----------|

| **Sandbox** (default) | `--sandbox` | In-memory (just-bash) | Simulated (just-bash) | Fully isolated | Safe exploration, CI/CD |

| **Local** | `--local` | `~/.phoenix-insight/` | Real bash (child_process) | Full system access | Power users, custom tools |

### Sandbox Mode (Default)

Uses [`just-bash`](https://github.com/vercel-labs/just-bash) - Vercel's open-source simulated bash with in-memory filesystem:

- **50+ built-in commands**: `ls`, `cat`, `grep`, `find`, `head`, `tail`, `jq`, `awk`, `sed`, `sort`, `uniq`, `wc`
- **Full shell features**: Pipes, redirections, variables, loops, functions
- **Execution protection**: Built-in safeguards against infinite loops/recursion
- **Zero disk/network access**: Completely isolated
- **AI SDK integration**: The companion [`bash-tool`](https://github.com/vercel-labs/bash-tool) package provides a ready-to-use tool

### Local Mode

Uses real bash and persists data to `~/.phoenix-insight/`:

```
~/.phoenix-insight/
  /snapshots/
    /{timestamp}/              # Each snapshot is timestamped
      /phoenix/                # Same structure as sandbox mode
        /projects/
        /datasets/
        ...
  /cache/                      # Cached API responses
  /config.json                 # User preferences
```

Benefits:

- **Full bash power**: Real `awk`, `sed`, `jq` with all features and plugins
- **Persistent data**: Snapshots survive between runs
- **Custom tools**: Use any installed CLI tools (ripgrep, fd, etc.)
- **Larger datasets**: Not limited by memory

Tradeoffs:

- **Less safe**: Agent can execute any bash command
- **Requires bash**: Must have bash installed

## Architecture Overview

```mermaid
flowchart TB
    subgraph CLI [CLI Layer]
        Flags["--sandbox | --local"]
        Interactive[Interactive Mode]
        SingleCmd[Single Command Mode]
    end
    
    subgraph DataIngestion [Data Ingestion]
        PhoenixClient[@arizeai/phoenix-client]
        Snapshot[Snapshot Builder]
    end
    
    subgraph SandboxMode [Sandbox Mode: just-bash]
        VFS[In-Memory Virtual FS]
        SimBash[Simulated Bash]
    end
    
    subgraph LocalMode [Local Mode: Real Bash]
        DiskFS["~/.phoenix-insight/"]
        RealBash[child_process bash]
    end
    
    subgraph Agent [ToolLoopAgent]
        AgentClass[ToolLoopAgent Class]
        BashTool[bash tool]
    end
    
    CLI --> DataIngestion
    Flags -->|sandbox| SandboxMode
    Flags -->|local| LocalMode
    PhoenixClient --> Snapshot
    Snapshot -->|"sandbox"| VFS
    Snapshot -->|"local"| DiskFS
    BashTool -->|"sandbox"| SimBash
    BashTool -->|"local"| RealBash
    AgentClass --> BashTool
    DataIngestion --> Agent
```

## Filesystem Structure

Phoenix data maps naturally to a REST-like hierarchy:

```
/phoenix/
  _context.md                       # Human/agent-readable summary (read this first!)
  /projects/
    index.jsonl                     # List of all projects
    /{project_name}/
      metadata.json                 # Project details
      /spans/
        index.jsonl                 # Paginated span list (sampled)
        /{span_id}.json             # Individual span details
      /annotations/
        index.jsonl
  /datasets/
    index.jsonl
    /{dataset_name}/
      metadata.json
      examples.jsonl
  /experiments/
    index.jsonl
    /{experiment_id}/
      metadata.json
      runs.jsonl
  /prompts/
    index.jsonl
    /{prompt_name}/
      metadata.json
      /versions/
        index.jsonl
        /{version_id}.md            # Template as markdown
  /_meta/
    snapshot.json                   # Snapshot metadata (timestamps, cursors)
```

### The `_context.md` Pattern

Following agent-native architecture principles, we generate a human/agent-readable context file at the root. The agent reads this first for immediate situational awareness:

```markdown
# Phoenix Snapshot Context

## What's Here
- **3 projects**: chatbot-prod (2,341 spans), rag-experiment (892 spans), eval-pipeline (412 spans)
- **5 datasets**: customer-queries, test-cases, golden-answers, edge-cases, production-sample
- **2 experiments**: prompt-comparison-v2 (completed), latency-optimization (in progress)
- **Snapshot**: 15 minutes ago from http://localhost:6006

## Recent Activity
- chatbot-prod: 847 spans in last hour, 3 errors detected
- eval-pipeline: experiment "prompt-comparison-v2" completed 2h ago

## What You Can Do
- **Explore**: ls, cat, grep, find, jq, awk, sed
- **Fetch more data**: `px-fetch-more spans --project <name> --limit 500`
- **Fetch specific trace**: `px-fetch-more trace --trace-id <id>`

## Data Freshness
This is a **read-only snapshot**. Data may have changed since capture.
Run with `--refresh` to get latest data.

## File Formats
- `.jsonl` files: One JSON object per line, use `jq -s` to parse as array
- `.json` files: Standard JSON
- `.md` files: Markdown (prompt templates)
```

## Caching & Time Range Strategy

### Snapshot Behavior

| Scenario | Behavior |

|----------|----------|

| **First run** | Fetch recent data with default limit (configurable) |

| **Subsequent runs (local mode)** | Incremental update - fetch only data newer than last snapshot |

| **`--refresh` flag** | Force fresh fetch, ignore cache |

| **Stale data** | Show warning: "Using snapshot from 2h ago, run with --refresh for latest" |

### Time Filtering by Entity

| Entity | Server-side filtering | Incremental strategy |

|--------|----------------------|---------------------|

| **Spans** | `start_time`, `end_time` params | Fetch spans newer than last `end_time` |

| **Datasets** | None | Compare `updated_at`, fetch if changed |

| **Experiments** | None | Compare `updated_at`, fetch if changed |

| **Annotations** | None | Compare `updated_at`, fetch if changed |

| **Prompts** | None | Refetch all (typically small) |

### Snapshot Metadata

Stored in `/_meta/snapshot.json`:

```json
{
  "created_at": "2025-01-09T10:30:00Z",
  "phoenix_url": "http://localhost:6006",
  "cursors": {
    "spans": {
      "project-1": { "last_end_time": "2025-01-09T10:29:00Z", "cursor": "abc123" }
    },
    "datasets": { "last_fetch": "2025-01-09T10:30:00Z" },
    "experiments": { "last_fetch": "2025-01-09T10:30:00Z" }
  },
  "limits": {
    "spans_per_project": 1000
  }
}
```

### On-Demand Pagination (px-fetch-more)

For large datasets, the agent can request more data via a custom command:

```bash
# Agent discovers it needs more spans
$ px-fetch-more spans --project my-project --limit 500

# Agent needs a specific trace
$ px-fetch-more trace --trace-id abc123
```

This keeps initial snapshots fast while allowing deep-dives when needed.

## Key Files

| File | Purpose |

|------|---------|

| [`js/packages/phoenix-insight/package.json`](js/packages/phoenix-insight/package.json) | Dependencies: `just-bash`, `bash-tool`, `@arizeai/phoenix-client`, `ai`, `@ai-sdk/anthropic`, `commander` |

| [`js/packages/phoenix-insight/src/cli.ts`](js/packages/phoenix-insight/src/cli.ts) | Entry point with Commander.js, --sandbox/--local/--refresh flags |

| [`js/packages/phoenix-insight/src/modes/`](js/packages/phoenix-insight/src/modes/) | Execution mode abstraction (sandbox vs local) |

| [`js/packages/phoenix-insight/src/snapshot/`](js/packages/phoenix-insight/src/snapshot/) | Data ingestion with incremental updates and caching |

| [`js/packages/phoenix-insight/src/commands/`](js/packages/phoenix-insight/src/commands/) | Custom commands: `px-fetch-more` for on-demand pagination |

| [`js/packages/phoenix-insight/src/agent/`](js/packages/phoenix-insight/src/agent/) | ToolLoopAgent setup with bash + custom tools |

| [`js/packages/phoenix-insight/src/prompts/`](js/packages/phoenix-insight/src/prompts/) | System prompts describing the filesystem structure |

## Core Components

### 1. Execution Mode Abstraction

A common interface for both sandbox and local modes:

```typescript
// src/modes/types.ts
interface ExecutionMode {
  /** Write Phoenix data to the filesystem */
  writeFile(path: string, content: string): Promise<void>;
  
  /** Execute a bash command and return output */
  exec(command: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  
  /** Get the bash tool for the AI SDK agent */
  getBashTool(): Tool;
  
  /** Clean up resources */
  cleanup(): Promise<void>;
}

// src/modes/sandbox.ts - uses just-bash
class SandboxMode implements ExecutionMode {
  private bash: Bash;
  
  constructor() {
    this.bash = new Bash({ cwd: '/phoenix' });
  }
  
  async writeFile(path: string, content: string) {
    await this.bash.exec(`mkdir -p $(dirname ${path})`);
    // Write via bash echo or use bash.fs directly
  }
  
  exec(command: string) {
    return this.bash.exec(command);
  }
  
  getBashTool() {
    return createBashTool({ bash: this.bash });
  }
  
  async cleanup() {
    // No-op for in-memory
  }
}

// src/modes/local.ts - uses real bash + ~/.phoenix-insight/
class LocalMode implements ExecutionMode {
  private workDir: string;
  
  constructor() {
    this.workDir = path.join(os.homedir(), '.phoenix-insight', 'snapshots', Date.now().toString());
    fs.mkdirSync(this.workDir, { recursive: true });
  }
  
  async writeFile(filePath: string, content: string) {
    const fullPath = path.join(this.workDir, filePath);
    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, content);
  }
  
  async exec(command: string) {
    return new Promise((resolve) => {
      exec(command, { cwd: this.workDir }, (error, stdout, stderr) => {
        resolve({ stdout, stderr, exitCode: error?.code ?? 0 });
      });
    });
  }
  
  getBashTool() {
    // Return a tool that executes real bash
    return tool({
      description: 'Execute bash commands',
      parameters: z.object({ command: z.string() }),
      execute: async ({ command }) => this.exec(command),
    });
  }
  
  async cleanup() {
    // Optionally clean up old snapshots
  }
}
```

### 2. Snapshot Builder

Fetches data via `@arizeai/phoenix-client` and writes to the execution mode's filesystem:

```typescript
import { createClient } from "@arizeai/phoenix-client";
import { ExecutionMode } from "./modes/types";

async function buildSnapshot(client: PhoenixClient, mode: ExecutionMode): Promise<void> {
  // Fetch and write projects
  const projects = await client.projects.list();
  await mode.writeFile('/phoenix/projects/index.jsonl', toJSONL(projects));
  
  for (const project of projects) {
    await mode.writeFile(
      `/phoenix/projects/${project.name}/metadata.json`, 
      JSON.stringify(project, null, 2)
    );
    
    const spans = await client.spans.getSpans({ projectName: project.name, limit: 100 });
    await mode.writeFile(
      `/phoenix/projects/${project.name}/spans/index.jsonl`, 
      toJSONL(spans)
    );
  }
  
  // Similar for datasets, experiments, prompts, annotations...
}

function toJSONL(items: unknown[]): string {
  return items.map(item => JSON.stringify(item)).join('\n');
}
```

### 4. Agent (Vercel AI SDK ToolLoopAgent)

We use the new `ToolLoopAgent` class from AI SDK - a higher-level abstraction that handles the tool loop, context management, and stopping conditions automatically:

```typescript
import { ToolLoopAgent, stepCountIs } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { ExecutionMode } from './modes/types';

// Create the agent with the execution mode's bash tool
function createInsightAgent(mode: ExecutionMode) {
  return new ToolLoopAgent({
    model: anthropic('claude-sonnet-4-20250514'),
    system: INSIGHT_SYSTEM_PROMPT,
    tools: { bash: mode.getBashTool() },
    stopWhen: stepCountIs(25),
  });
}

// Use the agent for queries
async function runQuery(agent: ToolLoopAgent, userQuery: string) {
  const result = await agent.generate({ prompt: userQuery });
  
  console.log(result.text);   // Agent's final answer
  console.log(result.steps);  // Steps taken (useful for debugging/logging)
  
  return result;
}
```

The agent works identically in both modes - the `ExecutionMode` abstraction provides the appropriate bash tool:

- **Sandbox mode**: `bash-tool` with just-bash (simulated, isolated)
- **Local mode**: Custom tool wrapping `child_process.exec` (real bash)

Benefits of `ToolLoopAgent`:

- **Reduces boilerplate** - No manual loop management
- **Reusable** - Define agent once, use for multiple queries
- **Built-in loop control** - `stopWhen` for custom stopping conditions
- **Step visibility** - Access `result.steps` for observability

### 5. System Prompt

The system prompt teaches the agent about the filesystem layout:

```typescript
const INSIGHT_SYSTEM_PROMPT = `You are an expert at analyzing Phoenix observability data.

**START by reading /phoenix/_context.md** - it contains a summary of what's available.

You have access to a bash shell with Phoenix data organized as files:

/phoenix/
  _context.md                    - READ THIS FIRST: summary of available data
  /projects/{name}/spans/        - Span data (JSONL format, may be sampled)
  /datasets/                     - Datasets and examples
  /experiments/                  - Experiment runs and results
  /prompts/                      - Prompt templates and versions

Use commands like:
- cat, head, tail: Read file contents  
- grep: Search for patterns
- jq: Query and transform JSON/JSONL
- ls, find: Navigate and discover data
- sort, uniq, wc: Aggregate and count
- awk: Complex text processing

If you need MORE data than what's in the snapshot:
- px-fetch-more spans --project <name> --limit 500
- px-fetch-more trace --trace-id <id>

This is a READ-ONLY snapshot. Start with _context.md, then explore to answer the question.`;
```

### 6. CLI Interface

```bash
# Interactive mode (sandbox by default)
$ phoenix-insight

# Single query mode
$ phoenix-insight "Which spans have the highest latency?"

# Explicit sandbox mode (default, fully isolated)
$ phoenix-insight --sandbox "summarize my experiments"

# Local mode (real bash, persistent ~/.phoenix-insight/)
$ phoenix-insight --local "find error patterns in my traces"

# Force fresh data (ignore cache)
$ phoenix-insight --local --refresh "analyze recent errors"

# Custom span limit per project (default: 1000)
$ phoenix-insight --limit 5000 "deep analysis of all spans"

# With explicit Phoenix connection
$ phoenix-insight --base-url http://localhost:6006 --api-key xxx "query"

# Stream output as agent works
$ phoenix-insight --stream "complex analysis query"

# Local mode with custom tools (ripgrep, fd, etc.)
$ phoenix-insight --local "use rg to find all error spans"
```

## Available Bash Commands

### Sandbox Mode (via just-bash)

**File Operations**: `cat`, `cp`, `ln`, `ls`, `mkdir`, `mv`, `rm`, `stat`, `touch`, `tree`

**Text Processing**: `awk`, `cut`, `grep`, `head`, `jq`, `sed`, `sort`, `tail`, `tr`, `uniq`, `wc`, `xargs`

**Navigation**: `cd`, `find`, `pwd`, `basename`, `dirname`

**Utilities**: `echo`, `env`, `date`, `seq`, `true`, `false`

### Local Mode (real bash)

All commands available on the user's system, including:

- Custom tools: `ripgrep` (`rg`), `fd`, `bat`, etc.
- Full `jq`, `awk`, `sed` with all features
- Any installed CLI tools

## Implementation Strategy

1. **MVP**: Scaffold package, execution modes, snapshot builder for projects + spans, agent loop
2. **Complete data**: Add datasets, experiments, prompts, annotations
3. **Polish**: Interactive TUI mode, streaming output, progress indicators
4. **Advanced**: Custom commands for Phoenix-specific operations (e.g., `px-trace` to fetch a trace on-demand)

## Design Decisions

- **Read-only**: The agent analyzes data but cannot modify Phoenix (no annotations, no deletions). This is intentional for safety. Write operations can be added later with confirmation prompts.
- **Agent-native**: Follows agent-native architecture principles - atomic tools, dynamic discovery, context injection via `_context.md`.

## Extensibility Points

- **Write operations**: Add `px-annotate`, `px-tag` commands with user confirmation
- **Execution modes**: Add new modes (e.g., Docker container, remote SSH)
- **Custom just-bash commands**: Use `defineCommand` to add Phoenix-specific tools in sandbox mode
- **Network access**: Enable curl in sandbox mode to fetch additional data on-demand (with URL allowlist)
- **Snapshot caching**: In local mode, cache and reuse snapshots between runs