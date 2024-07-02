import datetime

from strawberry.relay import GlobalID


async def test_experiments_api(test_client, simple_dataset):
    """
    A simple test of the expected flow for the experiments API flow
    """

    dataset_gid = GlobalID("Dataset", "0")

    # first, create an experiment associated with a dataset
    created_experiment = (
        await test_client.post(
            f"/v1/datasets/{dataset_gid}/experiments",
            json={"version_id": None, "repetitions": 1},
        )
    ).json()["data"]

    experiment_gid = created_experiment["id"]
    version_gid = created_experiment["dataset_version_id"]
    assert created_experiment["repetitions"] == 1

    dataset_examples = (
        await test_client.get(
            f"/v1/datasets/{dataset_gid}/examples",
            params={"version_id": str(version_gid)},
        )
    ).json()["data"]["examples"]

    # experiments can be read using the GET /experiments route
    experiment = (await test_client.get(f"/v1/experiments/{experiment_gid}")).json()["data"]
    assert experiment
    assert created_experiment["repetitions"] == 1

    # create experiment runs for each dataset example
    run_payload = {
        "dataset_example_id": str(dataset_examples[0]["id"]),
        "trace_id": "placeholder-id",
        "experiment_run_output": {"task_output": "some LLM application output"},
        "repetition_number": 1,
        "start_time": datetime.datetime.now().isoformat(),
        "end_time": datetime.datetime.now().isoformat(),
        "error": "an error message, if applicable",
    }
    run_payload["id"] = (
        await test_client.post(
            f"/v1/experiments/{experiment_gid}/runs",
            json=run_payload,
        )
    ).json()["data"]["id"]

    # experiment runs can be listed for evaluations
    experiment_runs = (await test_client.get(f"/v1/experiments/{experiment_gid}/runs")).json()[
        "data"
    ]
    assert experiment_runs
    assert len(experiment_runs) == 1

    # each experiment run can be evaluated
    evaluation_payload = {
        "experiment_run_id": run_payload["id"],
        "trace_id": "placeholder-id",
        "name": "some evaluation name",
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
        await test_client.post("/v1/experiment_evaluations", json=evaluation_payload)
    ).json()
    assert experiment_evaluation


async def test_experiment_404s_with_missing_dataset(test_client, simple_dataset):
    incorrect_dataset_gid = GlobalID("Dataset", "1")
    response = await test_client.post(
        f"/v1/datasets/{incorrect_dataset_gid}/experiments", json={"version_id": None}
    )
    assert response.status_code == 404


async def test_experiment_404s_with_missing_version(test_client, simple_dataset):
    correct_dataset_gid = GlobalID("Dataset", "0")
    incorrect_version_gid = GlobalID("DatasetVersion", "9000")
    response = await test_client.post(
        f"/v1/datasets/{correct_dataset_gid}/experiments",
        json={"version_id": str(incorrect_version_gid)},
    )
    assert response.status_code == 404


async def test_reading_experiments(test_client, dataset_with_experiments_without_runs):
    experiment_gid = GlobalID("Experiment", "0")
    dataset_gid = GlobalID("Dataset", "1")
    dataset_version_gid = GlobalID("DatasetVersion", "1")
    response = await test_client.get(f"/v1/experiments/{experiment_gid}")
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


async def test_reading_experiment_404s_with_missing_experiment(test_client):
    incorrect_experiment_gid = GlobalID("Experiment", "9000")
    response = await test_client.get(f"/v1/experiments/{incorrect_experiment_gid}")
    assert response.status_code == 404
