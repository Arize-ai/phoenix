# Trace corpus recorders

These scripts record application traffic through real OpenInference instrumenters.
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

## Generate varied recordings

`organic_conditions.json` defines authored changes to recorder inputs. Each condition names a base
fixture, a unique output fragment ID, an intensity, and one payload for each strength. Document
edits and matched local-tool result overlays are applied before the application runs. Keep every
condition fragment ID distinct from the IDs in `recorder_fixtures.json` and from other conditions.
Intensity below `0.2` selects `subtle`, intensity below `0.5` selects `moderate`, and all higher
valid values select `strong`.

All recorder commands accept `--condition` and `--append`. With neither flag, a recorder uses its
fixed fixtures and resets the output directory. A condition selects its one materialized fixture;
`--append` preserves existing rows so multiple conditions and archetypes can share a recording
directory.

Plain chat, RAG, tool agent, and structured extraction also accept `--provider scripted|live`.
Scripted is the default. Live recording requires an explicit `--model`, reads `OPENAI_API_KEY`, and
uses `OPENAI_BASE_URL` when it is set. For example:

```console
export OPENAI_API_KEY="..."
uv run --script scripts/datagen/tool_agent.py \
  --output-dir dist/datagen/recording \
  --condition support-stale-delivery-status \
  --provider live \
  --model gpt-5.4 \
  --append
```

Graph and guardrail recorders are deterministic applications and therefore expose condition and
append controls without provider or model options.

A live run records every instrumented invocation that emits trace IDs. Responses are not compared
with fixture-authored answers, and incomplete responses or traced application errors are retained.
A run fails the recording contract only when it emits no trace IDs. Review or evaluate quality
after recording; do not remove ambiguous outcomes from the generation stream.

An operating agent can choose conditions, model power, run count, and command order. To use Codex
with ChatGPT subscription access, authenticate once and ask the non-interactive command to inspect
the playbook and invoke recorder commands:

```console
codex login
codex exec 'Read scripts/datagen/README.md and scripts/datagen/organic_conditions.json. Choose varied conditions and models, run the applicable recorders into dist/datagen/recording with --append, and retain every run that emits trace IDs.'
```

`codex exec` chooses and runs commands in this workflow; it is not a provider implemented by the
recorders. Direct `--provider live` recorder calls use API credentials from the environment.

## Recorder environments

Every framework recorder has a PEP 723 dependency block and must be run with `uv run --script`.
This keeps recorder dependencies out of the Phoenix package and pins the instrumenter stack used
to create stored traces. Shared modules imported by those entry points use only the Python standard
library unless their dependency is declared in every importing script.

Each JSONL line in `traces.jsonl` is one protobuf-JSON `ExportTraceServiceRequest`. A single trace
may span multiple rows.

## Package a corpus

After all selected fixtures and conditions have been recorded into one directory:

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
