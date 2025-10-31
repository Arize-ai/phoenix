import datetime
import json
from io import StringIO
from typing import Any, Optional

import httpx
import pandas as pd
import pytest
from httpx import HTTPStatusError
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.server.types import DbSessionFactory
from tests.unit._helpers import verify_experiment_examples_junction_table
from tests.unit.server.api.conftest import ExperimentsWithIncompleteRuns


async def test_experiments_api(
    httpx_client: httpx.AsyncClient,
    simple_dataset: Any,
    db: DbSessionFactory,
) -> None:
    """
    A simple test of the expected flow for the experiments API flow
    """

    dataset_gid = GlobalID("Dataset", "0")

    # first, create an experiment associated with a dataset
    created_experiment = (
        await httpx_client.post(
            f"v1/datasets/{dataset_gid}/experiments",
            json={"version_id": None, "repetitions": 1},
        )
    ).json()["data"]

    experiment_gid = created_experiment["id"]
    version_gid = created_experiment["dataset_version_id"]
    assert created_experiment["repetitions"] == 1

    dataset_examples = (
        await httpx_client.get(
            f"v1/datasets/{dataset_gid}/examples",
            params={"version_id": str(version_gid)},
        )
    ).json()["data"]["examples"]

    # Verify that the experiment examples snapshot was created in the junction table
    async with db() as session:
        await verify_experiment_examples_junction_table(session, experiment_gid)

    # experiments can be read using the GET /experiments route
    experiment = (await httpx_client.get(f"v1/experiments/{experiment_gid}")).json()["data"]
    assert experiment
    assert created_experiment["repetitions"] == 1

    # get experiment JSON before any runs - should return 404
    response = await httpx_client.get(f"v1/experiments/{experiment_gid}/json")
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
            f"v1/experiments/{experiment_gid}/runs",
            json=run_payload,
        )
    ).json()["data"]["id"]

    # get experiment JSON after runs but before evaluations
    response = await httpx_client.get(f"v1/experiments/{experiment_gid}/json")
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
    response = await httpx_client.get(f"v1/experiments/{experiment_gid}/csv")
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
    experiment_runs = (await httpx_client.get(f"v1/experiments/{experiment_gid}/runs")).json()[
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
        await httpx_client.post("v1/experiment_evaluations", json=evaluation_payload)
    ).json()
    assert experiment_evaluation

    # get experiment JSON after adding evaluations
    response = await httpx_client.get(f"v1/experiments/{experiment_gid}/json")
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
    response = await httpx_client.get(f"v1/experiments/{experiment_gid}/csv")
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
        f"v1/datasets/{incorrect_dataset_gid}/experiments", json={"version_id": None}
    )
    assert response.status_code == 404


