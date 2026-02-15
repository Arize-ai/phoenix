# CLI Agent Starter Kit

An interactive TypeScript CLI agent powered by AI SDK's `ToolLoopAgent`, Anthropic's Claude, and Phoenix observability. Build intelligent command-line applications with multi-step reasoning and tool calling.

## Features

- 🤖 **ToolLoopAgent** - Multi-step reasoning and tool calling with AI SDK
- 💬 **Interactive Mode** - Real-time conversation with the agent
- 🛠️ **Tool Calling** - Extensible tool system (calculator, date/time, and more)
- 🔄 **Conversation History** - Maintains context across multiple turns
- 📦 **TypeScript** - Full type safety and modern JavaScript features
- 🔧 **Phoenix Skills** - Pre-configured with Phoenix CLI, Tracing, and Evals skills
- 📊 **OpenTelemetry Tracing** - Built-in Phoenix observability via phoenix-otel
- 🎨 **Colored Output** - Easy-to-read color-coded responses

## Prerequisites

- Node.js 22+ (see `.nvmrc`)
- pnpm 10.13.1+
- Docker Desktop (for local Phoenix instance)
- Anthropic API key

## Installation

```bash
# Install dependencies
pnpm install

# Copy environment template and add your API key
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY
```

## Environment Variables

Create a `.env` file in the project root:

```bash
# Required
ANTHROPIC_API_KEY=your_api_key_here

# Optional - Phoenix Tracing
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006  # Default: http://localhost:6006
PHOENIX_API_KEY=your_phoenix_api_key              # Only required for Phoenix Cloud
```

### Phoenix Tracing

The starter kit includes automatic OpenTelemetry tracing via `@arizeai/phoenix-otel`.

**Automatic Local Phoenix Setup**: The `pnpm dev` command automatically ensures a Phoenix Docker container is running. No manual setup required!

**Environment Variable Sharing**: The Phoenix container receives your `ANTHROPIC_API_KEY` from your `.env` file. This enables Phoenix features like:

- **LLM Evaluations**: Run evaluators (relevance, hallucination, toxicity) directly in Phoenix UI
- **Experiments**: Test different prompts and compare outputs
- **Dataset Testing**: Test your traces against evaluation criteria

Only the Anthropic API key is passed to Phoenix for security and simplicity.

Traces are sent to:

- **Local Phoenix** (default): `http://localhost:6006` - Automatically started via Docker
- **Phoenix Cloud**: Set `PHOENIX_COLLECTOR_ENDPOINT=https://app.phoenix.arize.com` and provide your `PHOENIX_API_KEY`

All AI SDK calls are automatically traced when `experimental_telemetry` is enabled.

**Important for CLI Applications**: The instrumentation includes proper shutdown handling to ensure spans are flushed before the process exits. This is critical for batch processing to work correctly.

**Note**: If you update your `ANTHROPIC_API_KEY` in `.env`, reload Phoenix to pick up the change: `pnpm phoenix:reload`

#### Phoenix Management Commands

```bash
pnpm phoenix:start    # Start Phoenix container
pnpm phoenix:stop     # Stop Phoenix container
pnpm phoenix:restart  # Restart Phoenix container (quick, but doesn't reload env vars)
pnpm phoenix:reload   # Reload Phoenix with updated .env variables (recreates container)
pnpm phoenix:logs     # View Phoenix logs (follow mode)
pnpm phoenix:down     # Stop and remove Phoenix container (data persists in volume)
```

**When to use reload vs restart:**

- Use `phoenix:restart` for quick container restarts (keeps same config)
- Use `phoenix:reload` after updating `.env` file (recreates container with new env vars)

The Phoenix UI is available at http://localhost:6006 when the container is running.

## How It Works

The CLI uses AI SDK's **ToolLoopAgent**, which implements a reasoning-and-acting loop:

1. **User Input**: You type a question or request
2. **Tool Selection**: Agent decides which tools (if any) to call based on your input
3. **Tool Execution**: Tools are executed and results are collected
4. **Response Generation**: Agent uses tool results to generate a final response
5. **Repeat**: Process continues until completion or max steps (10) is reached

### Available Tools

- **Calculator**: Perform mathematical calculations (e.g., "What is 42 \* 137?")
- **Date/Time**: Get current date and time (e.g., "What time is it?")

### Adding Custom Tools

Create a new tool using the `tool()` helper:

```typescript
import { tool } from "ai";
import { z } from "zod";

const weatherTool = tool({
  description: "Get weather information for a location",
  inputSchema: z.object({
    location: z.string().describe("City name or location"),
  }),
  execute: async ({ location }: { location: string }) => {
    // Your tool logic here
    return {
      location,
      temperature: 72,
      conditions: "Sunny",
    };
  },
});
```

Add it to the agent in `src/index.ts`:

```typescript
const agent = new ToolLoopAgent({
  model: anthropic("claude-sonnet-4-20250514"),
  instructions: "...",
  tools: {
    calculator: calculatorTool,
    getDateTime: getDateTimeTool,
    weather: weatherTool, // Add your tool here
  },
  stopWhen: stepCountIs(10),
  // IMPORTANT: Enable telemetry for Phoenix tracing
  experimental_telemetry: { isEnabled: true },
});
```

