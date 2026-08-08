# pyright: reportPrivateUsage=false
"""ATIF (Agent Trajectory Interchange Format) to Phoenix trace conversion.

Public API:
    convert_atif_trajectories_to_spans(trajectories, *, common_parent_span_context=None)
    upload_atif_trajectories_as_spans(client, trajectories, *, project_name)
"""

from __future__ import annotations

from typing import Any, Mapping, Optional, Sequence, TypedDict

from phoenix.client.__generated__ import v1
from phoenix.client.client import Client

from ._convert import (
    _IS_EXTERNAL_PARENT_SPAN_CONTEXT_KEY,
    _PARENT_SPAN_CONTEXT_KEY,
    _build_subagent_ref_map,
    _convert_atif_trajectory_to_spans,
    _flatten_atif_trajectories,
    _get_parent_span_context,
)
from ._validate import _validate_atif_trajectory

__all__ = [
    "AtifParentSpanContext",
    "convert_atif_trajectories_to_spans",
    "upload_atif_trajectories_as_spans",
]

DEFAULT_TIMEOUT_IN_SECONDS = 30


class AtifParentSpanContext(TypedDict):
    """A caller-owned parent span for converted ATIF trajectories."""

    trace_id: str  # 32 lowercase hex characters
    span_id: str  # 16 lowercase hex characters