async def test_experiment_404s_with_missing_version(
    httpx_client: httpx.AsyncClient,
    simple_dataset: Any,
) -> None:
    correct_dataset_gid = GlobalID("Dataset", "0")
    incorrect_version_gid = GlobalID("DatasetVersion", "9000")
    response = await httpx_client.post(
        f"v1/datasets/{correct_dataset_gid}/experiments",
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
    response = await httpx_client.get(f"v1/experiments/{experiment_gid}")
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

    response = await httpx_client.get(f"v1/datasets/{dataset_gid}/experiments")
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

    response = await httpx_client.get(f"v1/datasets/{dataset_gid}/experiments")
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


async def test_experiment_runs_pagination(
    httpx_client: httpx.AsyncClient,
    simple_dataset: Any,
) -> None:
    """Test pagination functionality for experiment runs endpoint."""
    dataset_gid = GlobalID("Dataset", "0")

    # Create experiment and runs
    experiment = (
        await httpx_client.post(
            f"v1/datasets/{dataset_gid}/experiments",
            json={"version_id": None, "repetitions": 1},
        )
    ).json()["data"]

    dataset_examples = (
        await httpx_client.get(
            f"v1/datasets/{dataset_gid}/examples",
            params={"version_id": str(experiment["dataset_version_id"])},
        )
    ).json()["data"]["examples"]

    # Create 5 runs for pagination testing
    created_runs = []
    for i in range(5):
        run = (
            await httpx_client.post(
                f"v1/experiments/{experiment['id']}/runs",
                json={
                    "dataset_example_id": str(dataset_examples[0]["id"]),
                    "trace_id": f"trace-{i}",
                    "output": f"output-{i}",
                    "repetition_number": i + 1,
                    "start_time": datetime.datetime.now().isoformat(),
                    "end_time": datetime.datetime.now().isoformat(),
                },
            )
        ).json()["data"]
        created_runs.append(run["id"])

    def get_numeric_ids(run_ids: list[str]) -> list[int]:
        """Helper to extract numeric IDs for comparison."""
        return [int(GlobalID.from_id(run_id).node_id) for run_id in run_ids]

    # Expected order: descending by numeric ID
    expected_ids = sorted(get_numeric_ids(created_runs), reverse=True)  # [5, 4, 3, 2, 1]

    async def get_runs(limit: Optional[int] = None, cursor: Optional[str] = None) -> dict[str, Any]:
        """Helper to fetch runs with optional pagination."""
        params: dict[str, Any] = {}
        if limit is not None:
            params["limit"] = limit
        if cursor is not None:
            params["cursor"] = cursor
        response = await httpx_client.get(f"v1/experiments/{experiment['id']}/runs", params=params)
        assert response.status_code == 200
        return response.json()  # type: ignore[no-any-return]

    # Test: No pagination (backward compatibility)
    all_runs = await get_runs()
    assert len(all_runs["data"]) == 5
    assert all_runs["next_cursor"] is None
    all_runs_ids = [run["id"] for run in all_runs["data"]]
    assert get_numeric_ids(all_runs_ids) == expected_ids

    # Test: Page-by-page pagination with exact content validation
    page1 = await get_runs(limit=2)
    assert len(page1["data"]) == 2
    assert page1["next_cursor"] is not None
    page1_ids = get_numeric_ids([run["id"] for run in page1["data"]])
    assert page1_ids == expected_ids[:2]  # [5, 4]
    assert GlobalID.from_id(page1["next_cursor"]).node_id == str(expected_ids[2])  # "3"

    page2 = await get_runs(limit=2, cursor=page1["next_cursor"])
    assert len(page2["data"]) == 2
    assert page2["next_cursor"] is not None
    page2_ids = get_numeric_ids([run["id"] for run in page2["data"]])
    assert page2_ids == expected_ids[2:4]  # [3, 2]
    assert GlobalID.from_id(page2["next_cursor"]).node_id == str(expected_ids[4])  # "1"

    page3 = await get_runs(limit=2, cursor=page2["next_cursor"])
    assert len(page3["data"]) == 1
    assert page3["next_cursor"] is None
    page3_ids = get_numeric_ids([run["id"] for run in page3["data"]])
    assert page3_ids == expected_ids[4:5]  # [1]

    # Test: Aggregated pagination equals non-paginated
    paginated_ids = page1_ids + page2_ids + page3_ids
    assert paginated_ids == expected_ids
    paginated_run_ids = [run["id"] for run in page1["data"] + page2["data"] + page3["data"]]
    assert paginated_run_ids == all_runs_ids

    # Test: Large limit (no pagination)
    large_limit = await get_runs(limit=100)
    assert len(large_limit["data"]) == 5
    assert large_limit["next_cursor"] is None
    assert get_numeric_ids([run["id"] for run in large_limit["data"]]) == expected_ids

    # Test: Invalid cursor
    response = await httpx_client.get(
        f"v1/experiments/{experiment['id']}/runs", params={"limit": 2, "cursor": "invalid-cursor"}
    )
    assert response.status_code == 422


class TestExperimentCounts:
    """
    Test suite for experiment count fields (example_count, successful_run_count, failed_run_count, and missing_run_count).
    Validates that counts are accurate across all experiment endpoints (create, get, list).
    """

    @staticmethod
    async def _get_experiment(
        httpx_client: httpx.AsyncClient, experiment_gid: GlobalID
    ) -> dict[str, Any]:
        """Helper to fetch experiment data."""
        response = await httpx_client.get(f"v1/experiments/{experiment_gid}")
        assert response.status_code == 200
        return response.json()["data"]  # type: ignore[no-any-return]

    @staticmethod
    async def _create_run(
        httpx_client: httpx.AsyncClient,
        experiment_gid: GlobalID,
        example_gid: GlobalID,
        repetition_number: int,
        trace_id: str,
        output: str,
        error: Optional[str] = None,
    ) -> None:
        """Helper to create an experiment run."""
        await httpx_client.post(
            f"v1/experiments/{experiment_gid}/runs",
            json={
                "dataset_example_id": str(example_gid),
                "trace_id": trace_id,
                "output": output,
                "repetition_number": repetition_number,
                "start_time": datetime.datetime.now().isoformat(),
                "end_time": datetime.datetime.now().isoformat(),
                **({"error": error} if error else {}),
            },
        )

    async def test_comprehensive_count_scenarios(
        self,
        httpx_client: httpx.AsyncClient,
        experiments_with_incomplete_runs: ExperimentsWithIncompleteRuns,
    ) -> None:
        """
        Comprehensive test for example_count, successful_run_count, failed_run_count, and missing_run_count fields.

        Scenarios tested:
        1. Mixed runs (v1) - some successful, some failed, some missing
        2. No runs at all (v1) - zero successful and failed runs, all missing
        3. Deleted examples (v2) - handles dataset versioning with deletions
        4. Incremental additions (v2) - successful -> failed -> successful progression
        5. List endpoint - multiple experiments with correct counts
        6. Create endpoint - returns correct initial counts
        7. All runs failed - edge case where runs exist but successful_run_count = 0
        8. Simple boundary - minimal viable case (1 repetition, 1 successful run)

        missing_run_count is calculated as: (example_count × repetitions) - successful_run_count - failed_run_count
        """
        dataset = experiments_with_incomplete_runs.dataset
        exp_v1_mixed = experiments_with_incomplete_runs.experiment_v1_mixed
        exp_v1_empty = experiments_with_incomplete_runs.experiment_v1_empty
        exp_v2_deletion = experiments_with_incomplete_runs.experiment_v2_with_deletion
        exp_v2_incremental = experiments_with_incomplete_runs.experiment_v2_incremental
        examples = experiments_with_incomplete_runs.examples_in_v1

        # Convert to GlobalIDs
        dataset_gid = GlobalID("Dataset", str(dataset.id))
        exp_v1_mixed_gid = GlobalID("Experiment", str(exp_v1_mixed.id))
        exp_v1_empty_gid = GlobalID("Experiment", str(exp_v1_empty.id))
        exp_v2_deletion_gid = GlobalID("Experiment", str(exp_v2_deletion.id))
        exp_v2_incremental_gid = GlobalID("Experiment", str(exp_v2_incremental.id))

        # ===== Test 1: Experiment with mixed successful and failed runs (v1) =====
        # exp_v1_mixed: has 5 examples, 7 successful runs, 3 failed runs, 3 repetitions
        # Total expected: 5 × 3 = 15 runs
        # (ex0: 3 successful, ex1: 1 successful + 1 failed,
        #  ex2: 0 runs, ex3: 2 successful + 1 failed, ex4: 1 successful + 1 failed)
        exp1_data = await self._get_experiment(httpx_client, exp_v1_mixed_gid)
        assert exp1_data["example_count"] == 5, "exp_v1_mixed should have 5 examples"
        assert exp1_data["successful_run_count"] == 7, (
            "exp_v1_mixed should have 7 successful runs (3+1+0+2+1)"
        )
        assert exp1_data["failed_run_count"] == 3, (
            "exp_v1_mixed should have 3 failed runs (0+1+0+1+1)"
        )
        assert exp1_data["missing_run_count"] == 5, (
            "exp_v1_mixed should have 5 missing runs (15 total - 7 successful - 3 failed)"
        )

        # ===== Test 2: Experiment with no runs at all (v1) =====
        # exp_v1_empty: 5 examples, 2 repetitions = 10 total expected runs
        exp2_data = await self._get_experiment(httpx_client, exp_v1_empty_gid)
        assert exp2_data["example_count"] == 5, "exp_v1_empty should have 5 examples"
        assert exp2_data["successful_run_count"] == 0, "exp_v1_empty should have 0 successful runs"
        assert exp2_data["failed_run_count"] == 0, "exp_v1_empty should have 0 failed runs"
        assert exp2_data["missing_run_count"] == 10, (
            "exp_v1_empty should have 10 missing runs (5 examples × 2 repetitions)"
        )

        # ===== Test 3: Experiment with deleted example in v2 =====
        # exp_v2_deletion: has 4 examples (ex2 deleted from v2), 4 successful runs, 1 failed, 2 repetitions
        # Total expected: 4 × 2 = 8 runs
        exp3_data = await self._get_experiment(httpx_client, exp_v2_deletion_gid)
        assert exp3_data["example_count"] == 4, (
            "exp_v2_deletion should have 4 examples (ex2 deleted)"
        )
        assert exp3_data["successful_run_count"] == 4, (
            "exp_v2_deletion should have 4 successful runs (2+1+0+1)"
        )
        assert exp3_data["failed_run_count"] == 1, (
            "exp_v2_deletion should have 1 failed run (0+1+0+0)"
        )
        assert exp3_data["missing_run_count"] == 3, (
            "exp_v2_deletion should have 3 missing runs (8 total - 4 successful - 1 failed)"
        )

        # ===== Test 4: Fresh experiment (v2), then incrementally add runs =====
        # exp_v2_incremental: has 2 examples, 3 repetitions = 6 total expected runs
        exp4_data = await self._get_experiment(httpx_client, exp_v2_incremental_gid)
        assert exp4_data["example_count"] == 2, "exp_v2_incremental should have 2 examples"
        assert exp4_data["successful_run_count"] == 0, (
            "exp_v2_incremental should start with 0 successful runs"
        )
        assert exp4_data["failed_run_count"] == 0, (
            "exp_v2_incremental should start with 0 failed runs"
        )
        assert exp4_data["missing_run_count"] == 6, (
            "exp_v2_incremental should start with 6 missing runs (2 × 3)"
        )

        # Add a successful run for the first example
        example_gid_0 = GlobalID("DatasetExample", str(examples[0].id))
        await self._create_run(
            httpx_client, exp_v2_incremental_gid, example_gid_0, 1, "test-trace-1", "success output"
        )

        # Verify count increased after successful run
        exp4_data = await self._get_experiment(httpx_client, exp_v2_incremental_gid)
        assert exp4_data["example_count"] == 2
        assert exp4_data["successful_run_count"] == 1, (
            "Should have 1 successful run after adding one"
        )
        assert exp4_data["failed_run_count"] == 0, "Should still have 0 failed runs"
        assert exp4_data["missing_run_count"] == 5, "Should have 5 missing runs (6 - 1)"

        # Add a failed run for the first example (different repetition)
        await self._create_run(
            httpx_client,
            exp_v2_incremental_gid,
            example_gid_0,
            2,
            "test-trace-2",
            "error output",
            error="Test error occurred",
        )

        # Verify failed run doesn't increment successful_run_count but decrements missing_run_count
        exp4_data = await self._get_experiment(httpx_client, exp_v2_incremental_gid)
        assert exp4_data["example_count"] == 2
        assert exp4_data["successful_run_count"] == 1, (
            "Failed run should not increment successful count"
        )
        assert exp4_data["failed_run_count"] == 1, "Should have 1 failed run after adding one"
        assert exp4_data["missing_run_count"] == 4, "Should have 4 missing runs (6 - 1 - 1)"

        # Add another successful run
        await self._create_run(
            httpx_client, exp_v2_incremental_gid, example_gid_0, 3, "test-trace-3", "success output"
        )

        # Verify count increased again
        exp4_data = await self._get_experiment(httpx_client, exp_v2_incremental_gid)
        assert exp4_data["example_count"] == 2
        assert exp4_data["successful_run_count"] == 2, "Should have 2 successful runs now"
        assert exp4_data["failed_run_count"] == 1, "Should still have 1 failed run"
        assert exp4_data["missing_run_count"] == 3, "Should have 3 missing runs (6 - 2 - 1)"

        # ===== Test 5: List experiments endpoint returns all with correct counts =====
        list_response = await httpx_client.get(f"v1/datasets/{dataset_gid}/experiments")
        assert list_response.status_code == 200
        experiments_list = list_response.json()["data"]

        assert len(experiments_list) == 4, "Should have 4 experiments"

        # Find the experiments in the list (order might vary)
        exp1_in_list = next(e for e in experiments_list if e["id"] == str(exp_v1_mixed_gid))
        exp2_in_list = next(e for e in experiments_list if e["id"] == str(exp_v1_empty_gid))
        exp3_in_list = next(e for e in experiments_list if e["id"] == str(exp_v2_deletion_gid))
        exp4_in_list = next(e for e in experiments_list if e["id"] == str(exp_v2_incremental_gid))

        # Verify counts in list endpoint match individual GET requests
        assert exp1_in_list["example_count"] == 5
        assert exp1_in_list["successful_run_count"] == 7
        assert exp1_in_list["failed_run_count"] == 3
        assert exp1_in_list["missing_run_count"] == 5
        assert exp2_in_list["example_count"] == 5
        assert exp2_in_list["successful_run_count"] == 0
        assert exp2_in_list["failed_run_count"] == 0
        assert exp2_in_list["missing_run_count"] == 10
        assert exp3_in_list["example_count"] == 4  # ex2 deleted in v2
        assert exp3_in_list["successful_run_count"] == 4
        assert exp3_in_list["failed_run_count"] == 1
        assert exp3_in_list["missing_run_count"] == 3
        assert exp4_in_list["example_count"] == 2
        assert exp4_in_list["successful_run_count"] == 2
        assert exp4_in_list["failed_run_count"] == 1
        assert exp4_in_list["missing_run_count"] == 3

        # ===== Test 6: Create endpoint returns correct initial counts =====
        # Create a fresh experiment and verify the create response has correct counts
        new_exp_response = await httpx_client.post(
            f"v1/datasets/{dataset_gid}/experiments",
            json={"version_id": None, "repetitions": 1},
        )
        assert new_exp_response.status_code == 200
        new_exp_data = new_exp_response.json()["data"]

        # Verify counts in create response (not just GET)
        assert new_exp_data["example_count"] == 5, "Create response should have example_count"
        assert new_exp_data["successful_run_count"] == 0, (
            "Create response should start with 0 successful runs"
        )
        assert new_exp_data["failed_run_count"] == 0, (
            "Create response should start with 0 failed runs"
        )
        assert new_exp_data["missing_run_count"] == 5, (
            "Create response should start with 5 missing runs (5 examples × 1 repetition)"
        )

        # ===== Test 7: Edge case - All runs failed =====
        new_exp_gid = new_exp_data["id"]

        # Add only failed runs for all examples
        for i, example in enumerate(examples):
            example_gid = GlobalID("DatasetExample", str(example.id))
            await self._create_run(
                httpx_client,
                new_exp_gid,
                example_gid,
                1,
                f"all-failed-trace-{i}",
                "failed output",
                error=f"All runs failed - example {i}",
            )

        # Verify that with all runs failed, successful_run_count is still 0 but failed_run_count is 5
        all_failed_data = await self._get_experiment(httpx_client, new_exp_gid)
        assert all_failed_data["example_count"] == 5
        assert all_failed_data["successful_run_count"] == 0, (
            "All failed runs should result in 0 successful count"
        )
        assert all_failed_data["failed_run_count"] == 5, (
            "All failed runs should result in 5 failed count"
        )
        assert all_failed_data["missing_run_count"] == 0, (
            "All failed runs should result in 0 missing count"
        )

        # ===== Test 8: Simple boundary case - 1 example, 1 repetition =====
        # This is the simplest possible experiment
        simple_exp_response = await httpx_client.post(
            f"v1/datasets/{dataset_gid}/experiments",
            json={"version_id": None, "repetitions": 1},
        )
        simple_exp_data = simple_exp_response.json()["data"]
        simple_exp_gid = simple_exp_data["id"]

        # Verify simple case starts correctly
        assert simple_exp_data["example_count"] == 5
        assert simple_exp_data["successful_run_count"] == 0
        assert simple_exp_data["failed_run_count"] == 0
        assert simple_exp_data["missing_run_count"] == 5

        # Add exactly 1 successful run
        await self._create_run(
            httpx_client,
            simple_exp_gid,
            GlobalID("DatasetExample", str(examples[0].id)),
            1,
            "simple-success",
            "simple output",
        )

        # Verify count is exactly 1
        simple_data = await self._get_experiment(httpx_client, simple_exp_gid)
        assert simple_data["example_count"] == 5
        assert simple_data["successful_run_count"] == 1, (
            "Simple 1-run case should have exactly 1 successful"
        )
        assert simple_data["failed_run_count"] == 0, "Simple 1-run case should have 0 failed runs"
        assert simple_data["missing_run_count"] == 4, (
            "Simple 1-run case should have 4 missing runs (5 - 1)"
        )


class TestIncompleteRuns:
    """
    Test suite for the incomplete runs endpoint.
    Validates detection of missing and failed experiment runs with proper pagination and error handling.
    """

    @staticmethod
    async def _get_incomplete_runs(
        httpx_client: httpx.AsyncClient,
        experiment_gid: GlobalID,
        limit: Optional[int] = None,
        cursor: Optional[str] = None,
    ) -> dict[str, Any]:
        """Helper to fetch incomplete runs."""
        params: dict[str, Any] = {}
        if limit is not None:
            params["limit"] = limit
        if cursor is not None:
            params["cursor"] = cursor
        response = await httpx_client.get(
            f"v1/experiments/{experiment_gid}/incomplete-runs", params=params
        )
        result: dict[str, Any] = {"status_code": response.status_code}
        if response.status_code == 200:
            result.update(response.json())
        else:
            result["text"] = response.text
            if response.headers.get("content-type", "").startswith("application/json"):
                result["json"] = response.json()
        return result

    @staticmethod
    async def _create_run(
        httpx_client: httpx.AsyncClient,
        experiment_gid: GlobalID,
        example_gid: GlobalID,
        repetition_number: int,
        trace_id: str,
        output: str,
        error: Optional[str] = None,
    ) -> None:
        """Helper to create an experiment run."""
        await httpx_client.post(
            f"v1/experiments/{experiment_gid}/runs",
            json={
                "dataset_example_id": str(example_gid),
                "trace_id": trace_id,
                "output": output,
                "repetition_number": repetition_number,
                "start_time": datetime.datetime.now().isoformat(),
                "end_time": datetime.datetime.now().isoformat(),
                **({"error": error} if error else {}),
            },
        )

    async def test_incomplete_runs(
        self,
        httpx_client: httpx.AsyncClient,
        experiments_with_incomplete_runs: ExperimentsWithIncompleteRuns,
    ) -> None:
        """
        Comprehensive test for the /incomplete-runs endpoint.

        Scenarios tested:
        1. Basic functionality - missing and failed runs detection
        2. Dataset example data - verify all required fields are included
        3. Complete examples exclusion - examples with all runs complete are excluded
        4. Pagination - multiple pages with limit=2
        5. No duplicates - verify pagination doesn't return duplicate examples
        6. Invalid experiment ID - returns 404 error
        7. Invalid cursor - returns 422 error
        8. Repetitions=1 optimization - test incomplete runs with repetitions=1
        9. All runs complete - edge case where no incomplete runs exist (empty result)
        """
        experiment_gid = GlobalID(
            "Experiment", str(experiments_with_incomplete_runs.experiment_v1_mixed.id)
        )
        dataset_id = experiments_with_incomplete_runs.dataset.id
        example_id_map = experiments_with_incomplete_runs.example_id_map

        # ===== Test 1: Basic functionality - includes missing and failed runs =====
        result = await self._get_incomplete_runs(httpx_client, experiment_gid)
        assert result["status_code"] == 200

        # Expected:
        # example 1: [2, 3] (failed, missing)
        # example 2: [1, 2, 3] (all missing)
        # example 3: [3] (failed)
        # example 4: [1, 2] (failed, missing)
        # Total: 4 examples with incomplete runs
        assert len(result["data"]) == 4, "Should have 4 incomplete examples"

        # Build a mapping of example_id to repetition_numbers
        incomplete_by_example = {
            int(GlobalID.from_id(run["dataset_example"]["id"]).node_id): run["repetition_numbers"]
            for run in result["data"]
        }

        assert incomplete_by_example[example_id_map[1]] == [2, 3]
        assert incomplete_by_example[example_id_map[2]] == [1, 2, 3]
        assert incomplete_by_example[example_id_map[3]] == [3]
        assert incomplete_by_example[example_id_map[4]] == [1, 2]

        # ===== Test 2: Verify dataset example data is included =====
        for incomplete_run in result["data"]:
            assert "dataset_example" in incomplete_run
            assert "id" in incomplete_run["dataset_example"]
            assert "input" in incomplete_run["dataset_example"]
            assert "output" in incomplete_run["dataset_example"]

        # ===== Test 3: Complete examples are excluded =====
        example_ids = [
            int(GlobalID.from_id(run["dataset_example"]["id"]).node_id) for run in result["data"]
        ]
        assert example_id_map[0] not in example_ids, "Complete examples should be excluded"

        # ===== Test 4: Pagination with limit=2 =====
        page1_data = await self._get_incomplete_runs(httpx_client, experiment_gid, limit=2)
        assert page1_data["status_code"] == 200
        assert len(page1_data["data"]) == 2, "Page 1 should have 2 examples"
        assert page1_data["next_cursor"] is not None, "Should have next page"

        # Get page 2
        page2_data = await self._get_incomplete_runs(
            httpx_client, experiment_gid, limit=2, cursor=page1_data["next_cursor"]
        )
        assert page2_data["status_code"] == 200
        assert len(page2_data["data"]) == 2, "Page 2 should have 2 examples"
        assert page2_data["next_cursor"] is None, "Should be last page"

        # ===== Test 5: Verify no duplicates across pages =====
        page1_ids = [run["dataset_example"]["id"] for run in page1_data["data"]]
        page2_ids = [run["dataset_example"]["id"] for run in page2_data["data"]]
        all_example_ids = page1_ids + page2_ids
        assert len(set(all_example_ids)) == 4, "Should have 4 unique examples"
        assert len(all_example_ids) == len(set(all_example_ids)), "Should have no duplicates"

        # ===== Test 6: Invalid experiment ID returns 404 =====
        invalid_experiment_gid = GlobalID("Experiment", "99999")
        invalid_result = await self._get_incomplete_runs(httpx_client, invalid_experiment_gid)
        assert invalid_result["status_code"] == 404, "Invalid experiment should return 404"

        # ===== Test 7: Invalid cursor returns 422 =====
        # Reuse the existing dataset to create a new experiment for cursor validation
        dataset_gid = GlobalID("Dataset", str(dataset_id))
        new_experiment = (
            await httpx_client.post(
                f"v1/datasets/{dataset_gid}/experiments",
                json={"version_id": None, "repetitions": 1},
            )
        ).json()["data"]

        invalid_cursor_result = await self._get_incomplete_runs(
            httpx_client, new_experiment["id"], cursor="invalid-cursor"
        )
        assert invalid_cursor_result["status_code"] == 422, "Invalid cursor should return 422"

        # ===== Test 8: Experiment with repetitions=1 (optimization path) =====
        # Create experiment with repetitions=1 to test the optimization case where
        # there can be no "partially complete" examples
        rep1_experiment = (
            await httpx_client.post(
                f"v1/datasets/{dataset_gid}/experiments",
                json={"version_id": None, "repetitions": 1},
            )
        ).json()["data"]

        # Get the examples for this experiment to understand what we're working with
        examples_response = await httpx_client.get(
            f"v1/datasets/{dataset_gid}/examples",
            params={"version_id": str(rep1_experiment["dataset_version_id"])},
        )
        examples = examples_response.json()["data"]["examples"]

        # Pick 3 examples to test with
        assert len(examples) >= 3, f"Need at least 3 examples, got {len(examples)}"

        # Pick the first 3 examples we can find
        test_examples = examples[:3]
        complete_example_id = test_examples[0]["id"]
        missing_example_id = test_examples[1]["id"]
        failed_example_id = test_examples[2]["id"]

        # Setup: example[0]=complete, example[1]=missing (no run), example[2]=failed
        await self._create_run(
            httpx_client,
            rep1_experiment["id"],
            complete_example_id,
            1,
            f"trace-complete-{complete_example_id}",
            "success",
            error=None,
        )
        # example[1] has no runs (missing) - don't create any run
        await self._create_run(
            httpx_client,
            rep1_experiment["id"],
            failed_example_id,
            1,
            f"trace-failed-{failed_example_id}",
            "",
            error="Task failed",
        )

        # Fetch incomplete runs to verify repetitions=1 optimization
        result = await self._get_incomplete_runs(httpx_client, rep1_experiment["id"])
        assert result["status_code"] == 200

        incomplete = {
            run["dataset_example"]["id"]: run["repetition_numbers"] for run in result["data"]
        }

        # Assertions for repetitions=1 behavior:
        # 1. Complete example should NOT be in incomplete results
        assert complete_example_id not in incomplete, (
            "Complete example should not be in incomplete runs"
        )

        # 2. Failed example SHOULD be in incomplete results with [1]
        assert failed_example_id in incomplete, "Failed example should be in incomplete runs"
        assert incomplete[failed_example_id] == [1], "Failed example should need repetition [1]"

        # 3. Missing example SHOULD be in incomplete results with [1]
        assert missing_example_id in incomplete, "Missing example should be in incomplete runs"
        assert incomplete[missing_example_id] == [1], "Missing example should need repetition [1]"

        # ===== Test 9: All runs complete - edge case (empty result) =====
        # Now complete ALL runs in the repetitions=1 experiment
        for example in examples:
            # Create or update to successful
            if example["id"] != complete_example_id:  # Skip already complete example
                await self._create_run(
                    httpx_client,
                    rep1_experiment["id"],
                    example["id"],
                    1,
                    f"complete-trace-{example['id']}",
                    "success",
                )

        # Verify that no incomplete runs are returned after all are complete
        complete_data = await self._get_incomplete_runs(httpx_client, rep1_experiment["id"])
        assert complete_data["status_code"] == 200
        assert len(complete_data["data"]) == 0, (
            "Experiment with all runs complete should have no incomplete runs"
        )
        assert complete_data["next_cursor"] is None, "Should have no next cursor"


class TestIncompleteEvaluations:
    """
    Test suite for the incomplete evaluations endpoint.
    Validates detection of missing and failed evaluations with proper pagination and error handling.
    """

    @staticmethod
    async def _get_incomplete_evaluations(
        httpx_client: httpx.AsyncClient,
        experiment_gid: GlobalID,
        evaluator_names: Optional[list[str]] = None,
        limit: Optional[int] = None,
        cursor: Optional[str] = None,
    ) -> dict[str, Any]:
        """Helper to fetch incomplete evaluations."""
        params: dict[str, Any] = {}
        if evaluator_names is not None:
            params["evaluation_name"] = evaluator_names
        if limit is not None:
            params["limit"] = limit
        if cursor is not None:
            params["cursor"] = cursor
        response = await httpx_client.get(
            f"v1/experiments/{experiment_gid}/incomplete-evaluations", params=params
        )
        result: dict[str, Any] = {"status_code": response.status_code}
        if response.status_code == 200:
            result.update(response.json())
        else:
            result["text"] = response.text
            if response.headers.get("content-type", "").startswith("application/json"):
                result["json"] = response.json()
        return result

    async def test_incomplete_evaluations_comprehensive(
        self,
        httpx_client: httpx.AsyncClient,
        experiments_with_incomplete_runs: ExperimentsWithIncompleteRuns,
        db: DbSessionFactory,
    ) -> None:
        """
        Comprehensive test for incomplete evaluations endpoint.

        Scenarios tested:
        1. Basic functionality - missing and failed evaluations
        2. Dataset example and run data included in response
        3. Correct evaluator categorization (missing vs failed)
        4. No evaluator names specified returns 400 error
        5. Invalid experiment ID returns 404 error
        6. Experiment with no runs returns empty result
        7. Pagination order - results ordered by run ID ascending
        8. Invalid cursor returns 422 error
        """
        from datetime import datetime, timezone

        from phoenix.db import models

        exp_v1_mixed = experiments_with_incomplete_runs.experiment_v1_mixed
        exp_v1_empty = experiments_with_incomplete_runs.experiment_v1_empty
        examples = experiments_with_incomplete_runs.examples_in_v1

        # Convert to GlobalIDs
        exp_gid = GlobalID("Experiment", str(exp_v1_mixed.id))

        # Add some evaluations to the runs
        # We'll add annotations for "accuracy" evaluator:
        # - ex0, rep1: successful
        # - ex0, rep2: failed
        # - ex0, rep3: missing
        # - ex1, rep1: missing (no annotation)

        now = datetime.now(timezone.utc)

        # Get the run IDs first (we need to query them from the database)
        async with db() as session:
            # Get runs for ex0
            runs_result = await session.execute(
                select(models.ExperimentRun)
                .where(models.ExperimentRun.experiment_id == exp_v1_mixed.id)
                .where(models.ExperimentRun.dataset_example_id == examples[0].id)
                .order_by(models.ExperimentRun.repetition_number)
            )
            ex0_runs = list(runs_result.scalars())

            # Add successful annotation for ex0, rep1
            if len(ex0_runs) >= 1:
                session.add(
                    models.ExperimentRunAnnotation(
                        experiment_run_id=ex0_runs[0].id,
                        name="accuracy",
                        annotator_kind="CODE",
                        label="correct",
                        score=1.0,
                        explanation=None,
                        trace_id=None,
                        error=None,
                        metadata_={},
                        start_time=now,
                        end_time=now,
                    )
                )

            # Add failed annotation for ex0, rep2
            if len(ex0_runs) >= 2:
                session.add(
                    models.ExperimentRunAnnotation(
                        experiment_run_id=ex0_runs[1].id,
                        name="accuracy",
                        annotator_kind="CODE",
                        label=None,
                        score=None,
                        explanation=None,
                        trace_id=None,
                        error="Evaluator failed",
                        metadata_={},
                        start_time=now,
                        end_time=now,
                    )
                )

        # ===== Test 1: Basic functionality - incomplete evaluations for "accuracy" =====
        result = await self._get_incomplete_evaluations(httpx_client, exp_gid, ["accuracy"])
        assert result["status_code"] == 200
        assert "data" in result
        assert len(result["data"]) > 0, "Should find runs with incomplete accuracy evaluations"

        # ===== Test 2: Verify structure of response data =====
        incomplete_eval = result["data"][0]
        assert "experiment_run" in incomplete_eval
        assert "dataset_example" in incomplete_eval
        assert "evaluation_names" in incomplete_eval
        assert isinstance(incomplete_eval["evaluation_names"], list)
        assert "id" in incomplete_eval["experiment_run"]
        assert "output" in incomplete_eval["experiment_run"]
        assert "dataset_example_id" in incomplete_eval["experiment_run"]

        # ===== Test 3: All runs missing "toxicity" evaluator =====
        toxicity_result = await self._get_incomplete_evaluations(
            httpx_client, exp_gid, ["toxicity"]
        )
        assert toxicity_result["status_code"] == 200
        assert len(toxicity_result["data"]) > 0, "Should find runs missing toxicity evaluator"
        for incomplete_eval in toxicity_result["data"]:
            assert "toxicity" in incomplete_eval["evaluation_names"]

        # ===== Test 4: No evaluator names specified returns 400 =====
        no_evaluator_result = await self._get_incomplete_evaluations(httpx_client, exp_gid)
        assert no_evaluator_result["status_code"] == 400
        assert "evaluation_name" in no_evaluator_result["text"].lower()

        # ===== Test 5: Invalid experiment ID returns 404 =====
        fake_exp_gid = GlobalID("Experiment", "999999")
        invalid_result = await self._get_incomplete_evaluations(
            httpx_client, fake_exp_gid, ["accuracy"]
        )
        assert invalid_result["status_code"] == 404
        if "json" in invalid_result:
            assert "does not exist" in invalid_result["json"]["detail"]
        else:
            assert "does not exist" in invalid_result["text"]

        # ===== Test 6: Experiment with no runs returns empty result =====
        exp_empty_gid = GlobalID("Experiment", str(exp_v1_empty.id))
        empty_result = await self._get_incomplete_evaluations(
            httpx_client, exp_empty_gid, ["non_existent"]
        )
        assert empty_result["status_code"] == 200
        assert len(empty_result["data"]) == 0, "Experiment with no runs should return empty"
        assert empty_result["next_cursor"] is None

        # ===== Test 7: Results ordered by run ID ascending =====
        # Add annotations to create incomplete evaluations
        now = datetime.now(timezone.utc)
        async with db() as session:
            # Get all runs for this experiment
            runs_result = await session.execute(
                select(models.ExperimentRun)
                .where(models.ExperimentRun.experiment_id == exp_v1_mixed.id)
                .order_by(models.ExperimentRun.id)
            )
            runs = list(runs_result.scalars())

            # Add "ordering_test" annotation to only the first run, leaving others incomplete
            if runs:
                session.add(
                    models.ExperimentRunAnnotation(
                        experiment_run_id=runs[0].id,
                        name="ordering_test",
                        annotator_kind="CODE",
                        label=None,
                        score=1.0,
                        explanation=None,
                        error=None,
                        metadata_={},
                        trace_id=None,
                        start_time=now,
                        end_time=now,
                    )
                )

        # Get all incomplete evaluations for ordering test
        order_result = await self._get_incomplete_evaluations(
            httpx_client, exp_gid, ["ordering_test"]
        )
        assert order_result["status_code"] == 200
        all_run_ids = [item["experiment_run"]["id"] for item in order_result["data"]]
        assert len(all_run_ids) >= 2, (
            f"Need at least 2 incomplete evaluations to test ordering, got {len(all_run_ids)}"
        )

        # Convert all GlobalIDs to rowids and verify ascending order
        from phoenix.server.api.types.node import from_global_id_with_expected_type

        all_rowids = [
            from_global_id_with_expected_type(GlobalID.from_id(gid), "ExperimentRun")
            for gid in all_run_ids
        ]
        for i in range(len(all_rowids) - 1):
            assert all_rowids[i] < all_rowids[i + 1], (
                f"Results should be in ascending order: row {all_rowids[i]} should be < {all_rowids[i + 1]}"
            )

        # ===== Test 8: Invalid cursor returns 422 =====
        invalid_cursor_result = await self._get_incomplete_evaluations(
            httpx_client, exp_gid, ["accuracy"], cursor="invalid-cursor"
        )
        assert invalid_cursor_result["status_code"] == 422
