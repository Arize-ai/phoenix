# pyright: reportPrivateUsage=false
"""ATIF (Agent Trajectory Interchange Format) to Phoenix trace conversion.

Public API:
    upload_atif_trajectory_as_spans(client, trajectory, project_name)
"""

from __future__ import annotations

from typing import Any, Mapping, Optional

from phoenix.client.__generated__ import v1
from phoenix.client.client import Client

from ._convert import _convert_atif_trajectory_to_spans
from ._validate import _validate_atif_trajectory

__all__ = ["upload_atif_trajectory_as_spans"]

DEFAULT_TIMEOUT_IN_SECONDS = 30


def upload_atif_trajectory_as_spans(
    client: Client,
    trajectory: Mapping[str, Any],
    *,
    project_name: str = "default",
    timeout: Optional[int] = DEFAULT_TIMEOUT_IN_SECONDS,
) -> v1.CreateSpansResponseBody:
    """Upload an ATIF trajectory as spans to Phoenix.

    Validates the trajectory, converts it to a hierarchical span tree
    (root AGENT → step CHAIN/LLM spans → tool TOOL spans), and logs
    the spans via the client's ``spans.log_spans()`` API.

    Args:
        client: A Phoenix ``Client`` instance.
        trajectory: An ATIF trajectory dict conforming to the ATIF
            schema (v1.0–v1.6).
        project_name: The Phoenix project to upload spans into.
            Defaults to ``"default"``.
        timeout: Request timeout in seconds.

    Returns:
        The response body from ``log_spans``, containing
        ``total_received`` and ``total_queued`` counts.

    Raises:
        ValueError: If the trajectory fails validation.

    Example::

        from phoenix.client import Client
        from phoenix.client.helpers.atif import (
            upload_atif_trajectory_as_spans,
        )

        client = Client()
        trajectory = {
            "schema_version": "ATIF-v1.4",
            "session_id": "sess-001",
            "agent": {
                "name": "my-agent",
                "version": "1.0",
                "model_name": "gpt-4",
            },
            "steps": [...],
        }
        result = upload_atif_trajectory_as_spans(
            client, trajectory, project_name="my-project"
        )
        print(result)  # {"total_received": 5, "total_queued": 5}
    """
    _validate_atif_trajectory(trajectory)
    spans = _convert_atif_trajectory_to_spans(trajectory)
    return client.spans.log_spans(
        project_identifier=project_name,
        spans=spans,
        timeout=timeout,
    )
