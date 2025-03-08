import datetime
import json
from io import StringIO
from typing import Any

import httpx
import pandas as pd
import pytest
from httpx import HTTPStatusError
from strawberry.relay import GlobalID


async def test_experiments_api(
    httpx_client: httpx.AsyncClient,
    simple_dataset: Any,
) -> None:
    """
    A simple test of the expected flow for the experiments API flow
    """

    dataset_gid = GlobalID("Dataset", "0")

    # first, create an experiment associated with a dataset
    created_experiment = (
        await httpx_client.post(
            f"/v1/datasets/{dataset_gid}/experiments",
            json={"version_id": None, "repetitions": 1},
        )
    ).json()["data"]

    experiment_gid = created_experiment["id"]
    version_gid = created_experiment["dataset_version_id"]
    assert created_experiment["repetitions"] == 1

    dataset_examples = (
        await httpx_client.get(
            f"/v1/datasets/{dataset_gid}/examples",
            params={"version_id": str(version_gid)},
        )
    ).json()["data"]["examples"]

    # experiments can be read using the GET /experiments route
    experiment = (await httpx_client.get(f"/v1/experiments/{experiment_gid}")).json()["data"]
    assert experiment
    assert created_experiment["repetitions"] == 1

    # get experiment JSON before any runs - should return 404
    response = await httpx_client.get(f"/v1/experiments/{experiment_gid}/json")
    assert response.status_code == 404
    assert "has no runs" in response.text

    # create experiment runs for each dataset example
    run_payload = {
        "dataset_example_id": str(dataset_examples[0]["id"]),
        "trace_id": "placeholder-id",
        "output": "some LLM application output",
        "repetition_number": 1,
        "start_time": datetime.datetime.now().isoformat(),
        "end_time": datetime.datetime.now().isoformat(),
        "error": "an error message, if applicable",
    }
    run_payload["id"] = (
        await httpx_client.post(
            f"/v1/experiments/{experiment_gid}/runs",
            json=run_payload,
        )
    ).json()["data"]["id"]

    # get experiment JSON after runs but before evaluations
    response = await httpx_client.get(f"/v1/experiments/{experiment_gid}/json")
    assert response.status_code == 200
    runs = json.loads(response.text)
    assert len(runs) == 1
    run = runs[0]
    assert isinstance(run.pop("example_id"), str)
    assert run.pop("repetition_number") == 1
    assert run.pop("input") == {"in": "foo"}
    assert run.pop("reference_output") == {"out": "bar"}
    assert run.pop("output") == "some LLM application output"
    assert run.pop("error") == "an error message, if applicable"
    assert isinstance(run.pop("latency_ms"), float)
    assert isinstance(run.pop("start_time"), str)
    assert isinstance(run.pop("end_time"), str)
    assert run.pop("trace_id") == "placeholder-id"
    assert run.pop("prompt_token_count") is None
    assert run.pop("completion_token_count") is None
    assert run.pop("annotations") == []
    assert not run

    # get experiment CSV after runs but before evaluations
    response = await httpx_client.get(f"/v1/experiments/{experiment_gid}/csv")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv"
    assert response.headers["content-disposition"].startswith('attachment; filename="')

    # Parse CSV content and verify the data
    csv_content = response.text
    df = pd.read_csv(StringIO(csv_content))
    assert len(df) == 1

    # Convert first row to dictionary and verify all fields
    row = df.iloc[0].to_dict()
    assert isinstance(row.pop("example_id"), str)
    assert row.pop("repetition_number") == 1
    assert json.loads(row.pop("input")) == {"in": "foo"}
    assert json.loads(row.pop("reference_output")) == {"out": "bar"}
    assert row.pop("output") == "some LLM application output"
    assert row.pop("error") == "an error message, if applicable"
    assert isinstance(row.pop("latency_ms"), float)
    assert isinstance(row.pop("start_time"), str)
    assert isinstance(row.pop("end_time"), str)
    assert row.pop("trace_id") == "placeholder-id"
    assert pd.isna(row.pop("prompt_token_count"))
    assert pd.isna(row.pop("completion_token_count"))
    assert not row

    # experiment runs can be listed for evaluations
    experiment_runs = (await httpx_client.get(f"/v1/experiments/{experiment_gid}/runs")).json()[
        "data"
    ]
    assert experiment_runs
    assert len(experiment_runs) == 1

    # each experiment run can be evaluated
    evaluation_payload = {
        "experiment_run_id": run_payload["id"],
        "trace_id": "placeholder-id",
        "name": "some_evaluation_name",
        "annotator_kind": "LLM",
        "result": {
            "label": "some label",
            "score": 0.5,
            "explanation": "some explanation",
            "metadata": {"some": "metadata"},
        },
        "error": "an error message, if applicable",
        "start_time": datetime.datetime.now().isoformat(),
        "end_time": datetime.datetime.now().isoformat(),
    }
    experiment_evaluation = (
        await httpx_client.post("/v1/experiment_evaluations", json=evaluation_payload)
    ).json()
    assert experiment_evaluation

    # get experiment JSON after adding evaluations
    response = await httpx_client.get(f"/v1/experiments/{experiment_gid}/json")
    assert response.status_code == 200
    runs = json.loads(response.text)
    assert len(runs) == 1
    assert len(runs[0]["annotations"]) == 1
    annotation = runs[0]["annotations"][0]
    assert annotation.pop("name") == "some_evaluation_name"
    assert annotation.pop("label") == "some label"
    assert annotation.pop("score") == 0.5
    assert annotation.pop("explanation") == "some explanation"
    assert annotation.pop("metadata") == {}
    assert annotation.pop("annotator_kind") == "LLM"
    assert annotation.pop("trace_id") == "placeholder-id"
    assert annotation.pop("error") == "an error message, if applicable"
    assert isinstance(annotation.pop("start_time"), str)
    assert isinstance(annotation.pop("end_time"), str)
    assert not annotation

    # get experiment CSV after evaluations
    response = await httpx_client.get(f"/v1/experiments/{experiment_gid}/csv")
    assert response.status_code == 200
    assert response.headers["content-type"] == "text/csv"
    assert response.headers["content-disposition"].startswith('attachment; filename="')

    # Parse CSV content and verify the data with annotations
    csv_content = response.text
    df = pd.read_csv(StringIO(csv_content))
    assert len(df) == 1

    # Verify base fields
    row = df.iloc[0].to_dict()
    assert isinstance(row.pop("example_id"), str)
    assert row.pop("repetition_number") == 1
    assert json.loads(row.pop("input")) == {"in": "foo"}
    assert json.loads(row.pop("reference_output")) == {"out": "bar"}
    assert row.pop("output") == "some LLM application output"
    assert row.pop("error") == "an error message, if applicable"
    assert isinstance(row.pop("latency_ms"), float)
    assert isinstance(row.pop("start_time"), str)
    assert isinstance(row.pop("end_time"), str)
    assert row.pop("trace_id") == "placeholder-id"
    assert pd.isna(row.pop("prompt_token_count"))
    assert pd.isna(row.pop("completion_token_count"))

    # Verify annotation fields
    annotation_prefix = "annotation_some_evaluation_name"
    assert row.pop(f"{annotation_prefix}_label") == "some label"
    assert row.pop(f"{annotation_prefix}_score") == 0.5
    assert row.pop(f"{annotation_prefix}_explanation") == "some explanation"
    assert json.loads(row.pop(f"{annotation_prefix}_metadata")) == {}
    assert row.pop(f"{annotation_prefix}_annotator_kind") == "LLM"
    assert row.pop(f"{annotation_prefix}_trace_id") == "placeholder-id"
    assert row.pop(f"{annotation_prefix}_error") == "an error message, if applicable"
    assert isinstance(row.pop(f"{annotation_prefix}_start_time"), str)
    assert isinstance(row.pop(f"{annotation_prefix}_end_time"), str)
    assert not row


