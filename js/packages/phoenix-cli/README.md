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

CLI flags (`--endpoint`, `--project`, `--api-key`) override environment variables. For interactive local use, `px auth login` stores an OAuth session in your active profile; the session acts with the permissions of the user who logged in. API keys take precedence when both are configured.

| Variable                                 | Description                                   |
| ---------------------------------------- | --------------------------------------------- |
| `PHOENIX_HOST`                           | Phoenix API endpoint                          |
| `PHOENIX_PROJECT`                        | Project name or ID (canonical)                |
| `PHOENIX_PROJECT_NAME`                   | Project name or ID (alias for above)          |
| `PHOENIX_API_KEY`                        | API key (if auth is enabled)                  |
| `PHOENIX_CLIENT_HEADERS`                 | Custom headers as JSON string                 |
| `PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES` | Enable CLI delete commands when set to `true` |

Delete commands are disabled by default and require `PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES=true`.

The CLI also discovers the nearest `.env.phoenix` file at or above the current
working directory. Configuration precedence is: CLI flags, process environment,
active profile, `.env.phoenix`, then built-in defaults. Credentials are resolved
as one group, so a process API key is never combined with file-provided client
headers. If a higher-priority credential is paired with `PHOENIX_HOST` from the
file, the CLI warns once and continues. Set
`PHOENIX_DISCOVER_CONFIG=false` to disable discovery.

## Profiles

A profile saves the endpoint, project, API key, and headers for a Phoenix instance under a name like `prod` or `staging`. Activate a profile and every `px` command picks up those settings without re-exporting environment variables. Environment variables and CLI flags still override the active profile, so existing scripts keep working.

```bash
px profile create prod --endpoint https://phoenix.example.com --project main \
                       --api-key sk-xxx --activate
px profile list                # all profiles, kubectl-style "current" column
px profile show                # the active profile (or pass <name>)
px profile use prod            # switch the active profile
px profile edit prod           # open in $EDITOR, validates on save
px profile delete prod         # remove a profile (--yes to skip prompt)
```

Pass `--profile <name>` to `auth login`, `auth logout`, or `auth status` to scope a single invocation to a profile other than the active one.

### Editor autocompletion via `$schema`

The CLI writes a `$schema` field automatically the first time it creates
your `settings.json`, so editors like VS Code and JetBrains validate and
autocomplete the file out of the box:

```json
{
  "$schema": "https://raw.githubusercontent.com/Arize-ai/phoenix/main/schemas/phoenix-cli-settings.json",
  "activeProfile": "prod",
  "profiles": { ... }
}
```

If you remove the line by hand, the CLI won't add it back. The schema
lives at `schemas/phoenix-cli-settings.json` in the Phoenix repository
and tracks the published Zod schema. The pointer is currently pinned to
`main`; we'll switch to a SchemaStore entry once registered.

For VS Code project-wide association add to `.vscode/settings.json`:

```json
{
  "json.schemas": [
    {
      "fileMatch": ["settings.json"],
      "url": "https://raw.githubusercontent.com/Arize-ai/phoenix/main/schemas/phoenix-cli-settings.json"
    }
  ]
}
```

## Commands

### `pxi`

Open **PXI** (Phoenix Intelligence), an interactive terminal chat with the Phoenix
agent. It connects to a running Phoenix instance and is the same server-side agent
that powers the in-browser assistant — investigate failing traces, iterate on
prompts, and drive Phoenix from your terminal.

```bash
pxi                                                          # uses PHOENIX_HOST / PHOENIX_API_KEY
pxi --endpoint http://localhost:6006 --provider OPENAI --model gpt-5.4
npx -y @arizeai/phoenix-cli pxi                              # run without installing
```