def convert_atif_trajectories_to_spans(
    trajectories: Sequence[Mapping[str, Any]],
    *,
    common_parent_span_context: Optional[AtifParentSpanContext] = None,
) -> list[v1.Span]:
    """Validate and convert ATIF trajectories to Phoenix spans without uploading.

    Supports ATIF schema versions v1.0 through v1.7.

    **Trajectory grouping**

    When ``common_parent_span_context`` is omitted, trajectories retain
    their normal ATIF grouping behavior: unrelated trajectories produce
    separate traces, while subagents and continuations detected within the
    collection are joined to their related trajectories.

    When ``common_parent_span_context`` is provided, the collection is
    treated as one logical trajectory group. Every otherwise-top-level
    trajectory root becomes a child of the common parent and adopts its
    trace ID. Pass only trajectories belonging to the same enclosing
    operation, such as one agent-evaluation trial. ATIF-internal subagent
    relationships still take precedence: a subagent remains a child of its
    parent's tool span, while participating in the common parent's trace.

    **Trace structure**

    Only agent steps become spans. User and system messages appear as
    ``llm.input_messages`` on the LLM spans that follow them.

    Single-turn trajectories are flat. LLM and TOOL spans are siblings
    under the root AGENT span::

        AGENT (root — input=user message, output=final agent reply)
          LLM
          TOOL
          LLM

    Multi-turn trajectories get one nested AGENT span per user turn::

        AGENT (root — input=first user message, output=final agent reply)
          AGENT turn_1 (input=user msg 1, output=agent reply 1)
            LLM
            TOOL
          AGENT turn_2 (input=user msg 2, output=agent reply 2)
            LLM

    **Multi-agent / subagent handoffs**

    When trajectories in the collection reference each other through
    ``subagent_trajectory_ref``, the child trajectory is nested under the
    parent's tool span within one trace. Include separately stored parent
    and child trajectories in the same call for linking to work. ATIF v1.7
    embedded ``subagent_trajectories`` are flattened automatically, using
    ``trajectory_id`` as the canonical embedded reference key::

        AGENT (parent)
          LLM
          TOOL (delegate_task)
            AGENT (child agent)
              LLM
              TOOL

    **Continuation trajectories**

    Continuations with a ``session_id`` ending in ``-cont-{N}`` are
    automatically detected and placed in the same trace as the original.
    The continuation root is annotated with
    ``metadata.is_continuation = True``.

    **Content and dispatch behavior**

    - Multimodal messages (v1.6+) use OpenInference ``message.contents``
      attributes; text-only messages use ``message.content``.
    - Steps marked ``is_copied_context: true`` remain in reconstructed LLM
      input messages. Affected LLM spans receive
      ``metadata.has_copied_context = True``.
    - Agent steps with ``llm_call_count: 0`` (v1.7+) emit their TOOL spans
      without creating a synthetic LLM span.

    **Attribute mapping**

    - ``metrics.prompt_tokens`` / ``completion_tokens`` ->
      ``llm.token_count.prompt`` / ``completion`` / ``total``
    - ``metrics.cached_tokens`` ->
      ``llm.token_count.prompt_details.cache_read``
    - ``metrics.cost_usd`` -> ``llm.cost.total``
    - ``agent.model_name`` or step ``model_name`` -> ``llm.model_name``
    - ``agent.tool_definitions`` -> ``llm.tools.{i}.tool.json_schema``
    - ``reasoning_content`` -> ``metadata.reasoning_content``
    - ``session_id`` -> ``session.id`` on all spans

    **Deterministic IDs**

    Trace IDs normally derive from the run-scoped ``session_id``. Span IDs
    derive from the document-scoped ``trajectory_id`` when available. ATIF
    v1.7 standalone trajectories without a ``trajectory_id`` use a stable
    document hash to prevent documents sharing a session from collapsing.

    Before ATIF v1.7, trajectories sharing a ``session_id`` and omitting
    ``trajectory_id`` can generate colliding span IDs. Give each document a
    distinct ``trajectory_id`` when converting several such trajectories.

    Span and trace IDs are deterministic. If steps omit timestamps, repeated
    conversions may produce different fallback timestamps while retaining
    identical IDs.

    **Known limitation: long conversations**

    Each LLM span contains its full preceding conversation history. Long,
    tool-dense conversations can exceed OpenTelemetry attribute-size limits,
    causing spans to be truncated or rejected.

    Args:
        trajectories: A sequence of ATIF trajectory dicts conforming to the
            ATIF schema (v1.0-v1.7).
        common_parent_span_context: An optional parent shared by every
            otherwise-top-level trajectory. Use it only when all supplied
            trajectories belong to the same enclosing operation.

    Returns:
        The converted Phoenix spans, without uploading them.

    Raises:
        ValueError: If any trajectory fails validation.

    Examples::

        # Normal ATIF grouping: unrelated trajectories remain separate.
        spans = convert_atif_trajectories_to_spans(trajectories)

        # One logical group: all top-level trajectories belong to this trial.
        spans = convert_atif_trajectories_to_spans(
            trial_trajectories,
            common_parent_span_context={
                "trace_id": trial_trace_id,
                "span_id": trial_root_span_id,
            },
        )
    """
    for trajectory in trajectories:
        _validate_atif_trajectory(trajectory)

    trajectories_for_conversion: Sequence[Mapping[str, Any]] = trajectories
    if common_parent_span_context is not None:
        private_parent_ctx = (
            common_parent_span_context["span_id"],
            common_parent_span_context["trace_id"],
        )
        trajectories_for_conversion = [
            {
                **trajectory,
                _PARENT_SPAN_CONTEXT_KEY: private_parent_ctx,
                _IS_EXTERNAL_PARENT_SPAN_CONTEXT_KEY: True,
            }
            for trajectory in trajectories
        ]

    flat_trajectories = _flatten_atif_trajectories(trajectories_for_conversion)
    ref_map = _build_subagent_ref_map(flat_trajectories)

    all_spans: list[v1.Span] = []
    for trajectory in flat_trajectories:
        parent_ctx = _get_parent_span_context(trajectory, ref_map)
        all_spans.extend(
            _convert_atif_trajectory_to_spans(trajectory, parent_span_context=parent_ctx)
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
    into Phoenix/OpenTelemetry-compatible span trees and uploads them.
    Supports ATIF schema versions v1.0 through v1.7.

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
    and child trajectories together in one call for linking to work. ATIF
    v1.7 embedded ``subagent_trajectories`` are flattened and uploaded
    automatically, with ``trajectory_id`` used as the canonical embedded
    reference key::

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

    **Deterministic dispatch (v1.7+)**

    Agent steps with ``llm_call_count: 0`` represent non-LLM orchestration
    that issued tool calls. These steps do not create synthetic LLM spans;
    their TOOL spans are still emitted under the AGENT/turn parent.

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

    Trace IDs are derived from the run-scoped ``session_id`` when present.
    For ATIF v1.7 standalone trajectories that omit ``trajectory_id`` and
    do not declare a continuation, a stable document hash is used instead
    so separate trajectory documents that share a run-scoped ``session_id``
    do not collapse into one trace. Span IDs use document-scoped
    ``trajectory_id`` when available, with the same v1.7 document-hash
    fallback to avoid collisions.

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
            the ATIF schema (v1.0–v1.7).
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
    all_spans = convert_atif_trajectories_to_spans(trajectories)

    return client.spans.log_spans(
        project_identifier=project_name,
        spans=all_spans,
        timeout=timeout,
    )
