# CLI Agent Starter Kit

A TypeScript CLI agent with AI SDK, Anthropic Claude, and Phoenix observability. Demonstrates a Phoenix documentation assistant with declarative tool architecture.

## Quick Start

```bash
# Install and setup
pnpm install
cp .env.example .env
# Add your ANTHROPIC_API_KEY to .env

# Run (auto-starts Phoenix)
pnpm dev
```

**Requirements:** Node.js 22+, pnpm, Docker Desktop, Anthropic API key

**Commands:** `/help`, `/clear`, `/exit`

**Phoenix UI:** http://localhost:6006

## Project Structure

```
src/
├── cli.ts              # Entry point
├── agent/              # Agent factory
├── tools/              # Tool definitions
│   ├── index.ts        # Tool exports
│   ├── datetime.ts     # Utility tool
│   └── mcp.ts          # Phoenix docs MCP
├── prompts/            # System instructions
└── ui/                 # CLI interface
```

## Adding Tools

**1. Create tool file** (`src/tools/mytool.ts`):

```typescript
import { tool } from "ai";
import { z } from "zod";

export const myTool = tool({
  description: "What the tool does",
  inputSchema: z.object({
    /* params */
  }),
  execute: async (params) => {
    /* logic */
  },
});
```

**2. Export** (`src/tools/index.ts`):

```typescript
export { myTool } from "./mytool.js";
```

**3. Register** (`src/cli.ts`):

```typescript
const tools = { my: myTool };
```

## Naming Convention

| Type      | Pattern         | Example        |
| --------- | --------------- | -------------- |
| Export    | `camelCaseTool` | `dateTimeTool` |
| File      | `camelcase.ts`  | `datetime.ts`  |
| Agent key | `camelCase`     | `dateTime`     |

## Tool Types

- **Utility**: Simple helpers (datetime.ts)
- **MCP**: External integrations via Model Context Protocol (mcp.ts)

## Scripts

```bash
pnpm dev              # Run in development
pnpm build            # Compile TypeScript
pnpm start            # Run production build
pnpm phoenix:logs     # View Phoenix logs
pnpm eval             # Run all evaluations
```

## Evaluations

Built-in evaluation harness for testing agent quality. Create evaluators, datasets, and experiments in `evals/`:

```bash
pnpm eval                      # Run all evaluations
pnpm eval:terminal-format      # Run specific eval
```

See `evals/README.md` for creating custom evaluators and experiments.

## Troubleshooting

**No traces?** Check Phoenix: `pnpm phoenix:logs`

**Phoenix won't start?** Ensure Docker is running, port 6006 is available

## Resources

- [AI SDK Docs](https://sdk.vercel.ai/docs)
- [Phoenix Docs](https://arize.com/docs/phoenix)