Inside the chat, `/help`, `/clear`, and `/exit` are handled locally. See the
[PXI documentation](https://arize.com/docs/phoenix/pxi) for the full flag and
slash-command reference, model setup, and privacy controls.

---

### `px setup`

Wire your app up to Phoenix. Run it from the app root:

```bash
px setup                                          # interactive
px setup --endpoint https://phoenix.example.com   # skip the endpoint prompt
npx -y @arizeai/phoenix-cli setup                 # try without installing
```

Setup saves the connection to a gitignored `.env.phoenix`, then optionally
hands a coding agent (Claude Code, Codex, Cursor, OpenCode) an instrumentation
task and waits until a real trace appears. After that it can point `px` at the
new project and install Phoenix skills so the agent can query what you captured.

Along the way it offers to connect the Phoenix docs MCP server to the agent
doing the hand-off — through the agent's own CLI where it has one (`claude mcp
add`), else its per-project config file (`.cursor/mcp.json`, `opencode.json`).
Taking the offer skips the `.px/docs` download entirely — the agent searches
the docs on demand instead, which is faster to set up and cheaper in tokens.
Any failure falls back to the download. Pass `--docs-mcp` to take the offer
without being asked, `--no-docs-mcp` to never ask.

For CI or agents, pass flags instead of answering prompts:

```bash
# Connection only — write .env.phoenix, no source changes
px setup --no-input --endpoint http://localhost:6006 --project my-app

# Instrument too — requires --agent when there's no TTY to choose one
px setup --no-input --instrument --agent claude --yolo --language python --format raw

# Same, but connect the docs MCP instead of downloading the docs
px setup --no-input --instrument --agent claude --yolo --docs-mcp --format raw
```

Re-run pieces later with:

```bash
px setup instrument --agent codex   # instrument and verify again
px setup skills                     # install coding-agent skills only
```

#### `px setup mcp`

Register the Phoenix **remote MCP server** (`<endpoint>/mcp`) with a coding
agent, so the agent can search, query, and operate on your Phoenix data. The
endpoint is inferred from `--endpoint`, the active profile, or `PHOENIX_HOST` —
you never re-type it.

```bash
px setup mcp                        # pick scope (global default) + agent, interactively
px setup mcp --agent codex          # configure one agent
px setup mcp --agent claude --local # write this repo's config (.mcp.json)
```

Supported agents: `claude`, `codex`, `gemini`, `cursor`, `opencode`, `vscode`.
Where an agent ships an `mcp add` (Claude, Codex, Gemini, VS Code global) the
CLI drives it; the rest get a merge into their config file (`~/.cursor/mcp.json`,
`~/.config/opencode/opencode.json`, `.vscode/mcp.json`). Scope is `--global`
(user-wide, the default) or `--local` (this repo — Codex is global-only).

Auth defaults to **OAuth**: the config is URL-only and the agent opens Phoenix's
browser login on first use. For headless clients, pass an API-key bearer header
with `--header` (repeatable):

```bash
px setup mcp --agent codex --no-input --format raw
px setup mcp --agent claude --header 'Authorization: Bearer ${PHOENIX_API_KEY}'
```

---

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
| `--include-annotations`     | Include trace and span annotations     | —        |
| `--include-notes`           | Include trace and span notes           | —        |

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
px trace get abc123def456 --include-notes --format raw | jq '{traceNotes: .notes, spanNotes: [.spans[].notes]}'
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

### `px trace add-note <trace-id>`

Add a note to a trace by OpenTelemetry trace ID.

```bash
px trace add-note abc123def456 --text "needs follow-up"
px trace add-note abc123def456 --text "agent triage complete" --format raw --no-progress
```

---

### `px trace-annotations delete`

Delete trace annotations for the configured project. Requires `--all` (delete every matching row) **or** both `--start-time` and `--end-time` to bound the delete to a `[start_time, end_time)` window — `--name`, `--identifier`, and `--annotator-kind` are narrowing filters and never authorize the request on their own. Deletes are disabled by default; set `PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES=true` first.

```bash
px trace-annotations delete --identifier "$PHOENIX_CODING_IDENTIFIER" --all -y
px trace-annotations delete --identifier "$PHOENIX_CODING_IDENTIFIER" --all -y --format raw --no-progress
px trace-annotations delete --start-time 2026-01-01T00:00:00Z --end-time 2026-01-02T00:00:00Z -y
```

Output (json/raw): `{ deleted: true, target: "trace", filter: { identifier?, name?, annotator_kind?, start_time?, end_time?, all? } }`.

---

### `px span list [file]`

Fetch spans for the configured project with filtering options. Output is JSON.

```bash
px span list --limit 50                                    # stdout (pretty)
px span list --span-kind LLM --limit 20                    # only LLM spans
px span list --status-code ERROR --format raw --no-progress # pipe-friendly error spans
px span list --name chat_completion --trace-id abc123       # filter by name and trace
px span list --span-id abc123 def456                        # fetch specific spans by ID
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
| `--span-id <ids...>`        | Filter by OpenTelemetry span ID(s). Requires Phoenix server >= 19.6.0.                                                           | —        |
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

### `px span-annotations delete`

Delete span annotations for the configured project. Same authorization gate as `px trace-annotations delete` — requires `--all` or both `--start-time` and `--end-time`.

```bash
px span-annotations delete --identifier "$PHOENIX_CODING_IDENTIFIER" --all -y
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

### `px project get <name>`

Fetch a single Phoenix project by exact name. Output is a single record (not an array) — JSON and raw modes emit a bare object. On a name miss, exits with `ExitCode.FAILURE` (1) and writes a `StructuredError` JSON envelope to stderr in `--format json|raw`.

```bash
px project get my-project
px project get my-project --format raw --no-progress | jq -r '.id'
px project get my-project --format json
```

| Option              | Description                         | Default  |
| ------------------- | ----------------------------------- | -------- |
| `--format <format>` | `pretty`, `json`, or `raw`          | `pretty` |
| `--limit <number>`  | Page size for the underlying lookup | `100`    |
| `--no-progress`     | Suppress progress output            | —        |

Miss-case stderr (raw): `{"error":"Project 'foo' not found","code":"FAILURE","hint":"px project list --format raw"}`.

---

### `px session list`

List sessions for a project.

```bash
px session list                                            # latest 10 sessions
px session list --limit 20 --order asc                     # oldest first
px session list --format raw --no-progress | jq '.[].session_id'
px session list --include-annotations --include-notes --format raw | jq '.[].notes'
```

| Option                  | Description                                  | Default  |
| ----------------------- | -------------------------------------------- | -------- |
| `-n, --limit <number>`  | Maximum number of sessions                   | `10`     |
| `--order <order>`       | Sort order: `asc` or `desc`                  | `desc`   |
| `--include-annotations` | Include session annotations, excluding notes | —        |
| `--include-notes`       | Include session notes when present           | —        |
| `--format <format>`     | `pretty`, `json`, or `raw`                   | `pretty` |
| `--no-progress`         | Suppress progress output                     | —        |

---

### `px session get <session-id>`

View a session's conversation flow.

```bash
px session get my-session-id
px session get my-session-id --file session.json
px session get my-session-id --include-annotations --format raw | jq '.session.annotations'
px session get my-session-id --include-notes --format raw | jq '.session.notes'
```

| Option                  | Description                                  | Default  |
| ----------------------- | -------------------------------------------- | -------- |
| `--file <path>`         | Save session to file instead of stdout       | —        |
| `--include-annotations` | Include session annotations, excluding notes | —        |
| `--include-notes`       | Include session notes when present           | —        |
| `--format <format>`     | `pretty`, `json`, or `raw`                   | `pretty` |
| `--no-progress`         | Suppress progress output                     | —        |

---

### `px session annotate <session-id>`

Create or update a human session annotation by GlobalID or user-provided `session_id`.

```bash
px session annotate my-session-id --name reviewer --label pass
px session annotate my-session-id --name reviewer --score 0.9 --format raw --no-progress
px session annotate my-session-id --name evaluator --label pass --annotator-kind LLM
px session annotate my-session-id --name reviewer --explanation "needs follow-up"
```

---

### `px session add-note <session-id>`

Add a note to a session by GlobalID or user-provided `session_id`. Requires Phoenix server `14.17.0` or newer.

```bash
px session add-note my-session-id --text "needs follow-up"
px session add-note my-session-id --text "agent triage complete" --format raw --no-progress
```

---

### `px session-annotations delete`

Delete session annotations for the configured project. Same authorization gate as the trace/span equivalents — requires `--all` or both `--start-time` and `--end-time`.

```bash
px session-annotations delete --identifier "$PHOENIX_CODING_IDENTIFIER" --all -y
```

---

Annotation configs come in three types — `CATEGORICAL` (a fixed set of labels, each with an optional numeric score), `CONTINUOUS` (a numeric range), and `FREEFORM` (free text). The `create`, `get`, `update`, and `delete` commands round out full CRUD alongside `list`.

#### Specifying categorical values

`create` and `update` accept categorical labels the same way, so you only learn it once. Prefer the repeatable, shell-friendly flag; the JSON form is a bulk/agent alternative.

```bash
# Repeatable flag: label with an optional score (label=score, or just label)
--value good=1 --value bad=0 --value needs-review

# JSON payload (handy for agents or large label sets)
--values '[{"label":"good","score":1},{"label":"bad","score":0}]'
```

The two forms are mutually exclusive — pass one or the other, not both.

---

### `px annotation-config list`

List annotation configurations defined in your Phoenix instance.

```bash
# Show all annotation configs as a table
px annotation-config list

# Extract config names as JSON (agent-friendly)
px annotation-config list --format raw --no-progress | jq -r '.[].name'

# Fetch at most 10 configs
px annotation-config list --limit 10
```

| Option              | Description                | Default  |
| ------------------- | -------------------------- | -------- |
| `--format <format>` | `pretty`, `json`, or `raw` | `pretty` |
| `--no-progress`     | Suppress progress output   | —        |

---

### `px annotation-config get <config-identifier>`

Fetch a single annotation configuration by name or ID. The config is written to stdout in the selected `--format` (a single object for `raw`/`json`).

```bash
# Look up a config by name
px annotation-config get response-quality

# Resolve a config name to its ID (agent-friendly)
px annotation-config get response-quality --format raw --no-progress | jq -r '.id'

# Inspect the labels of a categorical config
px annotation-config get response-quality --format raw --no-progress | jq '.values'
```

| Option              | Description                | Default  |
| ------------------- | -------------------------- | -------- |
| `--format <format>` | `pretty`, `json`, or `raw` | `pretty` |
| `--no-progress`     | Suppress progress output   | —        |

---

### `px annotation-config create`

Create a new annotation configuration via `POST /v1/annotation_configs`. The created config is written to stdout in the selected `--format`.

```bash
# Pass/fail quality rating with scored labels (higher is better)
px annotation-config create --type CATEGORICAL --name response-quality \
  --value good=1 --value bad=0 --optimization-direction MAXIMIZE

# Sentiment labels without scores
px annotation-config create --type CATEGORICAL --name sentiment \
  --value positive --value neutral --value negative

# Confidence score between 0 and 1
px annotation-config create --type CONTINUOUS --name confidence --lower-bound 0 --upper-bound 1

# Free-text feedback from human reviewers
px annotation-config create --type FREEFORM --name reviewer-notes --description 'Free-form reviewer feedback'

# Create from a JSON payload and capture the new config ID (agent-friendly)
px annotation-config create --type CATEGORICAL --name response-quality \
  --values '[{"label":"good","score":1},{"label":"bad","score":0}]' \
  --format raw --no-progress | jq -r '.id'
```

| Option                           | Description                                           | Default  |
| -------------------------------- | ----------------------------------------------------- | -------- |
| `--type <type>`                  | `CATEGORICAL`, `CONTINUOUS`, or `FREEFORM` (required) | —        |
| `--name <name>`                  | Annotation config name (required)                     | —        |
| `--description <description>`    | Description                                           | —        |
| `--optimization-direction <dir>` | `MINIMIZE`, `MAXIMIZE`, or `NONE`                     | `NONE`   |
| `--value <label[=score]>`        | Categorical label (repeatable; CATEGORICAL configs)   | —        |
| `--values <json>`                | Categorical values as JSON (CATEGORICAL configs)      | —        |
| `--lower-bound <number>`         | Lower bound (CONTINUOUS/FREEFORM configs)             | —        |
| `--upper-bound <number>`         | Upper bound (CONTINUOUS/FREEFORM configs)             | —        |
| `--threshold <number>`           | Threshold (FREEFORM configs)                          | —        |
| `--format <format>`              | `pretty`, `json`, or `raw`                            | `pretty` |
| `--no-progress`                  | Suppress progress output                              | —        |

`--type` and `--name` are required; a `CATEGORICAL` config also requires at least one value. `--type` and `--optimization-direction` are case-insensitive. Invalid input — including flags that don't apply to the chosen type — exits with `INVALID_ARGUMENT`.

---

### `px annotation-config update <config-identifier>`

Update an annotation configuration by name or ID. Only the fields you pass are changed — the command fetches the existing config, merges your flags, and writes the result back via `PUT /v1/annotation_configs/{id}`. The config `type` is immutable; to change it, delete and recreate the config. The updated config is written to stdout in the selected `--format`.

```bash
# Change only the description; every other field is preserved
px annotation-config update response-quality --description 'Pass/fail rating from human review'

# Rename a config and set its optimization direction
px annotation-config update response-quality --name answer-quality --optimization-direction MAXIMIZE

# Replace the label set of a categorical config
px annotation-config update response-quality --value good=1 --value acceptable=0.5 --value bad=0

# Widen the range of a continuous config
px annotation-config update confidence --lower-bound -1 --upper-bound 1

# Update and capture the config ID (agent-friendly)
px annotation-config update response-quality --description 'Updated' --format raw --no-progress | jq -r '.id'
```

| Option                           | Description                                         | Default  |
| -------------------------------- | --------------------------------------------------- | -------- |
| `--name <name>`                  | New name                                            | —        |
| `--description <description>`    | New description                                     | —        |
| `--optimization-direction <dir>` | `MINIMIZE`, `MAXIMIZE`, or `NONE`                   | —        |
| `--value <label[=score]>`        | Categorical label (repeatable; CATEGORICAL configs) | —        |
| `--values <json>`                | Categorical values as JSON (CATEGORICAL configs)    | —        |
| `--lower-bound <number>`         | Lower bound (CONTINUOUS/FREEFORM configs)           | —        |
| `--upper-bound <number>`         | Upper bound (CONTINUOUS/FREEFORM configs)           | —        |
| `--threshold <number>`           | Threshold (FREEFORM configs)                        | —        |
| `--format <format>`              | `pretty`, `json`, or `raw`                          | `pretty` |
| `--no-progress`                  | Suppress progress output                            | —        |

At least one field flag is required. Invalid input — including flags that don't apply to the config's type (e.g. `--value` on a continuous config) — exits with `INVALID_ARGUMENT`.

---

### `px annotation-config delete <config-id>`

Delete an annotation configuration by ID. Like all delete commands, this is disabled unless `PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES=true` is set, and prompts for confirmation unless `--yes` is passed.

```bash
# Delete with an interactive confirmation prompt
px annotation-config delete QW5ub3RhdGlvbkNvbmZpZzoxMjM=

# Skip the confirmation prompt (for scripts and agents)
px annotation-config delete QW5ub3RhdGlvbkNvbmZpZzoxMjM= --yes

# Resolve a name to its ID, then delete it
px annotation-config get response-quality --format raw --no-progress | jq -r '.id' | xargs px annotation-config delete --yes
```

| Option          | Description              | Default |
| --------------- | ------------------------ | ------- |
| `-y, --yes`     | Skip confirmation prompt | —       |
| `--no-progress` | Suppress progress output | —       |

---

### `px auth login`

Log in with the browser-based OAuth flow and store tokens on the selected profile. The URL is always printed to stderr, so SSH and headless users can open it manually. OAuth CLI sessions act with the permissions of the user who logged in.

The CLI refreshes expiring access tokens automatically for REST, GraphQL, and
PXI requests. A request rejected with `401` triggers one refresh and retry;
rotated tokens are persisted back to the selected profile.

```bash
px auth login
px auth login --no-browser
px auth login --profile staging --format raw
```

| Option              | Description                            | Default  |
| ------------------- | -------------------------------------- | -------- |
| `--endpoint <url>`  | Phoenix API endpoint                   | —        |
| `--api-key <key>`   | Phoenix API key                        | —        |
| `--profile <name>`  | Profile to store OAuth tokens in       | active   |
| `--no-browser`      | Print URL without opening a browser    | —        |
| `--no-input`        | Do not prompt for pasted redirect URLs | —        |
| `--format <format>` | `pretty`, `json`, or `raw`             | `pretty` |

### `px auth logout`

Clear OAuth tokens from the selected profile. Logout best-effort revokes the refresh token on the server and leaves any configured API key untouched.

```bash
px auth logout
px auth logout --profile staging
px auth logout --format raw
```

### `px auth status`

Show current Phoenix authentication status, including the configured endpoint, credential source, identity, and OAuth access level/expiry when applicable.

```bash
px auth status
px auth status --endpoint http://localhost:6006
px auth status --profile staging --format raw
```

| Option              | Description                | Default  |
| ------------------- | -------------------------- | -------- |
| `--endpoint <url>`  | Phoenix API endpoint       | —        |
| `--api-key <key>`   | Phoenix API key            | —        |
| `--profile <name>`  | Profile to use             | active   |
| `--format <format>` | `pretty`, `json`, or `raw` | `pretty` |

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
- 💼 [LinkedIn](https://www.linkedin.com/showcase/113218220)
