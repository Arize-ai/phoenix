import asyncio
from datetime import datetime

import httpx

from phoenix.config import (
    get_env_collector_endpoint,
    get_env_host,
    get_env_port,
)
from phoenix.evals.executors import get_executor_on_sync_context
from phoenix.evals.models.rate_limiters import RateLimiter
from phoenix.exceptions import PhoenixRateLimitError


def _phoenix_client():
    host = get_env_host()
    base_url = get_env_collector_endpoint() or f"http://{host}:{get_env_port()}"
    base_url = base_url if base_url.endswith("/") else base_url + "/"
    sync_client = httpx.Client(base_url=base_url)
    async_client = httpx.AsyncClient(base_url=base_url)
    return sync_client, async_client


def run_experiment(dataset_id, callable, dataset_version_id=None):
    sync_client, async_client = _phoenix_client()
    version_param = f"?version-id={dataset_version_id}" if dataset_version_id else ""
    datasets_response = sync_client.get(f"/v1/datasets/{dataset_id}/examples" + version_param)
    dataset = datasets_response.json()

    experiment_response = sync_client.post(
        f"/v1/datasets/{dataset_id}/experiments", json={"version-id": dataset_version_id}
    )
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

        sync_client.post(
            f"/v1/datasets/{dataset_id}/experiments/{experiment_id}/runs", json=experiment_payload
        )

    executor = get_executor_on_sync_context(
        sync_run_experiment,
        async_run_experiment,
    )

    results, execution_details = executor.run(dataset)
    sync_client.post(f"/v1/datasets/{dataset_id}/experiments/{experiment_id}/complete")
    return dataset_id, experiment_id


def experiment_evals(dataset_id, experiment_id, experiment_evaluator):
    # I don't think we should explicitly need to pass a dataset id
    # But since the eventual route for even reading an experiment requires the dataset_id
    # In the path params, we still need to ask for it, which is awkward

    sync_client, async_client = _phoenix_client()

    experiment = sync_client.get(f"/v1/datasets/{dataset_id}/experiments/{experiment_id}").json()
    dataset_version_id = experiment["dataset_version_id"]
    dataset_examples = sync_client.get(
        f"/v1/datasets/{dataset_id}/examples?version-id={dataset_version_id}"
    ).json()
    experiment_data = sync_client.get(
        "/v1/datasets/{dataset_id:str}/experiments/{experiment_id:str}/runs"
    ).json()

    rate_limiter = RateLimiter(rate_limit_error=PhoenixRateLimitError)

    @rate_limiter.limit
    def sync_run_eval(input):
        example, experiment_run = input
        start_time = datetime.now()
        exc = None
        try:
            if asyncio.iscoroutinefunction(experiment_evaluator):
                raise RuntimeError("Evaluator is async but running in sync context")
            else:
                eval = experiment_evaluator(
                    example["input"], example["output"], experiment_run["output"]
                )
        except Exception as exc:
            error = exc
        finally:
            end_time = datetime.now()

        eval_payload = {
            "name": "test eval",
            "label": "test label",
            "score": float(eval),
            "explanation": "test explanation",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
        }
        if exc:
            eval_payload["error"] = repr(error)

        return sync_client.post(
            f"/v1/datasets/{dataset_id}/experiments/{experiment_id}/runs/{experiment_run["id"]}/evaluations",
            json=eval_payload,
        )

    @rate_limiter.alimit
    async def async_run_eval(input):
        example, experiment_run = input
        start_time = datetime.now()
        exc = None
        try:
            if asyncio.iscoroutinefunction(experiment_evaluator):
                eval = await experiment_evaluator(
                    example["input"], example["output"], experiment_run["output"]
                )
            else:
                eval = experiment_evaluator(
                    example["input"], example["output"], experiment_run["output"]
                )
        except Exception as exc:
            error = exc
        finally:
            end_time = datetime.now()

        eval_payload = {
            "name": "test eval",
            "label": "test label",
            "score": float(eval),
            "explanation": "test explanation",
            "start_time": start_time.isoformat(),
            "end_time": end_time.isoformat(),
        }
        if exc:
            eval_payload["error"] = repr(error)

        return sync_client.post(
            f"/v1/datasets/{dataset_id}/experiments/{experiment_id}/runs/{experiment_run["id"]}/evaluations",
            json=eval_payload,
        )

    executor = get_executor_on_sync_context(
        sync_run_eval,
        async_run_eval,
    )

    results, execution_details = executor.run(list(zip(dataset_examples, experiment_data)))
    return results
