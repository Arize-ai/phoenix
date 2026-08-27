# Phoenix Tracing: ATIF Trajectory Import (Python)

**Import agent trajectories from ATIF-compatible frameworks into Phoenix as traces.**

## Overview

ATIF (Agent Trajectory Interchange Format) is an open schema for recording agent execution. Frameworks like **Claude Code**, **OpenHands**, **Gemini CLI**, and **Codex** export ATIF via [Harbor](https://www.harborframework.com/docs). The `phoenix-client` package converts ATIF JSON into OpenTelemetry span trees and uploads them to Phoenix.

Supports ATIF schema versions v1.0 through v1.7.

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
- `trajectories` — one or more ATIF trajectory dicts (v1.0–v1.7)
- `project_name` — the Phoenix project to upload spans into
- `timeout` — request timeout in seconds (default: 30)

## Trace Hierarchy

The converter builds a span tree matching what real-time instrumentors produce:

**Single-turn:**
```
AGENT (root — input=user message, output=final agent reply)
  LLM
  TOOL
  LLM
```

**Multi-turn:**
```
AGENT (root — input=first user message, output=final agent reply)
  AGENT turn_1 (input=user msg 1, output=agent reply 1)
    LLM
    TOOL
  AGENT turn_2 (input=user msg 2, output=agent reply 2)
    LLM
```

## Multi-Agent / Subagent Linking

Upload parent and child trajectories together for cross-references to resolve:

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
AGENT (parent)
  LLM
  TOOL (delegate_task)
    AGENT (child agent)
      LLM
      TOOL
```

**ATIF v1.7**: embedded `subagent_trajectories` inside a single trajectory file are automatically flattened and linked. References resolve by `trajectory_id` — no separate upload needed.

## Deterministic Dispatch (v1.7+)

Agent steps with `llm_call_count: 0` represent non-LLM orchestration that issued tool calls. These steps do not produce a synthetic LLM span; their TOOL spans are still emitted under the AGENT/turn parent.

## Continuation Merging

When an agent's context window fills up, Harbor splits the session across multiple files. The converter detects continuation files (session IDs ending in `-cont-N`) and merges them into one trace. Continuation root spans are annotated with `metadata.is_continuation = True`.

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
| `session_id` | `session.id` |
| `trajectory_id` | Root span `metadata.trajectory_id` |
| Step messages | `llm.input_messages` / `llm.output_messages` |
| Tool calls | `llm.output_messages.{i}.message.tool_calls` |
| Observations | Tool span `output.value` |

## Deterministic IDs

Trace IDs are derived from the run-scoped `session_id` when present. Span IDs use document-scoped `trajectory_id` when available. ATIF v1.7 embedded subagents use the same `trajectory_id`-based seeding so they do not collide even when inheriting the same `session_id`. Re-uploading the same trajectory produces the same trace (idempotent).

## Known Limitation

Each LLM span includes the full conversation history as `llm.input_messages`. For very long sessions (~16+ turns with dense tool calls), this can exceed OTel attribute size limits and cause truncation.

## API Reference

- [API docs](https://arize-phoenix.readthedocs.io/en/latest/api/helpers.html#module-client.helpers.atif)
