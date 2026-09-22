# Phoenix Tracing: ATIF Trajectory Import (Python)

**Import agent trajectories from ATIF-compatible frameworks into Phoenix as traces.**

## Overview

ATIF (Agent Trajectory Interchange Format) is an open schema for recording agent execution. Frameworks like **Claude Code**, **OpenHands**, **Gemini CLI**, and **Codex** export ATIF via [Harbor](https://www.harborframework.com/docs). `upload_atif_trajectories_as_spans` in `arize-phoenix-client` converts ATIF JSON (schema v1.0 through v1.7) into an OpenInference span tree and uploads it to a Phoenix project.

The helper works on documents you have already loaded. It does not read referenced files, fetch URLs, or upload media bytes.

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

Raises `ValueError` when a trajectory or the resulting span graph fails validation. Nothing is uploaded on failure.

## The Resulting Trace

One trajectory becomes one trace with an AGENT root named after the agent. Every fresh step becomes a CHAIN span, and the LLM call and tool calls that step made hang off it. User messages are prompt context, not spans. Spans are named by what they act on, since the span kind already says what they do:

| Span | Kind | Name | `input.value` / `output.value` |
| --- | --- | --- | --- |
| Trajectory root | AGENT | the agent name (`assistant`) | the user request the trajectory answers / the last agent message |
| Turn (multi-turn only) | AGENT | `turn N` | the user message that opens the turn / the last agent message in it |
| Agent step | CHAIN | `iteration N` | the preceding context / the step's message and any tool result no call claimed |
| Context-management step | CHAIN | `compaction N` | the step's own message / its observation |
| Operational system step | CHAIN | `system event N` | the step's own message / its observation |
| Model call | LLM | the model name (`gpt-4`) | the reconstructed prompt (JSON) / the step's message |
| Tool call | TOOL | the tool name (`search`) | the call arguments (JSON) / the matching observation result |

**Single-turn** — every step hangs off the root:
```
AGENT assistant
  CHAIN iteration 1
    LLM gpt-4
    TOOL search
  CHAIN iteration 2
    LLM gpt-4
```

**Multi-turn** — one `turn N` AGENT span per turn. A turn opens at each user message that follows agent activity, so leading system steps and consecutive context messages stay in the turn they introduce:
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

Two kinds of step produce fewer spans than the table suggests:

- Steps marked `is_copied_context: true` are replayed history. They feed the prompt of later LLM spans but create no spans of their own, and an LLM span whose prompt includes copied history carries `metadata.has_copied_context = True`.
- An agent step with `llm_call_count: 0` is orchestration that issued tool calls without a model call. It gets its `iteration N` CHAIN and its TOOL spans, but no LLM span.

## Timing

ATIF records one timestamp per step: when it happened, not when it began. The converter reports what the document supports instead of inventing durations:

| Span | Interval | `metadata.atif.timing` |
| --- | --- | --- |
| CHAIN | from the preceding fresh event to the step's own timestamp | `event_interval` |
| TOOL | zero-duration event at the step timestamp | `event` |
| LLM | zero-duration event at the step timestamp | `event` |
| LLM with an adapter-supplied latency | starts with the step and runs for the measured latency, clamped to the step interval | the adapter's source name, suffixed `_clamped` when clamping applied; the latency is in `metadata.atif.measured_latency_ms` |

Missing or non-monotonic timestamps collapse onto the preceding event. ATIF does not say whether the tool calls in one step ran serially or concurrently, so they share the step timestamp. Document order and tool-call array order are preserved.

## Subagents

Upload parent and child trajectories in the same batch, parents first, so cross-references resolve:

```python
with open("parent.json") as f:
    parent = json.load(f)
with open("child.json") as f:
    child = json.load(f)

upload_atif_trajectories_as_spans(
    client, [parent, child], project_name="my-agent-eval"
)
```

Child spans always land in the parent's trace. The `subagent_trajectory_ref` in the parent step's observation result decides which span they nest under, and the child attaches to the most specific span the document supports:

| The reference | Child nests under |
| --- | --- |
| has a `source_call_id` matching one of the step's `tool_calls` (a `delegate_task` tool, for example) | that TOOL span |
| sits on a step that produced a CHAIN span but names no matching tool call — a system- or orchestrator-started spawn | that step's CHAIN span |
| sits on a step with no CHAIN span (copied context, a bare message) | the parent trajectory's root AGENT span |

```
AGENT parent
  CHAIN iteration 1
    LLM gpt-4
    TOOL delegate_task          # ref with a matching source_call_id
      AGENT child agent
        CHAIN iteration 1
          LLM gpt-4
          TOOL search
  CHAIN iteration 2
    LLM gpt-4
    AGENT other child agent     # ref with no matching tool call
      CHAIN iteration 1
        LLM gpt-4
```

ATIF v1.7 embedded `subagent_trajectories` are included automatically and resolve by `trajectory_id`; earlier versions resolve refs by `session_id`. Duplicate span IDs, unresolved parents, cross-trace parent links, and cycles are rejected before anything is uploaded.

## Continuations

When an agent's context window fills up, Harbor splits the session across files. Load them into the same batch: a `session_id` ending in `-cont-N` joins the original session's trace, with a root named `<agent> (continuation N)` that carries `metadata.is_continuation = True` and `metadata.continuation_index = N`. The helper does not follow `continued_trajectory_ref` to other files; the Harbor plugin does that itself.

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
| `final_metrics` | root span `metadata.final_metrics` |
| `trajectory_id` | root span `metadata.trajectory_id` |
| `session_id` | `session.id` on every span |
| Step messages | `llm.input_messages` / `llm.output_messages` |
| Text and image message parts | `message.contents` |
| Tool calls | `llm.output_messages.{i}.message.tool_calls` |
| Observations | TOOL span `output.value` |

Only LLM spans carry `llm.*` attributes. `llm.token_count.total` is the sum of prompt and completion tokens.

ATIF has no fields for cache-write or reasoning tokens, so producers put them in `metrics.extra` under their own names. The converter recognizes Claude Code's `cache_creation_input_tokens` and `output_tokens_details.thinking_tokens` and Codex's `cache_write_input_tokens` and `reasoning_output_tokens`, and maps them to `llm.token_count.prompt_details.cache_write` and `llm.token_count.completion_details.reasoning`.

## Metadata the Converter Adds

These keys tell imported spans apart from live instrumentation and preserve the producer's own identifiers:

| Key | On | Meaning |
| --- | --- | --- |
| `metadata.agent_name` | every span | the ATIF agent name |
| `metadata.atif.step_id` | every span below the root | the producer's own step identifier |
| `metadata.atif.source` | CHAIN | the step's ATIF `source` (`agent`, `system`, ...) |
| `metadata.atif.context_management` | CHAIN | `True` on compaction steps |
| `metadata.atif.timing` | CHAIN, LLM, TOOL | how the interval was derived (see [Timing](#timing)) |
| `metadata.atif.measured_latency_ms` | LLM | adapter-supplied latency, when present |
| `metadata.atif.input_source` | LLM | always `"reconstructed"` (see below) |
| `metadata.atif.tool_call_index` | TOOL | position in the step's `tool_calls` array |
| `metadata.has_copied_context` | LLM | the prompt includes `is_copied_context` history |
| `metadata.has_multimodal_content` | LLM | the step message has non-text parts |
| `metadata.llm_call_count` | LLM, TOOL | the step's declared `llm_call_count` |
| `metadata.tool_call_extra`, `metadata.observation_extra` | TOOL | the `extra` payloads on the call and its result |
| `metadata.agent_version`, `metadata.model_name` | root | the agent's `version` and `model_name`; `agent.extra` keys are merged in alongside |
| `metadata.is_continuation`, `metadata.continuation_index` | continuation root | see [Continuations](#continuations) |

## Reconstructed Messages

LLM inputs are rebuilt from ATIF context, not captured provider requests, and every LLM span says so with `metadata.atif.input_source = "reconstructed"`. In practice:

- ATIF sources `user`, `system`, and `agent` become message roles `user`, `system`, and `assistant`.
- A tool result with a matching call ID becomes a `tool` message. Feedback without one stays an `observation` entry with `after_step_id` in `input.value`, with no inferred role.
- Provider-native message payloads and tool argument keys are passed through, not interpreted.
- Multimodal results keep their text and image parts. ATIF v1.8 audio fields are not supported.

## Re-uploads

Span and trace IDs are deterministic: the same documents with the same parent relationships produce the same IDs, seeded from session and document identities (content hashes for v1.7 documents with no document ID). Give separate documents distinct `trajectory_id` values where the format allows it, or their IDs can collide.

Deterministic is not idempotent. The helper does not skip spans Phoenix already holds, and Phoenix rejects a batch that contains an existing span ID, so re-running an upload over an imported trajectory fails rather than merging. To replay safely, query the stored span IDs first and upload only the missing spans, as the Harbor plugin does.

## Limits

Each LLM span repeats its whole reconstructed context in `input.value` and its known-role messages in `llm.input_messages`. Very long sessions can exceed OTel attribute size limits and be truncated or rejected, as with live instrumentation.

## API Reference

- [API docs](https://arize-phoenix.readthedocs.io/en/latest/api/helpers.html#module-client.helpers.atif)
