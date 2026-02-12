# CLI Agent Starter Kit

This is a TypeScript CLI agent starter kit with AI SDK and Anthropic integration.

## Available Skills

This project has access to Phoenix skills through symlinks:

- **phoenix-cli** - Phoenix CLI management and operations
- **phoenix-tracing** - Phoenix tracing and observability features
- **phoenix-evals** - Phoenix evaluation tooling

Skills are located in `.agents/skills/` and are symlinked from the root Phoenix repository.

## Development

```bash
pnpm dev    # Run the agent
pnpm build  # Build the TypeScript
pnpm start  # Run the compiled output
```

## Environment Variables

- `ANTHROPIC_API_KEY` - Required for Anthropic API calls
