# CLI Agent Starter Kit

An interactive TypeScript CLI agent powered by AI SDK's `ToolLoopAgent`, Anthropic's Claude, and Phoenix observability.

## Features

- 🤖 **ToolLoopAgent** - Multi-step reasoning with automatic tool calling
- 💬 **Interactive Mode** - Conversational CLI interface
- 🛠️ **Extensible Tools** - Calculator, date/time, and custom tool support
- 📊 **Phoenix Tracing** - Built-in observability with OpenTelemetry
- 🔧 **Phoenix Skills** - Pre-configured CLI, tracing, and evals skills

## Prerequisites

- **Node.js 22+** (see `.nvmrc`)
- **pnpm 10.13.1+**
- **Docker Desktop** (for local Phoenix)
- **Anthropic API key**

### Recommended: Install Phoenix CLI Globally

For easier debugging and trace inspection:

```bash
pnpm add -g @arizeai/phoenix-cli

# Then use it anywhere:
phoenix-cli traces --endpoint http://localhost:6006 --project cli-agent-starter-kit --limit 5
```

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Set up environment
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# 3. Run the agent (automatically starts Phoenix)
pnpm dev
```

The CLI will start in interactive mode. Type questions and the agent will respond using available tools.

### Available Commands

- `/help` - Show help
- `/clear` - Clear conversation history
- `/exit` or `/quit` - Exit

### Phoenix Management

```bash
pnpm phoenix:start    # Start Phoenix container
pnpm phoenix:stop     # Stop Phoenix container
pnpm phoenix:logs     # View Phoenix logs
pnpm phoenix:reload   # Reload after .env changes
```

Access Phoenix UI at: http://localhost:6006

## Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=your_api_key_here

# Optional - Phoenix Configuration
PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006  # Default
PHOENIX_API_KEY=your_phoenix_api_key              # Phoenix Cloud only
```

## Adding Custom Tools

Create tools using the AI SDK's `tool()` helper:

```typescript
import { tool } from "ai";
import { z } from "zod";

const weatherTool = tool({
  description: "Get weather information",
  inputSchema: z.object({
    location: z.string().describe("City name"),
  }),
  execute: async ({ location }) => {
    // Your logic here
    return { temperature: 72, conditions: "Sunny" };
  },
});
```

Add to the agent in `src/index.ts`:

```typescript
const agent = new ToolLoopAgent({
  model: anthropic("claude-sonnet-4-20250514"),
  tools: {
    calculator: calculatorTool,
    weather: weatherTool, // Your new tool
  },
  // Required for Phoenix tracing
  experimental_telemetry: { isEnabled: true },
});
```

## Production Build

```bash
pnpm build       # Compile TypeScript
pnpm start       # Run compiled output
```

## Troubleshooting

**No traces in Phoenix?**

1. Verify `experimental_telemetry: { isEnabled: true }` in agent config
2. Check Phoenix is running: `pnpm phoenix:logs`
3. Verify traces: `npx @arizeai/phoenix-cli traces --endpoint http://localhost:6006 --project cli-agent-starter-kit`

**Phoenix won't start?**

- Ensure Docker Desktop is running
- Check port 6006 is available: `lsof -i :6006`
- View logs: `pnpm phoenix:logs`

## Resources

- [Vercel AI SDK Documentation](https://sdk.vercel.ai/docs)
- [Phoenix Documentation](https://arize.com/docs/phoenix)
- [Phoenix CLI on npm](https://www.npmjs.com/package/@arizeai/phoenix-cli)
