---
name: phoenix-cli
description: Debug LLM applications using the Phoenix CLI. Fetch traces, analyze errors, structure trace review with open coding and axial coding, inspect datasets, review experiments, query annotation configs, and use the GraphQL API. Use whenever the user is analyzing traces or spans, investigating LLM/agent failures, deciding what to do after instrumenting an app, building failure taxonomies, choosing what evals to write, or asking "what's going wrong", "what kinds of mistakes", or "where do I focus" — even without naming a technique.
license: Apache-2.0
compatibility: Requires Node.js (for npx) or global install of @arizeai/phoenix-cli. Optionally requires jq for JSON processing.
metadata:
  author: arize-ai
  version: "3.3.0"
---

# Phoenix CLI

## Invocation

```bash
px <resource> <action>                          # if installed globally
npx @arizeai/phoenix-cli <resource> <action>    # no install required
```

The CLI uses singular resource commands with subcommands like `list` and `get`:

```bash
px trace list
px trace get <trace-id>
px trace annotate <trace-id>
px trace add-note <trace-id>
px trace delete <trace-identifier>
px trace-annotations delete
px span list
px span annotate <span-id>
px span add-note <span-id>
px span delete <span-identifier>
px span-annotations delete
px session list
px session get <session-id>
px session annotate <session-id>
px session add-note <session-id>
px session delete <session-id>
px session-annotations delete
px dataset list
px dataset get <name>
px dataset delete <dataset-identifier>
px experiment list
px experiment get <id>
px experiment delete <experiment-id>
px prompt list
px prompt get <prompt-identifier>
px prompt delete <prompt-identifier>
px project list
px project get <name>
px project delete <project-identifier>
px annotation-config list
px annotation-config get <identifier>
px annotation-config create
px annotation-config update <identifier>
px annotation-config delete <id>
px auth login
px auth logout
px auth status
px profile list
px profile show [name]
px profile create <name>
px profile use <name>
px profile edit <name>
px profile delete <name>
px api graphql <query>
px docs fetch
px setup
px self update
```

Every `delete` above is gated: it requires
`PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES=true` in the environment and prompts for
confirmation unless `-y`/`--yes` is passed (`px profile delete` is local-only and
takes `--yes` without the env gate). Without the env var the command exits
without deleting anything.

## Setup

```bash
export PHOENIX_ENDPOINT=http://localhost:6006
export PHOENIX_PROJECT=my-project
export PHOENIX_API_KEY=your-api-key  # if auth is enabled
```

`PHOENIX_ENDPOINT` is the base URL for API access. It usually holds the same URL as `PHOENIX_COLLECTOR_ENDPOINT`; when only the collector variable is set, the CLI uses it for API access too.

For interactive local use, `px auth login` stores an OAuth session in the selected profile; the session acts with the permissions of the user who logged in. API keys take precedence over OAuth tokens when both are configured.
OAuth access tokens are refreshed automatically for REST, GraphQL, and PXI
requests, and rotated tokens are persisted to the selected profile.

Always use `--format raw --no-progress` when piping to `jq`.

### `px setup` — onboarding

`px setup` connects the app in the current directory to a Phoenix deployment
and writes `.env.phoenix` (mode 0600, gitignored). The interactive flow is for
humans — it prompts, launches coding agents, and polls for traces. **From an
agent, always pass `--no-input`:**

```bash
# Register only: connection + .env.phoenix, no source changes.
px setup --no-input --endpoint http://localhost:6006 --project my-app --format raw
```

Headless requires a clean git repo and, by default, stops after writing the
files — it will not touch source unless you ask. If auth is enabled, also set
`PHOENIX_API_KEY`. The project doesn't need to exist — Phoenix creates it on
first trace. Missing inputs exit `3` with exact remediation; cancel exits `2`.

To also instrument the app, name the lane — headless has no prompt to pick one
from, so `--instrument` requires `--agent`:

```bash
px setup --no-input --instrument --agent claude --yolo --format raw
```

