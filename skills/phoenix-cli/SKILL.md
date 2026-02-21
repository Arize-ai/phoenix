---
name: phoenix-cli
description: Debug LLM applications using the Phoenix CLI. Fetch traces, analyze errors, review experiments, inspect datasets, and query the GraphQL API. Use when debugging AI/LLM applications, analyzing trace data, working with Phoenix observability, or investigating LLM performance issues.
license: Apache-2.0
metadata:
  author: arize-ai
  version: "1.0"
---

# Phoenix CLI

## Invocation

```bash
px <command>                          # if installed globally
npx @arizeai/phoenix-cli <command>    # no install required
```

## Setup

```bash
export PHOENIX_HOST=http://localhost:6006
export PHOENIX_PROJECT=my-project
export PHOENIX_API_KEY=your-api-key  # if auth is enabled
```

Always use `--format raw --no-progress` when piping to `jq`.

## Traces

```bash
px traces --limit 20 --format raw --no-progress | jq .
px traces --last-n-minutes 60 --limit 20 --format raw --no-progress | jq '.[] | select(.status == "ERROR")'
px traces --format raw --no-progress | jq 'sort_by(-.duration) | .[0:5]'
px trace <trace-id> --format raw | jq .
px trace <trace-id> --format raw | jq '.spans[] | select(.status_code != "OK")'
```

### Trace JSON shape

```
Trace
  traceId, status ("OK"|"ERROR"), duration (ms), startTime, endTime
  rootSpan  — top-level span (parent_id: null)
  spans[]
    name, span_kind ("LLM"|"CHAIN"|"TOOL"|"RETRIEVER"|"EMBEDDING"|"AGENT")
    status_code ("OK"|"ERROR"), parent_id, context.span_id
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

## Datasets / Experiments / Prompts

```bash
px datasets --format raw --no-progress | jq '.[].name'
px dataset <name> --format raw | jq '.examples[] | {input, output: .expected_output}'
px experiments --dataset <name> --format raw --no-progress | jq '.[] | {id, name, failed_run_count}'
px experiment <id> --format raw --no-progress | jq '.[] | select(.error != null) | {input, error}'
px prompts --format raw --no-progress | jq '.[].name'
px prompt <name> --format text --no-progress   # plain text, ideal for piping to AI
```

## GraphQL

For ad-hoc queries not covered by the commands above. Output is `{"data": {...}}`.

```bash
px api graphql '{ projectCount datasetCount promptCount evaluatorCount }'
px api graphql '{ projects { edges { node { name traceCount tokenCountTotal } } } }' | jq '.data.projects.edges[].node'
px api graphql '{ datasets { edges { node { name exampleCount experimentCount } } } }' | jq '.data.datasets.edges[].node'
px api graphql '{ evaluators { edges { node { name kind } } } }' | jq '.data.evaluators.edges[].node'

# Introspect any type
px api graphql '{ __type(name: "Project") { fields { name type { name } } } }' | jq '.data.__type.fields[]'
```

Key root fields: `projects`, `datasets`, `prompts`, `evaluators`, `projectCount`, `datasetCount`, `promptCount`, `evaluatorCount`, `viewer`.
