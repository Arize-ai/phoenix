# /// script
# dependencies = [
#   "arize-phoenix-client",
#   "opentelemetry-sdk",
#   "opentelemetry-exporter-otlp",
#   "httpx",
# ]
# ///
"""Seed a local Phoenix with OpenInference-shaped spans for the
``attribute`` filter agent trial.

Usage::

    python seed.py --base-url http://localhost:6006
    PHOENIX_BASE_URL=http://localhost:6006 python seed.py

Idempotent: drops and recreates the trial project, then emits one span
per attribute shape (plain string, numeric-looking string, value-with-
colons, nested metadata, list-valued tag, ISO timestamp).
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from typing import Any

import httpx
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor
from phoenix.client import Client

PROJECT_NAME = "agent-trial-attribute-filter"
DEFAULT_BASE_URL = "http://localhost:6006"

# One span per OpenInference attribute pattern under test. OTel puts
# dotted keys on the wire; Phoenix unflattens them into nested JSON.
SEED_SPANS: list[dict[str, Any]] = [
    {
        "name": "span-user-string",
        "attributes": {"user.id": "user-42", "openinference.span.kind": "LLM"},
    },
    {
        "name": "span-user-string-numeric",
        "attributes": {"user.id": "12345", "openinference.span.kind": "LLM"},
    },
    {
        "name": "span-session-colon",
        "attributes": {"session.id": "sess:abc:123", "openinference.span.kind": "CHAIN"},
    },
    {
        "name": "span-metadata-nested",
        "attributes": {
            "metadata.tier": "premium",
            "metadata.count": 5,
            "metadata.ratio": 0.7,
            "metadata.flag": True,
            "openinference.span.kind": "CHAIN",
        },
    },
    {
        "name": "span-tag-list",
        "attributes": {"tag.tags": ["prod", "experimental"], "openinference.span.kind": "CHAIN"},
    },
    {
        "name": "span-iso-timestamp",
        "attributes": {
            "metadata.start_time": "2026-04-16T10:30:00Z",
            "openinference.span.kind": "CHAIN",
        },
    },
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        default=os.environ.get("PHOENIX_BASE_URL", DEFAULT_BASE_URL),
        help=f"Phoenix base URL (default: $PHOENIX_BASE_URL or {DEFAULT_BASE_URL}).",
    )
    args = parser.parse_args()
    base_url = args.base_url.rstrip("/")

    # Reset project (recreated implicitly on next OTLP ingest).
    try:
        Client(base_url=base_url).projects.delete(project_name=PROJECT_NAME)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code != 404:
            raise

    provider = TracerProvider(resource=Resource({"openinference.project.name": PROJECT_NAME}))
    provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(f"{base_url}/v1/traces")))
    tracer = provider.get_tracer(__name__)
    for spec in SEED_SPANS:
        with tracer.start_as_current_span(spec["name"]) as span:
            for key, value in spec["attributes"].items():
                span.set_attribute(key, value)

    # Poll until all spans are queryable (OTLP ingestion is async).
    url = f"{base_url}/v1/projects/{PROJECT_NAME}/spans"
    deadline = time.monotonic() + 10.0
    observed = 0
    with httpx.Client() as http:
        while time.monotonic() < deadline:
            resp = http.get(url, params={"limit": 100})
            if resp.status_code == 200:
                observed = len(resp.json().get("data", []))
                if observed >= len(SEED_SPANS):
                    break
            time.sleep(0.25)

    print(f"seeded {observed}/{len(SEED_SPANS)} spans into '{PROJECT_NAME}'", file=sys.stderr)
    return 0 if observed >= len(SEED_SPANS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
