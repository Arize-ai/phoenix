# Migrations

## v18.x to v19.0.0

### Built-in OAuth2 authorization server

Phoenix now serves a built-in OAuth2 authorization server whenever authentication is enabled. It provides browser-based
login for OAuth2 public clients — most notably `px auth login` in the Phoenix CLI — and advertises itself through the
standard discovery documents (`/.well-known/oauth-authorization-server` and `/.well-known/oauth-protected-resource`).
It is on by default and requires no configuration.

Operators who do not want this surface exposed — for example, deployments that mandate API-key-only access — can disable
it with the new environment variable:

- `PHOENIX_ENABLE_OAUTH2_AUTHORIZATION_SERVER` (default `true`). When set to `false`, every `/oauth2/*` endpoint and the
  `/.well-known/oauth-authorization-server` discovery document respond with `404`, and the protected-resource metadata
  stops advertising an authorization server. API keys, browser login, and password-based access tokens are unaffected.
  OAuth2 access tokens minted before the switch was flipped remain valid until they expire, but their grants can no
  longer be refreshed. The CLI reports "This Phoenix server does not support OAuth login; use an API key" when it
  encounters such a deployment. The variable has no effect when authentication is disabled.

Related dials for deployments that keep the authorization server enabled:

- `PHOENIX_OAUTH2_DYNAMIC_CLIENT_REGISTRATION` (default `enabled`) controls dynamic client registration (RFC 7591) and
  which redirect URIs registered clients may use. The default admits HTTPS redirect URIs in addition to loopback and
  private-use schemes, because MCP clients in the wild (Cursor, for example) register an HTTPS callback as part of
  standard registration and rejecting it breaks those clients out of the box. Registration by itself grants no access:
  a token is minted only after a logged-in user approves the consent page, the authorization code is delivered only to
  the exact registered redirect URI, and PKCE binds the token exchange to the client that started the flow. Set
  `local_only` to restrict code delivery to processes on the approving user's machine (loopback and private-use schemes
  only), or `disabled` to turn dynamic registration off entirely.
- `PHOENIX_OAUTH2_ALLOWED_REDIRECT_HOSTS` (unset by default) restricts which hosts may appear in HTTPS redirect URIs
  when registration is `enabled` — for example, `PHOENIX_OAUTH2_ALLOWED_REDIRECT_HOSTS=www.cursor.com` admits Cursor
  and nothing else.

A note on CORS: the anonymous OAuth surfaces (`/.well-known/*` discovery documents, `/oauth2/register`, `/oauth2/token`,
and `/oauth2/revoke`) answer cross-origin requests from any origin with non-credentialed wildcard CORS, so browser-based
OAuth clients work without configuration. These endpoints honor no cookies; the cookie-authenticated app API remains
governed by the `PHOENIX_ALLOWED_ORIGINS` allowlist, and the OAuth consent endpoint keeps its strict same-origin check.

### In-process MCP server

Phoenix now mounts an in-process MCP server at `/mcp` by default. The endpoint speaks Streamable HTTP and, when
authentication is enabled, reuses Phoenix's existing bearer-token authentication (including the OAuth2 authorization
server's access tokens and API keys). When authentication is disabled, `/mcp` is reachable without credentials.

Operators who do not want the MCP surface exposed can disable it with:

- `PHOENIX_ENABLE_MCP_SERVER` (default `true`). When set to `false`, the `/mcp` mount and the path-inserted protected
  resource metadata at `/.well-known/oauth-protected-resource/mcp` respond with `404`.

By default the `/mcp` endpoint now presents FastMCP's **code-mode** tool surface: instead of the `/v1`-derived tool
list, clients see discovery meta-tools (`search`, `get_schema`, `tags`, `list_tools`) and an `execute` tool that runs
model-written Python in a `pydantic-monty` sandbox where `call_tool(name, params)` is the only function in scope. The
`execute` tool can only invoke tools the caller is already authorized for, and each block is bounded by the FastMCP
sandbox defaults (30s wall clock, 100 MB memory, at most 50 `call_tool` invocations). To restore the previous
group-gated progressive-disclosure tool list instead, set:

- `PHOENIX_ENABLE_MCP_CODE_MODE` (default `true`). When set to `false`, `/mcp` presents the group-gated tool surface. Has no
  effect unless `PHOENIX_ENABLE_MCP_SERVER` is also set.

### Deployments behind a reverse proxy

The authorization server and the MCP endpoint place requirements on a fronting reverse proxy that ordinary UI and API
traffic never did. Deployments that expose Phoenix directly need none of this. For everyone else:

- **Set `PHOENIX_ROOT_URL`** (and `PHOENIX_HOST_ROOT_PATH` when Phoenix is served under a subpath). The OAuth2 issuer,
  every discovery URL, and the MCP 401 challenge are derived from `PHOENIX_ROOT_URL`, never from request `Host` headers,
  so this is what makes the deployment's advertised identity match the URL clients actually use.
