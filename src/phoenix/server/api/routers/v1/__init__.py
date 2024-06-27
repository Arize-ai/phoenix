from typing import Any, Awaitable, Callable, Mapping, Tuple

import wrapt
from starlette import routing
from starlette.requests import Request
from starlette.responses import Response
from starlette.status import HTTP_403_FORBIDDEN

from . import (
    datasets,
    evaluations,
    experiment_evaluations,
    experiment_runs,
    experiments,
    spans,
    traces,
)
from .dataset_examples import list_dataset_examples


@wrapt.decorator  # type: ignore
async def forbid_if_readonly(
    wrapped: Callable[[Request], Awaitable[Response]],
    _: Any,
    args: Tuple[Request],
    kwargs: Mapping[str, Any],
) -> Response:
    request, *_ = args
    if request.app.state.read_only:
        return Response(status_code=HTTP_403_FORBIDDEN)
    return await wrapped(*args, **kwargs)


class Route(routing.Route):
    def __init__(self, path: str, endpoint: Callable[..., Any], **kwargs: Any) -> None:
        super().__init__(path, forbid_if_readonly(endpoint), **kwargs)


V1_ROUTES = [
    Route("/v1/evaluations", evaluations.post_evaluations, methods=["POST"]),
    Route("/v1/evaluations", evaluations.get_evaluations, methods=["GET"]),
    Route("/v1/traces", traces.post_traces, methods=["POST"]),
    Route("/v1/spans", spans.query_spans_handler, methods=["POST"]),
    Route("/v1/spans", spans.get_spans_handler, methods=["GET"]),
    Route("/v1/datasets/upload", datasets.post_datasets_upload, methods=["POST"]),
    Route("/v1/datasets", datasets.list_datasets, methods=["GET"]),
    Route("/v1/datasets/{id:str}", datasets.get_dataset_by_id, methods=["GET"]),
    Route("/v1/datasets/{id:str}/csv", datasets.get_dataset_csv, methods=["GET"]),
    Route(
        "/v1/datasets/{id:str}/jsonl/openai_ft",
        datasets.get_dataset_jsonl_openai_ft,
        methods=["GET"],
    ),
    Route(
        "/v1/datasets/{id:str}/jsonl/openai_evals",
        datasets.get_dataset_jsonl_openai_evals,
        methods=["GET"],
    ),
    Route("/v1/datasets/{id:str}/examples", list_dataset_examples, methods=["GET"]),
    Route("/v1/datasets/{id:str}/versions", datasets.get_dataset_versions, methods=["GET"]),
    Route(
        "/v1/datasets/{dataset_id:str}/experiments",
        experiments.create_experiment,
        methods=["POST"],
    ),
    Route(
        "/v1/experiments/{experiment_id:str}",
        experiments.read_experiment,
        methods=["GET"],
    ),
    Route(
        "/v1/experiments/{experiment_id:str}/runs",
        experiment_runs.create_experiment_run,
        methods=["POST"],
    ),
    Route(
        "/v1/experiments/{experiment_id:str}/runs",
        experiment_runs.list_experiment_runs,
        methods=["GET"],
    ),
    Route(
        "/v1/experiment_evaluations",
        experiment_evaluations.upsert_experiment_evaluation,
        methods=["POST"],
    ),
]
