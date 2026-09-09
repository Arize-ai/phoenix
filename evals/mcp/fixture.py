"""Trusted, additive seed API. The caller must first authorize and create a fresh target.

This module owns no target lifecycle and has no database/file cleanup operations.
It must never be passed the shared results server as a disposable target.
"""

from __future__ import annotations

import time
from typing import Any, Callable


def seed(client: Any, payload: dict[str, Any]) -> None:
    project = payload["project"]
    # Refuse accidental reuse. Never delete existing resources to make a seed pass.
    if any(item["name"] == project for item in client.projects.list()):
        raise ValueError("Fixture project already exists; select an authorized fresh target")
    client.projects.create(name=project)
    client.spans.log_spans(project_identifier=project, spans=payload["spans"])
    if payload["span_annotations"]:
        client.spans.log_span_annotations(span_annotations=payload["span_annotations"])
    if payload["trace_annotations"]:
        client.traces.log_trace_annotations(trace_annotations=payload["trace_annotations"])


def await_ready(
    read_state: Callable[[], dict[str, Any]], expected: dict[str, Any], *, timeout: float = 60
) -> None:
    """A trusted API reader must supply complete paginated semantic state, not healthz."""
    deadline = time.monotonic() + timeout
    while True:
        if read_state() == expected:
            return
        if time.monotonic() >= deadline:
            raise TimeoutError("Target semantic state does not match the immutable fixture")
        time.sleep(0.1)
