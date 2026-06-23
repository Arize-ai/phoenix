"""Happy-path + contract tests for the public log_run / log_evaluation client methods."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx
import pytest

from phoenix.client.resources.experiments import AsyncExperiments, Experiments


def _client(handler: Any) -> httpx.Client:
    return httpx.Client(base_url="http://test", transport=httpx.MockTransport(handler))


def _async_client(handler: Any) -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url="http://test", transport=httpx.MockTransport(handler))


def test_log_run_posts_and_returns_server_id() -> None:
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json

        captured["url"] = str(request.url)
        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={"data": {"id": "ExperimentRun:server-1"}})

    exp = Experiments(client=_client(handler))
    now = datetime.now(timezone.utc)
    run = exp.log_run(
        experiment_id="Experiment:1",
        dataset_example_id="DatasetExample:9",
        output={"answer": "42"},
        start_time=now,
        end_time=now,
        repetition_number=1,
    )
    assert run["id"] == "ExperimentRun:server-1"
    assert captured["url"].endswith("/v1/experiments/Experiment%3A1/runs")
    assert captured["body"]["dataset_example_id"] == "DatasetExample:9"
    assert captured["body"]["output"] == {"answer": "42"}


def test_log_run_raises_on_409_by_default() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, json={"detail": "already exists"})

    exp = Experiments(client=_client(handler))
    now = datetime.now(timezone.utc)
    with pytest.raises(httpx.HTTPStatusError):
        exp.log_run(
            experiment_id="Experiment:1",
            dataset_example_id="DatasetExample:9",
            output=None,
            start_time=now,
            end_time=now,
        )


def test_log_run_tolerate_existing_swallows_409() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(409, json={"detail": "already exists"})

    exp = Experiments(client=_client(handler))
    now = datetime.now(timezone.utc)
    run = exp.log_run(
        experiment_id="Experiment:1",
        dataset_example_id="DatasetExample:9",
        output=None,
        start_time=now,
        end_time=now,
        tolerate_existing=True,
    )
    assert run["id"].startswith("temp-")


def test_log_evaluation_requires_result_or_error() -> None:
    exp = Experiments(client=_client(lambda r: httpx.Response(200, json={"data": {"id": "x"}})))
    with pytest.raises(ValueError):
        exp.log_evaluation(experiment_run_id="ExperimentRun:1", name="pass")


def test_log_evaluation_posts_result() -> None:
    captured: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        import json

        captured["body"] = json.loads(request.content)
        return httpx.Response(200, json={"data": {"id": "Annotation:1"}})

    exp = Experiments(client=_client(handler))
    evaluation = exp.log_evaluation(
        experiment_run_id="ExperimentRun:1",
        name="pass",
        score=1.0,
        label="pass",
    )
    assert evaluation["id"] == "Annotation:1"
    assert captured["body"]["name"] == "pass"
    assert captured["body"]["result"] == {"score": 1.0, "label": "pass"}


async def test_async_log_run_matches_sync_contract() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"data": {"id": "ExperimentRun:async-1"}})

    exp = AsyncExperiments(client=_async_client(handler))
    now = datetime.now(timezone.utc)
    run = await exp.log_run(
        experiment_id="Experiment:1",
        dataset_example_id="DatasetExample:9",
        output={"k": "v"},
        start_time=now,
        end_time=now,
    )
    assert run["id"] == "ExperimentRun:async-1"
