"""Trusted, additive seed API. The caller must first authorize and create a fresh target.

This module owns no target lifecycle and has no database/file cleanup operations.
It must never be passed the shared results server as a disposable target.
"""

from __future__ import annotations

from typing import Any


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


def validate_seed(payload: dict[str, Any], manifest: dict[str, Any], truth: dict[str, Any]) -> None:
    """Verify the staged seed's content identity before creating any target records."""
    import hashlib
    import json

    content = {
        "version": manifest["converter_version"],
        "revision": manifest["revision"],
        "source_hash": manifest["source_hash"],
        "payload": payload,
    }
    encoded = json.dumps(
        content, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode()
    if hashlib.sha256(encoded).hexdigest() != manifest["fixture_hash"]:
        raise ValueError("Private payload differs from its manifest hash")
    if payload["project"] != manifest["project"] or truth["project"] != manifest["project"]:
        raise ValueError("Seed project identities disagree")
