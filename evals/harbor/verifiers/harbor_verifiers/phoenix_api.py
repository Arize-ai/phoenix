"""Phoenix query helpers for reference solutions in task images.

Use the typed Phoenix client for spans and span annotations. The client cannot read
trace annotations, so :func:`trace_annotation_scores` uses the REST API. Per-span cost
requires GraphQL, so :func:`span_costs` uses the GraphQL API. Aggregates over many rows
go through :func:`execute_sql`, the read-only analytics SQL tool on the MCP server.
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict
from typing import Any, Sequence

from fastmcp import Client as McpClient
from phoenix.client import Client
from phoenix.client.__generated__ import v1
from strawberry.relay import GlobalID

from harbor_verifiers.graphql.__generated__ import Client as GraphQLClient
from harbor_verifiers.graphql.__generated__ import (
    DatasetEvaluatorFields,
    DatasetEvaluatorsNodeDataset,
    DatasetExperimentsNodeDataset,
    ExperimentFields,
)
from phoenix.server.api.types.node import from_global_id

PHOENIX_URL = os.environ.get("PHOENIX_EVAL_URL", "http://127.0.0.1:6006")
ANSWER_PATH = os.environ.get("PHOENIX_EVAL_ANSWER_PATH", "/app/answer.txt")
SPAN_LIMIT = 1_000_000  # The client fetches 100 spans per page up to this limit.


def client() -> Client:
    return Client(base_url=PHOENIX_URL)


def dataset_examples(dataset: str) -> tuple[str, list[v1.DatasetExample]]:
    """The dataset's node id and its current examples."""
    result = client().datasets.get_dataset(dataset=dataset)
    return result.id, result.examples


def project_spans(project: str) -> list[v1.Span]:
    return client().spans.get_spans(project_identifier=project, limit=SPAN_LIMIT)


TraceId = str
SpanId = str


def spans_by_trace(spans: list[v1.Span]) -> dict[TraceId, list[v1.Span]]:
    traces: dict[TraceId, list[v1.Span]] = defaultdict(list)
    for span in spans:
        traces[span["context"]["trace_id"]].append(span)
    return traces


def annotation_labels(project: str, name: str) -> list[str]:
    annotations = client().spans.get_span_annotations(
        spans=project_spans(project), project_identifier=project, include_annotation_names=[name]
    )
    return [
        str(annotation["result"]["label"])
        for annotation in annotations
        if annotation.get("result") and annotation["result"].get("label")
    ]


def trace_annotation_scores(
    project: str, name: str, trace_ids: Sequence[TraceId]
) -> dict[TraceId, float]:
    """Return the score of each trace's ``name`` annotation, omitting unscored traces."""
    scores: dict[TraceId, float] = {}
    for start in range(0, len(trace_ids), 50):
        cursor: str | None = None
        while True:
            params: dict[str, Any] = {"trace_ids": trace_ids[start : start + 50], "limit": 1000}
            if cursor:
                params["cursor"] = cursor
            url = (
                f"{PHOENIX_URL}/v1/projects/{urllib.parse.quote(project)}/trace_annotations?"
                + urllib.parse.urlencode(params, doseq=True)
            )
            with urllib.request.urlopen(url, timeout=60) as response:
                page: v1.TraceAnnotationsResponseBody = json.load(response)
            for annotation in page["data"]:
                result = annotation.get("result")
                score = result.get("score") if result else None
                if annotation["name"] == name and score is not None:
                    scores[annotation["trace_id"]] = float(score)
            cursor = page.get("next_cursor")
            if not cursor:
                break
    return scores


def graphql_client() -> GraphQLClient:
    """The typed client that ``make codegen-harbor-graphql`` compiles from verifiers/graphql/operations."""
    return GraphQLClient(url=f"{PHOENIX_URL}/graphql")


def rowid(node_id: str) -> int:
    return from_global_id(GlobalID.from_id(node_id))[1]


