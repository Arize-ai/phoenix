# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "arize-phoenix-otel",
#     "httpx",
# ]
# ///
"""Verify threshold-based (tiered) token cost calculation end to end.

Sends two OpenInference LLM spans for a model with `threshold_based` tier
pricing in the cost manifest — one below the 200k prompt-token threshold and
one above — waits for Phoenix to ingest and compute span costs, then queries
the GraphQL cost API and compares the results against expected values derived
from the manifest.

Usage:
    uv run verify_threshold_cost.py [--base-url http://localhost:6006]

The target Phoenix server must be running this branch, with a database that
was (re)started on this branch so the facilitator has synced the manifest
customizations into the `token_prices` table. Set PHOENIX_API_KEY if the
server has auth enabled.
"""

import argparse
import json
import os
import sys
import time
import uuid
from pathlib import Path
from typing import Any

import httpx

MODEL_NAME = "claude-4-sonnet-20250514"
BELOW_PROMPT_TOKENS = 100_000
ABOVE_PROMPT_TOKENS = 250_000
COMPLETION_TOKENS = 2_000
MANIFEST_PATH = (
    Path(__file__).parent.parent
    / "src"
    / "phoenix"
    / "server"
    / "cost_tracking"
    / "model_cost_manifest.json"
)

SPANS_QUERY = """
query VerifyThresholdCosts($projectId: ID!) {
  node(id: $projectId) {
    ... on Project {
      spans(first: 50) {
        edges {
          node {
            name
            costSummary {
              prompt { tokens cost }
              completion { tokens cost }
              total { tokens cost }
            }
          }
        }
      }
    }
  }
}
"""


def expected_costs(prompt_tokens: int, completion_tokens: int) -> dict[str, float]:
    """Compute expected prompt/completion costs for MODEL_NAME from the manifest."""
    manifest = json.loads(MANIFEST_PATH.read_text())
    model = next(m for m in manifest["models"] if m["name"] == MODEL_NAME)
    rates: dict[str, float] = {}
    for price in model["token_prices"]:
        token_type = price["token_type"]
        if token_type not in ("input", "output"):
            continue
        rate = price["base_rate"]
        if customization := price.get("customization"):
            assert customization["type"] == "threshold_based"
            assert customization["key"] == "llm.token_count.prompt"
            if prompt_tokens > customization["threshold"]:
                rate = customization["new_rate"]
        rates[token_type] = rate
    return {
        "prompt": prompt_tokens * rates["input"],
        "completion": completion_tokens * rates["output"],
    }


def send_spans(base_url: str, project_name: str, run_id: str) -> dict[str, int]:
    """Emit one below-threshold and one above-threshold LLM span. Returns span names."""
    from phoenix.otel import register

    tracer_provider = register(
        endpoint=f"{base_url}/v1/traces",
        project_name=project_name,
        batch=False,
        set_global_tracer_provider=False,
        verbose=False,
    )
    tracer = tracer_provider.get_tracer(__name__)
    span_names = {}
    for label, prompt_tokens in (
        ("below", BELOW_PROMPT_TOKENS),
        ("above", ABOVE_PROMPT_TOKENS),
    ):
        name = f"{label}-threshold-{run_id}"
        span_names[name] = prompt_tokens
        with tracer.start_as_current_span(name) as span:
            span.set_attribute("openinference.span.kind", "LLM")
            span.set_attribute("llm.model_name", MODEL_NAME)
            span.set_attribute("llm.token_count.prompt", prompt_tokens)
            span.set_attribute("llm.token_count.completion", COMPLETION_TOKENS)
            span.set_attribute("llm.token_count.total", prompt_tokens + COMPLETION_TOKENS)
    tracer_provider.force_flush()
    return span_names


def graphql(client: httpx.Client, base_url: str, query: str, variables: dict[str, Any]) -> Any:
    response = client.post(f"{base_url}/graphql", json={"query": query, "variables": variables})
    response.raise_for_status()
    payload = response.json()
    if payload.get("errors"):
        raise RuntimeError(f"GraphQL errors: {payload['errors']}")
    return payload["data"]


def fetch_project_id(client: httpx.Client, base_url: str, project_name: str) -> str | None:
    data = graphql(
        client,
        base_url,
        "query { projects(first: 200) { edges { node { id name } } } }",
        {},
    )
    for edge in data["projects"]["edges"]:
        if edge["node"]["name"] == project_name:
            return str(edge["node"]["id"])
    return None


def fetch_cost_summaries(
    client: httpx.Client, base_url: str, project_name: str, span_names: set[str]
) -> dict[str, Any] | None:
    """Return costSummary per span name once every span has a computed cost."""
    if (project_id := fetch_project_id(client, base_url, project_name)) is None:
        return None
    data = graphql(client, base_url, SPANS_QUERY, {"projectId": project_id})
    summaries = {
        edge["node"]["name"]: edge["node"]["costSummary"]
        for edge in data["node"]["spans"]["edges"]
        if edge["node"]["name"] in span_names
    }
    if set(summaries) != span_names or any(v is None for v in summaries.values()):
        return None
    return summaries


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--base-url",
        default=os.environ.get("PHOENIX_COLLECTOR_ENDPOINT", "http://localhost:6006"),
    )
    parser.add_argument("--timeout", type=float, default=30.0, help="seconds to wait for costs")
    args = parser.parse_args()
    base_url = args.base_url.rstrip("/")

    run_id = uuid.uuid4().hex[:8]
    project_name = f"threshold-cost-verification-{run_id}"
    print(f"Sending spans for {MODEL_NAME} to {base_url} (project: {project_name})")
    span_tokens = send_spans(base_url, project_name, run_id)

    headers = {}
    if api_key := os.environ.get("PHOENIX_API_KEY"):
        headers["Authorization"] = f"Bearer {api_key}"

    with httpx.Client(headers=headers, timeout=10.0) as client:
        deadline = time.time() + args.timeout
        summaries = None
        while time.time() < deadline:
            summaries = fetch_cost_summaries(client, base_url, project_name, set(span_tokens))
            if summaries is not None:
                break
            time.sleep(1.0)
        if summaries is None:
            print(f"FAIL: span costs not available after {args.timeout}s", file=sys.stderr)
            return 1

    ok = True
    for name, prompt_tokens in span_tokens.items():
        expected = expected_costs(prompt_tokens, COMPLETION_TOKENS)
        actual = summaries[name]
        print(f"\n{name} (prompt tokens: {prompt_tokens:,})")
        for part in ("prompt", "completion"):
            actual_cost = (actual.get(part) or {}).get("cost")
            expected_cost = expected[part]
            matches = actual_cost is not None and abs(actual_cost - expected_cost) < 1e-9
            ok &= matches
            status = "OK  " if matches else "FAIL"
            print(f"  {status} {part}: actual={actual_cost} expected={expected_cost}")

    if ok:
        print("\nAll threshold-based costs match the manifest tier rates.")
        return 0
    print(
        "\nMismatch detected. If costs match the BASE rates instead of tier rates for the"
        " above-threshold span, the customization was not synced into the database —"
        " restart the server on this branch to re-run the facilitator sync.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
