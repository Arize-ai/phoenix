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
px traces --limit 10                         # newest 10 traces (pretty)
px traces --format raw --no-progress | jq   # compact JSON for piping
px traces ./out/ --limit 50                 # save as files to directory
px traces --last-n-minutes 60               # filter by time window
```

Always use `--format raw --no-progress` when piping to `jq`.

```bash
# Find ERROR traces
px traces --limit 50 --format raw --no-progress | jq '.[] | select(.status == "ERROR")'

# Slowest 5 traces
px traces --limit 20 --format raw --no-progress | jq 'sort_by(-.duration) | .[0:5]'

# LLM models used
px traces --limit 50 --format raw --no-progress | \
  jq -r '.[].spans[] | select(.span_kind == "LLM") | .attributes["llm.model_name"]' | sort -u

# Token counts per trace
px traces --limit 20 --format raw --no-progress | \
  jq '.[] | {traceId, tokens: (.spans[] | select(.span_kind == "LLM") | .attributes["llm.token_count.completion"])}'
```

Trace JSON shape:

```json
{
  "traceId": "abc123",
  "status": "OK",
  "duration": 1250,
  "spans": [{
    "name": "chat_completion",
    "span_kind": "LLM",
    "status_code": "OK",
    "attributes": {
      "llm.model_name": "gpt-4",
      "llm.token_count.prompt": 512,
      "llm.token_count.completion": 256,
      "input.value": "...",
      "output.value": "..."
    }
  }]
}
```

Key span kinds: `LLM`, `CHAIN`, `TOOL`, `RETRIEVER`, `EMBEDDING`, `AGENT`.

Key attributes: `llm.model_name`, `llm.provider`, `llm.token_count.prompt`, `llm.token_count.completion`, `llm.input_messages.*`, `llm.output_messages.*`, `input.value`, `output.value`, `exception.message`.

---

## `px trace <trace-id>` — Single trace

```bash
px trace abc123def456 --format raw | jq '.spans[] | select(.status_code != "OK")'
px trace abc123def456 --format raw | jq '.spans | sort_by(-.duration_ms) | .[0:3]'
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