async def test_experiment_404s_with_missing_dataset(
    httpx_client: httpx.AsyncClient,
    simple_dataset: Any,
) -> None:
    incorrect_dataset_gid = GlobalID("Dataset", "1")
    response = await httpx_client.post(
        f"/v1/datasets/{incorrect_dataset_gid}/experiments", json={"version_id": None}
    )
    assert response.status_code == 404


async def test_experiment_404s_with_missing_version(
    httpx_client: httpx.AsyncClient,
    simple_dataset: Any,
) -> None:
    correct_dataset_gid = GlobalID("Dataset", "0")
    incorrect_version_gid = GlobalID("DatasetVersion", "9000")
    response = await httpx_client.post(
        f"/v1/datasets/{correct_dataset_gid}/experiments",
        json={"version_id": str(incorrect_version_gid)},
    )
    assert response.status_code == 404


async def test_reading_experiments(
    httpx_client: httpx.AsyncClient,
    dataset_with_experiments_without_runs: Any,
) -> None:
    experiment_gid = GlobalID("Experiment", "0")
    dataset_gid = GlobalID("Dataset", "1")
    dataset_version_gid = GlobalID("DatasetVersion", "1")
    response = await httpx_client.get(f"/v1/experiments/{experiment_gid}")
    assert response.status_code == 200
    experiment = response.json()["data"]
    assert "created_at" in experiment
    assert "updated_at" in experiment
    expected = {
        "id": str(experiment_gid),
        "dataset_id": str(dataset_gid),
        "dataset_version_id": str(dataset_version_gid),
        "metadata": {"info": "a test experiment"},
    }
    assert all(experiment[key] == value for key, value in expected.items())


