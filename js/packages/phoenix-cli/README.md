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

A command-line interface for [Arize Phoenix](https://github.com/Arize-ai/phoenix). Fetch traces, inspect datasets, query experiments, and access prompts directly from your terminal—or pipe them into AI coding agents like Claude Code, Cursor, Codex, and Gemini CLI.

## Installation

```bash
npm install -g @arizeai/phoenix-cli
# or run without installing:
npx @arizeai/phoenix-cli

# once installed globally, update in place:
px self update
```

## Configuration

```bash
export PHOENIX_HOST=http://localhost:6006
export PHOENIX_PROJECT=my-project
export PHOENIX_API_KEY=your-api-key  # if authentication is enabled
```

CLI flags (`--endpoint`, `--project`, `--api-key`) override environment variables.

| Variable                                 | Description                                   |
| ---------------------------------------- | --------------------------------------------- |
| `PHOENIX_HOST`                           | Phoenix API endpoint                          |
| `PHOENIX_PROJECT`                        | Project name or ID                            |
| `PHOENIX_API_KEY`                        | API key (if auth is enabled)                  |
| `PHOENIX_CLIENT_HEADERS`                 | Custom headers as JSON string                 |
| `PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES` | Enable CLI delete commands when set to `true` |

Delete commands are disabled by default and require `PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES=true`.

## Commands

### `px self update`

Check the npm registry for the latest CLI release and update the installed
global CLI in place when a newer version is available.

```bash
px self update          # show current/latest and update if needed
px self update --check  # show current/latest without installing
```

Automatic updates are supported for global `npm`, `pnpm`, `bun`, and standard
`deno install -g` wrapper installs.

### `px trace list [directory]`

Fetch recent traces from the configured project. All output is JSON.

```bash
px trace list --limit 10                          # stdout (pretty)
px trace list --format raw --no-progress | jq    # pipe-friendly compact JSON
px trace list ./my-traces --limit 50             # save as JSON files to directory
px trace list --last-n-minutes 60 --limit 20     # filter by time window
px trace list --since 2026-01-13T10:00:00Z       # since ISO timestamp
```

| Option                      | Description                            | Default  |
| --------------------------- | -------------------------------------- | -------- |
| `[directory]`               | Save traces as JSON files to directory | stdout   |
| `-n, --limit <number>`      | Number of traces (newest first)        | 10       |
| `--last-n-minutes <number>` | Only traces from the last N minutes    | —        |
| `--since <timestamp>`       | Traces since ISO timestamp             | —        |
| `--format <format>`         | `pretty`, `json`, or `raw`             | `pretty` |
| `--no-progress`             | Suppress progress output               | —        |
| `--include-annotations`     | Include span annotations               | —        |
| `--include-notes`           | Include span notes                     | —        |

```bash
# Find ERROR traces
px trace list --limit 50 --format raw --no-progress | jq '.[] | select(.status == "ERROR")'

# Sort by duration, take top 5 slowest
px trace list --limit 20 --format raw --no-progress | jq 'sort_by(-.duration) | .[0:5]'

# Extract LLM model names used
px trace list --limit 50 --format raw --no-progress | \
  jq -r '.[].spans[] | select(.span_kind == "LLM") | .attributes["llm.model_name"]' | sort -u
```

---

### `px trace get <trace-id>`

Fetch a single trace by ID.

```bash
px trace get abc123def456
px trace get abc123def456 --format raw | jq '.spans[] | select(.status_code != "OK")'
px trace get abc123def456 --file trace.json
px trace get abc123def456 --include-notes --format raw | jq '.spans[].notes'
```

---

### `px trace annotate <trace-id>`

Create or update a human trace annotation by OpenTelemetry trace ID.

```bash
px trace annotate abc123def456 --name reviewer --label pass
px trace annotate abc123def456 --name reviewer --score 0.9 --format raw --no-progress
px trace annotate abc123def456 --name evaluator --label pass --annotator-kind LLM
px trace annotate abc123def456 --name reviewer --explanation "needs follow-up"
```

---

### `px span list [file]`

Fetch spans for the configured project with filtering options. Output is JSON.

```bash
px span list --limit 50                                    # stdout (pretty)
px span list --span-kind LLM --limit 20                    # only LLM spans
px span list --status-code ERROR --format raw --no-progress # pipe-friendly error spans
px span list --name chat_completion --trace-id abc123       # filter by name and trace
px span list --parent-id null                               # root spans only
px span list spans.json --limit 100 --include-annotations   # save to file with annotations
px span list --last-n-minutes 30 --span-kind TOOL RETRIEVER # multiple span kinds
```

| Option                      | Description                                                                                                                      | Default  |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | -------- |
| `[file]`                    | Save spans as JSON to file                                                                                                       | stdout   |
| `-n, --limit <number>`      | Maximum number of spans (newest first)                                                                                           | `100`    |
| `--last-n-minutes <number>` | Only spans from the last N minutes                                                                                               | —        |
| `--since <timestamp>`       | Spans since ISO timestamp                                                                                                        | —        |
| `--span-kind <kinds...>`    | Filter by span kind (`LLM`, `CHAIN`, `TOOL`, `RETRIEVER`, `EMBEDDING`, `AGENT`, `RERANKER`, `GUARDRAIL`, `EVALUATOR`, `UNKNOWN`) | —        |
| `--status-code <codes...>`  | Filter by status code (`OK`, `ERROR`, `UNSET`)                                                                                   | —        |
| `--name <names...>`         | Filter by span name(s)                                                                                                           | —        |
| `--trace-id <ids...>`       | Filter by trace ID(s)                                                                                                            | —        |
| `--parent-id <id>`          | Filter by parent span ID (use `"null"` for root spans only)                                                                      | —        |
| `--include-annotations`     | Include span annotations in the output                                                                                           | —        |
| `--include-notes`           | Include span notes in the output                                                                                                 | —        |
| `--format <format>`         | `pretty`, `json`, or `raw`                                                                                                       | `pretty` |
| `--no-progress`             | Suppress progress output                                                                                                         | —        |

```bash
# Find all ERROR spans
px span list --status-code ERROR --format raw --no-progress | jq '.[] | {name, status_code}'

# Get LLM spans with token counts
px span list --span-kind LLM --format raw --no-progress | \
  jq '.[] | {name, model: .attributes["llm.model_name"], tokens: (.attributes["llm.token_count.prompt"] + .attributes["llm.token_count.completion"])}'

# Root spans only, sorted by name
px span list --parent-id null --format raw --no-progress | jq 'sort_by(.name)'
```

---

### `px span annotate <span-id>`

Create or update a human span annotation by OpenTelemetry span ID.

```bash
px span annotate 7e2f08cb43bbf521 --name reviewer --label pass
px span annotate 7e2f08cb43bbf521 --name reviewer --score 0.9 --format raw --no-progress
px span annotate 7e2f08cb43bbf521 --name checker --score 1 --annotator-kind CODE
px span annotate 7e2f08cb43bbf521 --name reviewer --explanation "looks good"
```

---

### `px span add-note <span-id>`

Add a note to a span by OpenTelemetry span ID.

```bash
px span add-note 7e2f08cb43bbf521 --text "double-check tool output"
px span add-note 7e2f08cb43bbf521 --text "verified by agent" --format raw --no-progress
```

---

### `px dataset list`

List all datasets.

```bash
px dataset list --format raw --no-progress | jq '.[].name'
```

---

### `px dataset get <dataset-identifier>`

Fetch examples from a dataset.

```bash
px dataset get my-dataset --format raw | jq '.examples[].input'
px dataset get my-dataset --split train --split test
px dataset get my-dataset --version <version-id>
px dataset get my-dataset --file dataset.json
```

---

### `px experiment list --dataset <name-or-id>`

List experiments for a dataset.

```bash
px experiment list --dataset my-dataset --format raw --no-progress | \
  jq '.[] | {id, successful_run_count, failed_run_count}'
```

---

### `px experiment get <experiment-id>`

Fetch a single experiment with all run data (inputs, outputs, evaluations, trace IDs).

```bash
# Find failed runs
px experiment get RXhwZXJpbWVudDox --format raw --no-progress | \
  jq '.[] | select(.error != null) | {input, error}'

# Average latency
px experiment get RXhwZXJpbWVudDox --format raw --no-progress | \
  jq '[.[].latency_ms] | add / length'
```

---

### `px prompt list`

List all prompts.

```bash
px prompt list --format raw --no-progress | jq '.[].name'
```

---

### `px prompt get <prompt-identifier>`

Fetch a prompt. The `text` format is ideal for piping to AI assistants.

```bash
px prompt get my-evaluator --format text --no-progress | claude -p "Review this prompt"
px prompt get my-evaluator --tag production --format json | jq '.template'
```

| Option              | Description                        | Default  |
| ------------------- | ---------------------------------- | -------- |
| `--tag <name>`      | Get version by tag                 | —        |
| `--version <id>`    | Get specific version               | latest   |
| `--format <format>` | `pretty`, `json`, `raw`, or `text` | `pretty` |

---

### `px project list`

List all available Phoenix projects.

```bash
px project list                                           # pretty output
px project list --format raw --no-progress | jq '.[].name'
px project list --limit 5
```

| Option              | Description                         | Default  |
| ------------------- | ----------------------------------- | -------- |
| `--limit <number>`  | Maximum number of projects per page | —        |
| `--format <format>` | `pretty`, `json`, or `raw`          | `pretty` |
| `--no-progress`     | Suppress progress output            | —        |

---

### `px session list`

List sessions for a project.

```bash
px session list                                            # latest 10 sessions
px session list --limit 20 --order asc                     # oldest first
px session list --format raw --no-progress | jq '.[].session_id'
```

| Option                 | Description                 | Default  |
| ---------------------- | --------------------------- | -------- |
| `-n, --limit <number>` | Maximum number of sessions  | `10`     |
| `--order <order>`      | Sort order: `asc` or `desc` | `desc`   |
| `--format <format>`    | `pretty`, `json`, or `raw`  | `pretty` |
| `--no-progress`        | Suppress progress output    | —        |

---

### `px session get <session-id>`

View a session's conversation flow.

```bash
px session get my-session-id
px session get my-session-id --file session.json
px session get my-session-id --include-annotations --format raw | jq '.traces'
```

| Option                  | Description                            | Default  |
| ----------------------- | -------------------------------------- | -------- |
| `--file <path>`         | Save session to file instead of stdout | —        |
| `--include-annotations` | Include session annotations            | —        |
| `--format <format>`     | `pretty`, `json`, or `raw`             | `pretty` |
| `--no-progress`         | Suppress progress output               | —        |

---

### `px annotation-config list`

List annotation configurations defined in your Phoenix instance.

```bash
px annotation-config list --format raw --no-progress | jq '.[].name'
```

| Option              | Description                | Default  |
| ------------------- | -------------------------- | -------- |
| `--format <format>` | `pretty`, `json`, or `raw` | `pretty` |
| `--no-progress`     | Suppress progress output   | —        |

---

### `px auth status`

Show current Phoenix authentication status, including the configured endpoint, whether you are authenticated or anonymous, and an obscured API key.

```bash
px auth status
px auth status --endpoint http://localhost:6006
```

| Option             | Description          | Default |
| ------------------ | -------------------- | ------- |
| `--endpoint <url>` | Phoenix API endpoint | —       |
| `--api-key <key>`  | Phoenix API key      | —       |

---

### `px api graphql <query>`

Make authenticated GraphQL queries against the Phoenix API. Output is `{"data": {...}}` JSON — pipe with `jq '.data.<field>'` to extract values. Only queries are permitted; mutations and subscriptions are rejected.

```bash
px api graphql '<query>' [--endpoint <url>] [--api-key <key>]
```

Preview the exact HTTP request as `curl` without executing it:

```bash
px api graphql '{ projects { edges { node { name } } } }' --curl
px api graphql '{ projects { edges { node { name } } } }' --curl --show-token
```

`--curl` prints the equivalent request to stdout and exits without making a network call. Authorization headers are masked by default, including values supplied through `PHOENIX_API_KEY` or `PHOENIX_CLIENT_HEADERS`. Use `--show-token` only when you explicitly need the raw credential in the generated command.

Current scope and behavior:

- `--curl` is currently implemented for `px api graphql` only.
- `--curl` prints the request without executing it.
- `--show-token` is only valid with `--curl`.
- Authorization masking and header normalization are designed to match the live request behavior used by `fetch`.

Use introspection to discover what fields are available:

```bash
$ px api graphql '{ __schema { queryType { fields { name } } } }' | jq '.data.__schema.queryType.fields[].name'
"projects"
"datasets"
"prompts"
"evaluators"
"projectCount"
"datasetCount"
...

$ px api graphql '{ __type(name: "Experiment") { fields { name type { name } } } }' | \
    jq '.data.__type.fields[] | {name, type: .type.name}'
{"name":"id","type":"ID"}
{"name":"name","type":"String"}
{"name":"runCount","type":"Int"}
{"name":"errorRate","type":"Float"}
{"name":"averageRunLatencyMs","type":"Float"}
```

**Projects:**

```bash
$ px api graphql '{ projects { edges { node { name traceCount tokenCountTotal } } } }' | \
    jq '.data.projects.edges[].node'
{"name": "default", "traceCount": 1482, "tokenCountTotal": 219083}
```

**Datasets:**

```bash
$ px api graphql '{ datasets { edges { node { name exampleCount experimentCount } } } }' | \
    jq '.data.datasets.edges[].node'
{"name": "eval-golden-set", "exampleCount": 120, "experimentCount": 4}
{"name": "rag-test-cases", "exampleCount": 50, "experimentCount": 1}
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
```

**Counts at a glance:**

```bash
$ px api graphql '{ projectCount datasetCount promptCount evaluatorCount }'
{"data": {"projectCount": 1, "datasetCount": 12, "promptCount": 3, "evaluatorCount": 2}}
```

---

### `px docs fetch`

Download Phoenix documentation markdown files for use by coding agents. Fetches pages from the [llms.txt](https://arize.com/docs/phoenix/llms.txt) index, filtered by workflow category, and writes them to a local directory with auto-generated index files.

```bash
px docs fetch                                # fetch default workflows
px docs fetch --workflow tracing             # fetch only tracing docs
px docs fetch --workflow tracing --workflow evaluation
px docs fetch --dry-run                      # preview without downloading
px docs fetch --refresh                      # clear output dir and re-download
```

| Option               | Description                                                                                                                                    | Default                                                        |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `--workflow <name>`  | Filter by workflow category (repeatable). Values: `tracing`, `evaluation`, `datasets`, `prompts`, `integrations`, `sdk`, `self-hosting`, `all` | `tracing`, `evaluation`, `datasets`, `prompts`, `integrations` |
| `--output-dir <dir>` | Output directory for downloaded docs                                                                                                           | `.px/docs`                                                     |
| `--dry-run`          | Discover links only; do not write files                                                                                                        | `false`                                                        |
| `--refresh`          | Clear output directory before downloading                                                                                                      | `false`                                                        |
| `--strict`           | Fail command if any page download fails                                                                                                        | `false`                                                        |
| `--workers <n>`      | Number of concurrent download workers                                                                                                          | `10`                                                           |

---

## JSON output shape

All commands output JSON. Use `--format raw` for compact JSON and `--no-progress` to suppress stderr when piping:

```bash
px trace list --format raw --no-progress | jq ...
px dataset list --format raw --no-progress | jq ...
```

Trace JSON structure:

```json
{
  "traceId": "abc123def456",
  "status": "OK",
  "duration": 1250,
  "spans": [
    {
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
    }
  ]
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