`--yolo` matters: a background agent has no terminal to approve its edits on,
so without it the run stalls until trace verification times out. `--language
python` skips the agent's language detection. `--docs-mcp` connects the
Phoenix docs MCP server to the hand-off agent (`claude mcp add` for claude,
config-file merge for cursor/opencode; codex unsupported) and skips the
`.px/docs` download — the agent searches docs on demand instead; any failure
falls back to the download. `--no-docs-mcp` suppresses the interactive offer.
`--format raw` prints
`{"endpoint","project","files","instrumentation","tracesVerified","tracesUrl"}`
— check `tracesVerified`, which is set only when the API confirmed a trace
arriving, not when the agent claims it finished.

A run whose wait ran out with no trace exits `6`, not `0`: the configuration and
edits are real, but tracing is not confirmed working. Treat that as a failure to
report, not a success — and do not substitute the hand-off agent's own exit code
or summary for the verdict. Registering without `--instrument`, and a human
answering "verify later" at the timeout prompt, both exit `0`.

`tracesVerified` is `false` for a registration-only run too, so it alone can't
tell "nothing to verify" from "no trace arrived". Read `verification`
(`verified` / `notVerified` / `deferred`, absent when there was nothing to
verify) when you need the difference.

Re-runnable slices, so an already-registered repo skips the questions:

```bash
px setup instrument --agent claude   # instrument + verify only
px setup skills                      # install the Phoenix coding-agent skills
```

### `px setup mcp` — register the remote MCP server

Wire the Phoenix remote MCP server (`<endpoint>/mcp`) into a coding agent so it
can query Phoenix data. The endpoint is inferred from `--endpoint`, the active
profile, or `PHOENIX_ENDPOINT`. Bare command prompts for scope (global default) then
agent; `--agent` skips both prompts.

```bash
px setup mcp --agent codex --no-input --format raw
px setup mcp --agent claude --local            # write this repo's .mcp.json
```

Agents: `claude`, `codex`, `gemini`, `cursor`, `opencode`, `vscode`. Scope is
`--global` (default) or `--local` (repo; Codex is global-only). Auth is OAuth by
default (URL-only config, browser login on first use); pass `--header "Name:
value"` (repeatable) for an API-key bearer fallback — for Codex a
`Authorization: Bearer ${VAR}` header becomes `bearer_token_env_var`. `--format
raw` prints `{"endpoint","url","serverName","agent","scope","auth","file?"}`.

## Quick Reference

| Task | Files |
| ---- | ----- |
| Look at sampled traces, spans, or sessions and write specific notes about what went wrong (no taxonomy yet) | [references/open-coding](references/open-coding.md) |
| Group those notes into a structured failure taxonomy and quantify what matters | [references/axial-coding](references/axial-coding.md) |

