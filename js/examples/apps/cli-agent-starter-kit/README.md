# CLI Agent Starter Kit

A TypeScript-based CLI agent starter kit integrated with the Vercel AI SDK and Anthropic's Claude, designed for building intelligent command-line applications with Phoenix observability skills.

## Features

- 🤖 **Anthropic Claude Integration** - Built with Vercel AI SDK for seamless LLM interactions
- 📦 **TypeScript** - Full type safety and modern JavaScript features
- 🔧 **Phoenix Skills** - Pre-configured with Phoenix CLI, Tracing, and Evals skills
- 📊 **OpenTelemetry Tracing** - Built-in Phoenix observability via phoenix-otel

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

## Usage

### Development Mode

Run the agent with hot reload (automatically starts Phoenix if not running):

```bash
pnpm dev              # Normal mode - minimal Phoenix startup output
pnpm dev:verbose      # Verbose mode - detailed Phoenix startup diagnostics
```

The `dev` command will:
1. Silently check if Phoenix Docker container is running
2. Start Phoenix automatically if needed (shows 2-line status message)
3. Wait for Phoenix to be healthy
4. Run your CLI agent with tracing enabled

Phoenix startup is minimal by default to keep your CLI output clean. Use `dev:verbose` only when debugging Phoenix container issues.

### Build for Production

Compile TypeScript to JavaScript:

```bash
pnpm build
```

### Run Production Build

Execute the compiled output:

```bash
pnpm start
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
