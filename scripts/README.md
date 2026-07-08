# Phoenix Scripts

Utility, testing, data-generation, and CI scripts that support Phoenix development. Most Python scripts can be run with `uv run scripts/<path>`; some declare PEP 723 inline dependencies and others assume the project venv is active.

## Top-level scripts

| Script | Purpose |
| --- | --- |
| `generate_sitemap.py` | Generate `sitemap.xml` from `docs.json` for the repo root and `docs/phoenix/`. |
| `generate_spans_with_event_attributes.py` | Send synthetic OTel spans with custom event attributes to a local Phoenix at `:6006`. |
| `seed_vendor_tool_spans.py` | Insert vendor-tool example spans (OpenAI Responses, Google, Bedrock, Anthropic) directly into the Phoenix DB via `PHOENIX_SQL_DATABASE_URL`. |
| `test_axis_label_clipping.py` | Reproduce issue #11312 — emit traces with long model names to test Metrics chart axis rendering. |
| `update_helm.py <version>` | Bump the Phoenix version in `helm/values.yaml` and `helm/Chart.yaml`. |
| `update_kustomize.py <version>` | Bump the Phoenix Docker image version in `kustomize/base/phoenix.yaml`. |

## Subdirectories

### `analytics/`
GitHub + PyPI usage analytics. See `analytics/README.md`. Requires `GITHUB_TOKEN`.

### `benchmarks/`
- `hallucination_eval_benchmark.ipynb` — notebook benchmarking the hallucination evaluator.

### `ci/`
Scripts run from CI workflows.
- `compile_openapi_schema.py` — emit Phoenix's OpenAPI schema to a file.
- `ensure_graphql_mutations_have_permission_classes.py` — enforce `IsNotReadOnly` / `IsNotViewer` on Strawberry mutations and subscriptions.
- `test_helm.py` — comprehensive Helm chart validation with async concurrency.
- `json-canonicalization-schema/` — fixtures/schema for canonicalization tests.

### `data/`
Data wrangling and corpus building (LangChain / LlamaIndex / HaluEval / MS MARCO / WikiQA / Wiki Toxic).
- `build_langchain_vector_store.py`, `build_llama_index_*.py` — build vector stores over the Arize docs.
- `convert_arize_docs_query_csv_to_jsonl.py`, `fetch_arize_documentation.py` — corpus prep.
- `generate_traces.py` — emit synthetic LLM traces.
- `wrangle_*.ipynb` — dataset preparation notebooks.

### `ddl/`
- `generate_ddl_postgresql.py` — extract DDL from a PostgreSQL Phoenix DB into a deterministic `postgresql_schema.sql`, validated with `pglast`. PEP 723 script.
- `postgresql_schema.sql` — checked-in canonical schema.

### `docker/devops/`
Local docker-compose stack for development: Phoenix, OIDC, LDAP, SMTP, Grafana, Prometheus, Toxiproxy, Vite dev server, k8s manifests. See `docker/devops/README.md`.

### `evaluators/`
GraphQL smoke tests for the chat / playground / evaluator surface.
- `test_chat_mutation.py`, `test_chat_subscription.py` — `chatCompletion` mutation/subscription.
- `test_chat_over_dataset.py`, `test_chat_over_dataset_mutation.py` — `chatCompletionOverDataset`.
- `test_create_llm_evaluator.py` — `createDatasetLlmEvaluator` mutation.

### `experiments/`
- `generate_multipage_experiment_data.py` — seed an experiment with 300 examples for pagination testing.

### `fixtures/`
Notebook fixtures used during demos and manual testing: `ChatRAG-Bench.ipynb`, `multi-turn_chat_sessions.ipynb`, `vision.ipynb`.

### `generate_data_via_plpgsql/`
PL/pgSQL-backed bulk data generation for performance testing. See `generate_data_via_plpgsql/README.md`.

### `generate_spans/`
- `generate_spans_deeply_nested.py` — emit deeply nested span trees.
- `generate_spans_for_time_series.py` — emit spans spread over time for time-series charts (PEP 723 script).

### `generate_spans_for_cost_calculations/`
- `generate_spans_for_cost_calculations.py` — emit spans across many models/providers to exercise cost calculation.

### `generate_spans_for_large_session/`
- `generate_spans_for_large_session.py` — emit a single very large session for stress-testing the session view.

### `llm_token_pricing_tables/`
- `litellm_model_prices.py` — fetch LiteLLM model pricing JSON, output `model_prices.csv` and `model_prices_by_token_type.csv`.

### `mock-llm-server/`
TypeScript mock for OpenAI / Anthropic / Google GenAI APIs with a real-time dashboard. See `mock-llm-server/README.md`.

### `perf/`
- `get_spans_dataframe_for_random_conversation_id.py` — sample a random `conversation_id` from PG, then time `Client.spans.get_spans_dataframe`.
- `postgres/postgres_explain_analyze.py` — run `EXPLAIN ANALYZE` over queries in `paste_queries_here.sql` (PEP 723 script).

### `prompts/`
- `compile_python_prompts.py` — compile YAML prompts into Python.
- `compile_typescript_prompts.py` — compile YAML prompts into TypeScript.

### `rag/`
- `llamaindex_retrieval_chunk_eval.ipynb` — RAG retrieval evaluation notebook.
- `plotresults.py` — plot helper for the notebook above.

### `testing/`
Smoke tests intended to be run against a live Phoenix instance.
- `dataset_upsert_smoke.py` / `.ts` — exercise the dataset upsert/update flow end to end.
- `experiment_runs_filters.ipynb` — interactive filter exploration.
- `send_spans.py` — emit synthetic OpenInference spans.

### `uv/`
- `type_check` — wrapper invoked by Make targets for typecheck.

## Running scripts

```bash
# In the project venv
uv run python scripts/<path>/<script>.py

# PEP 723 scripts (declare their own deps inline) work standalone
uv run scripts/ddl/generate_ddl_postgresql.py
uv run scripts/generate_spans/generate_spans_for_time_series.py
uv run scripts/perf/postgres/postgres_explain_analyze.py
```

Most span-generation scripts assume Phoenix is reachable at `http://localhost:6006`; DB-direct scripts read `PHOENIX_SQL_DATABASE_URL`.
