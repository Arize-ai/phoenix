import asyncio
from datetime import datetime

import httpx

from phoenix.config import (
    get_env_collector_endpoint,
    get_env_host,
    get_env_port,
)
from phoenix.exceptions import PhoenixRateLimitError
from phoenix.evals.executors import get_executor_on_sync_context
from phoenix.evals.models.rate_limiters import RateLimiter


def _phoenix_client():
    host = get_env_host()
    base_url = get_env_collector_endpoint() or f"http://{host}:{get_env_port()}"
    base_url = base_url if base_url.endswith("/") else base_url + "/"
    sync_client = httpx.Client(base_url=base_url)
    async_client = httpx.AsyncClient(base_url=base_url)
    return sync_client, async_client


def run_experiment(dataset_id, callable):
    sync_client, async_client = _phoenix_client()
    datasets_response = sync_client.get(f"v1/datasets/{dataset_id}/examples")
    dataset = datasets_response.json()

    experiment_response = sync_client.post(f"v1/datasets/{dataset_id}/experiments")
    experiment_id = experiment_response.json()["id"]

    rate_limiter = RateLimiter(rate_limit_error=PhoenixRateLimitError)

    @rate_limiter.limit
    def sync_run_experiment(example):
        start_time = datetime.now()
        exc = None
        try:
            if asyncio.iscoroutinefunction(callable):
                raise RuntimeError("Callable is async but running in sync context")
            else:
                output = callable(example["input"])
        except Exception as exc:
            error = exc
        finally:
            end_time = datetime.now()

        experiment_payload = {
            "dataset_example_id": example["id"],
            "output": output,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
        }
        if exc:
            experiment_payload["error"] = repr(error)

        sync_client.post(
            f"/v1/datasets/{dataset_id}/experiments/{experiment_id}/runs", json=experiment_payload
        )

    @rate_limiter.alimit
    async def async_run_experiment(example):
        start_time = datetime.now()
        exc = None
        try:
            if asyncio.iscoroutinefunction(callable):
                output = await callable(example["input"])
            else:
                output = callable(example["input"])
        except Exception as exc:
            error = exc
        finally:
            end_time = datetime.now()

        experiment_payload = {
            "dataset_example_id": example["id"],
            "output": output,
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
        }
        if exc:
            experiment_payload["error"] = repr(error)

        sync_client.post(f"/v1/datasets/{dataset_id}/experiments/{experiment_id}/runs")

    executor = get_executor_on_sync_context(
        sync_run_experiment,
        async_run_experiment,
    )

    results, execution_details = executor.run(dataset)
