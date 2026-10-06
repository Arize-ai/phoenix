import importlib.util
import json
from pathlib import Path
from types import ModuleType
from typing import Any
from unittest.mock import MagicMock

import httpx
import pytest
from phoenix.client import Client


@pytest.fixture
def loader() -> ModuleType:
    path = Path(__file__).resolve().parents[3] / "scripts" / "load_patronus_trail.py"
    spec = importlib.util.spec_from_file_location("load_patronus_trail", path)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize("scores_on_trace", [False, True])
def test_annotations_are_persisted_when_loading_returns(
    tmp_path: Path, scores_on_trace: bool, loader: ModuleType
) -> None:
    trace_id = "1" * 32
    span_id = "2" * 16
    rows = tmp_path / "rows.json"
    rows.write_text(
        json.dumps(
            [
                {
                    "trace": json.dumps(
                        {
                            "trace_id": trace_id,
                            "spans": [
                                {
                                    "trace_id": trace_id,
                                    "span_id": span_id,
                                    "timestamp": "2025-03-19T16:40:00Z",
                                    "duration": "PT1S",
                                }
                            ],
                        }
                    ),
                    "labels": json.dumps(
                        {
                            "errors": [
                                {"location": span_id, "category": f"error-{i}", "impact": "HIGH"}
                                for i in range(101)
                            ],
                            "scores": [{"reliability_score": 3.0}],
                        }
                    ),
                }
            ]
        )
    )
    persisted_spans: list[dict[str, Any]] = []
    persisted_traces: list[dict[str, Any]] = []

    def log_span_annotations(*, span_annotations: list[dict[str, Any]], sync: bool = False) -> None:
        if sync:
            persisted_spans.extend(span_annotations)

    def log_trace_annotations(
        *, trace_annotations: list[dict[str, Any]], sync: bool = False
    ) -> None:
        if sync:
            persisted_traces.extend(trace_annotations)

    client = MagicMock()
    client.spans.get_spans.return_value = [{"context": {"span_id": span_id}}]
    client.spans.log_span_annotations.side_effect = log_span_annotations
    client.traces.log_trace_annotations.side_effect = log_trace_annotations
    loader._load_source(
        client,
        "gaia",
        rows,
        None,
        shift_to_now=False,
        annotations=True,
        scores_on_trace=scores_on_trace,
        mapper=loader.IdMapper(regenerate=False),
    )

    assert len(persisted_spans) == (101 if scores_on_trace else 102)
    assert len(persisted_traces) == (1 if scores_on_trace else 0)
    reliability = next(
        a for a in persisted_spans + persisted_traces if a["name"] == "trail_reliability"
    )
    assert reliability["result"]["score"] == 3.0


def test_wait_for_spans_finds_previously_imported_traces(loader: ModuleType) -> None:
    trace_id = "1" * 32
    span_id = "2" * 16
    imported = {"context": {"span_id": span_id, "trace_id": trace_id}}
    newer = [{"context": {"span_id": f"{i:016x}", "trace_id": "3" * 32}} for i in range(1100)]

    def respond(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/arize_phoenix_version":
            return httpx.Response(200, text="20.0.0")
        spans = (
            [imported]
            if request.url.params.get_list("trace_id") == [trace_id]
            else newer + [imported]
        )
        start = int(request.url.params.get("cursor", "0"))
        end = start + int(request.url.params["limit"])
        return httpx.Response(
            200,
            json={"data": spans[start:end], "next_cursor": str(end) if end < len(spans) else None},
        )

    client = Client(
        base_url="http://test",
        http_client=httpx.Client(base_url="http://test", transport=httpx.MockTransport(respond)),
    )
    loader._wait_for_spans(client, "trail-gaia", {span_id}, {trace_id}, timeout=0)


def test_wait_for_spans_batches_traces_and_waits_for_ingestion(
    loader: ModuleType, monkeypatch: pytest.MonkeyPatch
) -> None:
    trace_ids = {f"{i:032x}" for i in range(51)}
    span_ids = {f"{i:016x}" for i in range(51)}
    requests: list[list[str]] = []
    slept: list[float] = []

    def get_spans(
        *, project_identifier: str, trace_ids: list[str], limit: int
    ) -> list[dict[str, Any]]:
        requests.append(trace_ids)
        return [
            {"context": {"span_id": trace_id[-16:]}}
            for trace_id in trace_ids
            if int(trace_id, 16) != 50 or slept
        ]

    client = MagicMock()
    client.spans.get_spans.side_effect = get_spans
    monkeypatch.setattr(loader.time, "sleep", slept.append)
    loader._wait_for_spans(client, "trail-gaia", span_ids, trace_ids)
    assert slept == [2]
    assert [len(batch) for batch in requests] == [50, 1, 50, 1]
    assert set().union(*map(set, requests)) == trace_ids


def test_wait_for_spans_times_out(loader: ModuleType) -> None:
    client = MagicMock()
    client.spans.get_spans.return_value = []
    with pytest.raises(TimeoutError, match="1 spans were not ingested"):
        loader._wait_for_spans(client, "trail-gaia", {"2" * 16}, {"1" * 32}, timeout=0)
