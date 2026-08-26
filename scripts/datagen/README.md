# Trace corpus recorders

These scripts record deterministic application traffic through real OpenInference instrumenters.
The resulting corpus contains raw OTLP protobuf JSON requests and the fragment rows used by the
Phoenix datagen composer. Recording frameworks remain outside Phoenix runtime dependencies.

## Fixed inputs

`recorder_fixtures.json` contains the application inputs for every retained recorder:

- a stable fragment ID;
- an archetype and domain;
- direct prompts, turns, documents, or expected structured values.

The fixtures contain no sampling weights or generated text. Each recorder receives a
`RecorderFixture`, appends OTLP requests to `traces.jsonl`, and returns the trace IDs it emitted.
`record_fixture` then appends the matching four-field row to `fragments.jsonl`.

The fixture set includes multiple examples for plain chat, RAG, tool agents, graph agents,
guardrails, and structured extraction. Success, blocked, redacted, conflicting-source, and
incomplete-input examples are represented directly in the app inputs.

## Offline providers and tools

`ScriptedOpenAIProvider` serves a fixed sequence of text, tool-call, or HTTP responses through an
in-process `httpx` transport. It supports buffered and streaming chat completions without a network
connection or API key.

`local_tools` exposes deterministic document search, record lookup, status lookup, arithmetic,
and ticket creation over `tool_fixtures.json`. The file contains separate customer-support,
analytics, and coding data sets.

## Recorder environments

Every framework recorder has a PEP 723 dependency block and must be run with `uv run --script`.
This keeps recorder dependencies out of the Phoenix package and pins the instrumenter stack used
to create stored traces. Shared modules imported by those entry points use only the Python standard
library unless their dependency is declared in every importing script.

Each JSONL line in `traces.jsonl` is one protobuf-JSON `ExportTraceServiceRequest`. A single trace
may span multiple rows.

## Package a corpus

After all selected fixtures have been recorded into one directory:

```console
uv run python -m scripts.datagen.corpus <recording-dir> \
  --archive dist/datagen/corpus.tar.gz
```

The archive contains only `fragments.jsonl` and `traces.jsonl`.

Validate or stage the archive for manual publication:

```console
uv run python -m scripts.datagen.publish validate \
  --archive dist/datagen/corpus.tar.gz

uv run python -m scripts.datagen.publish prepare-archive \
  --archive dist/datagen/corpus.tar.gz \
  --output-dir dist/datagen-publication
```

Preparation prints the exact commands for uploading the digest-addressed archive first and the
public pointer second.

## Freshness

Re-record and review the corpus whenever a pinned instrumenter version changes. This keeps stored
span shapes aligned with the framework and instrumenter versions declared by each recorder.
