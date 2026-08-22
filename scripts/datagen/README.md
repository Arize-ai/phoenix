# Trace scenario recorder

These scripts record deterministic scenario traffic through real OpenInference instrumenters. The
result is OTLP protobuf JSON published to GCS and downloaded on demand, so replay does not install
the scenario frameworks or add recorded traces to the Phoenix wheel.

Each recorder pins its own instrumenter stack in a PEP 723 header, so it must be run with
`uv run --script` — a plain `uv run` would use the repository environment instead. `pyproject.toml`
sets `[tool.uv] exclude-newer = "3 days"`, so a pin must be at least three days old to resolve at
all; keep that in mind when bumping versions.

## Choose a generation backend

Initialize a generation run with `generate.py init --profile-set <profile-set.json>`. The profile
set fixes which application profiles may be sampled and is copied into the run as canonical
`profiles.json`; resumed runs never read mutable source profiles.

Use `--luna-provider openai_api` or `--frontier-provider openai_api` for priced Responses and Batch
execution. These attempts require entries in `pricing.json`, reserve their worst-case token cost,
and reconcile actual usage against the run budget. Use `codex_exec` for subscription-authenticated
non-interactive Codex execution. Codex runs are direct-only, use structured JSON results in a
read-only isolated directory, and record provider usage without reserving or reporting USD spend.
The two model bindings are independent, so one run may mix priced OpenAI and subscription Codex
attempts.

Both paths implement the structured request/result contract in `model_backend.py`. Scripted
conversations can use a direct backend or the OpenAI Batch adapter. Self-play uses a structured
backend for user simulation while the assistant recorder continues through the real framework
client and OpenInference instrumenter, preserving authentic trace capture. The shared request
purpose also admits `judge` for the accepted-fragment outcome pass.

## Judge accepted outcomes

Outcome labels describe what the conversation delivered; they do not decide whether a valid
fragment belongs in the bank. `survived` means the result remained correct and appropriately
cautious, `degraded` means a material but bounded loss left it usable or recoverable, and `failed`
means the result was materially wrong, unsafe, or unusable. All three remain product data.

Record one complete `JudgingInputV1` for every accepted fragment with
`generate.py record-judging-input`, then run `generate.py judge`. The pass uses the run's immutable
frontier model and provider binding. It judges every fragment with recorded seed proximity and a
deterministic stratified five-percent sample of the remainder. Exact completed rows resume without
another model call; transport failures remain retryable provider attempts and do not become
fragment rejects.

The run keeps `judging-inputs.jsonl` and `judgments.jsonl` as generation sidecars. Packaging
projects their seed, route, label, and rationale metadata into each fragment's existing
`quality_results["judged_outcome"]` mapping and matching manifest aggregates. The published
schema-v2 archive still contains only `manifest.json`, `fragments.jsonl`, and `traces.jsonl`.

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
output is intentionally untracked; package, validate, and publish it manually.

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

## Replaying scenario traffic

`phoenix datagen` supports four replay realism controls:

- `--rate-schedule {flat,business-hours}` selects a constant rate or a weekly business-hours
  profile. The default is `flat`.
- `--timezone <IANA-name>` selects the timezone used to evaluate the business-hours profile. The
  default is `UTC`.
- `--backfill <duration>` starts the virtual replay timeline in the past. Durations use a positive
  number followed by `s`, `m`, `h`, or `d`, such as `48h`.
- `--error-rate <probability>` sets the probability of injecting a synthetic LLM or tool error.
  The default is `0`.

## Publishing a scenario archive

Publication is an owner-run operation. Prepare a schema-v2 generation run locally with:

```console
uv run python -m scripts.datagen.publish prepare-run <run-dir> \
  --scenario-name <scenario-name> \
  --generated-at <ISO-8601-UTC-timestamp> \
  --generation-revision <git-revision> \
  --instrumenter-package <distribution>=<version> \
  --output-dir dist/datagen-publication
```

Repeat `--instrumenter-package` for every recorder dependency represented in the run. For an
already packaged schema-v1 or schema-v2 archive, use `prepare-archive --archive <archive>
--asset-schema-version <1-or-2>` instead. Both commands validate the canonical archive through the
runtime fetch and load path, fetch the current public index, stage the archive under its SHA-256,
write the next `index.json`, and print the exact upload commands.

Review the staged index, then run the printed commands in order. They have this form:

```console
gcloud storage cp --no-clobber \
  --cache-control="public,max-age=31536000,immutable" \
  "dist/datagen-publication/scenarios/<scenario>/<sha256>/<scenario>.tar.gz" \
  "gs://arize-phoenix-assets/datagen/scenarios/<scenario>/<sha256>/<scenario>.tar.gz"
gcloud storage cp \
  --cache-control="no-cache,max-age=0" \
  "dist/datagen-publication/index.json" \
  "gs://arize-phoenix-assets/datagen/index.json"
```

Upload the immutable archive first and the index last. Re-run the preparation command immediately
before publishing so the staged index is based on the current remote index.
