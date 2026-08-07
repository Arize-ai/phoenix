# Phoenix Scripts

Utility, testing, data-generation, and CI scripts that support Phoenix development. Most Python scripts can be run with `uv run scripts/<path>`; some declare PEP 723 inline dependencies and others assume the project venv is active.

## Which data generator do I want?

Three directories generate data and they are not interchangeable — pick by what you need the
data to *do*, not by volume.

| I need… | Use | Why |
| --- | --- | --- |
| Traces that behave like real traffic | `generate_spans/` (`make seed`) | Exports over OTLP, so Phoenix computes costs, sessions, and rollups normally |
| A local Phoenix that looks lived-in | `make seed-all` | Every trace scenario **plus** datasets and experiments |
| Traces only, every shape | `make seed DATAGEN_SCENARIO=all` | Every scenario, each into its own project — no datasets or experiments |
| Datasets, experiments, evaluations | `experiments/` (`make seed-experiments`) | Drives the dataset → experiment → evaluation loop via the client and GraphQL |
| Millions of rows for storage/query perf | `generate_data_via_plpgsql/` | Writes Postgres directly — fast, but **no costs and no sessions** (it bypasses ingestion) |

Each directory has its own README with the full option list and its gotchas.

> **If `make` fails with `Required uv version ==0.11.12 does not match…`**, that is the exact
> pin in `pyproject.toml` (`[tool.uv] required-version`, kept in step with the Dockerfile's
> builder image), not a problem with the target. Either `uv self update 0.11.12`, or skip the
> wrapper and run the underlying command — every `make seed*` target is a thin wrapper:
>
> ```bash
> python -m scripts.generate_spans all --endpoint http://localhost:6006 --seed 42
> python scripts/experiments/generate_baseline_metrics_data.py --endpoint http://localhost:6006
> ```

## Top-level scripts

| Script | Purpose |
| --- | --- |
| `generate_sitemap.py` | Generate `sitemap.xml` from `docs.json` for the repo root and `docs/phoenix/`. |
| `seed_vendor_tool_spans.py` | Insert vendor-tool example spans (OpenAI Responses, Google, Bedrock, Anthropic) directly into the Phoenix DB via `PHOENIX_SQL_DATABASE_URL`. |
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

Parameterized experiment fixtures driving the dataset → experiment → evaluation loop. See
`experiments/README.md` for the script table and gotchas. Both support `--endpoint`,
`--examples`, `--seed`, `--dataset-name`, and `--dry-run`:

- `generate_baseline_metrics_data.py` — seed a sequence of improving experiments with a selected baseline.
- `generate_multipage_experiment_data.py` — seed a large experiment with realistic mixed evaluator results for pagination testing.

```bash
make seed-experiments
make seed-experiments DATAGEN_EXPERIMENT=generate_multipage_experiment_data.py \
  DATAGEN_ARGS="--examples 300"

# The scripts remain directly runnable.
uv run python scripts/experiments/generate_baseline_metrics_data.py --experiments 10
uv run python scripts/experiments/generate_multipage_experiment_data.py --examples 300
```

### `fixtures/`
Notebook fixtures used during demos and manual testing: `ChatRAG-Bench.ipynb`, `multi-turn_chat_sessions.ipynb`, `vision.ipynb`.

### `generate_data_via_plpgsql/`
PL/pgSQL-backed bulk data generation for performance testing. See `generate_data_via_plpgsql/README.md`.

### `generate_spans/`

One parameterized interface for synthetic OpenInference span data. Every scenario supports
`--endpoint`, `--project-name`, `--seed`, and `--dry-run`, followed by parameters specific to
its intent. See `generate_spans/README.md` for the scenario table, the contract for adding a
scenario, and the gotchas worth reading before editing these files.

```bash
# Seed a local Phoenix with the representative mixed workload.
make seed

# Seed every scenario at once, each into its own project.
# With DATAGEN_PROJECT/PHOENIX_PROJECT set, that value becomes a prefix (demo-rag, demo-agent).
make seed DATAGEN_SCENARIO=all

# Select and configure another scenario.
make seed DATAGEN_SCENARIO=time-series DATAGEN_ARGS="--days 30 --timezone America/Denver"

# Target a secured Phoenix project or collector and choose a reproducible seed.
PHOENIX_COLLECTOR_ENDPOINT=https://app.phoenix.arize.com \
PHOENIX_API_KEY=your-api-key \
PHOENIX_PROJECT=demo \
make seed DATAGEN_SEED=7 DATAGEN_ARGS="--traces 250"

# Inspect scenario-specific parameters or validate without exporting.
make seed-help DATAGEN_SCENARIO=costs
make seed DATAGEN_SCENARIO=costs DATAGEN_ARGS="--provider groq --dry-run"

# The underlying CLI remains available for direct use.
uv run python -m scripts.generate_spans --help
uv run python -m scripts.generate_spans mixed --traces 100 --max-depth 3
uv run python -m scripts.generate_spans agent --traces 25 --max-steps 4
uv run python -m scripts.generate_spans rag --traces 60 --top-k 4 --miss-rate 0.25
uv run python -m scripts.generate_spans prompts --traces 90 --v2-share 0.5
uv run python -m scripts.generate_spans axis-labels --traces 25
uv run python -m scripts.generate_spans nested --depth 6 --branches 2
uv run python -m scripts.generate_spans time-series --days 30 --timezone America/Denver
uv run python -m scripts.generate_spans token-details --days 7
uv run python -m scripts.generate_spans costs --provider openai --spans-per-model 2
uv run python -m scripts.generate_spans sessions --sessions 40 --users 12 --days 7
uv run python -m scripts.generate_spans large-session --turns 1000
uv run python -m scripts.generate_spans events --traces 10 --exceptions-per-trace 1
uv run python -m scripts.generate_spans edge-cases --list
uv run python -m scripts.generate_spans edge-cases --only unicode
```

Use `--dry-run` to validate a workload and inspect its counts without sending data. The
individual Python files remain directly executable for focused development.

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

### `uv/`
- `type_check` — wrapper invoked by Make targets for typecheck.

## Running scripts

```bash
# In the project venv
uv run python scripts/<path>/<script>.py

# PEP 723 scripts (declare their own deps inline) work standalone
uv run scripts/ddl/generate_ddl_postgresql.py
uv run python -m scripts.generate_spans time-series
uv run scripts/perf/postgres/postgres_explain_analyze.py
```

OpenTelemetry scripts default to Phoenix at `http://localhost:6006`. The vendor-tool fixture
reads `PHOENIX_SQL_DATABASE_URL`; PL/pgSQL scripts accept standard connection flags and
`PGPASSWORD`.
