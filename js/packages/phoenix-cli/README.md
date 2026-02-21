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

A command-line interface for [Arize Phoenix](https://github.com/Arize-ai/phoenix). Fetch traces, inspect datasets, query experiments, and access the full GraphQL API—all from your terminal. Output is JSON, designed to be piped to `jq` or read by AI coding agents.

## Installation

```bash
npm install -g @arizeai/phoenix-cli
```

Or run directly with npx:

```bash
npx @arizeai/phoenix-cli
```

## Configuration

```bash
export PHOENIX_HOST=http://localhost:6006
export PHOENIX_PROJECT=my-project
export PHOENIX_API_KEY=your-api-key  # if authentication is enabled
```

CLI flags (`--endpoint`, `--project`, `--api-key`) override environment variables.

| Variable | Description |
|----------|-------------|
| `PHOENIX_HOST` | Phoenix API endpoint |
| `PHOENIX_PROJECT` | Project name or ID |
| `PHOENIX_API_KEY` | API key (if auth is enabled) |
| `PHOENIX_CLIENT_HEADERS` | Custom headers as JSON string |

## Commands

### `px api graphql <query>`

Make authenticated GraphQL queries against the Phoenix API. Output is pretty-printed JSON. Only queries are permitted — mutations and subscriptions are rejected.

```bash
px api graphql '<query>' [--endpoint <url>] [--api-key <key>]
```

Use introspection to discover what fields are available:

```bash
$ px api graphql '{ __schema { queryType { fields { name } } } }' | jq '.data.__schema.queryType.fields[].name'
"projects"
"datasets"
"experiments"
"prompts"
"evaluators"
"projectCount"
"datasetCount"
...
```

Inspect any type's fields:

```bash
$ px api graphql '{ __type(name: "Experiment") { fields { name type { name } } } }' | \
    jq '.data.__type.fields[] | {name, type: .type.name}'
{"name":"id","type":"ID"}
{"name":"name","type":"String"}
{"name":"runCount","type":"Int"}
{"name":"errorRate","type":"Float"}
{"name":"averageRunLatencyMs","type":"Float"}
...
```

**Projects:**

```bash
$ px api graphql '{ projects { edges { node { name traceCount tokenCountTotal } } } }'
{
  "data": {
    "projects": {
      "edges": [
        { "node": { "name": "default", "traceCount": 1482, "tokenCountTotal": 219083 } }
      ]
    }
  }
}

$ px api graphql '{ projects { edges { node { name traceCount } } } }' | \
    jq '.data.projects.edges[].node'
{"name": "default", "traceCount": 1482}
```

**Datasets:**

```bash
$ px api graphql '{ datasets { edges { node { name exampleCount experimentCount } } } }' | \
    jq '.data.datasets.edges[].node'
{"name": "eval-golden-set", "exampleCount": 120, "experimentCount": 4}
{"name": "rag-test-cases", "exampleCount": 50, "experimentCount": 1}

$ px api graphql '{ datasetCount }'
{"data": {"datasetCount": 12}}
```

**Experiments:**

```bash
# List experiments per dataset with error rate and avg latency
$ px api graphql '{
  datasets {
    edges {
      node {
        name
        experiments {
          edges {
            node { name runCount errorRate averageRunLatencyMs }
          }
        }
      }
    }
  }
}' | jq '.data.datasets.edges[].node | {dataset: .name, experiments: [.experiments.edges[].node]}'

# Find experiments with failures
$ px api graphql '{
  datasets { edges { node { name experiments { edges { node { name errorRate runCount } } } } } }
}' | jq '.. | objects | select(.errorRate? > 0) | {name, errorRate, runCount}'

# Inspect individual run outputs
$ px api graphql '{
  datasets(first: 1) {
    edges { node { experiments(first: 1) { edges { node {
      name
      runs { edges { node { traceId output error latencyMs } } }
    } } } } }
  }
}' | jq '.data.datasets.edges[0].node.experiments.edges[0].node.runs.edges[].node'
```

**Counts at a glance:**

```bash
$ px api graphql '{ projectCount datasetCount promptCount evaluatorCount }'
{
  "data": {
    "projectCount": 1,
    "datasetCount": 12,
    "promptCount": 3,
    "evaluatorCount": 2
  }
}
```

---

### `px traces [directory]`

Fetch recent traces from the configured project. All output is JSON.

```bash
px traces --limit 10                          # stdout (pretty)
px traces --format raw --no-progress | jq    # pipe-friendly compact JSON
px traces ./my-traces --limit 50             # save as JSON files to directory
px traces --last-n-minutes 60 --limit 20     # filter by time window
px traces --since 2026-01-13T10:00:00Z       # since ISO timestamp
```

| Option | Description | Default |
|--------|-------------|---------|
| `[directory]` | Save traces as JSON files to directory | stdout |
| `-n, --limit <number>` | Number of traces (newest first) | 10 |
| `--last-n-minutes <number>` | Only traces from the last N minutes | — |
| `--since <timestamp>` | Traces since ISO timestamp | — |
| `--format <format>` | `pretty`, `json`, or `raw` | `pretty` |
| `--no-progress` | Suppress progress output | — |
| `--include-annotations` | Include span annotations | — |

```bash
# Find ERROR traces
px traces --limit 50 --format raw --no-progress | jq '.[] | select(.status == "ERROR")'

# Sort by duration, take top 5 slowest
px traces --limit 20 --format raw --no-progress | jq 'sort_by(-.duration) | .[0:5]'

# Extract LLM model names used
px traces --limit 50 --format raw --no-progress | \
  jq -r '.[].spans[] | select(.span_kind == "LLM") | .attributes["llm.model_name"]' | sort -u
```

---

### `px trace <trace-id>`

Fetch a single trace by ID.

```bash
px trace abc123def456
px trace abc123def456 --format raw | jq '.spans[] | select(.status_code != "OK")'
px trace abc123def456 --file trace.json
```

---

### `px datasets`

List all datasets.

```bash
px datasets --format raw --no-progress | jq '.[].name'
```

---

### `px dataset <dataset-identifier>`

Fetch examples from a dataset.

```bash
px dataset my-dataset --format raw | jq '.examples[].input'
px dataset my-dataset --split train --split test
px dataset my-dataset --version <version-id>
px dataset my-dataset --file dataset.json
```

---

### `px experiments --dataset <name-or-id>`

List experiments for a dataset.

```bash
px experiments --dataset my-dataset --format raw --no-progress | \
  jq '.[] | {id, successful_run_count, failed_run_count}'
```

---

### `px experiment <experiment-id>`

Fetch a single experiment with all run data (inputs, outputs, evaluations, trace IDs).

```bash
# Find failed runs
px experiment RXhwZXJpbWVudDox --format raw --no-progress | \
  jq '.[] | select(.error != null) | {input, error}'

# Average latency
px experiment RXhwZXJpbWVudDox --format raw --no-progress | \
  jq '[.[].latency_ms] | add / length'
```

---

### `px prompts`

List all prompts.

```bash
px prompts --format raw --no-progress | jq '.[].name'
```

---

### `px prompt <prompt-identifier>`

Fetch a prompt. The `text` format is ideal for piping to AI assistants.

```bash
px prompt my-evaluator --format text --no-progress | claude -p "Review this prompt"
px prompt my-evaluator --tag production --format json | jq '.template'
```

| Option | Description | Default |
|--------|-------------|---------|
| `--tag <name>` | Get version by tag | — |
| `--version <id>` | Get specific version | latest |
| `--format <format>` | `pretty`, `json`, `raw`, or `text` | `pretty` |

---

## JSON output shape

All commands output JSON. Use `--format raw` for compact JSON and `--no-progress` to suppress stderr when piping:

```bash
px traces --format raw --no-progress | jq ...
px datasets --format raw --no-progress | jq ...
```

Trace JSON structure:

```json
{
  "traceId": "abc123def456",
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
      "input.value": "What is the weather?",
      "output.value": "The weather is sunny..."
    }
  }]
}
```

`px api graphql` output always wraps results in `{"data": {...}}`. Pipe with `jq '.data.<field>'` to extract.

---

## Community

- 🌍 [Slack community](https://join.slack.com/t/arize-ai/shared_invite/zt-3r07iavnk-ammtATWSlF0pSrd1DsMW7g)
- 📚 [Documentation](https://arize.com/docs/phoenix)
- 🌟 [GitHub](https://github.com/Arize-ai/phoenix)
- 🐞 [Report bugs](https://github.com/Arize-ai/phoenix/issues)
- 𝕏 [@ArizePhoenix](https://twitter.com/ArizePhoenix)
