import datetime

from strawberry.relay import GlobalID


async def test_experiments_api(test_client, simple_dataset):
    """
    A simple test of the expected flow for the experiments API
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