Both stages tag every artifact with one shared **coding annotation identifier** (descriptive shape, e.g. `coding-run:chatbot-context-loss-2026-05-06`) so the run is queryable, reversible, and viewable as a unit. Pass `--identifier <value>` explicitly on every `px` call — shell inheritance is unreliable across agent harnesses. Open coding writes notes via `px ... add-note` and records a small local JSONL sidecar at `.px/coding/<sanitized-identifier>.jsonl`; axial coding reads that sidecar as the deterministic handoff and records labels in `.px/coding/<sanitized-identifier>-axial.jsonl`. Pick the identifier once per run (see [references/open-coding.md](references/open-coding.md#coding-annotation-identifier-pick-this-first)), then share the Phoenix UI link from the wrap-up section. Revert is opt-in and runs three identifier-bound DELETEs only after explicit user confirmation.

> **Workflow term vs. server annotation name.** The skill prose calls this value the **coding annotation identifier** (shell-variable hint: `CODING_ANNOTATION_IDENTIFIER`). The server-side annotation NAME used for the UI filter is unchanged — `coding_session_id` — for data compatibility with rows already written by previous runs. Don't try to rename the server-side annotation; treat the asymmetry as load-bearing.

## Workflows

**"What do I do after instrumenting?" / "Where do I focus?" / "What's going wrong?"**
[open-coding](references/open-coding.md) → [axial-coding](references/axial-coding.md) → build evals for the top categories.

## Reference Categories

| Prefix | Description |
| ------ | ----------- |
| `references/open-coding` | Free-form notes against sampled traces, spans, or sessions — reach for it whenever the user wants to make sense of LLM traffic but has no failure categories yet. Includes a unit-of-analysis diagnostic so the workflow runs at the level the failure modes actually live at (trace for stateless single-shot calls, session for multi-turn agents, span for mechanical/in-isolation failures). |
| `references/axial-coding` | Inductive grouping of notes into a MECE taxonomy with counts — reach for it whenever the user has observations and needs categories or eval targets |

## Auth

```bash
px auth login                                 # browser-based OAuth login
px auth login --no-browser                    # print URL for SSH/headless use
px auth logout                                # clear OAuth tokens; leaves API keys
px auth status                                # check connection and authentication
px auth status --endpoint http://other:6006   # check a specific endpoint
px auth status --profile staging              # check a named profile's connection
px auth status --format raw                   # machine-readable credential source
```

`auth status` reports the credential source (`flag`, `env`, `profile-key`, `oauth`, or `none`). OAuth status includes the token expiry.

When the stored credential source is `oauth` and the authenticated probe fails,
`auth status` retries once without credentials and reports anonymous access only
if the server explicitly says access is anonymous. This keeps a stale or expired
profile token from being reported as an auth failure against a deployment that
has since switched from OAuth to anonymous access.

## Profiles

Named profiles let you switch between multiple Phoenix instances (local, staging, cloud) without juggling environment variables. Profiles are stored in `~/.px/settings.json` (or `$XDG_CONFIG_HOME/px/settings.json`).

Configuration priority (highest to lowest): CLI flags > env vars > active profile > nearest `.env.phoenix` file > built-in defaults.

The CLI also discovers the nearest `.env.phoenix` file at or above the current working directory (the same file `px setup` writes). Credentials are resolved as one group, so a process API key is never combined with file-provided headers. Set `PHOENIX_DISCOVER_CONFIG=false` to disable discovery.

```bash
px profile list                              # list all profiles (shows active profile)
px profile show                              # show the active profile's settings
px profile show staging                      # show a named profile's settings
px profile create prod --endpoint https://app.phoenix.arize.com --api-key <key> --activate
px profile create local --endpoint http://localhost:6006 --project my-app
px profile use prod                          # switch the active profile
px profile edit prod                         # open profile JSON in $EDITOR (validates on save)
px profile delete prod --yes                 # delete a profile (--yes skips confirmation)
```

Use `--profile <name>` on any command to target a specific profile without changing the active one:

```bash
px trace list --profile staging --limit 10 --format raw --no-progress | jq .
px auth status --profile prod
```

`px profile create` options: `--endpoint <url>`, `--project <name>`, `--api-key <key>`, `--header <key=value>` (repeatable), `--activate`.

## Projects

```bash
px project list                                            # list all projects (table view)
px project list --format raw --no-progress | jq '.[].name' # project names as JSON
px project list --name-contains prod                       # filter by name substring (case-insensitive)
px project get my-project --format raw --no-progress       # single record by exact name
px project get my-project --format raw --no-progress | jq -r '.id'  # extract project id
```

`project list` accepts `--limit <n>` (projects fetched per page) and
`--name-contains <filter>`, which filters server-side on a case-insensitive name
substring. Use it instead of piping `list` through `grep` when you only know part
of a project's name.

`project get` exits with `ExitCode.FAILURE` (1) on a name miss and writes a `StructuredError` `{error, code: "FAILURE", hint}` to stderr in `--format json|raw`.

## Traces

```bash
px trace list --limit 20 --format raw --no-progress | jq .
px trace list --last-n-minutes 60 --limit 20 --format raw --no-progress | jq '.[] | select(.status == "ERROR")'
px trace list --since 2025-01-15T00:00:00Z --limit 50 --format raw --no-progress | jq .
px trace list --since 2025-01-15T00:00:00Z --until 2025-01-16T00:00:00Z --limit 50 --format raw --no-progress | jq .  # time range (until is exclusive)
px trace list --format raw --no-progress | jq 'sort_by(-.duration) | .[0:5]'
px trace list --include-notes --format raw --no-progress | jq '.[].notes'
px trace get <trace-id> --format raw | jq .
px trace get <trace-id> --format raw | jq '.spans[] | select(.status_code != "OK")'
px trace get <trace-id> --include-notes --format raw | jq '.notes'
px trace annotate <trace-id> --name reviewer --label pass
px trace annotate <trace-id> --name reviewer --score 0.9 --format raw --no-progress
px trace annotate <trace-id> --name reviewer --label pass --identifier "<coding-annotation-id>"  # tag with a coding annotation identifier
px trace add-note <trace-id> --text "needs follow-up"
px trace add-note <trace-id> --text "needs follow-up" --identifier "<coding-annotation-id>"  # tag + upsert on identifier
px trace-annotations delete --identifier "<coding-annotation-id>" --all -y            # nuke every annotation tied to this coding annotation identifier
```

`px <entity>-annotations delete` requires `--all` or both `--start-time` and `--end-time` and emits `{deleted: true, target, filter}` on success.

### Trace JSON shape

```
Trace
  traceId, status ("OK"|"ERROR"), duration (ms), startTime, endTime
  annotations[] (with --include-annotations, excludes note)
    name, result { score, label, explanation }
  notes[] (with --include-notes)
    name="note", result { explanation }
  rootSpan  — top-level span (parent_id: null)
  spans[]
    name, span_kind ("LLM"|"CHAIN"|"TOOL"|"RETRIEVER"|"EMBEDDING"|"AGENT"|"RERANKER"|"GUARDRAIL"|"EVALUATOR"|"UNKNOWN")
    status_code ("OK"|"ERROR"|"UNSET"), parent_id, context.span_id
    notes[] (with --include-notes)
      name="note", result { explanation }
    attributes
      input.value, output.value          — raw input/output
      llm.model_name, llm.provider
      llm.token_count.prompt/completion/total
      llm.token_count.prompt_details.cache_read
      llm.token_count.completion_details.reasoning
      llm.input_messages.{N}.message.role/content
      llm.output_messages.{N}.message.role/content
      llm.invocation_parameters          — JSON string (temperature, etc.)
      exception.message                  — set if span errored
```

## Spans

```bash
px span list --limit 20                                    # recent spans (table view)
px span list --last-n-minutes 60 --limit 50                # spans from last hour
px span list --since 2025-01-15T00:00:00Z --limit 50       # spans since a timestamp
px span list --since 2025-01-15T00:00:00Z --until 2025-01-16T00:00:00Z --limit 50  # time range (until is exclusive)
px span list --span-kind LLM --limit 10                    # only LLM spans
px span list --status-code ERROR --limit 20                # only errored spans
px span list --name chat_completion --limit 10             # filter by span name
px span list --trace-id <id> --format raw --no-progress | jq .   # all spans for a trace
px span list --span-id <id> <id> --format raw --no-progress | jq .  # fetch specific spans by ID (server >= 19.6.0)
px span list --parent-id null --limit 10                   # only root spans
px span list --parent-id <span-id> --limit 10              # only children of a span
px span list --include-annotations --limit 10              # include annotation scores
px span list --include-notes --limit 10                    # include span notes
px span list --attribute llm.model_name:gpt-4 --limit 10  # filter by string attribute
px span list --attribute llm.token_count.total:500 --limit 10  # filter by numeric attribute
px span list --attribute 'user.id:"12345"' --limit 10     # force string match for numeric-looking value
px span list --attribute session.id:sess:abc:123 --limit 20  # colon in value OK (split on first colon only)
px span list --attribute llm.model_name:gpt-4 --attribute session.id:abc --limit 10  # AND multiple filters
px span list output.json --limit 100                       # save to JSON file
px span list --format raw --no-progress | jq '.[] | select(.status_code == "ERROR")'
px span annotate <span-id> --name reviewer --label pass
px span annotate <span-id> --name checker --score 1 --annotator-kind CODE
px span annotate <span-id> --name reviewer --label pass --identifier "<coding-annotation-id>"  # tag with a coding annotation identifier
px span add-note <span-id> --text "verified by agent"
px span add-note <span-id> --text "verified by agent" --identifier "<coding-annotation-id>"  # tag + upsert on identifier
px span-annotations delete --identifier "<coding-annotation-id>" --all -y           # nuke every annotation tied to this coding annotation identifier
```

### Span JSON shape

```
Span
  name, span_kind ("LLM"|"CHAIN"|"TOOL"|"RETRIEVER"|"EMBEDDING"|"AGENT"|"RERANKER"|"GUARDRAIL"|"EVALUATOR"|"UNKNOWN")
  status_code ("OK"|"ERROR"|"UNSET"), status_message
  context.span_id, context.trace_id, parent_id
  start_time, end_time
  attributes
    input.value, output.value          — raw input/output
    llm.model_name, llm.provider
    llm.token_count.prompt/completion/total
    llm.input_messages.{N}.message.role/content
    llm.output_messages.{N}.message.role/content
    llm.invocation_parameters          — JSON string (temperature, etc.)
    exception.message                  — set if span errored
  annotations[] (with --include-annotations, excludes note)
    name, result { score, label, explanation }
  notes[] (with --include-notes)
    name="note", result { explanation }
```

## Sessions

```bash
px session list --limit 10 --format raw --no-progress | jq .
px session list --order asc --format raw --no-progress | jq '.[].session_id'
px session list --include-annotations --include-notes --format raw --no-progress | jq '.[].notes'
px session get <session-id> --format raw | jq .
px session get <session-id> --include-annotations --format raw | jq '.session.annotations'
px session get <session-id> --include-notes --format raw | jq '.session.notes'
px session annotate <session-id> --name reviewer --label pass
px session annotate <session-id> --name reviewer --score 0.9 --format raw --no-progress
px session annotate <session-id> --name reviewer --label pass --identifier "<coding-annotation-id>"  # tag with a coding annotation identifier
px session add-note <session-id> --text "verified by agent"
px session add-note <session-id> --text "verified by agent" --identifier "<coding-annotation-id>"  # tag + upsert on identifier
px session-annotations delete --identifier "<coding-annotation-id>" --all -y              # nuke every annotation tied to this coding annotation identifier
px session delete <session-id> -y                                                        # requires PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES=true
```

`session list` has no filter flag. To select sessions by shape — error counts,
token totals, tool use, annotation labels — use the session filter expression
language through GraphQL (see [Session filter expressions](#session-filter-expressions)).

### Session JSON shape

```
SessionData
  id, session_id, project_id
  start_time, end_time
  token_count_prompt, token_count_completion, token_count_total  — cumulative across all LLM spans in the session (int, default 0)
  annotations[] (with --include-annotations, excludes note)
    name, result { score, label, explanation }
  notes[] (with --include-notes)
    name="note", result { explanation }
  traces[]
    id, trace_id, start_time, end_time
```

## Datasets / Experiments / Prompts

```bash
px dataset list --format raw --no-progress | jq '.[].name'
px dataset get <name> --format raw | jq '.examples[] | {input, output: .expected_output}'
px dataset get <name> --split train --format raw | jq .    # filter by split
px dataset get <name> --version <version-id> --format raw | jq .
px experiment list --dataset <name> --format raw --no-progress | jq '.[] | {id, name, failed_run_count}'
px experiment get <id> --format raw --no-progress | jq '.[] | select(.error != null) | {input, error}'
px prompt list --format raw --no-progress | jq '.[].name'
px prompt get <name> --format text --no-progress   # plain text, ideal for piping to AI
```

## Annotation Configs

Full CRUD: `list`, `get`, `create`, `update`, `delete`. Types are `CATEGORICAL` (labels + optional scores), `CONTINUOUS` (numeric range), `FREEFORM` (free text).

```bash
px annotation-config list                                                # all configs (table view)
px annotation-config list --format raw --no-progress | jq -r '.[].name' # config names as JSON
px annotation-config get response-quality --format raw --no-progress     # one config by name or ID

# create — categorical (scored labels), continuous (numeric range), or freeform (free text)
px annotation-config create --type CATEGORICAL --name response-quality --value good=1 --value bad=0
px annotation-config create --type CONTINUOUS --name confidence --lower-bound 0 --upper-bound 1
px annotation-config create --type FREEFORM --name reviewer-notes --description 'Free-form reviewer feedback'

# update by name or ID — only the fields you pass change; type is immutable
px annotation-config update response-quality --name answer-quality --optimization-direction MAXIMIZE
px annotation-config update response-quality --value good=1 --value acceptable=0.5 --value bad=0
px annotation-config update response-quality --description "Updated" --format raw --no-progress | jq -r '.id'

# delete by ID — requires PHOENIX_CLI_DANGEROUSLY_ENABLE_DELETES=true; --yes skips the prompt
px annotation-config delete QW5ub3RhdGlvbkNvbmZpZzoxMjM= --yes
```

Categorical values are specified the same way in `create` and `update`: repeatable `--value label[=score]` (score optional), or a single `--values '<json>'` payload — mutually exclusive. `update` fetches the existing config, merges your flags, and writes the full body back via `PUT /v1/annotation_configs/{id}`; it requires at least one field flag. Other type-specific flags: `--lower-bound`/`--upper-bound` (CONTINUOUS/FREEFORM), `--threshold` (FREEFORM). Invalid input (bad flags, type mismatches, malformed values) exits `3` (`INVALID_ARGUMENT`) with a `{error, code, hint?}` JSON envelope on stderr in `raw`/`json` mode. `get`/`create`/`update` output the config object (single object in `raw`/`json`, not an array).

## GraphQL

For ad-hoc queries not covered by the commands above. Output is `{"data": {...}}`.

```bash
px api graphql '{ projectCount datasetCount promptCount evaluatorCount }'
px api graphql '{ projects { edges { node { name traceCount tokenCountTotal } } } }' | jq '.data.projects.edges[].node'
px api graphql '{ datasets { edges { node { name exampleCount experimentCount } } } }' | jq '.data.datasets.edges[].node'
px api graphql '{ evaluators { edges { node { name kind } } } }' | jq '.data.evaluators.edges[].node'
# evaluator kind values: "LLM" | "CODE" | "BUILTIN"
# CODE = server-side code evaluator running in a sandbox; BUILTIN = pre-built server evaluator

# Introspect any type
px api graphql '{ __type(name: "Project") { fields { name type { name } } } }' | jq '.data.__type.fields[]'
```

Key root fields: `projects`, `datasets`, `prompts`, `evaluators`, `projectCount`, `datasetCount`, `promptCount`, `evaluatorCount`, `viewer`.

### Span filter expressions

`Project.spans` takes a `filterCondition` — a Python expression over per-span
values, the same language the UI's spans/traces filter bar compiles. Annotations
are reached through three subscript accessors, and **the accessor picks the
grain**:

| Accessor | Matches annotations on | Written by |
| -------- | ---------------------- | ---------- |
| `annotations["name"]` | the span itself | `px span annotate`, `px span add-note` |
| `evals["name"]` | the span itself (accepted alongside `annotations`) | same as above |
| `trace_annotations["name"]` | the span's parent **trace** | `px trace annotate`, `px trace add-note` |

Each yields `.label`, `.score`, and `.explanation`. `trace_annotations` joins a
span through its trace row ID, so every span in an annotated trace matches — pair
it with `rootSpansOnly: true` when you want one row per trace:

```bash
px api graphql '{
  projects(first: 1) { edges { node { spans(
    first: 20
    rootSpansOnly: true
    filterCondition: "trace_annotations[\"quality\"].label == \"poor\""
  ) { edges { node { spanId name } } } } } }
}' | jq '.data.projects.edges[0].node.spans.edges[].node'
```

Picking the wrong accessor fails silently rather than erroring: filtering with
`annotations[...]` for an annotation that was written at the trace grain joins
against span annotations and matches nothing. `trace_annotations` is
span-filter-only — a `sessionFilterCondition` that uses it fails to compile with
`` `trace_annotations` is only available when filtering spans ``.

### Session filter expressions

`px session list` has no filter flag, so selecting sessions by shape means going
through GraphQL. `Project.sessions` takes a `sessionFilterCondition` — a Python
expression over per-session values, the session-grain sibling of the span filter
language:

```bash
px api graphql '{
  projects(first: 1) { edges { node { sessions(
    first: 10
    sessionFilterCondition: "num_traces > 5 and any(span.status_code == \"ERROR\" for span in spans)"
  ) { edges { node { sessionId numTraces numTracesWithError } } } } } }
}' | jq '.data.projects.edges[0].node.sessions.edges[].node'
```

Discover the bindable names for a project rather than guessing — the vocabulary
is generated from the compiler's own bindings, so it cannot drift from what
compiles:

```bash
px api graphql '{ projects(first: 1) { edges { node { sessionFilterVocabulary {
  name type category description iterableName } } } } }' \
  | jq '.data.projects.edges[0].node.sessionFilterVocabulary[] | {name, type, category}'

# Check an expression before running it
px api graphql '{ projects(first: 1) { edges { node {
  validateSessionFilterCondition(condition: "num_traces > 5") { isValid errorMessage }
} } } }'
```

Commonly bound names: `session_id`, `start_time`, `end_time`, `duration_ms`,
`num_traces`, `num_traces_with_error`, `token_count_prompt`,
`token_count_completion`, `token_count_total`, `prompt_cost`, `completion_cost`,
`total_cost`, `tool_span_count`, `llm_span_count`, the root-span text values
`first_input` / `last_output` and their existential counterparts `any_input` /
`any_output`, root-span attribute access via `attributes["llm.model_name"]`
(with `user.id` and `metadata["key"]` accepted as proxies), the iterables
`spans`, `traces`, `session_annotations`, and `span_annotations` for
comprehensions (`any(...)` / `all(...)` / `len([...])`), and
`annotations["name"].score|.label` for session annotations. Three rules the DSL
legislates and an agent will otherwise get wrong:

- **A missing value fails every comparison, in both directions.** A session with
  no recorded input matches neither `'x' in first_input` nor its negation. Target
  the missing case explicitly with `is None`.
- **`in` against a string ignores case; `==` matches exactly.** This holds at
  every grain, so the same query gives the same answer in the spans view.
- **`any_input` / `any_output` are containment tests, not values.** Write
  `'refund' in any_input`, never `any_input == 'refund'`.

On fields that accept both grains (e.g. `Project.recordCount`),
`sessionFilterCondition` and the span-grain `filterCondition` are mutually
exclusive — passing both is a request error.

## Docs

Download Phoenix documentation markdown for local use by coding agents.

```bash
px docs fetch                                # fetch default workflow docs to .px/docs
px docs fetch --workflow tracing             # fetch only tracing docs
px docs fetch --workflow tracing --workflow evaluation
px docs fetch --dry-run                      # preview what would be downloaded
px docs fetch --refresh                      # clear .px/docs and re-download
px docs fetch --output-dir ./my-docs         # custom output directory
```

Key options: `--workflow` (repeatable, values: `tracing`, `evaluation`, `datasets`, `prompts`, `integrations`, `sdk`, `self-hosting`, `all`), `--dry-run`, `--refresh`, `--output-dir` (default `.px/docs`), `--workers` (default 10).
