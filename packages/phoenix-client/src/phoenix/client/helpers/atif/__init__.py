# pyright: reportPrivateUsage=false
"""ATIF (Agent Trajectory Interchange Format) to Phoenix trace conversion.

Public API:
    upload_atif_trajectories_as_spans(client, trajectories, *, project_name)
"""

from __future__ import annotations

from typing import Any, List, Mapping, Optional, Sequence

from phoenix.client.__generated__ import v1
from phoenix.client.client import Client

from ._convert import (
    _build_subagent_ref_map,
    _convert_atif_trajectory_to_spans,
)
from ._validate import _validate_atif_trajectory

__all__ = ["upload_atif_trajectories_as_spans"]

DEFAULT_TIMEOUT_IN_SECONDS = 30


def upload_atif_trajectories_as_spans(
    client: Client,
    trajectories: Sequence[Mapping[str, Any]],
    *,
    project_name: str,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
) -> v1.CreateSpansResponseBody:
    """Upload one or more ATIF trajectories as spans to Phoenix.

    Converts ATIF (Agent Trajectory Interchange Format) trajectory dicts
    into Phoenix/OpenTelemetry-compatible span trees and uploads them.
    Supports ATIF schema versions v1.0 through v1.6.

    **Trace structure**

    Each trajectory produces one trace. Only agent steps become spans;
    user and system messages appear as ``llm.input_messages`` on the LLM
    spans that follow them (matching how real instrumented traces work).

    - Single-turn trajectories are flat. LLM and TOOL spans are
      siblings under the AGENT — the agent runtime executes tools,
      not the LLM::

        AGENT (root — input=user message, output=final agent reply)
          LLM
          TOOL
          LLM

    - Multi-turn trajectories (multiple user messages) get nested AGENT
      spans, one per turn. A new turn starts at each follow-up user
      message::

        AGENT (root — input=first user message, output=final agent reply)
          AGENT turn_1 (input=user msg 1, output=agent reply 1)
            LLM
            TOOL
          AGENT turn_2 (input=user msg 2, output=agent reply 2)
            LLM

    **Multi-agent / subagent handoffs**

    When trajectories in the batch reference each other via
    ``subagent_trajectory_ref``, the child trajectory's spans are nested
    under the parent's tool span within a single trace. Upload the parent
    and child trajectories together in one call for linking to work::

        AGENT (parent)
          LLM
          TOOL (delegate_task)
            AGENT (child agent)
              LLM
              TOOL

    **Continuation trajectories**

    When an agent's context window is exhausted, Harbor splits the
    session across files using ``continued_trajectory_ref``. The
    continuation trajectory gets a ``session_id`` ending in
    ``-cont-{N}``. These are automatically detected and merged into the
    same trace as the original, so the full agent session appears as one
    trace. The continuation's root span is annotated with
    ``metadata.is_continuation = True``.

    **Multimodal content (v1.6+)**

    Messages containing image content parts (``type: "image"`` with a
    ``source.path`` URL) are written using the OpenInference
    ``message.contents`` array format, with image URLs stored in
    ``message_content.image.image.url``. Text-only messages use the
    standard ``message.content`` string attribute.

    **Copied context**

    Steps marked ``is_copied_context: true`` (replayed conversation
    history from a continuation handoff) are included in
    ``llm.input_messages`` as normal messages. LLM spans whose input
    includes any copied context steps are annotated with
    ``metadata.has_copied_context = True``.

    **Attribute mapping**

    - ``metrics.prompt_tokens`` / ``completion_tokens`` →
      ``llm.token_count.prompt`` / ``completion`` / ``total``
    - ``metrics.cached_tokens`` →
      ``llm.token_count.prompt_details.cache_read``
    - ``metrics.cost_usd`` → ``llm.cost.total``
    - ``agent.model_name`` or step ``model_name`` → ``llm.model_name``
    - ``agent.tool_definitions`` → ``llm.tools.{i}.tool.json_schema``
    - ``reasoning_content`` → ``metadata.reasoning_content``
    - ``session_id`` → ``session.id`` on all spans

    **Deterministic IDs**

    Trace and span IDs are derived from ``session_id`` via SHA-256, so
    re-uploading the same trajectory produces the same trace (idempotent).

    **Known limitation: long conversations**

    Each LLM span includes the full conversation history up to that
    point as ``llm.input_messages`` attributes. For long multi-turn
    sessions (roughly 16+ turns with dense tool calls), this can exceed
    OpenTelemetry attribute size limits, causing spans to be truncated
    or rejected. This matches the behavior of real-time instrumentors
    and is a known platform-wide issue, not specific to ATIF conversion.

    Args:
        client: A Phoenix ``Client`` instance.
        trajectories: A sequence of ATIF trajectory dicts conforming to
            the ATIF schema (v1.0–v1.6).
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
    # Validate all trajectories first
    for trajectory in trajectories:
        _validate_atif_trajectory(trajectory)

    # Scan for subagent references across the batch
    ref_map = _build_subagent_ref_map(trajectories)

    # Convert all trajectories (with cross-trace linking)
    all_spans: List[v1.Span] = []
    for trajectory in trajectories:
        session_id = trajectory["session_id"]
        parent_ctx = ref_map.get(session_id)
        all_spans.extend(
            _convert_atif_trajectory_to_spans(trajectory, parent_span_context=parent_ctx)
        )

    return client.spans.log_spans(
        project_identifier=project_name,
        spans=all_spans,
        timeout=timeout,
    )
