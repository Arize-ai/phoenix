# pyright: reportPrivateUsage=false
"""ATIF (Agent Trajectory Interchange Format) to Phoenix trace conversion.

Public API:
    upload_atif_trajectories_as_spans(client, trajectories, *, project_name)

Conversion and reparenting are separate steps: ``_convert.py`` decides each
trajectory's span tree, ``_reparent.py`` decides where a batch of trees hangs.
Callers that need both compose them.
"""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence

from phoenix.client.__generated__ import v1
from phoenix.client.client import Client

from ._convert import (
    _build_subagent_ref_map,
    _convert_atif_trajectory_to_spans,
    _flatten_atif_trajectories,
    _get_parent_span_context,
)
from ._validate import _validate_atif_trajectory

__all__ = ["upload_atif_trajectories_as_spans"]

DEFAULT_TIMEOUT_IN_SECONDS = 30


def _convert_atif_trajectories_to_spans(
    trajectories: Sequence[Mapping[str, Any]],
) -> list[v1.Span]:
    """Validate and convert ATIF trajectories to Phoenix spans without uploading."""
    for trajectory in trajectories:
        _validate_atif_trajectory(trajectory)

    flat_trajectories = _flatten_atif_trajectories(trajectories)
    ref_map = _build_subagent_ref_map(flat_trajectories)

    all_spans: list[v1.Span] = []
    for trajectory in flat_trajectories:
        parent_ctx = _get_parent_span_context(trajectory, ref_map)
        all_spans.extend(
            _convert_atif_trajectory_to_spans(
                trajectory,
                parent_span_context=parent_ctx,
            )
        )

    return all_spans


def upload_atif_trajectories_as_spans(
    client: Client,
    trajectories: Sequence[Mapping[str, Any]],
    *,
    project_name: str,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
) -> v1.CreateSpansResponseBody:
    """Upload one or more ATIF trajectories as spans to Phoenix.

    Converts ATIF (Agent Trajectory Interchange Format) trajectory dicts
    into Phoenix span trees and uploads them. Supports ATIF schema versions
    v1.0 through v1.7.

    **Trace structure**

    Each trajectory produces one trace. Spans are named by their target:
    the agent name for the root, the model name for LLM calls, and the tool
    name for tool calls. Each fresh agent step (one iteration of the agent loop)
    becomes a CHAIN span named ``iteration N``; context management and
    operational system steps become ``compaction N`` and ``system event N``.
    The producer's ``step_id`` is kept in ``metadata.atif.step_id`` and the
    agent name in ``metadata.agent_name`` on every span. User messages are
    prompt context, not spans.

    Single-turn trajectories place each step under the root::

        AGENT assistant (input=user request, output=final reply)
          CHAIN iteration 1 (input=request, output=reply and observations)
            LLM gpt-4
            TOOL search
          CHAIN iteration 2
            LLM gpt-4

    Multi-turn trajectories add one AGENT span per turn. A turn starts at
    each user message that follows agent activity::

        AGENT assistant
          AGENT turn 1 (input=user message 1, output=reply 1)
            CHAIN iteration 1
              LLM gpt-4
          AGENT turn 2 (input=user message 2, output=reply 2)
            CHAIN iteration 2
              LLM gpt-4

    **Subagents**

    When trajectories in a batch reference each other through
    ``subagent_trajectory_ref``, the child's spans join the parent's trace
    under the closest span the document proves: the TOOL span whose
    ``source_call_id`` the reference names, else the referencing step's
    CHAIN, else the parent's root. Upload parent and child together for the
    link to resolve. ATIF v1.7 embedded ``subagent_trajectories`` are
    flattened automatically and resolved by ``trajectory_id``::

        AGENT orchestrator
          CHAIN iteration 1
            LLM gpt-4
            TOOL delegate_task
              AGENT researcher
                CHAIN iteration 1
                  LLM gpt-4

    **Continuations**

    Harbor splits a session across files with ``continued_trajectory_ref``
    when the context window is exhausted, giving the continuation a
    ``session_id`` ending in ``-cont-{N}``. Continuations join the original
    trace; their roots are named ``<agent> (continuation N)``
    and carry ``metadata.is_continuation = True``.

    **Copied context**

    Steps marked ``is_copied_context: true`` are replayed history. They
    contribute to reconstructed ``llm.input_messages`` but create no turns,
    steps, or elapsed time. LLM spans whose prompt includes copied history
    carry ``metadata.has_copied_context = True``.

    **Timing**

    ATIF records one event timestamp per step, not an interval. A step's
    CHAIN spans from the preceding fresh event to its own timestamp. LLM and
    TOOL spans are zero-duration events at the step timestamp unless an
    adapter supplies a measured LLM latency; ATIF does not say whether tool
    calls in one step ran serially or concurrently. Missing or non-monotonic
    timestamps collapse onto the preceding event rather than inventing
    duration. Document order and tool-call array order are preserved.

    **Attribute mapping**

    - ``metrics.prompt_tokens`` / ``completion_tokens`` →
      ``llm.token_count.prompt`` / ``completion`` / ``total`` (LLM spans)
    - ``metrics.cached_tokens`` →
      ``llm.token_count.prompt_details.cache_read``
    - ``metrics.cost_usd`` → ``llm.cost.total``
    - ``agent.model_name`` or step ``model_name`` → ``llm.model_name``
    - ``agent.tool_definitions`` → ``llm.tools.{i}.tool.json_schema``
    - ``reasoning_content`` → ``metadata.reasoning_content``
    - ``final_metrics`` → ``metadata.final_metrics`` on the root span
    - ``session_id`` → ``session.id`` on all spans
    - Multimodal message parts (v1.6+) → OpenInference ``message.contents``
    - Agent steps with ``llm_call_count: 0`` (v1.7+) emit TOOL spans without
      an LLM span

    **Deterministic IDs**

    Trace IDs derive from the run-scoped ``session_id``; span IDs derive from
    the document-scoped ``trajectory_id``. A v1.7 document that has neither
    falls back to a stable content hash, so re-uploading a trajectory yields
    the same trace and sibling documents that share a session do not collide.

    **Known limitation**

    Each LLM span carries the full conversation history as
    ``llm.input_messages``. Very long sessions can exceed attribute size
    limits and be truncated or rejected, as with live instrumentation.

    Args:
        client: A Phoenix ``Client`` instance.
        trajectories: A sequence of ATIF trajectory dicts conforming to
            the ATIF schema (v1.0 through v1.7).
        project_name: The Phoenix project to upload spans into.
        timeout: Request timeout in seconds.

    Returns:
        The response body from ``log_spans``, containing
        ``total_received`` and ``total_queued`` counts.

    Raises:
        ValueError: If any trajectory fails validation.

    Example::

        from phoenix.client import Client
        from phoenix.client.helpers.atif import (
            upload_atif_trajectories_as_spans,
        )

        client = Client()
        trajectories = [
            {
                "schema_version": "ATIF-v1.4",
                "session_id": "sess-001",
                "agent": {
                    "name": "my-agent",
                    "version": "1.0",
                    "model_name": "gpt-4",
                },
                "steps": [...],
            }
        ]
        result = upload_atif_trajectories_as_spans(
            client, trajectories, project_name="my-project"
        )
        print(result)  # {"total_received": 5, "total_queued": 5}
    """
    all_spans = _convert_atif_trajectories_to_spans(trajectories)

    return client.spans.log_spans(
        project_identifier=project_name,
        spans=all_spans,
        timeout=timeout,
    )