- **Forward host-root `/.well-known/*` to Phoenix unmodified** when Phoenix is served under a subpath. RFC 8414 §3 and
  RFC 9728 §3.1 place the well-known segment *between the host and the path*: for a deployment at
  `https://example.com/phoenix`, clients fetch `https://example.com/.well-known/oauth-authorization-server/phoenix` —
  a URL at the host root, outside the subpath the proxy routes to Phoenix. Phoenix registers matching routes for these
  path-inserted documents whenever `PHOENIX_HOST_ROOT_PATH` is set; the proxy only needs to deliver them without
  stripping or rewriting the path.
- **Do not put proxy-level authentication in front of the anonymous surfaces**: `/mcp`, `/oauth2/register`,
  `/oauth2/token`, `/oauth2/revoke`, and `/.well-known/*`. OAuth and MCP clients bootstrap from Phoenix's own `401`
  response and its `WWW-Authenticate` header; a proxy that answers with a `302` to a login page or an SSO interstitial
  ends the flow before it starts. These endpoints are safe to expose without a proxy gate — they honor no cookies, and
  each validates its own inputs (see the CORS note above for the same boundary).
- **Let `OPTIONS` requests through untouched** on those same paths. Browsers send a preflight `OPTIONS` before
  cross-origin requests, and preflights carry no credentials by specification; one intercepted by a proxy auth layer
  fails the real request with an opaque CORS error.
- **Do not buffer or time out the MCP response stream.** `/mcp` holds a long-lived `text/event-stream` response open
  for server-to-client messages. Response buffering (`proxy_buffering` in nginx, for example) or short read/write
  timeouts silently break the session.
- **Pass response headers through unmodified**, in particular `WWW-Authenticate`, `Mcp-Session-Id`, and the
  `Access-Control-*` family — clients read all three, and browser-based clients cannot see the first two at all if a
  proxy strips the CORS header that exposes them.
- **Let 404s stay 404s.** Discovery clients probe several candidate `/.well-known/*` URLs and rely on a clean `404` to
  move to the next one. A proxy that substitutes a custom HTML error page (or any `200`) makes the probe look like a
  malformed discovery document, and clients abort instead of falling through.

### GraphQL API keys can no longer create API keys

Through Phoenix 18, the GraphQL mutations `createUserApiKey` and `createSystemApiKey` accepted API-key-authenticated callers for backward compatibility: a user API key could mint another user key for the same owner, and an `ADMIN`-role user key could mint a system key. This allowed a compromised key to issue a durable replacement before the original was revoked.

As of Phoenix 19, both GraphQL mutations reject API-key-authenticated callers with an `Unauthorized` error, matching the policy the REST API-key endpoints (`POST /v1/user/api_keys`, `POST /v1/system/api_keys`) have enforced since their introduction:

- User API keys are created from an authenticated human session.
- System API keys are created from a human `ADMIN` session or with `PHOENIX_ADMIN_SECRET`.
- API keys (user or system) cannot create API keys, on either surface.

The GraphQL schema is unchanged, and listing and revoking keys work exactly as before, including with API-key authentication where previously permitted.

**Migration:** If you have automation that uses an existing API key to mint new keys through GraphQL, switch it to one of the supported issuance origins:

- Create keys interactively under **Settings → API Keys**, or
- Authenticate the automation as a session (log in with user credentials to obtain an access token), or
- For system keys, authenticate with `PHOENIX_ADMIN_SECRET` and call `POST /v1/system/api_keys` (or the GraphQL mutation).

Keys created before the upgrade remain valid; only the ability of a key to create further keys is removed.

## v17.x to v18.0.0

### DB Index for Sessions Time Range

The sessions time-range filter now uses interval-overlap semantics (a session is included if and only if it had activity
inside the window). A single migration restructures the indexes:

- Creates the composite index `ix_project_sessions_project_id_end_time` on `project_sessions (project_id, end_time DESC)`, which the new filter relies on.
- Creates four foreign-key indexes on the experiment log tables so that experiment/dataset deletions no longer trigger sequential scans: `ix_experiment_logs_experiment_id`, `ix_experiment_eval_logs_experiment_run_id`, `ix_experiment_eval_logs_dataset_evaluator_id`, and `ix_experiment_task_logs_dataset_example_id`.
- Creates `user_id` indexes on seven tables with an unindexed `ON DELETE SET NULL` foreign key to `users`, so a user deletion no longer sequential-scans each of them: `span_annotations`, `trace_annotations`, `document_annotations`, `project_session_annotations`, `datasets`, `dataset_versions`, and `experiments`.
- Drops seven redundant single-column indexes: five whose lookups are served by the leading columns of existing unique indexes (`ix_project_annotation_configs_project_id`, `ix_prompts_prompt_labels_prompt_label_id`, `ix_token_prices_model_id`, `ix_dataset_examples_dataset_id`, `ix_dataset_evaluators_dataset_id`); `ix_dataset_examples_external_id`, which no query uses on its own — `external_id` lookups are always scoped to a dataset and are served by the unique `(dataset_id, external_id)` index; and `ix_project_sessions_end_time`, which is superseded by the new composite (created before the drop, so there is never a window without an end_time index).