**Important**: The `experimental_telemetry: { isEnabled: true }` option is required for Phoenix to capture traces from ToolLoopAgent. Without it, traces will not appear in Phoenix.

## Usage

### Interactive Mode (Default)

Run the agent in interactive conversation mode:

```bash
pnpm dev              # Normal mode - requires Phoenix to be running
pnpm dev:verbose      # Verbose mode - shows agent steps and detailed diagnostics
pnpm dev:no-phoenix   # Run without Phoenix check (use remote PHOENIX_COLLECTOR_ENDPOINT)
```

**Important**: `pnpm dev` requires a local Phoenix instance. If Docker is not running or Phoenix is not available, the CLI will exit with an error. Use `pnpm dev:no-phoenix` to skip the Phoenix check (useful when using a remote Phoenix instance via `PHOENIX_COLLECTOR_ENDPOINT`).

Once running, you can:

- **Ask questions**: Type your question and press Enter
- **Use commands**:
  - `/exit` or `/quit` - Exit the CLI
  - `/help` - Show help message
  - `/clear` - Clear conversation history

**Example conversation:**

```
You: What is 42 * 137?

Agent: 42 multiplied by 137 equals 5,754

You: What time is it?

Agent: The current time is 2:32:17 PM on February 15, 2026

You: /clear

✓ Conversation history cleared

You: /exit

Goodbye!
```

The `dev` command will:

1. **Check Docker availability** - Exits with error if Docker is not running
2. **Verify Phoenix is running** - Starts Phoenix automatically if needed
3. **Wait for health check** - Ensures Phoenix is healthy before starting CLI
4. **Start the agent** - Launches the interactive CLI with tracing enabled

If Phoenix is not available, you'll see:

```
Error: Docker is not available

Phoenix is required for this CLI agent.

To fix:
  1. Start Docker Desktop
  2. Run: pnpm phoenix:start
```

**Verbose Mode**: Use `pnpm dev:verbose` to see:

- Agent step-by-step execution
- Tool calls in each step
- Token usage per step
- Detailed Phoenix startup diagnostics

**Skip Phoenix Check**: Use `pnpm dev:no-phoenix` to run without requiring local Phoenix (useful when using remote Phoenix via `PHOENIX_COLLECTOR_ENDPOINT`)

### Build for Production

Compile TypeScript to JavaScript:

```bash
pnpm build
```

### Run Production Build

Execute the compiled output:

```bash
pnpm start              # Normal mode
pnpm start:verbose      # Verbose mode with step logging
```

### Clean Build Artifacts

Remove the `dist` directory:

```bash
pnpm clean
```

## Project Structure

```
cli-agent-starter-kit/
├── src/
│   ├── index.ts              # Main entry point
│   └── instrumentation.ts    # Phoenix tracing setup
├── scripts/
│   └── ensure-phoenix.sh     # Phoenix Docker management script
├── dist/                     # Compiled output (generated)
├── .agents/
│   └── skills/               # Agent skills (symlinked)
│       ├── phoenix-cli
│       ├── phoenix-evals
│       └── phoenix-tracing
├── .claude/
│   └── skills/               # Claude Code skills (symlinked)
├── docker-compose.yml        # Phoenix container configuration
├── AGENTS.md                 # Agent configuration
├── CLAUDE.md                 # Symlink to AGENTS.md
├── tsconfig.json             # TypeScript configuration
└── package.json              # Project dependencies
```

## Available Skills

This starter kit includes symlinked Phoenix skills for enhanced functionality:

- **phoenix-cli** - Phoenix CLI management and operations
- **phoenix-tracing** - Phoenix tracing and observability features
- **phoenix-evals** - Phoenix evaluation tooling

Skills are symlinked from the Phoenix monorepo root and available in both `.agents/skills/` and `.claude/skills/` directories.

## Troubleshooting

### No Traces Appearing in Phoenix

If traces are not showing up in Phoenix:

1. **Verify telemetry is enabled** in the ToolLoopAgent constructor:

   ```typescript
   experimental_telemetry: {
     isEnabled: true;
   }
   ```

2. **Check Phoenix is running**:

   ```bash
   pnpm phoenix:logs
   ```

3. **Verify traces using CLI**:

   ```bash
   npx @arizeai/phoenix-cli traces --endpoint http://localhost:6006 --project cli-agent-starter-kit --limit 5
   ```

4. **Check the project name** matches in both `src/instrumentation.ts` and Phoenix CLI commands.

5. **Flush traces on exit**: The instrumentation.ts file handles this automatically, but ensure your program exits cleanly.

### Phoenix Container Issues

**Container won't start:**

```bash
# Check Docker is running
docker info

# View Phoenix logs
pnpm phoenix:logs

# Restart Phoenix
pnpm phoenix:restart

# Complete reset (removes data)
pnpm phoenix:down
docker volume rm cli-agent-phoenix-data
pnpm phoenix:start
```

**Port 6006 already in use:**

```bash
# Find what's using port 6006
lsof -i :6006

# Stop any existing Phoenix processes
pnpm phoenix:stop
```

**Docker permissions:**
If you get permission errors, ensure Docker Desktop is running and you have the necessary permissions.

## Resources

- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Phoenix Documentation](https://arize.com/docs/phoenix)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
