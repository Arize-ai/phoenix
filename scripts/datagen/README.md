# Trace scenario recorder

These scripts record deterministic scenario traffic through real OpenInference instrumenters. The
result is checked-in OTLP protobuf JSON that can be replayed without installing the scenario
frameworks at runtime.

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

`openai_chat_sessions` and `langchain_agent_rag` write the bundled starter assets. Both default
`--output-dir` to their directory under `src/phoenix/datagen/assets/`, replacing that scenario's
`traces.jsonl` and regenerating `manifest.json` from the spans actually recorded.

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
may occupy multiple lines. Bundled starter assets must stay under the 512 KiB ceiling enforced on
the wheel by the publish workflow.

## Publishing a full scenario bank

Full banks are distributed as checksum-pinned GitHub release assets. Package an accepted
generation run with `package_generation_run` from `scripts.datagen.bank`, then upload the resulting
`<scenario-name>.tar.gz` file as the only file in a workflow artifact. Keep the source workflow run
ID and artifact name; the publication workflow downloads that immutable input rather than running
generation again.

Run the **Publish datagen assets** workflow with a unique lowercase `pass_id`, the source workflow
run ID, the artifact name, and the exact archive filename. A pass named `20260821-01` creates the
plain release tag and name `datagen-assets-20260821-01`. The archive is uploaded under its original
`<scenario-name>.tar.gz` filename, and the release is explicitly excluded from GitHub's latest
release selection.

Before any release is created, the workflow requires exactly one downloaded file and validates the
complete bank with `read_v2_bank`. This checks the canonical archive layout, manifest schema,
per-file digests and sizes, trace membership, and manifest counts. It also verifies that the
archive filename matches the manifest scenario name and that the staged index entry can be loaded
through Phoenix's runtime index parser. Any mismatch stops the pass before release mutation.

The workflow writes the validated counts, revision, matrix digest, archive digest, and archetypes to
both the release notes and the GitHub Actions step summary. It also uploads a
`datagen-assets-<pass_id>-index-update` artifact containing:

```text
asset-index.patch
generation-summary.md
release-metadata.json
src/phoenix/datagen/assets/index.json
```

Use the complete index file at its in-tree path as the input to the next application release. The
unified patch is included as a reviewer aid. The entry points to the immutable release URL and pins
the archive SHA-256 and byte size; do not edit those values independently of the published asset.