async def test_listing_experiments_on_empty_dataset(
    httpx_client: httpx.AsyncClient,
    dataset_with_experiments_without_runs: Any,
) -> None:
    dataset_gid = GlobalID("Dataset", "0")

    response = await httpx_client.get(f"/v1/datasets/{dataset_gid}/experiments")
    assert response.status_code == 200
    experiments = response.json()["data"]
    [experiment["id"] for experiment in experiments]
    assert len(experiments) == 0, "Both experiments are associated with Dataset with ID 1"


async def test_listing_experiments_by_dataset(
    httpx_client: httpx.AsyncClient,
    dataset_with_experiments_without_runs: Any,
) -> None:
    dataset_gid = GlobalID("Dataset", "1")
    experiment_gid_0 = GlobalID("Experiment", "0")
    experiment_gid_1 = GlobalID("Experiment", "1")

    response = await httpx_client.get(f"/v1/datasets/{dataset_gid}/experiments")
    assert response.status_code == 200
    experiments = response.json()["data"]
    experiment_gids = [experiment["id"] for experiment in experiments]
    assert len(experiments) == 2
    assert str(experiment_gid_1) == experiment_gids[0], "experiments are listed newest first"
    assert str(experiment_gid_0) == experiment_gids[1], "experiments are listed newest first"


async def test_deleting_dataset_also_deletes_experiments(
    httpx_client: httpx.AsyncClient,
    dataset_with_experiments_runs_and_evals: Any,
) -> None:
    ds_url = f"v1/datasets/{GlobalID('Dataset', str(1))}"
    exp_url = f"v1/experiments/{GlobalID('Experiment', str(1))}"
    runs_url = f"{exp_url}/runs"
    (await httpx_client.get(exp_url)).raise_for_status()
    assert len((await httpx_client.get(runs_url)).json()["data"]) > 0
    (await httpx_client.delete(ds_url)).raise_for_status()
    assert len((await httpx_client.get(runs_url)).json()["data"]) == 0
    with pytest.raises(HTTPStatusError):
        (await httpx_client.get(exp_url)).raise_for_status()
