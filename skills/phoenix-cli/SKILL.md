---
name: phoenix-cli
description: Debug LLM applications using the Phoenix CLI. Fetch traces, analyze errors, review experiments, inspect datasets, and query the GraphQL API. Use when debugging AI/LLM applications, analyzing trace data, working with Phoenix observability, or investigating LLM performance issues.
license: Apache-2.0
metadata:
  author: arize-ai
  version: "1.0"
---

# Phoenix CLI

The Phoenix CLI (`px`) gives you command-line access to your Phoenix observability data. Every command outputs JSON, designed to be piped to `jq` or read directly.

## Setup

```bash
export PHOENIX_HOST=http://localhost:6006
export PHOENIX_PROJECT=my-project
export PHOENIX_API_KEY=your-api-key  # if auth is enabled
```

Run `px --help` to see all commands. Run `px <command> --help` for command-specific flags.

## `px traces` — Fetch recent traces

```bash
px traces --limit 10                          # newest 10 traces (pretty print)
px traces --format raw --no-progress | jq    # compact JSON for piping
px traces ./out/ --limit 50                  # save as JSON files to directory
px traces --last-n-minutes 60 --limit 20     # filter by time window
px traces --since 2026-01-13T10:00:00Z       # since ISO timestamp
```

Always use `--format raw --no-progress` when piping to `jq`.

```bash
# Find ERROR traces
px traces --limit 50 --format raw --no-progress | jq '.[] | select(.status == "ERROR")'

# Slowest 5 traces
px traces --limit 20 --format raw --no-progress | jq 'sort_by(-.duration) | .[0:5]'

# LLM models used across recent traces
px traces --limit 50 --format raw --no-progress | \
  jq -r '.[].spans[] | select(.span_kind == "LLM") | .attributes["llm.model_name"]' | sort -u

# Token counts per trace
px traces --limit 20 --format raw --no-progress | \
  jq '.[] | {traceId, duration, prompt: .rootSpan.attributes["llm.token_count.prompt"], completion: .rootSpan.attributes["llm.token_count.completion"]}'

# Extract LLM inputs and outputs
px traces --limit 10 --format raw --no-progress | \
  jq '.[] | {traceId, input: .rootSpan.attributes["input.value"], output: .rootSpan.attributes["output.value"]}'
```

### Trace JSON shape

Each element of the output array is a `Trace` object:

```json
{
  "traceId": "73b0daa1b19c689af2f72a553cdea89d",
  "status": "OK",
  "startTime": "2026-02-21T06:45:49.076Z",
  "endTime": "2026-02-21T06:45:49.571Z",
  "duration": 495,
  "rootSpan": { ... },
  "spans": [
    {
      "id": "U3BhbjoyNTQ=",
      "name": "ChatCompletion",
      "context": {
        "trace_id": "73b0daa1b19c689af2f72a553cdea89d",
        "span_id": "1b85de45f4aac981"
      },
      "span_kind": "LLM",
      "parent_id": null,
      "start_time": "2026-02-21T06:45:49.076614+00:00",
      "end_time": "2026-02-21T06:45:49.571064+00:00",
      "status_code": "OK",
      "status_message": "",
      "attributes": {
        "input.value": "{\"messages\": [...], \"tools\": []}",
        "input.mime_type": "application/json",
        "output.value": "Hi! What would you like help with?",
        "output.mime_type": "text/plain",
        "llm.model_name": "gpt-4o",
        "llm.provider": "openai",
        "llm.system": "openai",
        "llm.input_messages.0.message.role": "system",
        "llm.input_messages.0.message.content": "You are a chatbot",
        "llm.input_messages.1.message.role": "user",
        "llm.input_messages.1.message.content": "Hello",
        "llm.output_messages.0.message.role": "assistant",
        "llm.output_messages.0.message.content": "Hi! What would you like help with?",
        "llm.invocation_parameters": "{\"temperature\": 0.7}",
        "llm.token_count.prompt": 14,
        "llm.token_count.completion": 12,
        "llm.token_count.total": 26,
        "llm.token_count.prompt_details.cache_read": 0,
        "llm.token_count.completion_details.reasoning": 0
      },
      "events": []
    }
  ]
}
```

### Key fields

