---
name: phoenix-cli
description: Debug LLM applications using the Phoenix CLI. Fetch traces, analyze errors, review experiments, and inspect datasets. Use when debugging AI/LLM applications, analyzing trace data, working with Phoenix observability, or investigating LLM performance issues.
license: Apache-2.0
metadata:
  author: arize-ai
  version: "1.0"
---

# Phoenix CLI

Debug and analyze LLM applications using the Phoenix CLI (`px`).

## Quick Start

### Installation

```bash
npm install -g @arizeai/phoenix-cli
# Or run directly with npx
npx @arizeai/phoenix-cli
```

### Configuration

Set environment variables before running commands:

```bash
export PHOENIX_HOST=http://localhost:6006
export PHOENIX_PROJECT=my-project
export PHOENIX_API_KEY=your-api-key  # if authentication is enabled
```

CLI flags override environment variables when specified.

## Debugging Workflows

### Debug a failing LLM application

1. Fetch recent traces to see what's happening:

```bash
px traces --limit 10
```

2. Find failed traces:

```bash
px traces --limit 50 --format raw --no-progress | jq '.[] | select(.status == "ERROR")'
```

3. Get details on a specific trace:

```bash
px trace <trace-id>
```

4. Look for errors in spans:

```bash
px trace <trace-id> --format raw | jq '.spans[] | select(.status_code != "OK")'
```

### Find performance issues

1. Get the slowest traces:

```bash
px traces --limit 20 --format raw --no-progress | jq 'sort_by(-.duration) | .[0:5]'
```

2. Analyze span durations within a trace:

```bash
px trace <trace-id> --format raw | jq '.spans | sort_by(-.duration_ms) | .[0:5] | .[] | {name, duration_ms, span_kind}'
```

### Analyze LLM usage

Extract models and token counts:

```bash
px traces --limit 50 --format raw --no-progress | \
  jq -r '.[].spans[] | select(.span_kind == "LLM") | {model: .attributes["llm.model_name"], prompt_tokens: .attributes["llm.token_count.prompt"], completion_tokens: .attributes["llm.token_count.completion"]}'
```

### Review experiment results

1. List datasets:

```bash
px datasets
```

2. List experiments for a dataset:

```bash
px experiments --dataset my-dataset
```

3. Analyze experiment failures:

```bash
px experiment <experiment-id> --format raw --no-progress | \
  jq '.[] | select(.error != null) | {input: .input, error}'
```

4. Calculate average latency:

```bash
px experiment <experiment-id> --format raw --no-progress | \
  jq '[.[].latency_ms] | add / length'
```

## Command Reference

### px traces

Fetch recent traces from a project.

```bash
px traces [directory] [options]
```

| Option | Description |
|--------|-------------|
| `[directory]` | Save traces as JSON files to directory |
| `-n, --limit <number>` | Number of traces (default: 10) |
| `--last-n-minutes <number>` | Filter by time window |
| `--since <timestamp>` | Fetch since ISO timestamp |
| `--format <format>` | `pretty`, `json`, or `raw` |
| `--include-annotations` | Include span annotations |

### px trace

Fetch a specific trace by ID.

```bash
px trace <trace-id> [options]
```

| Option | Description |
|--------|-------------|
| `--file <path>` | Save to file |
| `--format <format>` | `pretty`, `json`, or `raw` |
| `--include-annotations` | Include span annotations |

### px datasets

List all datasets.

```bash
px datasets [options]
```

### px dataset

Fetch examples from a dataset.

```bash
px dataset <dataset-name> [options]
```

| Option | Description |
|--------|-------------|
| `--split <name>` | Filter by split (repeatable) |
| `--version <id>` | Specific dataset version |
| `--file <path>` | Save to file |

### px experiments

List experiments for a dataset.

```bash
px experiments --dataset <name> [directory]
```

| Option | Description |
|--------|-------------|
| `--dataset <name>` | Dataset name or ID (required) |
| `[directory]` | Export experiment JSON to directory |

### px experiment

Fetch a single experiment with run data.

```bash
px experiment <experiment-id> [options]
```

### px prompts

List all prompts.

```bash
px prompts [options]
```

### px prompt

Fetch a specific prompt.

```bash
px prompt <prompt-name> [options]
```

## Output Formats

- **`pretty`** (default): Human-readable tree view
- **`json`**: Formatted JSON with indentation
- **`raw`**: Compact JSON for piping to `jq` or other tools

Use `--format raw --no-progress` when piping output to other commands.

## Trace Structure

Traces contain spans with OpenInference semantic attributes:

```json
{
  "traceId": "abc123",
  "spans": [{
    "name": "chat_completion",
    "span_kind": "LLM",
    "status_code": "OK",
    "attributes": {
      "llm.model_name": "gpt-4",
      "llm.token_count.prompt": 512,
      "llm.token_count.completion": 256,
      "input.value": "What is the weather?",
      "output.value": "The weather is sunny..."
    }
  }],
  "duration": 1250,
  "status": "OK"
}
```

Key span kinds: `LLM`, `CHAIN`, `TOOL`, `RETRIEVER`, `EMBEDDING`, `AGENT`.

Key attributes for LLM spans:
- `llm.model_name`: Model used
- `llm.provider`: Provider name (e.g., "openai")
- `llm.token_count.prompt` / `llm.token_count.completion`: Token counts
- `llm.input_messages.*`: Input messages (indexed, with role and content)
- `llm.output_messages.*`: Output messages (indexed, with role and content)
- `input.value` / `output.value`: Raw input/output as text
- `exception.message`: Error message if failed
