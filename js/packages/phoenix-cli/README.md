<h1 align="center" style="border-bottom: none">
    <div>
        <a href="https://phoenix.arize.com/?utm_medium=github&utm_content=header_img&utm_campaign=phoenix-cli">
            <picture>
                <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix.svg">
                <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix-white.svg">
                <img alt="Arize Phoenix logo" src="https://raw.githubusercontent.com/Arize-ai/phoenix-assets/refs/heads/main/logos/Phoenix/phoenix.svg" width="100" />
            </picture>
        </a>
        <br>
        @arizeai/phoenix-cli
    </div>
</h1>

<p align="center">
    <a href="https://www.npmjs.com/package/@arizeai/phoenix-cli">
        <img src="https://img.shields.io/npm/v/%40arizeai%2Fphoenix-cli" alt="NPM Version">
    </a>
    <a href="https://arize.com/docs/phoenix/">
        <img src="https://img.shields.io/badge/docs-blue?logo=typescript&logoColor=white" alt="Documentation">
    </a>
    <img referrerpolicy="no-referrer-when-downgrade" src="https://static.scarf.sh/a.png?x-pxid=8e8e8b34-7900-43fa-a38f-1f070bd48c64&page=js/packages/phoenix-cli/README.md" />
</p>

A command-line interface for [Arize Phoenix](https://github.com/Arize-ai/phoenix). Fetch traces, list datasets, and export experiment results directly from your terminal—or pipe them into AI coding agents like Claude Code, Cursor, Codex, and Gemini CLI.

## Installation

```bash
npm install -g @arizeai/phoenix-cli
```

Or run directly with npx:

```bash
npx @arizeai/phoenix-cli
```

## Quick Start

```bash
# Configure your Phoenix instance
export PHOENIX_HOST=http://localhost:6006
export PHOENIX_PROJECT=my-project
export PHOENIX_API_KEY=your-api-key  # if authentication is enabled

# Fetch the most recent trace
px traces --limit 1

# Fetch a specific trace by ID
px trace abc123def456

# Export traces to a directory
px traces ./my-traces --limit 50
```

## Environment Variables

| Variable                 | Description                                          |
| ------------------------ | ---------------------------------------------------- |
| `PHOENIX_HOST`           | Phoenix API endpoint (e.g., `http://localhost:6006`) |
| `PHOENIX_PROJECT`        | Project name or ID                                   |
| `PHOENIX_API_KEY`        | API key for authentication (if required)             |
| `PHOENIX_CLIENT_HEADERS` | Custom headers as JSON string                        |

CLI flags take priority over environment variables.

## Commands

### `px projects`

List all available projects.

```bash
px projects
px projects --format raw  # JSON output for piping
```

### `px traces [directory]`

Fetch recent traces from the configured project.

```bash
px traces --limit 10                          # Output to stdout
px traces ./my-traces --limit 10              # Save to directory
px traces --last-n-minutes 60 --limit 20      # Filter by time
px traces --since 2026-01-13T10:00:00Z        # Since timestamp
px traces --format raw --no-progress | jq     # Pipe to jq
```

| Option                      | Description                               | Default  |
| --------------------------- | ----------------------------------------- | -------- |
| `[directory]`               | Save traces as JSON files to directory    | stdout   |
| `-n, --limit <number>`      | Number of traces to fetch (newest first)  | 10       |
| `--last-n-minutes <number>` | Only fetch traces from the last N minutes | —        |
| `--since <timestamp>`       | Fetch traces since ISO timestamp          | —        |
| `--format <format>`         | `pretty`, `json`, or `raw`                | `pretty` |
| `--no-progress`             | Disable progress output                   | —        |
| `--include-annotations`     | Include span annotations in trace export  | —        |

### `px trace <trace-id>`

Fetch a specific trace by ID.

```bash
px trace abc123def456
px trace abc123def456 --file trace.json      # Save to file
px trace abc123def456 --format raw | jq      # Pipe to jq
```

| Option              | Description                    | Default  |
| ------------------- | ------------------------------ | -------- |
| `--file <path>`     | Save to file instead of stdout | stdout   |
| `--format <format>` | `pretty`, `json`, or `raw`     | `pretty` |
| `--include-annotations` | Include span annotations in trace export | — |

### `px datasets`

List all available datasets.

```bash
px datasets
px datasets --format json                    # JSON output
px datasets --format raw --no-progress | jq  # Pipe to jq
```

| Option              | Description                | Default  |
| ------------------- | -------------------------- | -------- |
| `--format <format>` | `pretty`, `json`, or `raw` | `pretty` |
| `--limit <number>`  | Maximum number of datasets | —        |

### `px dataset <dataset-identifier>`

Fetch examples from a dataset.

```bash
px dataset query_response                        # Fetch all examples
px dataset query_response --split train          # Filter by split
px dataset query_response --split train --split test  # Multiple splits
px dataset query_response --version <version-id> # Specific version
px dataset query_response --file dataset.json    # Save to file
px dataset query_response --format raw | jq '.examples[].input'
```

| Option           | Description                              | Default  |
| ---------------- | ---------------------------------------- | -------- |
| `--split <name>` | Filter by split (can be used repeatedly) | —        |
| `--version <id>` | Fetch from specific dataset version      | latest   |
| `--file <path>`  | Save to file instead of stdout           | stdout   |
| `--format <fmt>` | `pretty`, `json`, or `raw`               | `pretty` |

### `px experiments --dataset <name-or-id>`

List experiments for a dataset, optionally exporting full data to files.

```bash
px experiments --dataset my-dataset                 # List experiments
px experiments --dataset my-dataset --format json   # JSON output
px experiments --dataset my-dataset ./experiments   # Export to directory
```

| Option                   | Description                               | Default  |
| ------------------------ | ----------------------------------------- | -------- |
| `--dataset <name-or-id>` | Dataset name or ID (required)             | —        |
| `[directory]`            | Export experiment JSON files to directory | stdout   |
| `--format <format>`      | `pretty`, `json`, or `raw`                | `pretty` |
| `--limit <number>`       | Maximum number of experiments             | —        |

### `px experiment <experiment-id>`

Fetch a single experiment with all run data.

```bash
px experiment RXhwZXJpbWVudDox
px experiment RXhwZXJpbWVudDox --file exp.json   # Save to file
px experiment RXhwZXJpbWVudDox --format json     # JSON output
```

| Option              | Description                    | Default  |
| ------------------- | ------------------------------ | -------- |
| `--file <path>`     | Save to file instead of stdout | stdout   |
| `--format <format>` | `pretty`, `json`, or `raw`     | `pretty` |

## Output Formats

**`pretty`** (default) — Human-readable tree view:

```
┌─ Trace: abc123def456
│
│  Input: What is the weather in San Francisco?
│  Output: The weather is currently sunny...
│
│  Spans:
│  └─ ✓ agent_run (CHAIN) - 1250ms
│     ├─ ✓ llm_call (LLM) - 800ms
│     └─ ✓ tool_execution (TOOL) - 400ms
└─
```

**`json`** — Formatted JSON with indentation.

**`raw`** — Compact JSON for piping to `jq` or other tools.

## JSON Structure

```json
{
  "traceId": "abc123def456",
  "spans": [
    {
      "name": "chat_completion",
      "context": {
        "trace_id": "abc123def456",
        "span_id": "span-1"
      },
      "span_kind": "LLM",
      "parent_id": null,
      "start_time": "2026-01-17T10:00:00.000Z",
      "end_time": "2026-01-17T10:00:01.250Z",
      "status_code": "OK",
      "attributes": {
        "llm.model_name": "gpt-4",
        "llm.token_count.prompt": 512,
        "llm.token_count.completion": 256,
        "input.value": "What is the weather?",
        "output.value": "The weather is sunny..."
      }
    }
  ],
  "rootSpan": { ... },
  "startTime": "2026-01-17T10:00:00.000Z",
  "endTime": "2026-01-17T10:00:01.250Z",
  "duration": 1250,
  "status": "OK"
}
```

Spans include [OpenInference](https://github.com/Arize-ai/openinference) semantic attributes like `llm.model_name`, `llm.token_count.*`, `input.value`, `output.value`, `tool.name`, and `exception.*`.

## Examples

### Debug failed traces

```bash
px traces --limit 20 --format raw --no-progress | jq '.[] | select(.status == "ERROR")'
```

### Find slowest traces

```bash
px traces --limit 10 --format raw --no-progress | jq 'sort_by(-.duration) | .[0:3]'
```

### Extract LLM models used

```bash
px traces --limit 50 --format raw --no-progress | \
  jq -r '.[].spans[] | select(.span_kind == "LLM") | .attributes["llm.model_name"]' | sort -u
```

### Count errors

```bash
px traces --limit 100 --format raw --no-progress | jq '[.[] | select(.status == "ERROR")] | length'
```

### List datasets and experiments

```bash
# List all datasets
px datasets --format raw --no-progress | jq '.[].name'
# Output: "query_response"

# List experiments for a dataset
px experiments --dataset query_response --format raw --no-progress | \
  jq '.[] | {id, successful_run_count, failed_run_count}'
# Output: {"id":"RXhwZXJpbWVudDox","successful_run_count":249,"failed_run_count":1}

# Export all experiment data for a dataset to a directory
px experiments --dataset query_response ./experiments/
```

### Analyze experiment results

```bash
# Get input queries and latency from an experiment
px experiment RXhwZXJpbWVudDox --format raw --no-progress | \
  jq '.[] | {query: .input.query, latency_ms, trace_id}'

# Find failed runs in an experiment
px experiment RXhwZXJpbWVudDox --format raw --no-progress | \
  jq '.[] | select(.error != null) | {query: .input.query, error}'
# Output: {"query":"looking for complex fodmap meal ideas","error":"peer closed connection..."}

# Calculate average latency across runs
px experiment RXhwZXJpbWVudDox --format raw --no-progress | \
  jq '[.[].latency_ms] | add / length'
```

---

## Community

- 🌍 [Slack community](https://arize-ai.slack.com/join/shared_invite/zt-11t1vbu4x-xkBIHmOREQnYnYDH1GDfCg)
- 📚 [Documentation](https://arize.com/docs/phoenix)
- 🌟 [GitHub](https://github.com/Arize-ai/phoenix)
- 🐞 [Report bugs](https://github.com/Arize-ai/phoenix/issues)
- 𝕏 [@ArizePhoenix](https://twitter.com/ArizePhoenix)