**Trace-level** (top of each object):
- `traceId` — unique trace identifier
- `status` — `"OK"` or `"ERROR"` (derived from spans)
- `duration` — total milliseconds
- `startTime` / `endTime` — ISO timestamps
- `rootSpan` — the top-level span (no `parent_id`)
- `spans` — all spans in the trace

**Span-level** (inside `spans[]`):
- `span_kind` — `LLM`, `CHAIN`, `TOOL`, `RETRIEVER`, `EMBEDDING`, `AGENT`
- `status_code` — `"OK"` or `"ERROR"`
- `parent_id` — `null` for root span, span ID string for children
- `context.span_id` — unique span identifier

**Key OpenInference attributes** (inside `attributes`):
- `input.value` — raw input (may be JSON string when `input.mime_type` is `application/json`)
- `output.value` — raw output text
- `llm.model_name` — model used (e.g. `"gpt-4o"`, `"claude-3-5-sonnet"`)
- `llm.provider` — provider name (e.g. `"openai"`, `"anthropic"`)
- `llm.token_count.prompt` / `.completion` / `.total` — token counts
- `llm.token_count.prompt_details.cache_read` — cached prompt tokens
- `llm.token_count.completion_details.reasoning` — reasoning tokens (o-series models)
- `llm.input_messages.{N}.message.role` / `.content` — individual messages (indexed)
- `llm.output_messages.{N}.message.role` / `.content` — model response messages
- `llm.invocation_parameters` — JSON string of call parameters (temperature, etc.)
- `exception.message` — error message if span failed

---

## `px trace <trace-id>` — Single trace

Fetches a single trace by ID. Returns the same `Trace` JSON shape as `px traces` but for one trace. The `traceId` is the `traceId` field from a `px traces` result or from a `traceId` in an experiment run.

```bash
px trace 73b0daa1b19c689af2f72a553cdea89d
px trace 73b0daa1b19c689af2f72a553cdea89d --format raw | jq .
px trace 73b0daa1b19c689af2f72a553cdea89d --file trace.json

# Find spans that failed
px trace <trace-id> --format raw | jq '.spans[] | select(.status_code != "OK")'

# Sort spans by duration (longest first)
px trace <trace-id> --format raw | \
  jq '.spans | sort_by(-(.end_time | fromdateiso8601) + (.start_time | fromdateiso8601)) | .[0:5] | .[] | {name, span_kind, status_code}'

# Extract LLM input/output messages
px trace <trace-id> --format raw | \
  jq '.spans[] | select(.span_kind == "LLM") | {
    model: .attributes["llm.model_name"],
    input: [to_entries | .[] | select(.key | startswith("llm.input_messages")) | {(.key): .value}],
    output: .attributes["llm.output_messages.0.message.content"]
  }'

# Get exception details
px trace <trace-id> --format raw | \
  jq '.spans[] | select(.attributes["exception.message"]) | {name, error: .attributes["exception.message"]}'
```

---

## `px datasets` / `px dataset` — Dataset access

```bash
# List datasets
px datasets --format raw --no-progress | jq '.[].name'

# Fetch examples from a dataset
px dataset my-dataset --format raw | jq '.examples[] | {input, output: .expected_output}'
px dataset my-dataset --split train --format raw | jq '.examples | length'
```

---

## `px experiments` / `px experiment` — Experiment results

```bash
# List experiments for a dataset
px experiments --dataset my-dataset --format raw --no-progress | \
  jq '.[] | {id, name, successful_run_count, failed_run_count}'

# Inspect an experiment's runs
px experiment RXhwZXJpbWVudDox --format raw --no-progress | \
  jq '.[] | {input, output: .result, error, latency_ms}'

# Failed runs only
px experiment RXhwZXJpbWVudDox --format raw --no-progress | \
  jq '.[] | select(.error != null) | {input, error}'

# Average latency
px experiment RXhwZXJpbWVudDox --format raw --no-progress | \
  jq '[.[].latency_ms] | add / length'
```

---

## `px prompts` / `px prompt` — Prompt access

```bash
# List prompts
px prompts --format raw --no-progress | jq '.[].name'

# Get prompt as plain text (ideal for piping to AI)
px prompt my-evaluator --format text --no-progress

# Get a tagged production version
px prompt my-evaluator --tag production --format text --no-progress

# Pipe to an AI assistant
px prompt my-evaluator --format text --no-progress | claude -p "Suggest improvements"
```

