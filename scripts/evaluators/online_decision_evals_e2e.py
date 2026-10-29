"""Turn on datagen's online decision judge and wait for its annotations on live traffic.

Start Phoenix, run ``phoenix datagen`` against it, then:

    uv run python scripts/evaluators/online_decision_evals_e2e.py

Exits 0 once the judge has annotated at least one span, trace, and session.
"""

from __future__ import annotations

import sys
import time
from argparse import ArgumentParser, Namespace
from os import environ
from typing import Any, Optional
from urllib.parse import quote

import httpx

from phoenix.experimental.datagen.evaluators import (
    ONLINE_JUDGE_BINDINGS,
    ONLINE_JUDGE_NAME,
    ONLINE_JUDGE_PROJECT_NAME,
    seed_online_decision_judge,
)
from phoenix.server.cli.commands.datagen import _headers, _resolve_config

_PROVIDERS = """
query {
  modelProviders {
    key name modelTypes credentialsSet credentialRequirements { envVarName isRequired }
  }
}
"""
_VERSION = """
query ($id: ID!) { node(id: $id) { ... on DecisionVersion { modelProvider modelName } } }
"""
_RESULTS = """
query ($project: ID!, $binding: ID!) {
  project: node(id: $project) {
    ... on Project {
      spanAnnotationNameCounts { name count }
      traceAnnotationNameCounts { name count }
      sessionAnnotationNameCounts { name count }
    }
  }
  binding: node(id: $binding) {
    ... on ProjectEvaluator { failureSummary(timeRange: {}) { failedCount lastError } }
  }
}
"""
_GRAINS = {
    "SPAN": ("spanAnnotationNameCounts", "spans", "span_annotations", "span_ids"),
    "TRACE": ("traceAnnotationNameCounts", "traces", "trace_annotations", "trace_ids"),
    "SESSION": ("sessionAnnotationNameCounts", "sessions", "session_annotations", "session_ids"),
}
_PROJECT_PATH = f"v1/projects/{quote(ONLINE_JUDGE_PROJECT_NAME, safe='')}"


class CheckFailed(Exception):
    pass


def _graphql(http: httpx.Client, query: str, **variables: Any) -> dict[str, Any]:
    response = http.post("graphql", json={"query": query, "variables": variables})
    response.raise_for_status()
    body = response.json()
    if body.get("errors"):
        raise CheckFailed("; ".join(error["message"] for error in body["errors"]))
    data: dict[str, Any] = body["data"]
    return data


def _judge_model(http: httpx.Client) -> tuple[str, str]:
    response = http.get("v1/evaluators", params={"name": ONLINE_JUDGE_NAME})
    response.raise_for_status()
    judge = next((e for e in response.json()["data"] if e["name"] == ONLINE_JUDGE_NAME), None)
    if judge is None:
        raise CheckFailed(f"{ONLINE_JUDGE_NAME} not found: run `phoenix datagen seed` first.")
    version_id = judge["decision"]["resolved_decision_version_id"]
    version = _graphql(http, _VERSION, id=version_id)["node"]
    return version["modelProvider"], version["modelName"]


def _require_credentials(http: httpx.Client, provider_key: str, endpoint: str) -> None:
    providers = _graphql(http, _PROVIDERS)["modelProviders"]
    provider = next((p for p in providers if p["key"] == provider_key), None)
    if provider is None or "DECISION" not in provider["modelTypes"]:
        raise CheckFailed(f"{provider_key} is not a decision model provider on this server.")
    if not provider["credentialsSet"]:
        keys = ", ".join(
            requirement["envVarName"]
            for requirement in provider["credentialRequirements"]
            if requirement["isRequired"]
        )
        raise CheckFailed(
            f"{provider['name']} needs {keys}: set it in Phoenix's environment, "
            f"or save it at {endpoint.rstrip('/')}/settings/providers."
        )


def _bindings(http: httpx.Client) -> dict[str, dict[str, Any]]:
    response = http.get(f"{_PROJECT_PATH}/evaluators", params={"limit": 1000})
    if response.status_code == 404:
        raise CheckFailed(f"{ONLINE_JUDGE_PROJECT_NAME} not found: run `phoenix datagen seed`.")
    response.raise_for_status()
    found = {b["name"]: b for b in response.json()["data"] if b["name"] in ONLINE_JUDGE_BINDINGS}
    if missing := [name for name in ONLINE_JUDGE_BINDINGS if name not in found]:
        raise CheckFailed(f"Missing {', '.join(missing)}: run `phoenix datagen seed`.")
    return {name: found[name] for name in ONLINE_JUDGE_BINDINGS}


