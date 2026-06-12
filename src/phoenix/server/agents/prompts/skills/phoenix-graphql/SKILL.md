---
name: phoenix-graphql
description: >
  Write efficient GraphQL queries against the Phoenix API. Load this skill in two cases:
  (1) before composing any non-trivial GraphQL query yourself for data analysis (via
  `phoenix-gql` or `run_graphql_query`) — it contains schema entrypoints and patterns
  that eliminate the need for introspection; (2) when the user asks for help writing
  GraphQL queries for their own scripts, tools, or integrations against Phoenix —
  it covers the endpoint, authentication, and client examples.
summary: Answer data questions with efficient GraphQL queries, or get working GraphQL for your own scripts and integrations against the Phoenix API.
---

### Two modes

- **Internal data analysis** — you are querying Phoenix yourself to answer a question. Apply the schema facts, efficiency rules, and patterns below directly.
- **Helping the user integrate** — the user wants GraphQL queries for their own code or tools. Use the same schema facts and patterns, plus the "External API usage" section for endpoint, auth, and client examples. Queries you hand to the user should use variables and include pagination handling.

### Schema essentials

Top-level `Query` fields you will use most:

- `projects(first, after, sort: ProjectSort, filter: ProjectFilter)` → connection of `Project`
- `getProjectByName(name: String!)` → `Project` (skip the connection when you know the name)
- `node(id: ID!)` — global lookup for any entity; resolve with an inline fragment, e.g. `node(id: $id) { ... on Project { name } }`
- `getSpanByOtelId(...)`, `getTraceByOtelId(...)`, `getProjectSessionById(...)` — lookups by OTel/session identifiers
- `datasets(...)`, `prompts(...)`, `evaluators(...)` → connections
- `viewer` → the authenticated `User`
- `projectCount`, `datasetCount`, `promptCount` — cheap counts

Key `Project` fields:

- `spans(timeRange, first, after, sort: SpanSort, rootSpansOnly: Boolean, filterCondition: String)` → connection of `Span`. There is **no `traces` connection on `Project`** — use `spans(rootSpansOnly: true)` for one row per trace.
- `trace(traceId: ID!)` → `Trace` — lookup by OTel hex trace id.
- `sessions(timeRange, first, after, sort, filterIoSubstring, sessionId)` → connection of `ProjectSession`.
- Aggregates, most accepting `timeRange` and `filterCondition`: `traceCount`, `recordCount` (span count), `tokenCountTotal`, `tokenCountPrompt`, `tokenCountCompletion`, `costSummary`, `latencyMsQuantile(probability: Float!)`, `spanLatencyMsQuantile(probability: Float!)`.
- `spanAnnotationNames`, `traceAnnotationsNames`, `spanAnnotationSummary`, `documentEvaluationNames` — discover what evals/annotations exist before querying them.
- `validateSpanFilterCondition(condition: String!)` — check a filter string without running it.

Conventions:

- **Pagination** is Relay-style: `first`/`after` args; responses have `edges { node { ... } }` and `pageInfo { hasNextPage endCursor }`. Cursors are opaque strings. Some connections (e.g. `Project.spans`) are forward-only.
- **IDs**: the `id` field on any node is a Relay global ID (base64 of `TypeName:rowId`) — use it with `node(id:)`. The `spanId` and `traceId` fields are OpenTelemetry hex IDs — use those for OTel lookups and `/redirects/spans/<spanId>` / `/redirects/traces/<traceId>` links. Never mix the two.
- **`TimeRange`** input: `{ start: DateTime, end: DateTime }` — ISO 8601 strings; `end` is exclusive; both optional.
- **`SpanSort`** input: `{ col: SpanColumn, dir: SortDir }`, e.g. `{ col: startTime, dir: desc }`. Useful `SpanColumn` values: `startTime`, `latencyMs`, `tokenCountTotal`, `cumulativeTokenCountTotal`, `tokenCostTotal`.
- **`filterCondition`** is a Python-like DSL string over span fields, e.g. `span_kind == 'LLM'`, `status_code == 'ERROR'`, `latency_ms > 1000`, `'timeout' in output.value`, `evals['Hallucination'].label == 'hallucinated'`, `annotations['note'].score < 0.5`. Combine with `and`/`or`.

