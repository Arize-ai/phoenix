# /// script
# dependencies = [
#   "arize-phoenix-client",
#   "opentelemetry-sdk",
#   "opentelemetry-exporter-otlp",
#   "httpx",
# ]
# ///
"""Seed a running local Phoenix with OpenInference-shaped spans for the
attribute-filter agent usability trial (plan: _work/agent-usability-testing-
attribute-filter-param/plan.md).

Usage::

    python scripts/agent_api_testing/span_filtering/seed.py --base-url http://localhost:6006

Or via env var::

    PHOENIX_BASE_URL=http://localhost:6006 python scripts/agent_api_testing/span_filtering/seed.py

The script is idempotent: on each run it deletes and recreates the trial
project, then inserts one span per OpenInference attribute shape covering
the Phase 1 seed set (user.id, session.id with internal colons, nested
metadata.*, list-valued tag.tags, ISO timestamps, and the forced-string
numeric user.id="12345" footgun).

A ``manifest.json`` is written next to this script listing each seeded
span's attributes and the expected match set for each Phase 2 trial
prompt, providing ground truth for trial evaluation.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from typing import Any

import httpx
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

from phoenix.client import Client

PROJECT_NAME = "agent-trial-attribute-filter"
DEFAULT_BASE_URL = "http://localhost:6006"


# ---------------------------------------------------------------------------
# Seed span shapes — one per OpenInference attribute pattern. Each entry
# lists the attributes (dotted keys; OTel flattens nested dicts to dotted
# keys on the wire, and Phoenix's `unflatten` restores the nested JSON at
# ingestion) along with a stable name used to identify the span in the
# manifest.
# ---------------------------------------------------------------------------

SEED_SPANS: list[dict[str, Any]] = [
    {
        "name": "span-user-string",
        "description": "user.id as a plain string value.",
        "attributes": {
            "user.id": "user-42",
            "openinference.span.kind": "LLM",
        },
    },
    {
        "name": "span-user-string-numeric",
        "description": (
            "user.id forced to the string '12345' — exposes the type-coercion "
            "footgun where agents unquote numeric-looking strings."
        ),
        "attributes": {
            "user.id": "12345",
            "openinference.span.kind": "LLM",
        },
    },
    {
        "name": "span-session-colon",
        "description": "session.id with multiple internal colons.",
        "attributes": {
            "session.id": "sess:abc:123",
            "openinference.span.kind": "CHAIN",
        },
    },
    {
        "name": "span-metadata-nested",
        "description": "nested metadata.* with mixed primitive types.",
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
        "description": "tag.tags stored as a list of strings.",
        "attributes": {
            "tag.tags": ["prod", "experimental"],
            "openinference.span.kind": "CHAIN",
        },
    },
    {
        "name": "span-iso-timestamp",
        "description": "metadata.start_time as an ISO-8601 timestamp string.",
        "attributes": {
            "metadata.start_time": "2026-04-16T10:30:00Z",
            "openinference.span.kind": "CHAIN",
        },
    },
]


# ---------------------------------------------------------------------------
# Trial prompt ground truth — maps each planned Phase 2 trial prompt to the
# expected set of seeded span names that should match. Used by the trial
# harness (Task #10) to score agent output. Keep keys stable; prompts
# themselves are authored in Task #9 (README.md).
# ---------------------------------------------------------------------------

EXPECTED_MATCHES: dict[str, list[str]] = {
    "find_user_by_id_string": ["span-user-string"],
    "find_user_by_id_numeric_string": ["span-user-string-numeric"],
    "find_session_with_colons": ["span-session-colon"],
    "find_premium_tier_metadata": ["span-metadata-nested"],
    "find_spans_with_tag_prod": ["span-tag-list"],
    "find_spans_by_iso_timestamp": ["span-iso-timestamp"],
}


def _reset_project(client: Client) -> None:
    """Delete the trial project if it exists so the seed is deterministic.

    Phoenix does not expose a bulk-delete-spans endpoint at the time of
    writing, so the idempotency contract is: drop the whole project and
    recreate it. The project creation happens implicitly on first OTLP
    ingest via the ``openinference.project.name`` resource attribute, so
    we do not need to create it explicitly.
    """
    try:
        client.projects.delete(project_name=PROJECT_NAME)
        print(f"deleted existing project '{PROJECT_NAME}'", file=sys.stderr)
    except httpx.HTTPStatusError as exc:
        if exc.response.status_code == 404:
            print(f"project '{PROJECT_NAME}' did not exist (ok)", file=sys.stderr)
        else:
            raise


def _build_tracer(endpoint: str) -> Any:
    """Build an OTel tracer whose spans land in the trial project.

    The ``openinference.project.name`` resource attribute is Phoenix's
    project-routing key — spans carrying this resource are auto-assigned
    to (and auto-create) the named project.
    """
    provider = TracerProvider(resource=Resource({"openinference.project.name": PROJECT_NAME}))
    provider.add_span_processor(SimpleSpanProcessor(OTLPSpanExporter(endpoint)))
    return provider.get_tracer(__name__)


def _seed_spans(tracer: Any) -> None:
    for spec in SEED_SPANS:
        with tracer.start_as_current_span(spec["name"]) as span:
            for key, value in spec["attributes"].items():
                span.set_attribute(key, value)


def _wait_for_ingestion(
    base_url: str,
    expected: int,
    timeout_s: float = 10.0,
    interval_s: float = 0.25,
) -> int:
    """Poll GET /v1/projects/{project}/spans until the expected count is
    visible or the timeout elapses. Returns the final observed count.

    OTLP ingestion is asynchronous via the bulk inserter, so the script
    must wait for the spans to become queryable before the manifest is
    a valid reflection of server state.
    """
    deadline = time.monotonic() + timeout_s
    url = f"{base_url}/v1/projects/{PROJECT_NAME}/spans"
    observed = 0
    with httpx.Client() as http:
        while time.monotonic() < deadline:
            resp = http.get(url, params={"limit": 100})
            if resp.status_code == 200:
                observed = len(resp.json().get("data", []))
                if observed >= expected:
                    return observed
            time.sleep(interval_s)
    return observed


def _write_manifest(manifest_path: Path, base_url: str, observed: int) -> None:
    manifest = {
        "project_name": PROJECT_NAME,
        "base_url": base_url,
        "spans_observed": observed,
        "seed_spans": [
            {
                "name": spec["name"],
                "description": spec["description"],
                "attributes": spec["attributes"],
            }
            for spec in SEED_SPANS
        ],
        "expected_matches": EXPECTED_MATCHES,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        default=os.environ.get("PHOENIX_BASE_URL", DEFAULT_BASE_URL),
        help=(f"Phoenix base URL (default: $PHOENIX_BASE_URL or {DEFAULT_BASE_URL})."),
    )
    parser.add_argument(
        "--manifest",
        default=str(Path(__file__).with_name("manifest.json")),
        help="Path to write the ground-truth manifest JSON.",
    )
    args = parser.parse_args()

    base_url = args.base_url.rstrip("/")
    otlp_endpoint = f"{base_url}/v1/traces"
    manifest_path = Path(args.manifest)

    client = Client(base_url=base_url)
    _reset_project(client)

    tracer = _build_tracer(otlp_endpoint)
    _seed_spans(tracer)

    observed = _wait_for_ingestion(base_url, expected=len(SEED_SPANS))
    if observed < len(SEED_SPANS):
        print(
            f"warning: only {observed}/{len(SEED_SPANS)} spans visible after ingestion timeout",
            file=sys.stderr,
        )

    _write_manifest(manifest_path, base_url=base_url, observed=observed)
    print(
        f"seeded {observed}/{len(SEED_SPANS)} spans into '{PROJECT_NAME}'; "
        f"manifest → {manifest_path}",
        file=sys.stderr,
    )
    return 0 if observed >= len(SEED_SPANS) else 1


if __name__ == "__main__":
    raise SystemExit(main())