---

## `px api graphql` — Query the Phoenix GraphQL API

For cases not covered by the commands above. POST any GraphQL query directly to Phoenix. Output is `{"data": {...}}` JSON — pipe with `jq '.data.<field>'` to extract. Only queries are permitted; mutations and subscriptions are rejected.

### Discover available fields

```bash
# List all queryable root fields
$ px api graphql '{ __schema { queryType { fields { name description } } } }' | \
    jq '.data.__schema.queryType.fields[] | {name, description}'

# Inspect fields of any type
$ px api graphql '{ __type(name: "Project") { fields { name type { name } } } }' | \
    jq '.data.__type.fields[] | {name, type: .type.name}'
```

Key root query fields: `projects`, `datasets`, `prompts`, `evaluators`, `projectCount`, `datasetCount`, `promptCount`, `evaluatorCount`, `serverStatus`, `viewer`.

### Projects

```bash
$ px api graphql '{ projects { edges { node { name traceCount tokenCountTotal createdAt } } } }' | \
    jq '.data.projects.edges[].node'
{"name": "default", "traceCount": 1482, "tokenCountTotal": 219083, "createdAt": "..."}
```

Project fields: `id`, `name`, `traceCount`, `recordCount`, `tokenCountTotal`, `tokenCountPrompt`, `tokenCountCompletion`, `createdAt`, `updatedAt`, `spanAnnotationNames`, `traceAnnotationNames`.

### Datasets

```bash
$ px api graphql '{ datasets { edges { node { name exampleCount experimentCount createdAt } } } }' | \
    jq '.data.datasets.edges[].node'
{"name": "eval-golden-set", "exampleCount": 120, "experimentCount": 4, "createdAt": "..."}

$ px api graphql '{ datasetCount }' | jq '.data.datasetCount'
12
```

Dataset fields: `id`, `name`, `description`, `exampleCount`, `experimentCount`, `evaluatorCount`, `createdAt`, `updatedAt`, `metadata`.

### Experiments

```bash
$ px api graphql '{
  datasets {
    edges {
      node {
        name
        experiments {
          edges {
            node { id name runCount errorRate averageRunLatencyMs createdAt }
          }
        }
      }
    }
  }
}' | jq '.data.datasets.edges[].node | {dataset: .name, experiments: [.experiments.edges[].node]}'

# Find experiments with non-zero error rate
$ px api graphql '{
  datasets { edges { node { name experiments { edges { node { name errorRate runCount } } } } } }
}' | jq '.. | objects | select(.errorRate? > 0) | {name, errorRate, runCount}'
```

### Experiment runs

```bash
$ px api graphql '{
  datasets(first: 1) {
    edges { node { experiments(first: 1) { edges { node {
      name
      runs { edges { node { traceId output error latencyMs } } }
    } } } } }
  }
}' | jq '.data.datasets.edges[0].node.experiments.edges[0].node.runs.edges[].node'
{"traceId": "b696d0ac...", "output": {"answer": "Moore's Law is..."}, "error": null, "latencyMs": 1006}
```

ExperimentRun fields: `id`, `traceId`, `output`, `error`, `latencyMs`, `startTime`, `endTime`.

### Evaluators

```bash
$ px api graphql '{ evaluators { edges { node { name kind description isBuiltin } } } }' | \
    jq '.data.evaluators.edges[].node'
{"name": "correctness", "kind": "LLM", "description": "Evaluates answer correctness", "isBuiltin": true}
```

### Quick instance summary

```bash
$ px api graphql '{ projectCount datasetCount promptCount evaluatorCount }'
{"data": {"projectCount": 1, "datasetCount": 12, "promptCount": 3, "evaluatorCount": 2}}
```

---

## Piping patterns

Always use `--format raw --no-progress` for `px traces/datasets/experiments/experiment`. The `px api graphql` command always outputs `{"data": {...}}` — use `jq '.data.<field>'` to extract.

```bash
# REST commands: array at root
px traces --format raw --no-progress | jq '.[0]'

# GraphQL: wrapped in data key
px api graphql '{ projects { edges { node { name } } } }' | jq '.data.projects.edges[].node'
```
