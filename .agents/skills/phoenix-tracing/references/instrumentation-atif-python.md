# Phoenix Tracing: ATIF Trajectory Import (Python)

**Import agent trajectories from ATIF-compatible frameworks into Phoenix as traces.**

## Overview

ATIF (Agent Trajectory Interchange Format) is an open schema for recording agent runs. Frameworks like **Claude Code**, **OpenHands**, **Gemini CLI**, and **Codex** export ATIF via [Harbor](https://www.harborframework.com/docs). `upload_atif_trajectories_as_spans` in `arize-phoenix-client` turns ATIF JSON (schema v1.0 through v1.7) into a span tree and uploads it to a Phoenix project.

You load the JSON yourself. The helper does not read files, fetch URLs, or upload media.

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
- `trajectories` — one or more ATIF trajectory dicts (v1.0–v1.7); put parents before their children
- `project_name` — the Phoenix project to upload spans into
- `timeout` — request timeout in seconds (default: 30)

Raises `ValueError` if a trajectory is invalid. Nothing is uploaded when that happens.

## What the Trace Looks Like

One trajectory becomes one trace. The root is an AGENT span named after the agent. Each step becomes a CHAIN span, with the step's model call and tool calls underneath it. User messages become prompt context, not spans.

| Span | Kind | Name | `input.value` / `output.value` |
| --- | --- | --- | --- |
| Trajectory root | AGENT | the agent name (`assistant`) | the user's request / the agent's last message |
| Turn (multi-turn only) | AGENT | `turn N` | the user message that starts the turn / the agent's last message in it |
| Agent step | CHAIN | `iteration N` | the context the step saw / the step's message |
| Context-management step | CHAIN | `compaction N` | the step's message / its result |
| System step | CHAIN | `system event N` | the step's message / its result |
| Model call | LLM | the model name (`gpt-4`) | the prompt (JSON) / the step's message |
| Tool call | TOOL | the tool name (`search`) | the arguments (JSON) / the tool's result |

**Single-turn** — every step sits under the root:
```
AGENT assistant
  CHAIN iteration 1
    LLM gpt-4
    TOOL search
  CHAIN iteration 2
    LLM gpt-4
```

**Multi-turn** — one `turn N` span per turn. A new turn starts at each user message that follows agent activity:
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

Two cases produce fewer spans:

- Steps marked `is_copied_context: true` are replayed history. They become prompt context for later model calls, not spans. A model call whose prompt includes copied history has `metadata.has_copied_context = True`.
- An agent step with `llm_call_count: 0` ran tools without calling a model. It gets a CHAIN span and TOOL spans, but no LLM span.

## Timing

ATIF stores one timestamp per step: when it happened, not when it began. The converter does not invent durations:

- A CHAIN span runs from the previous step's timestamp to its own.
- LLM and TOOL spans are zero-length events at the step's timestamp. If the Harbor adapter recorded how long the model call took, the LLM span gets that length instead, cut off at the step's end, and `metadata.atif.measured_latency_ms` holds the value.
- A missing or out-of-order timestamp is treated as the previous step's timestamp.

`metadata.atif.timing` on each span says which rule applied: `event_interval` for CHAIN spans, `event` for zero-length spans, and the adapter's name for measured model calls (with a `_clamped` suffix when it was cut off).

## Subagents

Upload parent and child trajectories together, parents first:

```python
with open("parent.json") as f:
    parent = json.load(f)
with open("child.json") as f:
    child = json.load(f)

upload_atif_trajectories_as_spans(
    client, [parent, child], project_name="my-agent-eval"
)
```

The parent step that spawned the child points to it with a `subagent_trajectory_ref` in its result. That reference puts the child's spans into the parent's trace and decides where they sit:

| The reference | Child sits under |
| --- | --- |
| has a `source_call_id` that matches one of the step's `tool_calls` | that TOOL span |
| matches no tool call | the step's CHAIN span |
| is on a step marked `is_copied_context: true` | nothing: the reference is ignored and the child becomes its own separate trace |

```
AGENT parent
  CHAIN iteration 1
    LLM gpt-4
    TOOL delegate_task          # reference matches this tool call
      AGENT child agent
        CHAIN iteration 1
          LLM gpt-4
          TOOL search
  CHAIN iteration 2
    LLM gpt-4
    AGENT other child agent     # reference matches no tool call
      CHAIN iteration 1
        LLM gpt-4
```

ATIF v1.7 files can embed `subagent_trajectories`; those are picked up automatically and matched by `trajectory_id`. Older versions match by `session_id`. Duplicate span IDs, missing parents, and cycles are rejected before upload.

## Continuations

When an agent's context fills up, Harbor splits the session across files. Upload them together: a `session_id` ending in `-cont-N` joins the original trace, with a root named `<agent> (continuation N)` that has `metadata.is_continuation = True` and `metadata.continuation_index = N`. The helper does not open `continued_trajectory_ref` files for you.

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
| Tool results | TOOL span `output.value` |

Only LLM spans carry `llm.*` attributes.

Cache-write and reasoning token counts have no ATIF field, so producers put them in `metrics.extra`. The converter reads Claude Code's `cache_creation_input_tokens` and `output_tokens_details.thinking_tokens` and Codex's `cache_write_input_tokens` and `reasoning_output_tokens` into `llm.token_count.prompt_details.cache_write` and `llm.token_count.completion_details.reasoning`.

## Metadata the Converter Adds

| Key | On | Meaning |
| --- | --- | --- |
| `metadata.agent_name` | every span | the agent's name |
| `metadata.atif.step_id` | every span below the root | the step ID from the ATIF file |
| `metadata.atif.timing` | CHAIN, LLM, TOOL | which timing rule applied (see [Timing](#timing)) |
| `metadata.atif.measured_latency_ms` | LLM | how long the model call took, when the adapter recorded it |
| `metadata.atif.input_source` | LLM | always `"reconstructed"`: the prompt was rebuilt from the ATIF steps, not copied from the provider request |
| `metadata.has_copied_context` | LLM | the prompt includes copied history |
| `metadata.is_continuation`, `metadata.continuation_index` | continuation root | see [Continuations](#continuations) |

## Prompts Are Rebuilt

ATIF does not store the exact request sent to the model, so the converter rebuilds each prompt from the steps before the call. ATIF `user`, `system`, and `agent` steps become `user`, `system`, and `assistant` messages. A tool result that matches a call ID becomes a `tool` message; a result that matches no call is kept in `input.value` as an `observation` with the `after_step_id` it followed. Audio parts (ATIF v1.8) are not supported.

## Uploading Twice

The same trajectory always produces the same span IDs, and Phoenix rejects a batch that contains a span ID it already has. So uploading a trajectory a second time fails instead of merging or duplicating. To add spans to an imported trajectory, query which span IDs Phoenix already has and upload only the new ones, as the Harbor plugin does.

Give each trajectory its own `trajectory_id` when the format allows it. Without one, IDs are derived from `session_id`, and two different trajectories that share a session can collide.

## Limits

Each LLM span carries its full prompt. Very long sessions can exceed attribute size limits and be truncated or rejected, as with live tracing.

## API Reference

- [API docs](https://arize-phoenix.readthedocs.io/en/latest/api/helpers.html#module-client.helpers.atif)
