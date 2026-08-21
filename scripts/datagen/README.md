# Trace scenario recorder

These scripts record deterministic scenario traffic through real OpenInference instrumenters. The
result is OTLP protobuf JSON published to GCS and downloaded on demand, so replay does not install
the scenario frameworks or add recorded traces to the Phoenix wheel.

Each recorder pins its own instrumenter stack in a PEP 723 header, so it must be run with
`uv run --script` — a plain `uv run` would use the repository environment instead. `pyproject.toml`
sets `[tool.uv] exclude-newer = "3 days"`, so a pin must be at least three days old to resolve at
all; keep that in mind when bumping versions.

## The keyless mock provider

Every recorder that speaks to an LLM speaks to the in-repo mock provider, never to an external
service. Start it in its own shell and leave it running:

```console
uv run --script scripts/datagen/mock_openai_provider.py --port 8765
```

It serves both buffered and streaming (SSE) chat completions and fills each caller's own declared
tool schema, so the same provider backs every recorder below.

## Recorders with a command-line entry point

`openai_chat_sessions` and `langchain_agent_rag` write the starter assets. Both default
`--output-dir` to their directory under `dist/datagen-assets/`, replacing that scenario's
`traces.jsonl` and regenerating `manifest.json` from the spans actually recorded. The `dist/`
output is intentionally untracked; package it and publish it through the asset workflow.

```console
OPENAI_API_KEY=datagen-dummy-key OPENAI_BASE_URL=http://127.0.0.1:8765/v1 \
  uv run --script scripts/datagen/openai_chat_sessions.py

uv run --script scripts/datagen/langchain_agent_rag.py

OPENAI_API_KEY=datagen-dummy-key OPENAI_BASE_URL=http://127.0.0.1:8765/v1 \
  uv run --script scripts/datagen/tool_agent.py \
    --prompt "When should my standard-delivery order 10001 arrive?" \
    --output-dir <dir> --cell-id <64-hex>
```

`langchain_agent_rag` records LlamaIndex despite its name, and needs no provider — its LLM,
embedding, and rerank transports are faked in `rag.py`. `tool_agent` requires `--output-dir` and a
64-character lowercase hexadecimal `--cell-id`; it writes `traces.jsonl`, `messages.json`, and
`tool-invocations.jsonl` and is a generation lane, not a starter asset.

## Recorders driven as libraries

`graph_multi_agent`, `guardrailed_app`, and `structured_extraction` expose `record()` but no
`main()`. Export the script's pinned environment, then drive it from a short script run in that
environment:

```console
uv export --script scripts/datagen/graph_multi_agent.py -o /tmp/recorder-reqs.txt
uv run --no-project --python 3.11 --with-requirements /tmp/recorder-reqs.txt python drive.py
```

`drive.py` puts `scripts/datagen` on `sys.path`, installs the archetype's instrumentor on a
`TracerProvider`, and calls `record()`:

- `graph_multi_agent` — add `OpenInferenceContextSpanProcessor()` alongside the span exporter (it
  is what puts `session.id` on callback-created spans), instrument with `LangChainInstrumentor`,
  then `GraphMultiAgentRecorder(exporter).record(session_id, prompt, traces_path)`. Needs no
  provider.
- `structured_extraction` — instrument with `OpenAIInstrumentor` and pass an `OpenAI` client
  pointed at the mock provider, then
  `StructuredExtractionRecorder(client, exporter).record(ExtractionRequest(...))`.
- `guardrailed_app` — call `record(output_dir)`; it installs `GuardrailsInstrumentor` itself and
  needs no provider. It is pinned to `guardrails-ai==0.5.0` because that is the newest release the
  published OpenInference Guardrails instrumenter supports; bumping it silently disables
  instrumentation. Its first run downloads the NLTK `punkt` tokenizer to `~/nltk_data`, so pre-seed
  `NLTK_DATA` for an offline environment. Subsequent runs are offline.

## Freshness

Re-record and review the scenario assets whenever a pinned instrumenter version changes. This
version-bump workflow is the freshness mechanism for keeping stored span shapes aligned with
upstream instrumentation.

Every JSONL line is one protobuf-JSON `ExportTraceServiceRequest`; requests from a multi-span trace
may occupy multiple lines. Re-recorded assets are not package data and do not affect wheel size.

## Fetching published assets

Phoenix reads the public index at
`https://storage.googleapis.com/arize-phoenix-assets/datagen/index.json`, downloads a selected
archive, verifies its indexed byte size and SHA-256, verifies schema-v2 per-file hashes from the
manifest, and publishes the extracted files into the local cache. Schema-v1 starter manifests do
not contain per-file hashes, so their indexed archive hash plus cache-local file hashes preserve
their existing bytes. A previously cached index and scenario continue to work offline.

Set `PHOENIX_DATAGEN_ASSETS_BASE_URL` to an alternate HTTPS prefix for development or a private
deployment. The prefix must expose `index.json`, whose scenario entries continue to use absolute
HTTPS archive URLs. `XDG_CACHE_HOME` controls the cache root; otherwise Phoenix uses
`~/.cache/phoenix/datagen`.

## Publishing a scenario archive

Package an accepted generation run with `package_generation_run` from `scripts.datagen.bank`, then
upload the resulting `<scenario-name>.tar.gz` file as the only file in a workflow artifact. Keep
the source workflow run ID and artifact name; the publication workflow downloads that immutable
input rather than running generation again. Legacy schema-v1 starter archives may contain the
unchanged `manifest.json` and `traces.jsonl` under a single `<scenario-name>/` directory.

Run the **Publish datagen assets** workflow with a unique lowercase `pass_id`, the source workflow
run ID, the artifact name, the exact archive filename, and its schema version. The workflow uploads
the archive to a digest-addressed object under `gs://<bucket>/<prefix>/scenarios/` and then replaces
the public index. Its fixed concurrency group prevents simultaneous publications from losing an
index update.

Before any object is published, the workflow requires exactly one downloaded file and validates it
through the runtime fetch and load path. Schema-v2 banks also pass `read_v2_bank`, which checks the
canonical archive layout, manifest schema, per-file digests and sizes, trace membership, and
manifest counts. The archive filename must match the manifest scenario name, and the staged index
entry must pass Phoenix's runtime parser. Any mismatch stops the pass before GCS mutation.

The workflow writes the archive digest, object path, and validated bank counts to the GitHub Actions
step summary. It also uploads a `datagen-assets-<pass_id>-publication` artifact containing:

```text
generation-summary.md
index.json
```

The GCS upload uses Workload Identity Federation. Configure repository variables
`GCP_WORKLOAD_IDENTITY_PROVIDER` and `GCP_DATAGEN_ASSETS_SERVICE_ACCOUNT`. The bucket defaults to
the existing public `arize-phoenix-assets` bucket and the `datagen` prefix; override them with
`DATAGEN_ASSETS_GCS_BUCKET` and `DATAGEN_ASSETS_GCS_PREFIX`. The publishing identity needs object
create permission under the scenario prefix and object update permission for `index.json`.
