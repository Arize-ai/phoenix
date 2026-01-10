# Phoenix Insight CLI

A command-line interface for Phoenix data analysis with AI agents. This tool allows you to query and analyze Phoenix observability data using natural language through an AI-powered agent.

## Installation

```bash
npm install -g @arizeai/phoenix-insight
```

## Quick Start

```bash
# Query Phoenix data with natural language
phoenix-insight "What are the most common errors in the last hour?"

# Force refresh snapshot before querying
phoenix-insight "Show me slow traces" --refresh

# Run in sandbox mode (no filesystem writes)
phoenix-insight "Analyze trace patterns" --sandbox
```

## Configuration

Phoenix Insight can be configured through environment variables or command-line options:

- `PHOENIX_BASE_URL` - Phoenix server URL (default: http://localhost:6006)
- `PHOENIX_API_KEY` - API key for Phoenix authentication

## Features

- **Natural Language Queries**: Ask questions about your Phoenix data in plain English
- **Snapshot Management**: Efficient local caching of Phoenix data for fast queries
- **Execution Modes**:
  - **Sandbox Mode**: Safe exploration with in-memory filesystem
  - **Local Mode**: Persistent analysis with real filesystem access
- **Incremental Updates**: Smart caching that only fetches new data
- **Custom Commands**: Extensible with Phoenix-specific commands like `px-fetch-more`

## Usage

### Basic Query

```bash
phoenix-insight "What are the top 5 slowest API endpoints?"
```

### With Options

```bash
phoenix-insight "Find traces with errors" \
  --base-url https://phoenix.example.com \
  --api-key your-api-key \
  --limit 1000 \
  --stream
```

### Snapshot Management

```bash
# Create or update a snapshot
phoenix-insight snapshot --refresh

# Query with forced refresh
phoenix-insight "Analyze performance trends" --refresh
```

### Interactive Mode

```bash
# Start interactive REPL
phoenix-insight

# In REPL, type queries:
> What experiments are running?
> Show me the latest prompt versions
> exit
```

## Development

This package is part of the Phoenix monorepo. To contribute:

```bash
# Clone the repo
git clone https://github.com/Arize-ai/phoenix.git
cd phoenix/js/packages/phoenix-insight

# Install dependencies
pnpm install

# Run in development mode
pnpm dev "your query here"

# Run tests
pnpm test

# Build
pnpm build
```

## License

Apache-2.0
