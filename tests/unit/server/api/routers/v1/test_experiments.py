import json
from datetime import datetime, timezone
from io import StringIO
from secrets import token_hex
from typing import Any, Optional

import httpx
import pandas as pd
import pytest
from httpx import HTTPStatusError
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.api.types.node import from_global_id_with_expected_type
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
        "start_time": datetime.now(timezone.utc).isoformat(),
        "end_time": datetime.now(timezone.utc).isoformat(),
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
        "start_time": datetime.now(timezone.utc).isoformat(),
        "end_time": datetime.now(timezone.utc).isoformat(),
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
                    "start_time": datetime.now(timezone.utc).isoformat(),
                    "end_time": datetime.now(timezone.utc).isoformat(),
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
                "start_time": datetime.now(timezone.utc).isoformat(),
                "end_time": datetime.now(timezone.utc).isoformat(),
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
                "start_time": datetime.now(timezone.utc).isoformat(),
                "end_time": datetime.now(timezone.utc).isoformat(),
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

        # ===== Test 2.1: Verify correct revision snapshot (not latest revision) =====
        # The fixture has ex3 modified in v2 (ex3-v2-patched), but experiment_v1_mixed
        # was created with v1, so it should return v1 data (ex3-v1), not v2 data.
        ex3_incomplete = next(
            (
                run
                for run in result["data"]
                if int(GlobalID.from_id(run["dataset_example"]["id"]).node_id) == example_id_map[3]
            ),
            None,
        )
        assert ex3_incomplete is not None, "Example 3 should be in incomplete runs"

        # Verify snapshot data is v1 (not v2)
        assert ex3_incomplete["dataset_example"]["input"] == {"query": "ex3-v1"}, (
            f"Expected v1 snapshot data 'ex3-v1', but got "
            f"{ex3_incomplete['dataset_example']['input']!r}. "
            "This suggests the query is returning the latest revision instead of the snapshot."
        )
        assert ex3_incomplete["dataset_example"]["output"] == {"response": "expected-3-v1"}, (
            f"Expected v1 snapshot output 'expected-3-v1', but got "
            f"{ex3_incomplete['dataset_example']['output']!r}"
        )

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
    Comprehensive test suite for the incomplete evaluations endpoint.

    Tests detection of missing and failed evaluations with:
    - Correct filtering and categorization
    - Proper pagination behavior
    - Edge cases and boundary conditions
    - Error handling
    - Performance optimizations (JSON aggregation, error string optimization)
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

    async def test_incomplete_evaluations(
        self,
        httpx_client: httpx.AsyncClient,
        experiments_with_incomplete_runs: ExperimentsWithIncompleteRuns,
        db: DbSessionFactory,
    ) -> None:
        """
        Comprehensive test for /incomplete-evaluations endpoint.

        This test validates the complete lifecycle and edge cases of evaluations, organized into logical sections:

        I. Core Functionality
           - Missing and failed evaluation detection
           - Response structure and data completeness
           - Filtering (complete runs excluded, task-level errors excluded)

        II. Pagination & Ordering
           - Correct ordering (by run ID ascending)
           - Pagination with various limits (1, 2, large, oversized)
           - Cursor behavior (valid, invalid, at boundaries)
           - No gaps or duplicates across pages
           - No empty pages with next_cursor (critical bug fix)

        III. Edge Cases
           - Multiple evaluation names at once
           - Duplicate evaluation names
           - Single vs multiple evaluations
           - All evaluations complete (empty result)

        IV. Error Handling
           - No evaluation names (400 error)
           - Invalid experiment ID (404 error)
           - Invalid cursor (422 error)
           - Experiment with no runs (empty result)

        V. Security
           - SQL injection attempts through evaluation_name parameter
           - Mixed malicious and legitimate names
           - Database integrity after attacks
        """

        # Setup: Get experiment and example data
        exp_v1_mixed = experiments_with_incomplete_runs.experiment_v1_mixed
        exp_v1_empty = experiments_with_incomplete_runs.experiment_v1_empty
        exp_gid = GlobalID("Experiment", str(exp_v1_mixed.id))
        exp_empty_gid = GlobalID("Experiment", str(exp_v1_empty.id))
        now = datetime.now(timezone.utc)

        # Randomized evaluation names to avoid test pollution
        eval1 = f"eval1_{token_hex(4)}"
        eval2 = f"eval2_{token_hex(4)}"
        ordering_test_eval = f"ordering_test_{token_hex(4)}"
        never_added_eval = f"never_added_{token_hex(4)}"
        single_eval_test = f"single_eval_{token_hex(4)}"
        all_complete_eval = f"all_complete_{token_hex(4)}"

        # ====================================================================================
        # SETUP: Create test data with diverse evaluation states
        # ====================================================================================

        async with db() as session:
            # Get all runs for the experiment
            runs_result = await session.execute(
                select(models.ExperimentRun)
                .where(models.ExperimentRun.experiment_id == exp_v1_mixed.id)
                .order_by(models.ExperimentRun.id)
            )
            all_runs = list(runs_result.scalars())

            # Create specific scenarios for comprehensive testing
            # Only annotate successful runs (filter out failed runs)
            successful_runs = [run for run in all_runs if run.error is None]
            assert len(successful_runs) >= 5, (
                f"Fixture must provide at least 5 successful runs, got {len(successful_runs)}"
            )

            # Run 0: Complete for eval1, missing eval2 (partially complete)
            session.add(
                models.ExperimentRunAnnotation(
                    experiment_run_id=successful_runs[0].id,
                    name=eval1,
                    annotator_kind="CODE",
                    label="success",
                    score=1.0,
                    error=None,
                    metadata_={},
                    start_time=now,
                    end_time=now,
                )
            )

            # Run 1: Complete for BOTH eval1 and eval2 (fully complete - should be filtered out!)
            for eval_name in [eval1, eval2]:
                session.add(
                    models.ExperimentRunAnnotation(
                        experiment_run_id=successful_runs[1].id,
                        name=eval_name,
                        annotator_kind="CODE",
                        label="success",
                        score=1.0,
                        error=None,
                        metadata_={},
                        start_time=now,
                        end_time=now,
                    )
                )

            # Run 2: Failed eval1, complete eval2 (partial - failed counts as incomplete)
            session.add(
                models.ExperimentRunAnnotation(
                    experiment_run_id=successful_runs[2].id,
                    name=eval1,
                    annotator_kind="CODE",
                    label=None,
                    score=None,
                    error="Evaluation failed",
                    metadata_={},
                    start_time=now,
                    end_time=now,
                )
            )
            session.add(
                models.ExperimentRunAnnotation(
                    experiment_run_id=successful_runs[2].id,
                    name=eval2,
                    annotator_kind="CODE",
                    label="success",
                    score=1.0,
                    error=None,
                    metadata_={},
                    start_time=now,
                    end_time=now,
                )
            )

            # Run 3: Missing both eval1 and eval2 (no annotations)
            # (No annotations added)

            # Run 4: Failed both eval1 and eval2
            for eval_name in [eval1, eval2]:
                session.add(
                    models.ExperimentRunAnnotation(
                        experiment_run_id=successful_runs[4].id,
                        name=eval_name,
                        annotator_kind="CODE",
                        label=None,
                        score=None,
                        error="Evaluation error",
                        metadata_={},
                        start_time=now,
                        end_time=now,
                    )
                )

            # For all remaining successful runs beyond the first 5, add complete annotations
            # This prevents the test from being polluted by extra fixture runs
            for i in range(5, len(successful_runs)):
                for eval_name in [eval1, eval2]:
                    session.add(
                        models.ExperimentRunAnnotation(
                            experiment_run_id=successful_runs[i].id,
                            name=eval_name,
                            annotator_kind="CODE",
                            label="success",
                            score=1.0,
                            error=None,
                            metadata_={},
                            start_time=now,
                            end_time=now,
                        )
                    )

            # Setup for ordering test: annotate first run with ordering_test_eval
            assert len(all_runs) > 0, "Need at least one run for ordering test setup"
            session.add(
                models.ExperimentRunAnnotation(
                    experiment_run_id=all_runs[0].id,
                    name=ordering_test_eval,
                    annotator_kind="CODE",
                    label="success",
                    score=1.0,
                    error=None,
                    metadata_={},
                    trace_id=None,
                    start_time=now,
                    end_time=now,
                )
            )

        # ====================================================================================
        # PART I: CORE FUNCTIONALITY
        # ====================================================================================

        # Test 1: Basic detection of missing and failed evaluations
        result = await self._get_incomplete_evaluations(httpx_client, exp_gid, [eval1, eval2])
        assert result["status_code"] == 200
        assert "data" in result

        # Test 2: Response structure validation
        if result["data"]:
            first_item = result["data"][0]
            assert "experiment_run" in first_item
            assert "dataset_example" in first_item
            assert "evaluation_names" in first_item
            assert isinstance(first_item["evaluation_names"], list)
            assert "id" in first_item["experiment_run"]
            assert "output" in first_item["experiment_run"]
            assert "dataset_example_id" in first_item["experiment_run"]

            # Test 2.1: Verify output consistency across endpoints
            run_id = first_item["experiment_run"]["id"]
            list_runs_response = await httpx_client.get(f"v1/experiments/{exp_gid}/runs")
            list_runs_data = list_runs_response.json()["data"]
            matching_run = next((r for r in list_runs_data if r["id"] == run_id), None)
            assert matching_run is not None, (
                f"Run {run_id} from incomplete-evaluations not found in list_experiment_runs"
            )
            # Both endpoints must return identical output for the same run
            assert first_item["experiment_run"]["output"] == matching_run["output"], (
                f"Output must be identical across endpoints: "
                f"incomplete-evaluations returned {first_item['experiment_run']['output']!r}, "
                f"list_experiment_runs returned {matching_run['output']!r}"
            )

            # Test 2.2: Verify correct revision snapshot in dataset_example
            # The fixture has ex3 modified in v2, but experiment_v1_mixed uses v1 snapshot
            example_id_map = experiments_with_incomplete_runs.example_id_map

            # Find an evaluation for ex3 (which was modified in v2)
            ex3_eval = next(
                (
                    item
                    for item in result["data"]
                    if int(GlobalID.from_id(item["experiment_run"]["dataset_example_id"]).node_id)
                    == example_id_map[3]
                ),
                None,
            )

            if ex3_eval is not None:
                # Verify snapshot data is v1 (not v2 which has "ex3-v2-patched")
                assert ex3_eval["dataset_example"]["input"] == {"query": "ex3-v1"}, (
                    f"Expected v1 snapshot data 'ex3-v1', but got "
                    f"{ex3_eval['dataset_example']['input']!r}. "
                    "This suggests the query is returning the latest revision instead of the snapshot."
                )
                assert ex3_eval["dataset_example"]["output"] == {"response": "expected-3-v1"}, (
                    f"Expected v1 snapshot output 'expected-3-v1', but got "
                    f"{ex3_eval['dataset_example']['output']!r}"
                )

        # Test 2.5: Verify exactly one row per run (no duplicates from joins)
        run_ids_in_result = [item["experiment_run"]["id"] for item in result["data"]]
        assert len(run_ids_in_result) == len(set(run_ids_in_result)), (
            "Each run should appear exactly once (one row per run, not multiple rows from joins)"
        )

        # Get successful_runs again for assertions (we set them up in the db() context)
        async with db() as session:
            runs_result = await session.execute(
                select(models.ExperimentRun)
                .where(models.ExperimentRun.experiment_id == exp_v1_mixed.id)
                .where(models.ExperimentRun.error.is_(None))
                .order_by(models.ExperimentRun.id)
            )
            successful_runs = list(runs_result.scalars())

        # Test 3: Filtering - complete runs excluded
        run1_gid = str(GlobalID("ExperimentRun", str(successful_runs[1].id)))
        assert run1_gid not in run_ids_in_result, (
            "Run with all evaluations complete should be excluded"
        )

        # Test 4: Correct categorization (missing vs failed both included)
        # Build expected results map
        expected_incomplete = {
            str(GlobalID("ExperimentRun", str(successful_runs[0].id))): [
                eval2
            ],  # Complete eval1, missing eval2
            str(GlobalID("ExperimentRun", str(successful_runs[2].id))): [
                eval1
            ],  # Failed eval1, complete eval2
            str(GlobalID("ExperimentRun", str(successful_runs[3].id))): {
                eval1,
                eval2,
            },  # Missing both
            str(GlobalID("ExperimentRun", str(successful_runs[4].id))): {
                eval1,
                eval2,
            },  # Failed both
        }

        # Verify we got exactly the expected runs
        actual_run_ids = {item["experiment_run"]["id"] for item in result["data"]}
        expected_run_ids = set(expected_incomplete.keys())
        assert actual_run_ids == expected_run_ids, (
            f"Expected incomplete runs {expected_run_ids}, got {actual_run_ids}. "
            f"Missing: {expected_run_ids - actual_run_ids}, Extra: {actual_run_ids - expected_run_ids}"
        )

        # Verify each run has correct incomplete evaluations
        for item in result["data"]:
            run_id_str = item["experiment_run"]["id"]
            eval_names = item["evaluation_names"]
            expected = expected_incomplete[run_id_str]

            if isinstance(expected, list):
                assert eval_names == expected, (
                    f"Run {run_id_str} should have incomplete evals {expected}, got {eval_names}"
                )
            else:  # set
                assert set(eval_names) == expected, (
                    f"Run {run_id_str} should have incomplete evals {expected}, got {set(eval_names)}"
                )

        # Test 5: All runs missing an evaluator
        all_missing_result = await self._get_incomplete_evaluations(
            httpx_client, exp_gid, [never_added_eval]
        )
        assert all_missing_result["status_code"] == 200
        # All successful runs should be missing this evaluation (since we never added it)
        successful_run_count = len(successful_runs)
        assert len(all_missing_result["data"]) == successful_run_count, (
            f"All {successful_run_count} successful runs should be missing {never_added_eval}, "
            f"got {len(all_missing_result['data'])}"
        )

        # ====================================================================================
        # PART II: PAGINATION & ORDERING
        # ====================================================================================

        # Test 6: Results ordered by run ID ascending
        order_result = await self._get_incomplete_evaluations(
            httpx_client, exp_gid, [ordering_test_eval]
        )
        assert order_result["status_code"] == 200
        order_run_ids = [item["experiment_run"]["id"] for item in order_result["data"]]

        # Require at least 2 results to test ordering
        assert len(order_run_ids) >= 2, (
            f"Need at least 2 results to test ordering, got {len(order_run_ids)}. "
            f"Ensure fixture provides multiple runs missing {ordering_test_eval}"
        )

        # Verify strict ascending order
        order_rowids = [
            from_global_id_with_expected_type(GlobalID.from_id(gid), "ExperimentRun")
            for gid in order_run_ids
        ]
        for i in range(len(order_rowids) - 1):
            assert order_rowids[i] < order_rowids[i + 1], (
                f"Results must be in ascending order: row {order_rowids[i]} should be < {order_rowids[i + 1]}"
            )

        # Test 7: Pagination with limit=2
        # First verify the total count we expect
        total_incomplete = len(result["data"])
        assert total_incomplete == 4, (
            f"Expected exactly 4 incomplete runs (0,2,3,4), got {total_incomplete}"
        )

        paginated_result = await self._get_incomplete_evaluations(
            httpx_client, exp_gid, [eval1, eval2], limit=2
        )
        assert paginated_result["status_code"] == 200
        assert len(paginated_result["data"]) == 2, (
            "Should return exactly 2 runs when limit=2 and results exist"
        )
        assert paginated_result["next_cursor"] is not None, (
            "Must have next_cursor when limit < total results"
        )

        # Test 8: limit=1 (minimum pagination)
        limit1_result = await self._get_incomplete_evaluations(
            httpx_client, exp_gid, [eval1, eval2], limit=1
        )
        assert limit1_result["status_code"] == 200
        assert len(limit1_result["data"]) == 1, (
            "Should return exactly 1 run when limit=1 and results exist"
        )
        assert limit1_result["next_cursor"] is not None, (
            "Must have next_cursor when limit=1 < total results"
        )

        # Test 9: Large limit exceeding total runs
        large_limit_result = await self._get_incomplete_evaluations(
            httpx_client, exp_gid, [eval1, eval2], limit=10000
        )
        assert large_limit_result["status_code"] == 200
        assert large_limit_result.get("next_cursor") is None, (
            "Should not have next_cursor when limit exceeds total"
        )

        # Test 10: Pagination continuity - no gaps or duplicates
        all_paginated_runs = []
        cursor = None
        page_count = 0
        max_pages = 10  # Safety limit

        for _ in range(max_pages):
            page_result = await self._get_incomplete_evaluations(
                httpx_client, exp_gid, [eval1, eval2], limit=2, cursor=cursor
            )
            assert page_result["status_code"] == 200
            page_count += 1

            page_runs = page_result["data"]
            assert len(page_runs) > 0, (
                f"Page {page_count} must have results (empty pages violate pagination contract)"
            )
            all_paginated_runs.extend(page_runs)

            cursor = page_result.get("next_cursor")
            if cursor is None:
                break
        else:
            raise AssertionError(
                f"Pagination didn't complete within {max_pages} pages - possible infinite loop"
            )

        # Verify correct total pages (4 results / 2 per page = 2 pages)
        assert page_count == 2, f"Expected 2 pages with limit=2 and 4 results, got {page_count}"

        # Verify no duplicates
        paginated_run_ids = [item["experiment_run"]["id"] for item in all_paginated_runs]
        assert len(paginated_run_ids) == len(set(paginated_run_ids)), (
            f"Pagination must not have duplicates. Got {len(paginated_run_ids)} total, "
            f"{len(set(paginated_run_ids))} unique"
        )

        # Verify all expected runs retrieved (no gaps)
        assert set(paginated_run_ids) == set(run_ids_in_result), (
            f"Pagination must retrieve all results. "
            f"Missing: {set(run_ids_in_result) - set(paginated_run_ids)}, "
            f"Extra: {set(paginated_run_ids) - set(run_ids_in_result)}"
        )

        # Test 11: No empty pages with next_cursor (critical bug fix)
        # If we got a next_cursor in any response, the data should NOT be empty
        for page_num in range(10):
            check_result = await self._get_incomplete_evaluations(
                httpx_client,
                exp_gid,
                [eval1, eval2],
                limit=1,
                cursor=cursor if page_num > 0 else None,
            )
            if check_result.get("next_cursor"):
                assert len(check_result["data"]) > 0, (
                    f"BUG: Got next_cursor with empty data on page {page_num}! "
                    "This means SQL filtering is not working and empty pages are returned."
                )
            if not check_result.get("next_cursor"):
                break

        # ====================================================================================
        # PART III: EDGE CASES
        # ====================================================================================

        # Test 12: Single evaluation name
        single_eval_result = await self._get_incomplete_evaluations(
            httpx_client, exp_gid, [single_eval_test]
        )
        assert single_eval_result["status_code"] == 200
        # All successful runs should be missing this evaluation (since we never added it)
        assert len(single_eval_result["data"]) == successful_run_count, (
            f"All {successful_run_count} successful runs should be missing {single_eval_test}, "
            f"got {len(single_eval_result['data'])}"
        )
        for item in single_eval_result["data"]:
            assert item["evaluation_names"] == [single_eval_test], (
                f"Single evaluation request must only return that evaluation in list, got {item['evaluation_names']}"
            )

        # Test 13: Duplicate evaluation names (handled gracefully)
        duplicate_result = await self._get_incomplete_evaluations(
            httpx_client, exp_gid, [eval1, eval1, eval2, eval2]
        )
        assert duplicate_result["status_code"] == 200
        assert "data" in duplicate_result
        assert isinstance(duplicate_result["data"], list)

        # Verify duplicates are handled correctly (no crashes, valid structure)
        for item in duplicate_result["data"]:
            assert "experiment_run" in item
            assert "evaluation_names" in item
            # Each incomplete evaluation name should appear at most once per run
            assert len(item["evaluation_names"]) == len(set(item["evaluation_names"])), (
                f"Evaluation names should be deduplicated within each run: {item['evaluation_names']}"
            )
            # All evaluation names should be either eval1 or eval2
            for name in item["evaluation_names"]:
                assert name in [eval1, eval2], f"Unexpected evaluation name: {name}"

        # Test 14: All evaluations complete (empty result)
        async with db() as session:
            runs_result = await session.execute(
                select(models.ExperimentRun)
                .where(models.ExperimentRun.experiment_id == exp_v1_mixed.id)
                .where(models.ExperimentRun.error.is_(None))
                .order_by(models.ExperimentRun.id)
            )
            successful_runs = list(runs_result.scalars())

            for run in successful_runs:
                session.add(
                    models.ExperimentRunAnnotation(
                        experiment_run_id=run.id,
                        name=all_complete_eval,
                        annotator_kind="CODE",
                        label="success",
                        score=1.0,
                        error=None,
                        metadata_={},
                        start_time=now,
                        end_time=now,
                    )
                )

        all_complete_result = await self._get_incomplete_evaluations(
            httpx_client, exp_gid, [all_complete_eval]
        )
        assert all_complete_result["status_code"] == 200
        # Should return empty list (all successful runs have this evaluation complete)
        # Failed runs are excluded from results (they shouldn't be evaluated)
        assert len(all_complete_result["data"]) == 0, (
            f"When all successful runs have completed an evaluation, should return 0 results, "
            f"got {len(all_complete_result['data'])}"
        )
        assert all_complete_result.get("next_cursor") is None, (
            "Empty result should not have next_cursor"
        )

        # ====================================================================================
        # PART IV: ERROR HANDLING
        # ====================================================================================

        # Test 15: No evaluator names specified returns 400
        no_evaluator_result = await self._get_incomplete_evaluations(httpx_client, exp_gid)
        assert no_evaluator_result["status_code"] == 400
        assert "evaluation_name" in no_evaluator_result["text"].lower()

        # Test 16: Invalid experiment ID returns 404
        fake_exp_gid = GlobalID("Experiment", "999999")
        invalid_result = await self._get_incomplete_evaluations(httpx_client, fake_exp_gid, [eval1])
        assert invalid_result["status_code"] == 404
        if "json" in invalid_result:
            assert "does not exist" in invalid_result["json"]["detail"]
        else:
            assert "does not exist" in invalid_result["text"]

        # Test 17: Invalid cursor returns 422
        invalid_cursor_result = await self._get_incomplete_evaluations(
            httpx_client, exp_gid, [eval1], cursor="invalid-cursor"
        )
        assert invalid_cursor_result["status_code"] == 422

        # Test 18: Experiment with no runs returns empty result
        non_existent_eval = f"non_existent_{token_hex(4)}"
        empty_result = await self._get_incomplete_evaluations(
            httpx_client, exp_empty_gid, [non_existent_eval]
        )
        assert empty_result["status_code"] == 200
        assert len(empty_result["data"]) == 0, "Experiment with no runs should return empty"
        assert empty_result["next_cursor"] is None

        # ====================================================================================
        # PART V: SECURITY
        # ====================================================================================

        # Test 19: SQL injection attempts through evaluation_name parameter
        sql_injection_attempts = [
            # Classic SQL injection attempts
            "'; DROP TABLE experiment_runs; --",
            "' OR '1'='1",
            "' OR 1=1--",
            "admin'--",
            "' UNION SELECT NULL--",
            # More sophisticated attempts
            "1' AND '1'='1",
            "1' UNION SELECT * FROM experiments--",
            "'; DELETE FROM experiments WHERE 1=1--",
            # Boolean-based blind SQL injection
            "' AND (SELECT COUNT(*) FROM experiments) > 0--",
            # Time-based blind SQL injection
            "'; WAITFOR DELAY '00:00:05'--",
            # PostgreSQL-specific attempts
            "'; SELECT pg_sleep(5)--",
            "' OR 1=1; --",
            # Multiple statement attempts
            "eval1'; DROP TABLE experiments; SELECT '",
            # NULL byte injection
            "eval1\x00",
            # Unicode/encoding attempts
            "eval1\u0027 OR 1=1--",
        ]

        for injection_attempt in sql_injection_attempts:
            # Test single malicious evaluation name
            result = await self._get_incomplete_evaluations(
                httpx_client, exp_gid, [injection_attempt]
            )

            # Null bytes should be rejected with 400 (invalid input)
            if "\x00" in injection_attempt:
                assert result["status_code"] == 400, (
                    f"Null byte injection should return 400 error: {injection_attempt}"
                )
                assert "null byte" in result["text"].lower(), (
                    "Error message should mention null bytes"
                )
            else:
                # Other injection attempts should return valid response (not crash)
                assert result["status_code"] == 200, (
                    f"SQL injection attempt should not cause server error: {injection_attempt}"
                )

                # Result should be empty or contain valid data structure
                assert "data" in result, "Response should have data field"
                assert isinstance(result["data"], list), "Data should be a list"

                # If there's data, verify structure is intact
                for item in result["data"]:
                    assert "experiment_run" in item
                    assert "dataset_example" in item
                    assert "evaluation_names" in item
                    assert isinstance(item["evaluation_names"], list)

        # Test 20: Mixed malicious and legitimate names
        mixed_attempt = await self._get_incomplete_evaluations(
            httpx_client,
            exp_gid,
            ["legitimate_eval", "'; DROP TABLE experiments--", "another_eval"],
        )
        assert mixed_attempt["status_code"] == 200
        assert "data" in mixed_attempt

        # Test 21: Verify database integrity after SQL injection attempts
        normal_result = await self._get_incomplete_evaluations(
            httpx_client, exp_gid, ["safe_evaluation_name"]
        )
        assert normal_result["status_code"] == 200, (
            "Database should still be functional after SQL injection attempts"
        )