def _sample(http: httpx.Client, grain: str, name: str) -> Optional[dict[str, Any]]:
    _, listing, annotations, ids_param = _GRAINS[grain]
    params: dict[str, Any] = {"limit": 100}
    if grain == "SPAN":
        params["span_kind"] = "LLM"
    response = http.get(f"{_PROJECT_PATH}/{listing}", params=params)
    response.raise_for_status()
    targets = response.json()["data"]
    if not targets:
        return None
    if grain == "SPAN":
        ids = [target["context"]["span_id"] for target in targets]
    elif grain == "TRACE":
        ids = [target["trace_id"] for target in targets]
    else:
        ids = [target["session_id"] for target in targets]
    response = http.get(
        f"{_PROJECT_PATH}/{annotations}",
        params={ids_param: ids, "include_annotation_names": name, "limit": 1},
    )
    response.raise_for_status()
    found = response.json()["data"]
    return found[0]["result"] if found else None


def _results(
    http: httpx.Client, project_id: str, bindings: dict[str, dict[str, Any]]
) -> list[tuple[str, str, int, int, Optional[str]]]:
    rows = []
    for name, binding in bindings.items():
        grain = binding["evaluation_target"]
        data = _graphql(http, _RESULTS, project=project_id, binding=binding["id"])
        counts = {row["name"]: row["count"] for row in data["project"][_GRAINS[grain][0]]}
        summary = data["binding"]["failureSummary"]
        rows.append(
            (grain, name, counts.get(name, 0), summary["failedCount"], summary["lastError"])
        )
    return rows


def check(args: Namespace) -> bool:
    config = _resolve_config(
        Namespace(
            endpoint=args.endpoint,
            api_key=args.api_key,
            corpus=None,
            project=None,
            rate=None,
            burstiness=None,
        ),
        environ,
    )
    with httpx.Client(
        base_url=config.endpoint.rstrip("/") + "/", headers=_headers(config), timeout=30
    ) as http:
        current = _judge_model(http)
        wanted = (args.model_provider or current[0], args.model_name or current[1])
        _require_credentials(http, wanted[0], config.endpoint)
        if wanted != current:
            seed_online_decision_judge(http, model_provider=wanted[0], model_name=wanted[1])
            print(f"{ONLINE_JUDGE_NAME} now runs {wanted[0]} {wanted[1]}")
        bindings = _bindings(http)
        for binding in bindings.values():
            if not binding["enabled"]:
                http.patch(
                    f"v1/project_evaluators/{quote(binding['id'], safe='')}",
                    json={"enabled": True},
                ).raise_for_status()
        response = http.get(_PROJECT_PATH)
        response.raise_for_status()
        project_id = response.json()["data"]["id"]
        print(
            f"Enabled {len(bindings)} bindings on {ONLINE_JUDGE_PROJECT_NAME}; "
            f"waiting up to {args.timeout:.0f}s for annotations"
        )
        deadline = time.monotonic() + args.timeout
        while True:
            rows = _results(http, project_id, bindings)
            if all(count for _, _, count, _, _ in rows) or time.monotonic() >= deadline:
                break
            time.sleep(10)
        print(f"{'grain':<8} {'binding':<26} {'annotations':>11} {'failures':>8}  sample")
        for grain, name, count, failed, last_error in rows:
            result = _sample(http, grain, name) if count else None
            sample = f"label={result['label']!r} score={result['score']!r}" if result else "-"
            print(f"{grain:<8} {name:<26} {count:>11} {failed:>8}  {sample}")
            if failed and last_error:
                print(f"{'':<8} last error: {last_error}")
        return all(count for _, _, count, _, _ in rows)


def main() -> None:
    parser = ArgumentParser(description="Check datagen's online decision judge on live traffic.")
    parser.add_argument("--endpoint", help="Phoenix base URL (env: PHOENIX_COLLECTOR_ENDPOINT).")
    parser.add_argument("--api-key", help="Phoenix API key (env: PHOENIX_API_KEY).")
    parser.add_argument(
        "--timeout", type=float, default=900, help="Seconds to wait for annotations (default: 900)."
    )
    parser.add_argument("--model-provider", help="Decision provider to run the judge on.")
    parser.add_argument("--model-name", help="Decision model to run the judge on.")
    try:
        passed = check(parser.parse_args())
    except CheckFailed as error:
        print(error, file=sys.stderr)
        sys.exit(1)
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
