# Phoenix Tracing: ATIF Trajectory Import (Python)

**Import agent trajectories from ATIF-compatible frameworks into Phoenix as traces.**

## Overview

ATIF (Agent Trajectory Interchange Format) is an open schema for recording agent execution. Frameworks like **Claude Code**, **OpenHands**, **Gemini CLI**, and **Codex** export ATIF via [Harbor](https://www.harborframework.com/docs). The `phoenix-client` package converts ATIF JSON into OpenTelemetry span trees and uploads them to Phoenix.

Supports ATIF schema versions v1.0 through v1.7. Callers load the documents themselves — the helper does not read referenced files, fetch URLs, or upload media bytes.

## Installation

```bash
pip install arize-phoenix-client
```

## Quick Start

```python
import json
from phoenix.client import Client
from phoenix.client.helpers.atif import upload_atif_trajectories_as_spans

with open("trajectory.json") as f:
    trajectory = json.load(f)

client = Client()
result = upload_atif_trajectories_as_spans(
    client, [trajectory], project_name="my-agent-eval"
)
# {"total_received": 5, "total_queued": 5}
```

## Signature

```python
def upload_atif_trajectories_as_spans(
    client: Client,
    trajectories: Sequence[Mapping[str, Any]],
    *,
    project_name: str,
    timeout: Optional[int] = 30,
) -> v1.CreateSpansResponseBody:
```

- `client` — a `phoenix.client.Client` instance
- `trajectories` — one or more ATIF trajectory dicts (v1.0–v1.7); put parents before external children
- `project_name` — the Phoenix project to upload spans into
- `timeout` — request timeout in seconds (default: 30)

Raises `ValueError` when a trajectory or the resulting span graph fails validation.

## Trace Hierarchy

Each trajectory gets an AGENT root. Spans are named by their target, since the
span kind already names the operation: the agent name for the root, the model
name for LLM calls, the tool name for tool calls. Each fresh agent step becomes
a CHAIN span named `iteration N`; context-management steps become
`compaction N` and operational system steps `system event N`. User messages are
prompt context, not spans.

**Single-turn** — every step hangs off the root:
```
AGENT assistant
  CHAIN iteration 1
    LLM gpt-4
    TOOL search
  CHAIN iteration 2
    LLM gpt-4
```

**Multi-turn** — one AGENT span per turn. A turn opens at each user message
that follows agent activity, so leading system steps and consecutive context
messages stay in the turn they introduce:
```
AGENT assistant
  AGENT turn 1
    CHAIN iteration 1
      LLM gpt-4
      TOOL search
  AGENT turn 2
    CHAIN iteration 2
      LLM gpt-4
```

Steps marked `is_copied_context: true` reconstruct prompt history without
creating execution spans; an LLM span whose context includes copied history
carries `metadata.has_copied_context = True`.

An agent step with `llm_call_count: 0` is non-LLM orchestration that issued
tool calls. It still gets its iteration CHAIN and its TOOL spans, but no LLM
span.

## Timing

ATIF records one event timestamp per step, not an interval, so the converter
reports honest event timing rather than fabricating durations:

- A step's CHAIN span runs from the preceding fresh event to its own
  timestamp (`metadata.atif.timing = "event_interval"`).
- TOOL spans are zero-duration events at the step timestamp
  (`metadata.atif.timing = "event"`). ATIF does not say whether tool calls in
  one step ran serially or concurrently.
- An LLM span is a zero-duration event too, unless an adapter supplies a
  measured latency; a measured interval is clamped to the step interval and
  recorded as `metadata.atif.measured_latency_ms`.
- Missing or non-monotonic timestamps collapse onto the preceding event.

Document order and tool-call array order are preserved.

## Multi-Agent / Subagent Linking

Upload parent and child trajectories together, parents first, for
cross-references to resolve:

```python
with open("parent.json") as f:
    parent = json.load(f)
with open("child.json") as f:
    child = json.load(f)

upload_atif_trajectories_as_spans(
    client, [parent, child], project_name="my-agent-eval"
)
```

Resulting trace:
```
AGENT parent
  CHAIN iteration 1
    LLM gpt-4
    TOOL delegate_task
      AGENT child agent
        CHAIN iteration 1
          LLM gpt-4
          TOOL search
```

### Which span parents the child

A step in the parent trajectory declares that it spawned a subagent via a
`subagent_trajectory_ref` in its observation result. The child's spans always
land in the parent's trace; the ref decides which span they nest under, and the
child attaches to the closest span the document actually proves:

**The subagent was spawned by a named tool call** (e.g. a `delegate_task`
tool). The result's `source_call_id` matches one of the step's `tool_calls`, so
the child nests under that TOOL span, as in the trace above.

**The spawn is attributable to a step but not to a call** — the system or an
orchestration layer started it, there is no `source_call_id`, or the
`source_call_id` matches none of the step's tool calls. There is no TOOL span
to hang it on, so the child nests under that step's CHAIN span:

```
AGENT parent
  CHAIN iteration 1
    LLM gpt-4
    AGENT child agent
      CHAIN iteration 1
        LLM gpt-4
```

**The referencing step is not operational** (copied context, a bare message).
There is no CHAIN span either, so the child nests directly under the parent
trajectory's root AGENT span.

Duplicate span IDs, unresolved parents, cross-trace parent links, and cycles
are rejected before upload.

**ATIF v1.7**: embedded `subagent_trajectories` inside a single trajectory file
are included automatically and resolve by `trajectory_id` — no separate upload
needed. Earlier versions resolve refs by `session_id`.

## Continuation Merging

When an agent's context window fills up, Harbor splits the session across
multiple files. Load them into the same batch: a `session_id` ending in
`-cont-N` joins the original session's trace. The continuation root is named
`<agent> (continuation N)` and carries `metadata.is_continuation = True` plus
`metadata.continuation_index`. A continuation of a subagent stays beneath the
same caller as the first document.

## Attribute Mapping

| ATIF field | OpenInference attribute |
|---|---|
| `metrics.prompt_tokens` | `llm.token_count.prompt` |
| `metrics.completion_tokens` | `llm.token_count.completion` |
| `metrics.cached_tokens` | `llm.token_count.prompt_details.cache_read` |
| `metrics.cost_usd` | `llm.cost.total` |
| `agent.model_name` / step `model_name` | `llm.model_name` |
| `agent.tool_definitions` | `llm.tools.{i}.tool.json_schema` |
| `reasoning_content` | `metadata.reasoning_content` |
| `final_metrics` | Root span `metadata.final_metrics` |
| `trajectory_id` | Root span `metadata.trajectory_id` |
| `session_id` | `session.id` on every span |
| Step messages | `llm.input_messages` / `llm.output_messages` |
| Text and image message parts | `message.contents` |
| Tool calls | `llm.output_messages.{i}.message.tool_calls` |
| Observations | Tool span `output.value` |

Only LLM spans carry `llm.*` attributes. Every span carries
`metadata.agent_name` and, below the root, `metadata.atif.step_id` holding the
producer's own step identifier.

ATIF has no fields for cache-write or reasoning tokens, so producers record
them under `metrics.extra` with their own names — Claude Code writes
`cache_creation_input_tokens` and `output_tokens_details.thinking_tokens`,
Codex writes `cache_write_input_tokens` and `reasoning_output_tokens`. The
converter maps whichever it finds to
`llm.token_count.prompt_details.cache_write` and
`llm.token_count.completion_details.reasoning`.

## Reconstructed Messages

LLM inputs are reconstructed from ATIF context, not captured provider requests,
and every LLM span says so with `metadata.atif.input_source = "reconstructed"`.
ATIF sources `user`, `system`, and `agent` map to roles `user`, `system`, and
`assistant`. The converter does not parse provider-native messages or interpret
tool argument keys. A result with a matching call ID becomes a tool message;
feedback without one stays an `observation` entry with `after_step_id` in
`input.value` and no inferred role. Multimodal results keep their content
parts. ATIF v1.8 audio fields are not supported.

## Deterministic IDs and Re-uploads

IDs are deterministic for the same documents and parent relationships: the
converter seeds them from session and document identities, falling back to
content hashes for v1.7 documents with no document ID. Give separate documents
distinct `trajectory_id` values where the format allows it.

Determinism is not deduplication. This helper does not skip spans Phoenix has
already stored, and Phoenix rejects a batch containing an existing span ID — so
re-running an upload over an already-imported trajectory fails rather than
merging. The Harbor plugin handles replay itself by querying stored IDs and
uploading only the missing spans.

## Known Limitation

Each LLM span repeats its whole reconstructed context in `input.value` and its
known-role messages in `llm.input_messages`. Very long sessions can exceed OTel
attribute size limits and be truncated or rejected, as with live
instrumentation.

## API Reference

- [API docs](https://arize-phoenix.readthedocs.io/en/latest/api/helpers.html#module-client.helpers.atif)
