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

    Validates each trajectory, resolves subagent cross-references between
    trajectories in the batch, converts them to hierarchical span trees
    (root AGENT → per-turn AGENT → LLM spans → TOOL spans), and logs
    all spans via a single ``client.spans.log_spans()`` call.
    Single-turn trajectories are flat (root AGENT → LLM → TOOL).

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
