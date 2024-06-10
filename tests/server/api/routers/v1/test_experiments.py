import datetime

from strawberry.relay import GlobalID


async def test_experiments_api(test_client, simple_dataset):
    """
    A simple test of the expected flow for the experiments API flow
    """

    dataset_globalid = GlobalID("Dataset", "0")

    # first, create an experiment associated with a dataset
    experiment = (
        await test_client.post(
            f"/v1/datasets/{dataset_globalid}/experiments", json={"version-id": None}
        )
    ).json()

    experiment_globalid = experiment["id"]
    version_globalid = experiment["dataset_version_id"]

    dataset_examples = (
        await test_client.get(
            f"/v1/datasets/{dataset_globalid}/examples",
            params={"version-id": str(version_globalid)},
        )
    ).json()

    # experiments can be read using the GET /experiments route
    experiment = (await test_client.get(f"/v1/experiments/{experiment_globalid}")).json()
    assert experiment

    # create experiment runs for each dataset example
    run_payload = {
        "dataset_example_id": str(dataset_examples[0]["id"]),
        "trace_id": "placeholder-id",  # not yet implemented
        "output": "some LLM application output",
        "start_time": datetime.datetime.now().isoformat(),
        "end_time": datetime.datetime.now().isoformat(),
        "error": "an error message, if applicable",
    }
    experiment_run = (
        await test_client.post(
            f"/v1/experiments/{experiment_globalid}/runs",
            json=run_payload,
        )
    ).json()

    # experiment runs can be listed for evaluations
    experiment_runs = (await test_client.get(f"/v1/experiments/{experiment_globalid}/runs")).json()
    assert experiment_runs
    assert len(experiment_runs) == 1

    # each experiment run can be evaluated
    evaluation_payload = {
        "name": "some evaluation name",
        "label": "some label",
        "score": 0.5,
        "explanation": "some explanation",
        "error": "an error message, if applicable",
        "metadata": {"some": "metadata"},
        "start_time": datetime.datetime.now().isoformat(),
        "end_time": datetime.datetime.now().isoformat(),
    }
    experiment_evaluation = (
        await test_client.post(
            f"/v1/experiments/{experiment_globalid}/runs/{experiment_run['id']}/evaluations",
            json=evaluation_payload,
        )
    ).json()
    assert experiment_evaluation


async def test_experiment_404s_with_missing_dataset(test_client, simple_dataset):
    incorrect_dataset_globalid = GlobalID("Dataset", "1")
    response = await test_client.post(
        f"/v1/datasets/{incorrect_dataset_globalid}/experiments", json={"version-id": None}
    )
    assert response.status_code == 404


async def test_experiment_404s_with_missing_version(test_client, simple_dataset):
    correct_dataset_globalid = GlobalID("Dataset", "0")
    incorrect_version_globalid = GlobalID("DatasetVersion", "9000")
    response = await test_client.post(
        f"/v1/datasets/{correct_dataset_globalid}/experiments",
        json={"version-id": str(incorrect_version_globalid)},
    )
    assert response.status_code == 404


async def test_reading_experiments(test_client, dataset_with_experiments):
    experiment_globalid = GlobalID("Experiment", "0")
    dataset_globalid = GlobalID("Dataset", "1")
    dataset_version_globalid = GlobalID("DatasetVersion", "1")
    response = await test_client.get(f"/v1/experiments/{experiment_globalid}")
    assert response.status_code == 200
    experiment = response.json()
    assert "created_at" in experiment
    assert "updated_at" in experiment
    expected = {
        "id": str(experiment_globalid),
        "dataset_id": str(dataset_globalid),
        "dataset_version_id": str(dataset_version_globalid),
        "metadata": {"info": "a test experiment"},
    }
    assert all(experiment[key] == value for key, value in expected.items())


async def test_reading_experiment_404s_with_missing_experiment(test_client):
    incorrect_experiment_globalid = GlobalID("Experiment", "9000")
    response = await test_client.get(f"/v1/experiments/{incorrect_experiment_globalid}")
    assert response.status_code == 404
