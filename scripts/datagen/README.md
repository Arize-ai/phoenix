# Trace corpus recorder

These scripts record deterministic trace traffic through real OpenInference instrumenters. The
result is OTLP protobuf JSON published to GCS and downloaded on demand, so replay does not install
the recording frameworks or add recorded traces to the Phoenix wheel.

The corpus is the set of recorded traces datagen replays; publish updates by uploading a new
archive and repointing `corpus.json`.

Each recorder pins its own instrumenter stack in a PEP 723 header, so it must be run with
`uv run --script` — a plain `uv run` would use the repository environment instead. `pyproject.toml`
sets `[tool.uv] exclude-newer = "3 days"`, so a pin must be at least three days old to resolve at
all; keep that in mind when bumping versions.

## Choose a generation backend

Initialize a generation run with `generate.py init --profile-set <profile-set.json>`. The profile
set fixes which application profiles may be sampled and is copied into the run as canonical
`profiles.json`; resumed runs never read mutable source profiles.

Use `--luna-provider openai_api` or `--frontier-provider openai_api` for the OpenAI Responses API.
Use `codex_exec` for subscription-authenticated non-interactive Codex execution, which returns
structured JSON results from a read-only isolated directory. Both record provider token usage on
the attempt. The two model bindings are independent, so one run may mix OpenAI and Codex attempts.

Both paths implement the structured request/result contract in `model_backend.py`. Self-play uses a
structured backend for user simulation while the assistant recorder continues through the real
framework client and OpenInference instrumenter, preserving authentic trace capture. The shared
request purpose also admits `judge` for the accepted-fragment outcome pass.

## Run a supplemental fault pass

Use a supplemental run when an existing schema-v2 archive needs new recorder behavior without
regenerating its accepted fragments. Verify the base archive before initialization, then bind its
identity and digest into the immutable run configuration. This example allocates ten fault cells
across all provider and tool modes while leaving enough eligible cells in both lanes:

```console
BASE_ARCHIVE=/path/to/corpus.tar.gz
BASE_CORPUS=corpus
BASE_SHA256=<verified-base-sha256>
RUN_DIR=dist/datagen-runs/<supplement-run>

test "$(shasum -a 256 "$BASE_ARCHIVE" | awk '{print $1}')" = "$BASE_SHA256"

uv run python scripts/datagen/generate.py init "$RUN_DIR" \
  --profile-set scripts/datagen/profiles/profile-set.json \
  --run-id <supplement-run> --seed <matrix-seed> \
  --luna-model <subscription-generation-model> \
  --frontier-model <subscription-judge-model> \
  --luna-provider codex_exec --frontier-provider codex_exec \
  --self-play-target 9 --scripted-target 9 \
  --fault-fraction 0.5555555555555556 \
  --fault-modes \
    provider_429=100,provider_timeout=100,malformed_response=100,tool_delay=1,tool_exception=1 \
  --base-scenario-name "$BASE_CORPUS" \
  --base-archive-sha256 "$BASE_SHA256"
```

Initialize a second directory with the same options before recording and compare `matrix.json`.
Cell IDs, fault modes, provider-fault turns, and base lineage must match exactly. Run only the
non-`none` cells through `scripted.generate_script` or `self_play.record_self_play_cell`, using
`CodexExecBackend` for generated text and the real recorder with the mock provider for trace
capture. Do not construct fragment or span JSON by hand. A selected provider fault must show its
one-shot retry, and a selected tool fault must show its delay or exception in the invocation
ledger before the candidate can be accepted.

Record one judging input per accepted fragment, then judge the run through its immutable
`codex_exec` frontier binding:

```console
for input_json in "$RUN_DIR"/judging-inputs-pending/*.json; do
  uv run python scripts/datagen/generate.py record-judging-input \
    "$RUN_DIR" "$input_json"
done
uv run python scripts/datagen/generate.py judge "$RUN_DIR"
```

Package the supplement with every instrumenter version represented by its recorded traces. Merge
it only with the digest-verified base declared at initialization:

```console
SUPPLEMENT_ARCHIVE="$RUN_DIR/supplement/corpus.tar.gz"
MERGED_ARCHIVE="$RUN_DIR/merged/corpus.tar.gz"

uv run python -m scripts.datagen.scenario package "$RUN_DIR" \
  --archive "$SUPPLEMENT_ARCHIVE" \
  --generated-at <ISO-8601-UTC-timestamp> \
  --generation-revision <git-revision> \
  --instrumenter-package <distribution>=<version>

uv run python -m scripts.datagen.scenario merge \
  --base "$BASE_ARCHIVE" \
  --supplement "$SUPPLEMENT_ARCHIVE" \
  --archive "$MERGED_ARCHIVE"

uv run python -m scripts.datagen.publish validate \
  --archive "$MERGED_ARCHIVE"
```