### Efficiency rules

- **Do not run full schema introspection.** The facts above cover most analysis queries. When you genuinely need to verify a field or argument, introspect one type at a time: `{ __type(name: "Project") { fields { name args { name type { name kind } } } } }`.
- **Batch independent lookups with aliases** in one query instead of multiple round trips, e.g. `p50: latencyMsQuantile(probability: 0.5) p99: latencyMsQuantile(probability: 0.99)`.
- Select only the fields you need; keep page sizes small (10–50) and paginate only when necessary.
- Pass values via query variables, never string interpolation.
- Span `input`/`output` payloads can be huge — request `input { truncatedValue }` (first 100 chars) when surveying; fetch `input { value }` (full payload) only for spans you intend to read closely.

### Common patterns

Project overview in one round trip:

```graphql
query Overview($name: String!, $timeRange: TimeRange) {
  getProjectByName(name: $name) {
    id
    traceCount(timeRange: $timeRange)
    recordCount(timeRange: $timeRange)
    tokenCountTotal(timeRange: $timeRange)
    p50: latencyMsQuantile(probability: 0.5, timeRange: $timeRange)
    p99: latencyMsQuantile(probability: 0.99, timeRange: $timeRange)
    errorCount: recordCount(timeRange: $timeRange, filterCondition: "status_code == 'ERROR'")
    spanAnnotationNames
  }
}
```

Recent root spans (one per trace), slowest first:

```graphql
query RecentTraces($id: ID!, $first: Int = 20) {
  node(id: $id) {
    ... on Project {
      spans(first: $first, rootSpansOnly: true, sort: { col: latencyMs, dir: desc }) {
        edges {
          node { spanId traceId name latencyMs statusCode startTime cumulativeTokenCountTotal }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
}
```

Filtered spans (error LLM spans):

```graphql
query ErrorSpans($id: ID!) {
  node(id: $id) {
    ... on Project {
      spans(first: 20, filterCondition: "span_kind == 'LLM' and status_code == 'ERROR'") {
        edges { node { spanId traceId name statusCode } }
      }
    }
  }
}
```

### Execution surfaces (internal mode)

- `phoenix-gql` (bash): run `phoenix-gql --help` for flags and current permissions. Use `--data-only` when piping to `jq`, `--output <file>` for large results, `--vars '<json>'` for variables. Mutations are allowed only when runtime permissions say so; the tool reports its permissions on every invocation. If a bash filesystem is available, `/phoenix/graphql/` contains a live `schema.json` plus route-specific recipe `.graphql` files and prefetched starter data — prefer recipes over writing queries from scratch.
- `run_graphql_query` (server sub-agent): strictly read-only — queries only, no mutations or subscriptions. Pass variables via `variable_values`.

### External API usage (user-facing mode)

Facts users need to call the API themselves:

- **Endpoint**: `POST <phoenix-host>/graphql` with a JSON body `{ "query": "...", "variables": { ... } }`. A GraphiQL IDE is served on GET at the same path.
- **Auth**: send a Phoenix API key as a bearer token: `Authorization: Bearer <API_KEY>`. API keys are created in Phoenix settings.
- The GraphQL schema is primarily designed for the Phoenix UI and may change between versions; for stable programmatic access, recommend the REST API (`/v1/...`) and the `arize-phoenix-client` Python / `@arizeai/phoenix-client` TypeScript packages where they cover the need, and GraphQL for everything else.

curl:

```bash
curl -s "$PHOENIX_HOST/graphql" \
  -H "Authorization: Bearer $PHOENIX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"query": "query($n: String!) { getProjectByName(name: $n) { traceCount } }", "variables": {"n": "default"}}'
```

Python:

```python
import httpx

resp = httpx.post(
    f"{host}/graphql",
    headers={"Authorization": f"Bearer {api_key}"},
    json={"query": query, "variables": variables},
)
resp.raise_for_status()
data = resp.json()["data"]
```

When handing users a query, include: the full operation with variable definitions, an example variables payload, and a note on paginating via `pageInfo { hasNextPage endCursor }` → pass `endCursor` as `after`.
