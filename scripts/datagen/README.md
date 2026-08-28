# Trace corpus recorders

These scripts record application traffic through real OpenInference instrumenters.
The resulting corpus contains raw OTLP protobuf JSON requests and the fragment rows used by the
Phoenix datagen composer. A **fragment** is one replayable unit — a conversation turn or an agent
episode — pointing at the recorded traces it produced. Recording frameworks remain outside Phoenix
runtime dependencies.

## Fixed inputs

`recorder_fixtures.json` contains the application inputs for every retained recorder:

- a stable fragment ID;
- an archetype (which kind of application produced the trace — plain chat, RAG, tool agent,
  graph agent, guardrails, or structured extraction) and a domain (its subject area, such as
  customer support or coding);
- direct prompts, turns, documents, or expected structured values.

The fixtures contain no sampling weights or generated text. Each recorder receives a
`RecorderFixture`, appends OTLP requests to `traces.jsonl`, and returns the trace IDs it emitted.
`record_fixture` then appends the matching fragment row (`fragment_id`, `archetype`, `domain`,
`trace_ids`) to `fragments.jsonl`.

The fixture set includes multiple examples for plain chat, RAG, tool agents, graph agents,
guardrails, and structured extraction. Success, blocked, redacted, conflicting-source, and
incomplete-input examples are represented directly in the app inputs.

Tool-agent fixtures may carry `prompt_variants`: alternative phrasings of the opening prompt.
Live recording picks one phrasing per run, so repeated runs of the same task do not open with
identical text. Coding fixtures without a deterministic scripted episode are skipped by
scripted auto-selection and record live only.

## Offline providers and tools

`ScriptedOpenAIProvider` serves a fixed sequence of text, tool-call, or HTTP responses through an
in-process `httpx` transport. It supports buffered and streaming chat completions without a network
connection or API key.

`local_tools` exposes deterministic document search, record lookup, status lookup, arithmetic,
and ticket creation over `tool_fixtures.json`. The file contains separate customer-support,
analytics, and coding data sets.

## Generate varied recordings

`organic_conditions.json` defines authored input variations: degraded versions of the base
fixture inputs that let response-quality issues arise naturally rather than by script. Each
condition names a base fixture, a unique output fragment ID, an intensity, and one payload per
intensity level. Document edits, replacements at existing fixture-input paths, and
matched local-tool result overlays are applied before the application runs. Input replacements
cannot add or remove structure. Keep every condition fragment ID distinct from the IDs in
`recorder_fixtures.json` and from other conditions. Intensity selects the level:

| Intensity | Level |
| --------- | ----- |
| below 0.2 | `subtle` |
| below 0.5 | `moderate` |
| 0.5 and above | `strong` |

All recorder commands accept `--condition` and `--append`. With neither flag, a recorder uses its
fixed fixtures and resets the output directory. `--condition` runs the one fixture with that
condition's edits applied; `--append` preserves existing rows so multiple conditions and
recorders can share a recording directory.

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

Live plain-chat conversations run until the simulated user closes them. A target turn count
(drawn per fixture, or set with `--target-turns`) controls when the simulator is told to wrap
up once its current concern is addressed; the conversation ends at that natural closing
message, with a hard cap at twice the target. Live model aliases: `luna` and `terra` resolve
to their provider model IDs with tool-calling options applied.

A live run records every instrumented invocation that emits trace IDs. Responses are not compared
with fixture-authored answers, and incomplete responses or traced application errors are retained.
A run fails only when it emits no trace IDs. Review or evaluate quality after recording; keep
ambiguous outcomes in the recorded set.

### Recording playbook (all recorders, one directory)

Choose one live model for the batch and run these commands in order. The first command starts a new
recording and captures every scripted tool fixture, including the longer coding sessions. Each later
command appends either all base fixtures for one recorder or its authored condition. The resulting
recording contains more than two dozen fragments across all six archetypes.

```console
export DATAGEN_MODEL="gpt-5-mini"

uv run --script scripts/datagen/tool_agent.py \
  --output-dir dist/datagen/recording

uv run --script scripts/datagen/openai_chat_sessions.py \
  --output-dir dist/datagen/recording \
  --provider live --model "$DATAGEN_MODEL" --append
uv run --script scripts/datagen/openai_chat_sessions.py \
  --output-dir dist/datagen/recording \
  --condition support-late-express-ambiguity \
  --provider live --model "$DATAGEN_MODEL" --append

uv run --script scripts/datagen/llama_index_rag.py \
  --output-dir dist/datagen/recording \
  --provider live --model "$DATAGEN_MODEL" --append
uv run --script scripts/datagen/llama_index_rag.py \
  --output-dir dist/datagen/recording \
  --condition research-fleet-delivery-pressure \
  --provider live --model "$DATAGEN_MODEL" --append

uv run --script scripts/datagen/tool_agent.py \
  --output-dir dist/datagen/recording \
  --provider live --model "$DATAGEN_MODEL" --append
uv run --script scripts/datagen/tool_agent.py \
  --output-dir dist/datagen/recording \
  --condition support-stale-delivery-status \
  --provider live --model "$DATAGEN_MODEL" --append

uv run --script scripts/datagen/structured_extraction.py \
  --output-dir dist/datagen/recording \
  --provider live --model "$DATAGEN_MODEL" --append
uv run --script scripts/datagen/structured_extraction.py \
  --output-dir dist/datagen/recording \
  --condition analytics-corrected-refund-export \
  --provider live --model "$DATAGEN_MODEL" --append

uv run --script scripts/datagen/graph_multi_agent.py \
  --output-dir dist/datagen/recording --append
uv run --script scripts/datagen/guardrailed_app.py \
  --output-dir dist/datagen/recording --append
```

Keep every command result that reports trace IDs, including responses that are incomplete,
ambiguous, or accompanied by a traced application error. If a command reports no trace IDs, fix
that recorder before continuing so later `--append` calls do not hide the missing fragment.

Anyone — or any coding agent — running this playbook can choose the conditions, models, run
count, and command order. To use Codex with ChatGPT subscription access, authenticate once and ask
the non-interactive command to inspect the playbook and invoke recorder commands:

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

Tests for the packaging pipeline (conditions, packer, fetcher roundtrip) live in `tests/` next to
this file and run with `uv run pytest scripts/datagen/tests`. They are separate from the Phoenix
unit test suite: CI runs them in the Datagen Tooling Tests job when files under `scripts/datagen/`
or `src/phoenix/datagen/` change. Recorder behavior has no unit tests; verify recorders by
generating a corpus.

## Package a corpus

After all selected fixtures and conditions have been recorded into one directory, package the
recording. The printed statistics include `opening_diversity_by_domain` — distinct opening
inputs per domain — so low seed variety is visible before publication:

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
