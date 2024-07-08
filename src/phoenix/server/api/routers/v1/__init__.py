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

V1_ROUTES = (
    ("/v1/evaluations", evaluations.post_evaluations, ["POST"]),
    ("/v1/evaluations", evaluations.get_evaluations, ["GET"]),
    ("/v1/traces", traces.post_traces, ["POST"]),
    ("/v1/spans", spans.query_spans_handler, ["POST"]),
    ("/v1/spans", spans.get_spans_handler, ["GET"]),
    ("/v1/datasets/upload", datasets.post_datasets_upload, ["POST"]),
    ("/v1/datasets", datasets.list_datasets, ["GET"]),
    ("/v1/datasets/{id:str}", datasets.delete_dataset_by_id, ["DELETE"]),
    ("/v1/datasets/{id:str}", datasets.get_dataset_by_id, ["GET"]),
    ("/v1/datasets/{id:str}/csv", datasets.get_dataset_csv, ["GET"]),
    ("/v1/datasets/{id:str}/jsonl/openai_ft", datasets.get_dataset_jsonl_openai_ft, ["GET"]),
    ("/v1/datasets/{id:str}/jsonl/openai_evals", datasets.get_dataset_jsonl_openai_evals, ["GET"]),
    ("/v1/datasets/{id:str}/examples", list_dataset_examples, ["GET"]),
    ("/v1/datasets/{id:str}/versions", datasets.get_dataset_versions, ["GET"]),
    ("/v1/datasets/{dataset_id:str}/experiments", experiments.create_experiment, ["POST"]),
    ("/v1/experiments/{experiment_id:str}", experiments.read_experiment, ["GET"]),
    ("/v1/experiments/{experiment_id:str}/runs", experiment_runs.create_experiment_run, ["POST"]),
    ("/v1/experiments/{experiment_id:str}/runs", experiment_runs.list_experiment_runs, ["GET"]),
    ("/v1/experiment_evaluations", experiment_evaluations.upsert_experiment_evaluation, ["POST"]),
)