def dataset_evaluators(dataset_id: str) -> list[DatasetEvaluatorFields]:
    node = graphql_client().dataset_evaluators(dataset_id, timeout=60.0).node
    if not isinstance(node, DatasetEvaluatorsNodeDataset):
        raise ValueError(f"{dataset_id} is not a dataset")
    return [edge.node for edge in node.dataset_evaluators.edges]


def dataset_experiments(dataset_id: str) -> list[ExperimentFields]:
    """Every experiment run on the dataset, oldest first."""
    node = graphql_client().dataset_experiments(dataset_id, timeout=60.0).node
    if not isinstance(node, DatasetExperimentsNodeDataset):
        raise ValueError(f"{dataset_id} is not a dataset")
    return sorted((edge.node for edge in node.experiments.edges), key=lambda x: x.created_at)


def graphql(
    query: str, variables: dict[str, Any] | None = None, timeout: float = 60.0
) -> dict[str, Any]:
    """Return the ``data`` object from a local Phoenix GraphQL query."""
    request = urllib.request.Request(
        f"{PHOENIX_URL}/graphql",
        data=json.dumps({"query": query, "variables": variables or {}}).encode(),
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        payload = json.load(response)
    if payload.get("errors"):
        raise SystemExit(payload["errors"])
    data: dict[str, Any] = payload["data"]
    return data


def span_costs(project: str) -> dict[SpanId, float]:
    """Spans without cost data are omitted."""
    edges = graphql("{ projects(first: 100) { edges { node { id name } } } }")["projects"]["edges"]
    project_id = json.dumps(next(e["node"]["id"] for e in edges if e["node"]["name"] == project))
    costs: dict[SpanId, float] = {}
    cursor: str | None = None
    while True:
        after = ", after: " + json.dumps(cursor) if cursor else ""
        page = graphql(
            "{ node(id: " + project_id + ") { ... on Project { spans(first: 500" + after + ") {"
            " edges { node { spanId costSummary { total { cost } } } }"
            " pageInfo { hasNextPage endCursor } } } } }"
        )["node"]["spans"]
        for edge in page["edges"]:
            cost = ((edge["node"].get("costSummary") or {}).get("total") or {}).get("cost")
            if cost:
                costs[edge["node"]["spanId"]] = float(cost)
        if not page["pageInfo"]["hasNextPage"]:
            return costs
        cursor = page["pageInfo"]["endCursor"]


Row = dict[str, Any]


def execute_sql(sql: str) -> list[Row]:
    """Run one read-only statement through the MCP ``executeSql`` tool.

    The tool admits only allowlisted tables and functions and caps results at
    5,000 rows, so aggregate in SQL rather than fetching rows to aggregate here.
    """

    # The analytics tools are hidden behind progressive disclosure, so the MCP
    # session (whose logger is named "client") warns that it cannot validate
    # their structured output. It still returns it.
    logging.getLogger("client").setLevel(logging.ERROR)

    async def call() -> dict[str, Any]:
        async with McpClient(f"{PHOENIX_URL}/mcp") as mcp:
            result = await mcp.call_tool("executeSql", {"sql": sql, "row_limit": 5_000})
        envelope = result.structured_content or result.data
        if not isinstance(envelope, dict):
            raise SystemExit(f"executeSql returned no envelope: {result.content}")
        return envelope

    envelope = asyncio.run(call())
    if "error" in envelope:
        raise SystemExit(f"executeSql refused the statement: {envelope['error']}\n{sql}")
    if envelope.get("row_count_is_partial"):
        raise SystemExit(f"executeSql truncated the result: {envelope.get('notes')}\n{sql}")
    columns = envelope["columns"]
    return [dict(zip(columns, row)) for row in envelope["rows"]]


def scalar(sql: str) -> Any:
    """The single value of a one-row, one-column statement."""
    rows = execute_sql(sql)
    if len(rows) != 1 or len(rows[0]) != 1:
        raise SystemExit(f"expected one value, got {rows!r}\n{sql}")
    return next(iter(rows[0].values()))


def rest(path: str, *, missing_ok: bool = False, **params: Any) -> Any:
    """GET a REST route under ``/v1`` and return the parsed JSON body.

    List parameters repeat the query key. With ``missing_ok`` a 404 returns None.
    """
    query = urllib.parse.urlencode(
        {key: value for key, value in params.items() if value is not None}, doseq=True
    )
    request = urllib.request.Request(f"{PHOENIX_URL}/v1{path}" + (f"?{query}" if query else ""))
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        if missing_ok and error.code == 404:
            return None
        raise SystemExit(f"GET /v1{path} failed with {error.code}: {error.read()[:500]!r}")


def rest_pages(path: str, **params: Any) -> list[Any]:
    """Every item of a cursor-paginated REST list route."""
    items: list[Any] = []
    cursor: str | None = None
    while True:
        page = rest(path, cursor=cursor, **params)
        items.extend(page["data"])
        cursor = page.get("next_cursor")
        if not cursor:
            return items


def dataset_id(name: str) -> str:
    """The node id of the dataset with this exact name."""
    for dataset in rest("/datasets", name=name)["data"]:
        if dataset["name"] == name:
            return str(dataset["id"])
    raise SystemExit(f"no dataset named {name!r}")


def experiment_by_name(dataset: str, name: str) -> dict[str, Any]:
    """The REST experiment record with this name on the dataset."""
    for experiment in rest_pages(f"/datasets/{dataset_id(dataset)}/experiments", limit=100):
        if experiment["name"] == name:
            return dict(experiment)
    raise SystemExit(f"no experiment named {name!r} on {dataset!r}")


_EXPERIMENT_RUNS = """
query($id: ID!, $after: String) { node(id: $id) { ... on Experiment {
  runs(first: 50, after: $after) {
    pageInfo { hasNextPage endCursor }
    edges { node { id traceId error output
      annotations { edges { node { name label score explanation } } }
      example { id revision { input output metadata } } } } } } } }
"""


def experiment_runs(experiment_id: str) -> list[dict[str, Any]]:
    """Every run of the experiment with its annotations flattened and its example."""
    runs: list[dict[str, Any]] = []
    cursor: str | None = None
    while True:
        page = graphql(_EXPERIMENT_RUNS, {"id": experiment_id, "after": cursor})["node"]["runs"]
        for edge in page["edges"]:
            run = dict(edge["node"])
            run["annotations"] = [a["node"] for a in run["annotations"]["edges"]]
            runs.append(run)
        if not page["pageInfo"]["hasNextPage"]:
            return runs
        cursor = page["pageInfo"]["endCursor"]


_GENERATIVE_MODELS = """
query($after: String) { generativeModels(first: 100, after: $after) {
  pageInfo { hasNextPage endCursor }
  edges { node { name namePattern kind provider
    tokenPrices { tokenType kind costPerToken costPerMillionTokens } } } } }
"""


def generative_models() -> list[dict[str, Any]]:
    """Every generative model with its token prices."""
    models: list[dict[str, Any]] = []
    cursor: str | None = None
    while True:
        page = graphql(_GENERATIVE_MODELS, {"after": cursor})["generativeModels"]
        models.extend(edge["node"] for edge in page["edges"])
        if not page["pageInfo"]["hasNextPage"]:
            return models
        cursor = page["pageInfo"]["endCursor"]


def attribute(attributes: str | dict[str, Any], path: str) -> Any:
    """A dotted key such as ``llm.model_name`` from a span's nested attributes."""
    value: Any = json.loads(attributes) if isinstance(attributes, str) else attributes
    for part in path.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(part)
    return value


def utc(timestamp: str) -> str:
    """An ISO 8601 instant as ``YYYY-MM-DD HH:MM:SS UTC`` for the answer text."""
    return timestamp[:19].replace("T", " ") + " UTC"


def write_answer(answer: str) -> None:
    """Write the answer for grading and print it to the task log."""
    with open(ANSWER_PATH, "w") as handle:
        handle.write(answer + "\n")
    print(answer)
