---
name: phoenix-graphql
description: >
  Write efficient GraphQL queries against the Phoenix API. Load this skill in two cases:
  (1) before composing any non-trivial GraphQL query yourself for data analysis (via
  the `phoenix-gql` bash command) — it contains schema entrypoints and patterns
  that eliminate the need for introspection; (2) when the user asks for help writing
  GraphQL queries for their own scripts, tools, or integrations against Phoenix —
  it covers the endpoint, authentication, and client examples.
summary: Answer data questions with efficient GraphQL queries, or get working GraphQL for your own scripts and integrations against the Phoenix API.
---

### Two modes

- **Internal data analysis** — you are querying Phoenix yourself to answer a question. Apply the schema facts, efficiency rules, and patterns below directly.
- **Helping the user integrate** — the user wants GraphQL queries for their own code or tools. Use the same schema facts and patterns, plus the "External API usage" section for endpoint, auth, and client examples. Queries you hand to the user should use variables and include pagination handling.

### Entrypoints

Top-level `Query` entrypoints get you to a starting entity; per-entity schema details live in the resources listed under "Schema map" below.

- `node(id: ID!)` — global lookup for **any** entity by its Relay global id; resolve with an inline fragment, e.g. `node(id: $id) { ... on Dataset { name } }`. This is the primary way to fetch datasets, prompts, experiments, sessions, and annotations, which have **no** by-name/by-id helpers.
- `projects(...)`, `datasets(...)`, `prompts(...)`, `evaluators(...)` → Relay connections, each with `filter`/`sort` inputs to find an entity when you only have a name.
- By-X helpers (the only ones that exist): `getProjectByName(name: String!)`, `getProjectSessionById(sessionId: String!)`, `getDatasetExampleByExternalId(datasetId: GlobalID!, externalId: String!)`, `getSpanByOtelId(spanId: String!)`, `getTraceByOtelId(traceId: String!)`. There is **no** `getDatasetByName`, `getPromptByName`, or `getExperimentById` — use `node(id:)` or a connection `filter` instead.
- `viewer` → the authenticated `User`; `projectCount`, `datasetCount`, `promptCount` — cheap counts.
- `compareExperiments(baseExperimentId: GlobalID!, compareExperimentIds: [GlobalID!]!, first, after, filterCondition)` → experiment comparison.

### Schema map

Per-entity field references and examples are split into resources. Read **only** the one(s) you need with `read_skill_resource`, after loading this skill:

- `project-spans-traces` — Project aggregates and `spans`; Span and Trace fields. The starting point for most trace analysis.
- `sessions` — ProjectSession: multi-turn session metrics, token/cost, session traces.
- `datasets` — Dataset and DatasetExample: examples, versions, splits, labels.
- `experiments` — Experiment and ExperimentRun: runs, aggregate metrics, comparison.
- `prompts` — Prompt and PromptVersion: versions, templates, tags.
- `annotations` — Span/Trace/ExperimentRun annotation fields and how to read them.

### Conventions

These apply to every entity:

- **Pagination** is Relay-style: `first`/`after` args; responses have `edges { node { ... } }` and `pageInfo { hasNextPage endCursor }`. Cursors are opaque strings. Some connections (e.g. `Project.spans`, `Experiment.runs`, `ProjectSession.traces`) are forward-only.
- **IDs**: the `id` field on any node is a Relay global ID (base64 of `TypeName:rowId`) — use it with `node(id:)`. OpenTelemetry hex IDs come from `Span.spanId` and `Trace.traceId` — use those for OTel lookups and `/redirects/spans/<spanId>` / `/redirects/traces/<traceId>` links. Note a `Span` has **no** `traceId` field; read it via the nested `trace { traceId }`. Never mix global IDs with OTel IDs.
- **`TimeRange`** input: `{ start: DateTime, end: DateTime }` — ISO 8601 strings; `end` is exclusive; both optional.
- **`SpanSort`** input: `{ col: SpanColumn, dir: SortDir }`, e.g. `{ col: startTime, dir: desc }`. Useful `SpanColumn` values: `startTime`, `latencyMs`, `tokenCountTotal`, `cumulativeTokenCountTotal`, `tokenCostTotal`.
- **`filterCondition`** is a Python-like DSL string over span fields, e.g. `span_kind == 'LLM'`, `status_code == 'ERROR'`, `latency_ms > 1000`, `'timeout' in output.value`, `evals['Hallucination'].label == 'hallucinated'`, `annotations['note'].score < 0.5`. Combine with `and`/`or`.

### Efficiency rules

- **Do not run full schema introspection.** Read the relevant `Schema map` resource instead; it covers the fields and arguments for that entity. Only when a resource does not cover a field you need, introspect a single type: `{ __type(name: "Project") { fields { name args { name type { name kind } } } } }`.
- **Batch independent lookups with aliases** in one query instead of multiple round trips, e.g. `p50: latencyMsQuantile(probability: 0.5) p99: latencyMsQuantile(probability: 0.99)`.
- Select only the fields you need; keep page sizes small (10–50) and paginate only when necessary.
- Pass values via query variables, never string interpolation.
- Span `input`/`output` payloads can be huge — request `input { truncatedValue }` (first 100 chars) when surveying; fetch `input { value }` (full payload) only for spans you intend to read closely.

### Patterns

Two canonical shapes to orient you; entity-specific examples live in each resource.

Reach an entity and read fields via `node(id:)` + an inline fragment:

```graphql
query GetEntity($id: ID!) {
  node(id: $id) {
    ... on Dataset { name exampleCount }
  }
}
```

Batch independent project aggregates with aliases in one round trip:

```graphql
query Overview($name: String!, $timeRange: TimeRange) {
  getProjectByName(name: $name) {
    traceCount(timeRange: $timeRange)
    p50: latencyMsQuantile(probability: 0.5, timeRange: $timeRange)
    p99: latencyMsQuantile(probability: 0.99, timeRange: $timeRange)
    errorCount: recordCount(timeRange: $timeRange, filterCondition: "status_code == 'ERROR'")
  }
}
```

### Execution surfaces (internal mode)

- `phoenix-gql` (bash): run `phoenix-gql --help` for flags and current permissions. Use `--data-only` when piping to `jq`, `--output <file>` for large results, `--vars '<json>'` for variables. Mutations are allowed only when runtime permissions say so; the tool reports its permissions on every invocation.

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