**Rolling deployments:** the migration honors `PHOENIX_MIGRATE_INDEX_CONCURRENTLY=true` (see [v12.x to v13.0.0](#v12x-to-v1300) below) for all index creates and drops. The `project_sessions` table holds one row per session, so the composite build is quick; index pre-creation is typically unnecessary. The migration verifies every index it creates before dropping anything: if a prior concurrent build failed and left an INVALID index behind, it fails with recovery instructions (drop the invalid index with `DROP INDEX CONCURRENTLY IF EXISTS <index name>` and rerun) instead of proceeding.

## v16.x to v17.0.0

### Agent assistant (PXI)

Phoenix v17 ships **PXI**, an in-app assistant that helps you investigate traces, iterate on prompts, and navigate Phoenix without leaving the page you're on.

To turn PXI off for an entire deployment, set:

```shell
PHOENIX_DISABLE_AGENT_ASSISTANT=true
```

## v15.x to v16.0.0

### Sandbox provider allowlist (`PHOENIX_ALLOWED_SANDBOX_PROVIDERS`)

A new optional environment variable, `PHOENIX_ALLOWED_SANDBOX_PROVIDERS`, restricts which sandbox provider families are available for code-evaluator execution. 

*When unset, all providers remain available. Set to `NONE` to disable all sandbox providers.*

To restrict the set of usable sandboxes, set the variable to a comma-separated list of family names:

```shell
PHOENIX_ALLOWED_SANDBOX_PROVIDERS=WASM,DENO
```

Accepted values: `WASM`, `E2B`, `DAYTONA`, `VERCEL`, `DENO`, `MODAL` (case-insensitive). Listing a family covers all of its language variants — for example, `VERCEL` covers both `VERCEL_PYTHON` and `VERCEL_TYPESCRIPT`.

### Sandbox and code-evaluator permissions

v16.0.0 introduces sandbox configuration and code evaluators as new API surfaces. When authentication is enabled, access to these surfaces is governed by user role:

| API Surface | Operation | Admin | Member | Viewer |
| --- | --- | --- | --- | --- |
| View code evaluator source | Read | ✅ | ✅ | ✅ |
| View code evaluator identity | Read | ✅ | ✅ | ✅ |
| View safe sandbox identity | Read | ✅ | ✅ | ✅ |
| View backend capability metadata | Read | ✅ | ✅ | ✅ |
| View sandbox config values | Read | ✅ | ✅ | ✅ |
| View provider config values | Read | ✅ | ✅ | ✅ |
| Create sandbox config | Write | ✅ | ❌ | ❌ |
| Update sandbox config | Write | ✅ | ❌ | ❌ |
| Delete sandbox config | Write | ✅ | ❌ | ❌ |
| Update sandbox provider | Write | ✅ | ❌ | ❌ |
| Create code evaluator | Write | ✅ | ✅ | ❌ |
| Patch code evaluator / rebind sandbox | Write | ✅ | ✅ | ❌ |
| Append code evaluator version | Write | ✅ | ✅ | ❌ |
| Create / update dataset code evaluator | Write | ✅ | ✅ | ❌ |
| Preview sandbox-backed code evaluator | Write | ✅ | ✅ | ❌ |

Sandbox configuration is admin-only. Code-evaluator authoring and preview are available to members and admins but not viewers. All read surfaces are unrestricted. When authentication is disabled, no role checks apply.

## v14.x to v15.0.0

No action is required to upgrade from v14.x to v15.0.0.

## v13.x to v14.0.0

### Phoenix server CLI (`phoenix` / `python -m phoenix.server.main`)

The CLI is now **subcommand-first**: you choose `serve` or `db`, then pass options for that command. In v13.x, many flags could appear **before** the subcommand (for example `--dev` and `--dev-vite-port` before `serve`); those must now come **after** the subcommand.

**Before:**

```shell
python -m phoenix.server.main --dev --dev-vite-port 5173 serve
phoenix --host 0.0.0.0 --port 6006 serve
```

**After:**

```shell
python -m phoenix.server.main serve --dev --dev-vite-port 5173
phoenix serve --host 0.0.0.0 --port 6006
```

Pass `--database-url` on the subcommand that needs a database (or rely on `PHOENIX_SQL_DATABASE_URL` / the default). 

```shell
python -m phoenix.server.main serve --database-url "postgresql://..."
python -m phoenix.server.main db migrate --database-url "postgresql://..."
```

`db migrate` is unchanged as a two-word subcommand: `python -m phoenix.server.main db migrate` (or `phoenix db migrate`).

Top-level `--help` only shows global usage; use `phoenix serve --help`, or `phoenix db migrate --help` for subcommand options.

### PostgreSQL Driver: `psycopg` Removed

The `psycopg` driver has been removed. Phoenix now uses `asyncpg` as the sole PostgreSQL driver for both runtime queries and migrations. If you have `psycopg` installed only for Phoenix, it can be uninstalled.

The `pg` extra no longer includes `psycopg`:

```shell
pip install arize-phoenix[pg]  # only installs asyncpg
```

No configuration changes are needed — `PHOENIX_SQL_DATABASE_URL` continues to work with the same `postgresql://` connection strings.

### Legacy Client Removed

The legacy `phoenix.session.client.Client` (accessed via `px.Client()`) has been removed. All client interactions now go through the `arize-phoenix-client` package.

```shell
pip install arize-phoenix-client
```

**Before:**

```python
import phoenix as px

client = px.Client(endpoint="http://localhost:6006")
```

**After:**

```python
from phoenix.client import Client

client = Client(base_url="http://localhost:6006")
```

The constructor parameter `endpoint` has been renamed to `base_url`. If omitted, it falls back to environment variables or `http://localhost:6006`. Attempting to import `phoenix.session.client` will raise an `ImportError` with migration guidance.

### Client Method Changes

The new client organizes methods under resource namespaces (`.spans`, `.datasets`, `.experiments`) instead of flat methods on the client object. Return types have also changed — the new client uses TypedDicts generated from the OpenAPI schema rather than custom dataclasses.

#### Spans and Traces

| Legacy (`px.Client()`)             | New (`phoenix.client.Client()`)                 |
| :--------------------------------- | :---------------------------------------------- |
| `client.get_spans_dataframe()`     | `client.spans.get_spans_dataframe()`            |
| `client.query_spans(query)`        | `client.spans.get_spans_dataframe(query=query)` |
| `client.get_evaluations()`         | `client.spans.get_span_annotations()`           |
| `client.log_evaluations(evals)`    | `client.spans.log_span_annotations(...)`        |
| `client.log_traces(trace_dataset)` | `client.spans.log_spans(...)`                   |

The `query_spans` method accepted `SpanQuery` objects as positional args and could return either a single DataFrame or a list. The new `get_spans_dataframe` takes a single `query` keyword argument and always returns a single DataFrame. If you previously passed multiple queries, call `get_spans_dataframe` once per query and join the results with pandas.

#### Datasets

| Legacy (`px.Client()`)                    | New (`phoenix.client.Client()`)             |
| :---------------------------------------- | :------------------------------------------ |
| `client.get_dataset(id=..., name=...)`    | `client.datasets.get_dataset(...)`          |
| `client.get_dataset_versions(dataset_id)` | `client.datasets.get_dataset_versions(...)` |
| `client.upload_dataset(...)`              | `client.datasets.create_dataset(...)`       |

The legacy `get_dataset` returned a `phoenix.experiments.types.Dataset` dataclass. The new client returns a `Dataset` object with the same conceptual fields (`.id`, `.examples`, `.version_id`) but backed by TypedDicts from the generated API schema.

#### Evaluations to Annotations

The concept formerly called "evaluations" is now called "annotations" throughout the new client. `SpanEvaluations` and `log_evaluations` are replaced:

**Before:**

```python
from phoenix.trace import SpanEvaluations

px.Client().log_evaluations(
    SpanEvaluations(eval_name="Hallucination", dataframe=results_df)
)
```

**After:**

```python
from phoenix.client import Client

Client().spans.log_span_annotations_dataframe(
    dataframe=results_df,
    annotation_name="Hallucination",
    annotator_kind="LLM",
)
```

### Experiments

The experiments API has moved from `phoenix.experiments` to `phoenix.client.experiments`. The `Example` type used in task functions now comes from the generated API types.

**Before:**

```python
from phoenix.experiments.types import Example
from phoenix.experiments.evaluators import create_evaluator
```

**After:**

```python
from phoenix.client.__generated__.v1 import DatasetExample as Example
from phoenix.client.experiments import create_evaluator
```

`run_experiment` and `evaluate_experiment` now require keyword arguments for `dataset`, `task`, and `experiment`:

```python
from phoenix.client.experiments import run_experiment, evaluate_experiment

experiment = run_experiment(dataset=dataset, task=task, evaluators=[...])
experiment = evaluate_experiment(experiment=experiment, evaluators=[...])
```

### Removed Helper Functions

The pre-defined query helpers `get_retrieved_documents`, `get_qa_with_reference`, and `get_called_tools` (from `phoenix.trace.dsl.helpers`) have been removed. Use `SpanQuery` with `client.spans.get_spans_dataframe(query=...)` directly instead. The documentation for [extracting data from spans](https://arize.com/docs/phoenix/tracing/how-to-tracing/importing-and-exporting-traces/extract-data-from-spans) has updated examples.

### Removed Top-Level Convenience Functions

- `px.Client` — use `from phoenix.client import Client` instead
- `px.log_evaluations(...)` — use `client.spans.log_span_annotations(...)` instead
- `session.query_spans(...)` — use `client.spans.get_spans_dataframe(...)` instead
- `session.get_evaluations(...)` — use `client.spans.get_span_annotations(...)` instead

### `/v1/evaluations` Endpoint Removed

The `POST /v1/evaluations` and `GET /v1/evaluations` REST endpoints have been removed. Use the annotations API instead, choosing the replacement by evaluation kind:

#### Ingestion (`POST /v1/evaluations` replacements)

| Evaluation kind | SDK replacement                                        | REST replacement                  |
| :-------------- | :----------------------------------------------------- | :-------------------------------- |
| span            | `client.spans.log_span_annotations_dataframe(...)`     | `POST /v1/span_annotations`       |
| trace           | `client.traces.log_trace_annotations_dataframe(...)`   | `POST /v1/trace_annotations`      |
| document        | `client.spans.log_document_annotations_dataframe(...)` | `POST /v1/document_annotations`   |

#### Retrieval (`GET /v1/evaluations` replacement)

The old `GET /v1/evaluations` only returned span annotations. Its replacement is `client.spans.get_span_annotations(...)`.

> **Note:** Trace annotation retrieval is available via `GET /projects/{id}/trace_annotations`, but this was not part of the old evaluations endpoint — it is a new capability, not a direct replacement.

**Before:**

```python
from phoenix.trace import SpanEvaluations
import phoenix as px

px.Client().log_evaluations(
    SpanEvaluations(eval_name="Hallucination", dataframe=results_df)
)
```

**After (span annotations):**

```python
from phoenix.client import Client

Client().spans.log_span_annotations_dataframe(
    dataframe=results_df,
    annotation_name="Hallucination",
    annotator_kind="LLM",
)
```

**After (trace annotations):**

```python
from phoenix.client import Client

Client().traces.log_trace_annotations_dataframe(
    dataframe=results_df,
    annotation_name="Hallucination",
    annotator_kind="LLM",
)
```

**After (document annotations):**

```python
from phoenix.client import Client

Client().spans.log_document_annotations_dataframe(
    dataframe=results_df,
    annotation_name="Relevance",
    annotator_kind="LLM",
)
```

**Removed dependencies:** `protobuf` is no longer a direct dependency of the Phoenix server (it remains a transitive dependency via OpenTelemetry gRPC packages).

## v12.x to v13.0.0

### DB Index for Session ID

A partial index on `spans.attributes` for session id is added by migration. Migration run time is estimated at approximately 200 seconds per 100 GiB on a MacBook Pro. Cloud environments may take longer depending on instance size and I/O throughput.

**Rolling deployments:** If an existing Phoenix instance is still serving traffic while a new instance starts and runs migrations, the default `CREATE INDEX` acquires a table lock that blocks writes from the old instance. To avoid this, set the following environment variable before starting the new instance:

```
PHOENIX_MIGRATE_INDEX_CONCURRENTLY=true
```

This uses `CREATE INDEX CONCURRENTLY`, which avoids the table lock but is roughly 2-3x slower. The new instance still blocks on startup until the index build completes.

**Large PostgreSQL databases (hundreds of GiB+):** For very large `spans` tables, even `CONCURRENTLY` can take hours. To make the migration instant, pre-create a no-op index with the same name before upgrading (while the old version is still running):

Step 1 — Create a no-op index (instant, no table scan):

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_spans_session_id
ON spans ((attributes #>> '{session,id}'))
WHERE false;
```

Step 2 — Upgrade Phoenix. The migration's `IF NOT EXISTS` sees the index name and skips.

Step 3 — Backfill the real index at your convenience (while the app is running):

```sql
DROP INDEX CONCURRENTLY IF EXISTS ix_spans_session_id;

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_spans_session_id
ON spans (((attributes #>> '{session,id}')::varchar))
WHERE ((attributes #>> '{session,id}')::varchar) IS NOT NULL;
```

Note: On PostgreSQL, the index uses the `#>>` path operator (e.g., `attributes #>> '{session,id}'`). Queries using chained arrow operators (`attributes -> 'session' ->> 'id'`) will not match the index. Phoenix's built-in query layer always uses the `#>>` form, so this only affects custom SQL queries run directly against the database.

### Azure OpenAI v1 API

Azure OpenAI integration now uses the OpenAI v1 API, which simplifies configuration by eliminating explicit API versioning. The `api_version` parameter is no longer required—versioning is now handled implicitly by the v1 API endpoint.

This change requires `openai>=2.14.0`.

**References**:

- [Azure OpenAI API Version Lifecycle](https://learn.microsoft.com/en-us/azure/ai-foundry/openai/api-version-lifecycle)
- [Migration from Azure AI Inference to OpenAI SDK](https://learn.microsoft.com/en-us/azure/ai-foundry/how-to/model-inference-to-openai-migration)

### AWS Bedrock Async Client

AWS Bedrock integration now uses `aioboto3` instead of `boto3` for fully async client operations. If you have `boto3` installed for Bedrock support, you should install `aioboto3` instead:

```shell
pip install aioboto3
```

### Inferences, dimensions, embeddings, and pointcloud (UMAP)

**Breaking change:** Model inferences, dimensions, embeddings, and the pointcloud (UMAP) visualization have been removed from Phoenix, along with their GraphQL and REST APIs. The UI no longer includes the `/model`, `/dimensions`, or `/embeddings` routes.

## v11.0.0 to v12.0.0

Instrumentation helpers are being moved to `openinference-instrumentation`.

Before:

```python
from phoenix.trace import using_project

with using_project(project_name="change-project"):
    ...
```

After:

```python
# openinference-instrumentation>=0.1.38
from openinference.instrumentation import dangerously_using_project

with dangerously_using_project(project_name="change-project"):
    ...
```

### PostgreSQL Connection Environment Variables

**Breaking Change**: Specifying port numbers in `PHOENIX_POSTGRES_HOST` is no longer supported.

**Before**:

```shell
export PHOENIX_POSTGRES_HOST=localhost:5432
```

**After**:

```shell
export PHOENIX_POSTGRES_HOST=localhost
export PHOENIX_POSTGRES_PORT=5432
```

**Impact**: If you were setting `PHOENIX_POSTGRES_HOST` with a port (e.g., `localhost:5432`), you must now separate the host and port into their respective environment variables.

## v10.0.0 to v11.0.0

This release is entirely encapsulated in a set of new tables. Have a nice release!

## v9.x to v10.0.0

This release updates the `users` table in the database. Migration is expected to be quick.

No other breaking changes are included in this release.

## v8.x to v9.0.0

This release migrates all annotations on spans and traces to a structure that supports multiple annotation values per entity (trace, span). This migration also changes the constraints for the tables. Because it operates on existing data, it may take a bit of time for the records to be fully migrated over. Phoenix migrates your data at boot so you may experience some slowness in the server coming up (depending on the amount of data you have). Please deploy v9.0 when your services can account for small amount of downtime.

Phoenix 9.0 also contains project-level retention policies. By default your pre-existing projects will point to a default retention policy of infinite retention so your data will no be affected.

> [!CAUTION]
> This version bump migrates all your annotations to a new format. Do not restart the server while the migration is running. Ensure that the migration is complete. Restarting the server mid-migration could put the DB in a state that will require manual intervention.

## v6.x to v7.0.0

### Python Script to Populate Database Table For Sessions

#### Option I. Run the script via the installed module

This assumes the database up migration has been applied by the Phoenix application, i.e. the new table for sessions has been created. See Option II for how to manually apply the up migration.

> [!NOTE]
> If you are using a PostgreSQL database, you will have to have the postgres extras installed via `pip install arize-phoenix[pg]`.

```shell
python -m phoenix.db.migrations.data_migration_scripts.populate_project_sessions
```

#### Option II. Run the script from the repository (and apply the up migration manually).

Step 1. Clone the Phoenix repository.

```shell
git clone git@github.com:Arize-ai/phoenix.git
```

Step 2. Change directory to where `alembic.ini` is located.

```shell
cd phoenix/src/phoenix/db/
```

Step 3. Run `alembic` for database `up` migration. This creates the new table for sessions.

```shell
alembic upgrade head
```

Step 4. Run script to populate sessions table from spans.

```shell
python migrations/data_migration_scripts/populate_project_sessions.py
```

#### Environment Variables Used by the Script

SQLite example

```shell
export PHOENIX_SQL_DATABASE_URL=sqlite:////phoenix.db
```

PostgreSQL example

```shell
export PHOENIX_SQL_DATABASE_URL=postgresql://localhost:5432/postgres?username=postgres&password=postgres
```

Optionally for PostgreSQL, you can set the schema via the environment variable `PHOENIX_SQL_DATABASE_SCHEMA`.

## v4.x to v5.0.0

Phoenix 5 introduces authentication. By default authentication is disabled and Phoenix will operate exactly as previous versions. Phoenix's authentication is designed to be as flexible as possible and can be adopted incrementally.

With authentication enabled, all API and UI access will be gated with credentials or API keys. Because of this, you will encounter some down time so please plan accordingly.

Phoenix 5 also fully de-couples instrumentation from the Phoenix package. All instrumentation should be installed and run via the OpenInference package. This allows for more flexibility in instrumentation and allows Phoenix to focus on its core functionality.

### Enabling Authentication

To get started, simply set two environment variables for your deployment:

```shell
export PHOENIX_ENABLE_AUTH=True
export PHOENIX_SECRET=a-sufficiently-long-secret
```

Once these environment variables are set, Phoenix scaffold and admin login and the entire server will be protected. Log in as the admin user and create a system key to use with your application(s). All API keys should be added as headers to your requests via the `Authorization` header using the `Bearer` scheme.

For more details, please see the [authentication setup guide](https://arize.com/docs/phoenix/setup/authentication).

### Migrating to OpenInference

If you are using Phoenix's `phoenix.trace` modules for LlamaIndex, LangChain, or OpenAI, you will need to migrate to OpenInference. OpenInference is a separate set of packages that provides instrumentation for Phoenix. Phoenix 5 no longer supports LlamaIndex or LangChain instrumentation from the `phoenix.trace` module.

Phoenix now includes a `phoenix.otel` module that provides simplified setup for OpenTelemetry. See the [`phoenix.otel` documentation](https://arize.com/docs/phoenix/tracing/how-to-tracing/setup-tracing/setup-tracing-python) for more details.

**Before**

```python
from phoenix.trace.openai import OpenAIInstrumentor

OpenAIInstrumentor().instrument()
```

**After**

```python
from openinference.instrumentation.openai import OpenAIInstrumentor

OpenAIInstrumentor().instrument(tracer_provider=tracer_provider)
```

For an extensive list of supported instrumentation, please see the [OpenInference](https://github.com/Arize-ai/openinference)

## v3.x to v4.0.0

### Migrating from legacy `phoenix.Dataset` to `phoenix.Inferences`

- `phoenix.Dataset` has been renamed to `phoenix.Inferences`
- `phoenix.ExampleDataset` has been renamed to `phoenix.ExampleInferences`
- All other methods and related functions and classes remain under the `phoenix` namespace

#### Old

```python
from phoenix import Dataset, ExampleDataset
```

#### New

```python
from phoenix import Inferences, ExampleInferences
```

## Migrating from `phoenix.experimental.evals` to `phoenix.evals`

- Phoenix has now moved promoted the `evals` module out of experimental and can be installed as a separate extra.

### Installing and Using the `evals` module

#### Old

```shell
pip install arize-phoenix[experimental]
```

```python
from phoenix.experimental.evals import OpenAIModel
from phoenix.experimental.evals import llm_classify

model = OpenAIModel()

```

#### New

```shell
pip install arize-phoenix[evals]
```

```python
from phoenix.evals import OpenAIModel
from phoenix.evals import llm_classify
```

### Token counting has been removed `evals`

#### Old

```python
from phoenix.experimental.evals import OpenAIModel
from phoenix.experimental.evals import processing # no longer supported in phoenix.evals

model = OpenAIModel()
model.max_context_size  # no longer supported in phoenix.evals
model.get_token_count_from_messages(...)  # no longer supported in phoenix.evals
model.get_tokens_from_text(...)  # no longer supported in phoenix.evals
model.get_text_from_tokens(...)  # no longer supported in phoenix.evals
```

### `BaseEvalModel` has been renamed to `BaseModel`

When implementing a custom model wrapper for use with Phoenix, the base class has been renamed.

#### Old

```python
from phoenix.experimental.evals.models import BaseEvalModel  # renamed to BaseModel
```

#### New

```python
from phoenix.evals.models import BaseModel
```

### Some modules in `phoenix.evals` have been relocated and renamed

#### Old

```python
from phoenix.experimental.evals.functions import classify, generate
from phoenix.experimental.evals.templates import default_templates, template
```

#### New

```python
from phoenix.evals import classify, generate
from phoenix.evals import default_templates, templates
```

## v2.x to v3.0.0

- **v3.0.0** - Phoenix now exclusively uses [OpenInference](https://github.com/Arize-ai/openinference) for instrumentation. OpenInference uses OpenTelemetry Protocol as the means for sending traces to a collector.

### OpenAI Tracing

#### `phoenix.trace.tracer.Tracer` is defunct and should be removed.

##### Old (v2.x)

```python
from phoenix.trace.exporter import HttpExporter  # no longer necessary
from phoenix.trace.openai import OpenAIInstrumentor
from phoenix.trace.tracer import Tracer  # no longer supported

tracer = Tracer(exporter=HttpExporter())  # no longer supported
OpenAIInstrumentor(tracer).instrument()  # tracer argument is no longer supported
```

##### New (v3.0.0)

```python
from phoenix.trace.openai import OpenAIInstrumentor

OpenAIInstrumentor().instrument()
```

---

#### Endpoint should be configured via environment variables `PHOENIX_HOST`, `PHOENIX_PORT`, or `PHOENIX_COLLECTOR_ENDPOINT`.

##### Old (v2.x)

```python
from phoenix.trace.exporter import HttpExporter  # no longer necessary
from phoenix.trace.openai import OpenAIInstrumentor
from phoenix.trace.tracer import Tracer  # no longer supported

tracer = Tracer(exporter=HttpExporter(port=12345))  # no longer supported
OpenAIInstrumentor(tracer).instrument()  # tracer argument is no longer supported
```

##### New (v3.0.0)

```python
import os
from phoenix.trace.openai import OpenAIInstrumentor

os.environ["PHOENIX_PORT"] = "12345"
OpenAIInstrumentor().instrument()
```

---

#### Calling `.get_spans()` on a tracer is no longer supported. Use `px.Client()` to get the spans as a dataframe from Phoenix.

##### Old (v2.x)

```python
from phoenix.trace.trace_dataset import TraceDataset  # no longer necessary
from phoenix.trace.tracer import Tracer  # no longer supported

tracer = Tracer()  # no longer supported
TraceDataset.from_spans(tracer.get_spans())  # no longer supported
```

##### New (v3.0.0)

```python
import phoenix as px

px.Client().get_spans_dataframe()
```

---

### LlamaIndex Tracing

#### The standard way of instrumenting your LlamaIndex application remains the same between 2.x and 3.x:

```python
from llama_index import set_global_handler

set_global_handler("arize_phoenix")
```

---

#### User should not pass Phoenix handler to a callback manager. Use the `set_global_handler` method above.

```python
from llama_index.callbacks import CallbackManager  # no longer necessary
from phoenix.trace.llama_index import OpenInferenceTraceCallbackHandler  # no longer supported

callback_handler = OpenInferenceTraceCallbackHandler()  # no longer supported
CallbackManager(handlers=[callback_handler])  # no longer supported
```

---

#### Endpoint should be configured via environment variables `PHOENIX_HOST`, `PHOENIX_PORT`, or `PHOENIX_COLLECTOR_ENDPOINT`.

##### Old (v2.x)

```python
from llama_index import set_global_handler
from phoenix.trace.exporter import HttpExporter  # no longer necessary

exporter = HttpExporter(host="127.0.0.1", port=6007)  # no longer supported
set_global_handler("arize_phoenix", exporter=exporter)
```

#### New (v3.0.0)

```python
import os
from llama_index import set_global_handler

os.environ["PHOENIX_HOST"] = "127.0.0.1"
os.environ["PHOENIX_PORT"] = "6007"
set_global_handler("arize_phoenix")
```

---

#### Calling `.get_spans()` on a handler is no longer supported. Use `px.Client()` to get the spans as a dataframe from Phoenix.

#### Old (v2.x)

```python
from phoenix.trace.trace_dataset import TraceDataset  # no longer necessary
from phoenix.trace.llama_index import OpenInferenceTraceCallbackHandler  # no longer supported

handler = OpenInferenceTraceCallbackHandler()  # no longer supported
TraceDataset.from_spans(handler.get_spans())  # .get_spans() no longer supported
```

##### New (v3.0.0)

```python
import phoenix as px

px.Client().get_spans_dataframe()
```

---

### LangChain Tracing

#### `phoenix.trace.langchain.OpenInferenceTracer` is defunct and should be removed.

##### Old (v2.x)

```python
from phoenix.trace.langchain import LangChainInstrumentor, OpenInferenceTracer

tracer = OpenInferenceTracer()  # no longer supported
LangChainInstrumentor(tracer).instrument()  # tracer argument is no longer supported
```

##### New (v3.0.0)

```python
from phoenix.trace.langchain import LangChainInstrumentor

LangChainInstrumentor().instrument()
```

---

#### Endpoint should be configured via environment variables `PHOENIX_HOST`, `PHOENIX_PORT`, or `PHOENIX_COLLECTOR_ENDPOINT`.

##### Old (v2.x)

```python
from phoenix.trace.exporter import HttpExporter  # no longer necessary
from phoenix.trace.langchain import LangChainInstrumentor, OpenInferenceTracer

tracer = OpenInferenceTracer(exporter=HttpExporter(port=12345))  # no longer supported
LangChainInstrumentor(tracer).instrument()
```

##### New (v3.0.0)

```python
from phoenix.trace.langchain import LangChainInstrumentor

os.environ["PHOENIX_PORT"] = "12345"
LangChainInstrumentor().instrument()
```

---

#### Calling `.get_spans()` on a tracer is no longer supported. Use `px.Client()` to get the spans as a dataframe from Phoenix.

##### Old (v2.x)

```python
from phoenix.trace.trace_dataset import TraceDataset  # no longer necessary
from phoenix.trace.langchain import OpenInferenceTracer  # no longer supported

tracer = OpenInferenceTracer()  # no longer supported
TraceDataset.from_spans(tracer.get_spans())  # .get_spans() no longer supported
```

##### New (v3.0.0)

```python
import phoenix as px

px.Client().get_spans_dataframe()
```

## v0.x to v1.0.0

- **v1.0.0** - Phoenix now exclusively supports the `openai>=1.0.0` sdk. If you are using an older version of the OpenAI SDK, you can continue to use `arize-phoenix==0.1.1`. However, we recommend upgrading to the latest version of the OpenAI SDK as it contains many improvements. If you are using Phoenix with LlamaIndex and and LangChain, you will have to upgrade to the versions of these packages that support the OpenAI `1.0.0` SDK as well (`llama-index>=0.8.64`, `langchain>=0.0.334`)