The merged manifest retains the base's top-level instrumenter map for schema-v2 compatibility.
`quality_gate_summary.merge_lineage` records the exact base and supplement maps separately, along
with each input archive digest and matrix identity. Before publication, confirm that every
requested fault mode has a non-zero fragment count, every fault has a terminal `survived`,
`degraded`, or `failed` judgment, and at least two fault traces contain the expected retry or
exception topology.

## Judge accepted outcomes

Outcome labels describe what the conversation delivered; they do not decide whether a valid
fragment belongs in the archive. `survived` means the result remained correct and appropriately
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

`openai_chat_sessions` and `langchain_agent_rag` record standalone trace sets. Both default
`--output-dir` to their directory under `dist/datagen-assets/`, replacing that recorder's
`traces.jsonl` and regenerating `manifest.json` from the spans actually recorded. The `dist/`
output is intentionally untracked. Neither manifest is the canonical schema-v2 form, so a
publishable archive comes from a generation run packaged by `scenario.py`.

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

Re-record and review the corpus whenever a pinned instrumenter version changes. This
version-bump workflow is the freshness mechanism for keeping stored span shapes aligned with
upstream instrumentation.

Every JSONL line is one protobuf-JSON `ExportTraceServiceRequest`; requests from a multi-span trace
may occupy multiple lines. Re-recorded assets are not package data and do not affect wheel size.

## Fetching the published corpus

Phoenix reads the public pointer at
`https://storage.googleapis.com/arize-phoenix-assets/datagen/corpus.json`, downloads its archive,
verifies the archive SHA-256, and publishes the extracted files into the local cache. A previously
cached pointer and corpus continue to work offline.

With no `--corpus`, replay uses a corpus bundled into the installation (Docker images bake one in
at build time) or, failing that, the published corpus. Development and private deployments pass
`--corpus <local directory>`. `XDG_CACHE_HOME` controls the cache root; otherwise Phoenix uses
`~/.cache/phoenix/datagen/corpus`.

## Replaying corpus traffic

`phoenix datagen` replays at a constant mean rate (`--rate`, `--burstiness`) and supports two
content controls:

- `--epsilon <probability>` sets the per-span token-inflation anomaly probability. The default
  is `0.02`.
- `--error-rate <probability>` sets the probability of injecting a synthetic LLM or tool error.
  The default is `0`.

## Publishing the corpus

Preparation is entirely local. `publish.py` validates the archive, stages it under its SHA-256,
writes the latest `corpus.json` pointer beside it, and prints the two
`gcloud storage cp` commands that would upload them. It holds no credentials and makes no network
write, so nothing reaches the bucket until someone runs those commands with their own `gcloud`
credentials.

Prepare a schema-v2 generation run with:

```console
uv run python -m scripts.datagen.publish prepare-run <run-dir> \
  --generated-at <ISO-8601-UTC-timestamp> \
  --generation-revision <git-revision> \
  --instrumenter-package <distribution>=<version> \
  --output-dir dist/datagen-publication
```

Repeat `--instrumenter-package` for every recorder dependency represented in the run. For an
already packaged schema-v2 archive, use `prepare-archive --archive <archive>` instead. Both
commands validate the canonical archive through the runtime
fetch and load path before staging anything.

For a merged supplemental archive, stop after staging and hand the command output to whoever holds
the bucket credentials:

```console
uv run python -m scripts.datagen.publish prepare-archive \
  --archive "$MERGED_ARCHIVE" \
  --output-dir dist/datagen-publication
```

Review the staged pointer, then run the printed commands in order. They have this form:

```console
gcloud storage cp --no-clobber \
  --cache-control="public,max-age=31536000,immutable" \
  "dist/datagen-publication/corpus/<sha256>/corpus.tar.gz" \
  "gs://arize-phoenix-assets/datagen/corpus/<sha256>/corpus.tar.gz"
gcloud storage cp \
  --cache-control="no-cache,max-age=0" \
  "dist/datagen-publication/corpus.json" \
  "gs://arize-phoenix-assets/datagen/corpus.json"
```

Upload the archive first and the pointer last. `--no-clobber` on the archive upload is what makes a
published corpus immutable: each archive lives at a path containing its own SHA-256, and the
upload refuses to overwrite an object that is already there, so republishing a changed archive
produces a new digest and a new path before `corpus.json` is repointed.
