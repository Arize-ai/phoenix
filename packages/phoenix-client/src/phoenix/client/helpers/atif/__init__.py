# pyright: reportPrivateUsage=false
"""ATIF (Agent Trajectory Interchange Format) to Phoenix trace conversion.

Public API:
    upload_atif_trajectories_as_spans(client, trajectories, *, project_name)

``_convert.py`` builds trajectory span trees. ``_reparent.py`` attaches them
to a caller-owned parent, as the Harbor plugin does for its trial root.
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
from ._validate import _validate_atif_trajectory, _validate_span_graph

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

    _validate_span_graph(all_spans)
    return all_spans


def upload_atif_trajectories_as_spans(
    client: Client,
    trajectories: Sequence[Mapping[str, Any]],
    *,
    project_name: str,
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
) -> v1.CreateSpansResponseBody:
    """Upload one or more ATIF trajectories as spans to Phoenix.

    Supports ATIF schema versions v1.0 through v1.7. Callers load the documents;
    this helper does not read referenced files, fetch URLs, or upload media bytes.

    **Trace structure**

    Each trajectory gets an AGENT root. Spans use the names from ATIF:
    the agent name for the root, the model name for LLM calls, and the tool
    name for tool calls. Each fresh agent step becomes a CHAIN span named
    ``iteration N``; context management and
    operational system steps become ``compaction N`` and ``system event N``.
    The producer's ``step_id`` is kept in ``metadata.atif.step_id`` and the
    agent name in ``metadata.agent_name`` on every span. User messages are
    prompt context, not spans.

    Single-turn trajectories place each step under the root::

        AGENT assistant
          CHAIN iteration 1
            LLM gpt-4
            TOOL search
          CHAIN iteration 2
            LLM gpt-4

    Multi-turn trajectories add one AGENT span per turn. A turn starts at
    each user message that follows agent activity. Steps marked
    ``is_copied_context: true`` contribute prompt history without creating
    execution spans. LLM spans that use copied history carry
    ``metadata.has_copied_context = True``.

    An agent step with ``llm_call_count: 0`` still gets an iteration CHAIN
    and any declared TOOL spans, but no LLM span.

    **Subagents**

    When trajectories in a batch reference each other through
    ``subagent_trajectory_ref``, the child's spans join the parent's trace
    under the TOOL span named by the observation's matching
    ``source_call_id``, else the referencing step's CHAIN, else the parent's
    root. Upload parent and child together for the
    link to resolve, with parents before children. Duplicate span IDs,
    unresolved parents, cross-trace parent links, and cycles are rejected
    before upload. ATIF v1.7 embedded ``subagent_trajectories`` are included
    automatically and resolved by ``trajectory_id``.

    **Continuations**

    Load continuation files into the same batch. A ``session_id`` ending in
    ``-cont-N`` joins the original session's trace. Its root is named
    ``<agent> (continuation N)`` and carries ``metadata.is_continuation = True``.
    The Harbor plugin follows local ``continued_trajectory_ref`` files itself.

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
      ``llm.token_count.prompt`` / ``completion`` / ``total`` on LLM spans
    - ``metrics.cached_tokens`` →
      ``llm.token_count.prompt_details.cache_read``
    - ``metrics.cost_usd`` → ``llm.cost.total``
    - ``agent.model_name`` or step ``model_name`` → ``llm.model_name``
    - ``agent.tool_definitions`` → ``llm.tools.{i}.tool.json_schema``
    - ``reasoning_content`` → ``metadata.reasoning_content``
    - ``final_metrics`` → ``metadata.final_metrics`` on the root span
    - ``session_id`` → ``session.id`` on all spans
    - Text and image message parts → OpenInference ``message.contents``

    **Deterministic IDs**

    IDs are deterministic for the same documents and parent relationships.
    The converter uses session and document identities, with content hashes
    for v1.7 documents that lack a document ID. Give separate documents
    distinct ``trajectory_id`` values when available.

    This helper does not skip stored spans. Phoenix rejects a batch containing
    an existing span ID. The Harbor plugin handles replay separately by
    querying stored IDs and uploading only missing spans.

    **Reconstructed messages and limits**

    LLM inputs are reconstructed ATIF context, not exact provider requests.
    Every LLM span records ``metadata.atif.input_source = "reconstructed"``.
    ATIF sources ``user``, ``system``, and ``agent`` map to roles ``user``,
    ``system``, and ``assistant``. The converter does not parse provider-native
    messages or interpret tool argument keys.
    Results with a matching call ID become tool messages; feedback without
    one remains an ``observation`` entry with ``after_step_id`` in
    ``input.value``, without an inferred message role. Multimodal results
    retain their content parts. ATIF v1.8 audio fields are not supported.

    Each LLM span repeats its reconstructed context in ``input.value`` and
    its known-role messages in ``llm.input_messages``. Very long sessions can
    exceed attribute size limits and be truncated or rejected, as with live
    instrumentation.

    Args:
        client: A Phoenix ``Client`` instance.
        trajectories: A sequence of ATIF trajectory dicts conforming to
            ATIF v1.0 through v1.7. Put parents before external children.
        project_name: The Phoenix project to upload spans into.
        timeout: Request timeout in seconds.

    Returns:
        The response body from ``log_spans``, containing
        ``total_received`` and ``total_queued`` counts.

    Raises:
        ValueError: If a trajectory or the resulting span graph fails validation.

    Example::

        import json
        from phoenix.client import Client
        from phoenix.client.helpers.atif import upload_atif_trajectories_as_spans

        with open("trajectory.json") as f:
            trajectory = json.load(f)

        result = upload_atif_trajectories_as_spans(
            Client(), [trajectory], project_name="my-agent-eval"
        )
        print(result)  # Counts of spans received and queued
    """
    all_spans = _convert_atif_trajectories_to_spans(trajectories)

    return client.spans.log_spans(
        project_identifier=project_name,
        spans=all_spans,
        timeout=timeout,
    )
