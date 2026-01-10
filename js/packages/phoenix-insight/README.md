# Phoenix Insight CLI

A filesystem-native AI agent CLI for querying Phoenix instances using the "bash + files" paradigm inspired by [Vercel's agent architecture](https://vercel.com/blog/how-to-build-agents-with-filesystems-and-bash).

Phoenix Insight transforms your Phoenix observability data into a structured filesystem, then uses an AI agent with bash tools to analyze it through natural language queries. This approach provides transparency, flexibility, and power that traditional APIs can't match.

## Installation

```bash
# Install globally via npm
npm install -g @arizeai/phoenix-insight

# Or use with pnpm
pnpm add -g @arizeai/phoenix-insight

# Or run directly with npx
npx @arizeai/phoenix-insight "your query"
```

## Quick Start

```bash
# Query Phoenix data with natural language
phoenix-insight "What are the most common errors in the last hour?"

# Interactive mode for multiple queries
phoenix-insight --interactive

# Local mode with persistent storage
phoenix-insight --local "analyze trace patterns"

# Force fresh data
phoenix-insight --refresh "show me the slowest endpoints"
```

## How It Works

Phoenix Insight operates in three phases:

1. **Data Ingestion**: Fetches data from your Phoenix instance and creates a structured filesystem snapshot
2. **AI Analysis**: An AI agent explores the data using bash commands (cat, grep, jq, awk, etc.)
3. **Natural Language Results**: The agent synthesizes findings into clear, actionable insights

### Filesystem Structure

Phoenix data is organized into an intuitive REST-like hierarchy:

```
/phoenix/
  _context.md                       # Start here! Human-readable summary
  /projects/
    index.jsonl                     # All projects
    /{project_name}/
      metadata.json                 # Project details
      /spans/
        index.jsonl                 # Trace spans (sampled)
  /datasets/
    index.jsonl                     # All datasets
    /{dataset_name}/
      metadata.json
      examples.jsonl
  /experiments/
    index.jsonl                     # All experiments
    /{experiment_id}/
      metadata.json
      runs.jsonl
  /prompts/
    index.jsonl                     # All prompts
    /{prompt_name}/
      metadata.json
      /versions/
        /{version}.md               # Prompt templates as markdown
  /traces/                          # Fetched on-demand
    /{trace_id}/
      spans.jsonl
      metadata.json
  /_meta/
    snapshot.json                   # Snapshot metadata
```

## Execution Modes

Phoenix Insight supports two execution modes:

### Sandbox Mode (default)

Uses [just-bash](https://github.com/vercel-labs/just-bash) for complete isolation:

- **In-memory filesystem**: No disk writes
- **Simulated bash**: 50+ built-in commands
- **Zero risk**: Cannot access your system
- **Perfect for**: CI/CD, demos, safe exploration

### Local Mode (--local)

Uses real bash and persistent storage:

- **Persistent data**: Snapshots saved to `~/.phoenix-insight/`
- **Full bash power**: All system commands available
- **Incremental updates**: Only fetches new data
- **Perfect for**: Power users, complex analysis, custom tools

## Usage Examples

### Basic Queries

```bash
# Analyze errors
phoenix-insight "What types of errors are occurring most frequently?"

# Performance analysis
phoenix-insight "Find the slowest traces and identify patterns"

# Experiment comparison
phoenix-insight "Compare success rates across recent experiments"

# Dataset exploration
phoenix-insight "Show me statistics about my datasets"
```

### Advanced Options

```bash
# Connect to remote Phoenix instance
phoenix-insight "analyze traces" \
  --base-url https://phoenix.example.com \
  --api-key your-api-key

# Increase span fetch limit (default: 1000 per project)
phoenix-insight "deep trace analysis" --limit 5000

# Stream responses in real-time
phoenix-insight "complex analysis task" --stream

# Use local mode for persistent storage
phoenix-insight "experimental query" --local

# Enable observability tracing (sends traces to Phoenix)
phoenix-insight "analyze performance" --trace
```

### Interactive Mode

Start an interactive REPL session for multiple queries:

```bash
$ phoenix-insight --interactive

phoenix> What projects have the most spans?
[Agent analyzes and responds...]

phoenix> Show me error patterns in the chatbot-prod project
[Agent investigates specific project...]

phoenix> px-fetch-more trace --trace-id abc123
[Agent fetches specific trace data...]

phoenix> exit
```

### Snapshot Management

Create or update snapshots separately from queries:

```bash
# Create initial snapshot
phoenix-insight snapshot

# Force refresh (ignore cache)
phoenix-insight snapshot --refresh

# Snapshot from specific Phoenix instance
phoenix-insight snapshot \
  --base-url https://phoenix.example.com \
  --api-key your-api-key

# Enable observability tracing for snapshot process
phoenix-insight snapshot --trace

# Clean up local snapshots
phoenix-insight prune

# Preview what would be deleted
phoenix-insight prune --dry-run
```

### On-Demand Data Fetching

The agent can fetch additional data during analysis:

```bash
# In your query, the agent might discover it needs more data:
"I need more spans to complete this analysis. Let me fetch them..."
px-fetch-more spans --project my-project --limit 500

# Or fetch a specific trace:
"I'll get the full trace to understand the error..."
px-fetch-more trace --trace-id abc123
```

## Configuration

### Environment Variables

| Variable               | Description                | Default                 |
| ---------------------- | -------------------------- | ----------------------- |
| `PHOENIX_BASE_URL`     | Phoenix server URL         | `http://localhost:6006` |
| `PHOENIX_API_KEY`      | API key for authentication | (none)                  |
| `PHOENIX_INSIGHT_MODE` | Default execution mode     | `sandbox`               |
| `DEBUG`                | Show detailed error info   | `0`                     |

### Commands

Phoenix Insight provides several commands:

- **Default (query mode)**: `phoenix-insight "your query"` - Analyze Phoenix data with natural language
- **`snapshot`**: Create or update a data snapshot from Phoenix
- **`prune`**: Delete local snapshot directory to free up space

### Command Line Options

| Option                | Description                        | Default          | Applies to     |
| --------------------- | ---------------------------------- | ---------------- | -------------- |
| `--sandbox`           | Run in sandbox mode (default)      | true             | query          |
| `--local`             | Run in local mode                  | false            | query          |
| `--base-url <url>`    | Phoenix server URL                 | env or localhost | all            |
| `--api-key <key>`     | Phoenix API key                    | env or none      | all            |
| `--refresh`           | Force fresh snapshot               | false            | query/snapshot |
| `--limit <n>`         | Max spans per project              | 1000             | query          |
| `--stream`            | Stream agent responses             | false            | query          |
| `--interactive`, `-i` | Interactive REPL mode              | false            | query          |
| `--trace`             | Enable tracing to Phoenix instance | false            | query/snapshot |
| `--dry-run`           | Preview without making changes     | false            | prune          |

### Local Mode Storage

In local mode, data is stored in:

```
~/.phoenix-insight/
  /snapshots/
    /{timestamp}/              # Each snapshot
      /phoenix/                # Phoenix data
  /cache/                      # API response cache
  /config.json                 # User preferences
```

To clean up local storage:

```bash
# Delete all local snapshots
phoenix-insight prune

# Preview what will be deleted
phoenix-insight prune --dry-run
```

## Troubleshooting

### Connection Issues

```bash
# Test connection to Phoenix
phoenix-insight snapshot

# If that fails, check your Phoenix instance:
curl http://localhost:6006/v1/projects

# Verify with explicit connection:
phoenix-insight snapshot --base-url http://your-phoenix:6006
```

### Authentication Errors

```bash
# Set API key via environment
export PHOENIX_API_KEY="your-key"
phoenix-insight "your query"

# Or pass directly
phoenix-insight "your query" --api-key "your-key"
```

### Debug Mode

For detailed error information:

```bash
# Enable debug output
DEBUG=1 phoenix-insight "problematic query"

# This shows:
# - Full stack traces
# - API request details
# - Agent tool calls
# - Raw responses
```

### Common Issues

**"No snapshot found" in local mode**

```bash
# Create initial snapshot
phoenix-insight snapshot

# Or use --refresh to create on-demand
phoenix-insight "query" --refresh
```

**Out of memory in sandbox mode**

```bash
# Reduce span limit
phoenix-insight "query" --sandbox --limit 500

# Or use local mode for large datasets
phoenix-insight "query" --local
```

**Local storage getting too large**

```bash
# Check what will be deleted
phoenix-insight prune --dry-run

# Clean up all local snapshots
phoenix-insight prune
```

**Agent can't find expected data**

```bash
# Force refresh to get latest
phoenix-insight "query" --refresh

# Fetch more data on-demand (agent will do this automatically)
px-fetch-more spans --project my-project --limit 2000
```

## Observability

Phoenix Insight can trace its own execution back to Phoenix for monitoring and debugging:

```bash
# Enable tracing for queries
phoenix-insight "analyze errors" --trace

# Enable tracing in interactive mode
phoenix-insight --interactive --trace

# Enable tracing for snapshot creation
phoenix-insight snapshot --trace
```

When `--trace` is enabled:

- All agent operations are traced as spans
- Tool calls and responses are captured
- Performance metrics are recorded
- Traces are sent to the same Phoenix instance being queried (or the one specified by --base-url)

This is particularly useful for:

- Debugging slow queries
- Understanding agent decision-making
- Monitoring Phoenix Insight usage
- Optimizing performance

## Agent Capabilities

The AI agent has access to:

### Bash Commands (Sandbox Mode)

- **File operations**: `cat`, `ls`, `find`, `head`, `tail`
- **Search & filter**: `grep`, `awk`, `sed`
- **JSON processing**: `jq` (full featured)
- **Analysis**: `sort`, `uniq`, `wc`
- **And more**: 50+ commands via just-bash

### Bash Commands (Local Mode)

- All commands available on your system
- Custom tools: `ripgrep`, `fd`, `bat`, etc.
- Full `jq`, `awk`, `sed` features
- Any installed CLI tools

### Custom Commands

- `px-fetch-more spans`: Fetch additional spans
- `px-fetch-more trace`: Fetch specific trace by ID

### Understanding Context

The agent always starts by reading `/_context.md` which provides:

- Summary of available data
- Recent activity highlights
- Data freshness information
- Available commands reminder

## Development

### Building from Source

```bash
# Clone the repository
git clone https://github.com/Arize-ai/phoenix.git
cd phoenix/js/packages/phoenix-insight

# Install dependencies
pnpm install

# Run in development
pnpm dev "your query"

# Run tests
pnpm test

# Build for production
pnpm build

# Type checking
pnpm typecheck
```

### Architecture

Phoenix Insight uses:

- **Commander.js** for CLI interface
- **AI SDK** with Anthropic Claude for the agent
- **just-bash** for sandbox execution
- **Phoenix Client** for data fetching
- **TypeScript** for type safety

### Testing

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test -- --coverage

# Run specific test file
pnpm test src/modes/sandbox.test.ts

# Type checking
pnpm typecheck
```

## Examples of Agent Analysis

### Error Pattern Detection

```
User: "What are the most common errors in my traces?"

Agent: I'll analyze the error patterns in your traces. Let me start by examining the context...

*reads _context.md*
*searches for error spans across projects*
*aggregates by error type*
*identifies patterns*

I found 3 main error patterns in your traces:
1. **Database timeouts** (42% of errors): Occurring in user-service, primarily during peak hours
2. **API rate limits** (31% of errors): Third-party integration hitting limits
3. **Null pointer exceptions** (27% of errors): In the recommendation engine

The database timeouts show a clear pattern during 9-10am and 2-3pm daily.
```

### Performance Analysis

```
User: "Find the slowest API endpoints"

Agent: I'll analyze your API endpoint performance. Let me examine the span data...

*reads project spans*
*calculates latency percentiles*
*groups by endpoint*
*identifies outliers*

Here are your slowest API endpoints by p95 latency:
1. `/api/v1/recommendations` - 3.2s p95 (8.1s p99)
2. `/api/v1/search` - 2.8s p95 (5.2s p99)
3. `/api/v1/user/history` - 1.9s p95 (3.1s p99)

The recommendations endpoint has high variability, suggesting cache misses.
```

## Tips and Best Practices

### Query Formulation

- Be specific about what you want to analyze
- Mention time ranges if relevant
- Ask for patterns, not just raw data

### Performance

- Use `--limit` to control data volume
- In sandbox mode, start with smaller datasets
- Use local mode for production analysis

### Security

- Use sandbox mode when trying new queries
- Never put API keys in queries
- Review agent actions with `--stream`

## License

Apache-2.0 - See [LICENSE](../../../LICENSE) for details.

## Contributing

Contributions are welcome! Please see our [Contributing Guide](../../../CONTRIBUTING.md) for details.

## Support

- [GitHub Issues](https://github.com/Arize-ai/phoenix/issues)
- [Phoenix Documentation](https://docs.arize.com/phoenix)
- [Discord Community](https://discord.gg/arize-ai)
