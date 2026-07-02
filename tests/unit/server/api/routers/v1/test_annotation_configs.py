from copy import deepcopy
from typing import Any, Optional

import pytest
from httpx import AsyncClient
from strawberry.relay.types import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    AnnotationType,
    CategoricalAnnotationConfig,
    CategoricalAnnotationValue,
    OptimizationDirection,
)
from phoenix.server.types import DbSessionFactory


@pytest.mark.parametrize(
    "create_config,update_config",
    [
        pytest.param(
            {
                "name": "config-name",
                "type": AnnotationType.CATEGORICAL.value,
                "description": "Test description",
                "optimization_direction": OptimizationDirection.MAXIMIZE.value,
                "values": [
                    {"label": "Good", "score": 1.0},
                    {"label": "Bad", "score": 0.0},
                ],
            },
            {
                "name": "updated-config-name",
                "type": AnnotationType.CATEGORICAL.value,
                "description": "Updated description",
                "optimization_direction": OptimizationDirection.MINIMIZE.value,
                "values": [
                    {"label": "Excellent", "score": 1.0},
                    {"label": "Poor", "score": 0.0},
                ],
            },
            id="categorical",
        ),
        pytest.param(
            {
                "name": "config-name",
                "type": AnnotationType.CONTINUOUS.value,
                "description": "Test description",
                "optimization_direction": OptimizationDirection.MAXIMIZE.value,
                "lower_bound": 0.0,
                "upper_bound": 100.0,
            },
            {
                "name": "updated-config-name",
                "type": AnnotationType.CONTINUOUS.value,
                "description": "Updated description",
                "optimization_direction": OptimizationDirection.MINIMIZE.value,
                "lower_bound": -10.0,
                "upper_bound": 10.0,
            },
            id="continuous",
        ),
        pytest.param(
            {
                "name": "config-name",
                "type": AnnotationType.FREEFORM.value,
                "description": "Test description",
                "optimization_direction": OptimizationDirection.MAXIMIZE.value,
                "threshold": 0.5,
                "lower_bound": 0.0,
                "upper_bound": 1.0,
            },
            {
                "name": "updated-config-name",
                "type": AnnotationType.FREEFORM.value,
                "description": "Updated description",
                "optimization_direction": OptimizationDirection.MINIMIZE.value,
                "threshold": 0.25,
                "lower_bound": -1.0,
                "upper_bound": 2.0,
            },
            id="freeform",
        ),
    ],
)
async def test_crud_operations(
    httpx_client: AsyncClient,
    create_config: dict[str, Any],
    update_config: dict[str, Any],
) -> None:
    # Create a categorical annotation config
    create_response = await httpx_client.post(
        "/v1/annotation_configs",
        json=create_config,
    )
    assert create_response.status_code == 200
    created_config = create_response.json()["data"]
    config_id = created_config["id"]

    expected_config = create_config
    expected_config["id"] = config_id
    assert created_config == expected_config

    # List annotation configs
    list_response = await httpx_client.get("/v1/annotation_configs")
    assert list_response.status_code == 200
    configs = list_response.json()["data"]
    assert len(configs) == 2  # Includes the seeded user_feedback config.
    assert created_config in configs
    assert any(config["name"] == "user_feedback" for config in configs)

    # Get config by ID
    get_response = await httpx_client.get(f"/v1/annotation_configs/{config_id}")
    assert get_response.status_code == 200
    assert get_response.json()["data"] == created_config

    # Get config by name
    get_by_name_response = await httpx_client.get("/v1/annotation_configs/config-name")
    assert get_by_name_response.status_code == 200
    assert get_by_name_response.json()["data"] == created_config

    # Update the annotation config
    update_response = await httpx_client.put(
        f"/v1/annotation_configs/{config_id}",
        json=update_config,
    )
    assert update_response.status_code == 200
    updated_config = update_response.json()["data"]
    expected_updated_config = update_config
    expected_updated_config["id"] = config_id
    assert updated_config == expected_updated_config

    # Delete the annotation config
    delete_response = await httpx_client.delete(f"/v1/annotation_configs/{config_id}")
    assert delete_response.status_code == 200
    assert delete_response.json()["data"] == expected_updated_config

    # Verify the config is deleted by listing
    list_response = await httpx_client.get("/v1/annotation_configs")
    assert list_response.status_code == 200
    configs = list_response.json()["data"]
    assert len(configs) == 1  # Only the seeded user_feedback config remains.
    assert configs[0]["name"] == "user_feedback"

    # Verify the config is deleted by getting
    get_response = await httpx_client.get(f"/v1/annotation_configs/{config_id}")
    assert get_response.status_code == 404


@pytest.mark.parametrize(
    "annotation_config",
    [
        pytest.param(
            {
                "name": "note",
                "type": AnnotationType.CATEGORICAL.value,
                "description": "Test description",
                "optimization_direction": OptimizationDirection.MAXIMIZE.value,
                "values": [
                    {"label": "Good", "score": 1.0},
                    {"label": "Bad", "score": 0.0},
                ],
            },
            id="categorical",
        ),
        pytest.param(
            {
                "name": "note",
                "type": AnnotationType.CONTINUOUS.value,
                "description": "Test description",
                "optimization_direction": OptimizationDirection.MAXIMIZE.value,
                "lower_bound": 0.0,
                "upper_bound": 1.0,
            },
            id="continuous",
        ),
        pytest.param(
            {
                "name": "note",
                "type": AnnotationType.FREEFORM.value,
                "description": "Test description",
            },
            id="freeform",
        ),
    ],
)
async def test_cannot_create_annotation_config_with_reserved_name_for_notes(
    httpx_client: AsyncClient,
    annotation_config: dict[str, Any],
) -> None:
    response = await httpx_client.post("/v1/annotation_configs", json=annotation_config)
    assert response.status_code == 409
    assert (
        "The name 'note' is reserved for trace and span notes and cannot be used "
        "for annotation configs."
    ) in response.text


@pytest.mark.parametrize(
    "annotation_config",
    [
        pytest.param(
            {
                "name": "test-config",
                "type": AnnotationType.CATEGORICAL.value,
                "description": "Test description",
                "optimization_direction": OptimizationDirection.MAXIMIZE.value,
                "values": [
                    {"label": "Good", "score": 1.0},
                    {"label": "Bad", "score": 0.0},
                ],
            },
            id="categorical",
        ),
        pytest.param(
            {
                "name": "test-config",
                "type": AnnotationType.CONTINUOUS.value,
                "description": "Test description",
                "optimization_direction": OptimizationDirection.MAXIMIZE.value,
                "lower_bound": 0.0,
                "upper_bound": 1.0,
            },
            id="continuous",
        ),
        pytest.param(
            {
                "name": "test-config",
                "type": AnnotationType.FREEFORM.value,
                "description": "Test description",
            },
            id="freeform",
        ),
    ],
)
async def test_cannot_update_annotation_config_name_to_reserved_name_for_notes(
    httpx_client: AsyncClient,
    annotation_config: dict[str, Any],
) -> None:
    # First create a config
    response = await httpx_client.post("/v1/annotation_configs", json=annotation_config)
    assert response.status_code == 200
    config_id = response.json()["data"]["id"]

    # Try to update the name to "note"
    update_config = deepcopy(annotation_config)
    update_config["name"] = "note"
    response = await httpx_client.put(f"/v1/annotation_configs/{config_id}", json=update_config)
    assert response.status_code == 409
    assert (
        "The name 'note' is reserved for trace and span notes and cannot be used "
        "for annotation configs."
    ) in response.text


@pytest.mark.parametrize(
    "annotation_config",
    [
        pytest.param(
            {
                "name": "config-name",
                "type": AnnotationType.CATEGORICAL.value,
                "description": "Test description",
                "optimization_direction": OptimizationDirection.MAXIMIZE.value,
                "values": [
                    {"label": "Good", "score": 1.0},
                    {"label": "Bad", "score": 0.0},
                ],
            },
            id="categorical",
        ),
        pytest.param(
            {
                "name": "config-name",
                "type": AnnotationType.CONTINUOUS.value,
                "description": "Test description",
                "optimization_direction": OptimizationDirection.MAXIMIZE.value,
                "lower_bound": 0.0,
                "upper_bound": 1.0,
            },
            id="continuous",
        ),
        pytest.param(
            {
                "name": "config-name",
                "type": AnnotationType.FREEFORM.value,
                "description": "Test description",
            },
            id="freeform",
        ),
    ],
)
async def test_cannot_create_annotation_config_with_duplicate_name(
    httpx_client: AsyncClient,
    annotation_config: dict[str, Any],
) -> None:
    response = await httpx_client.post("/v1/annotation_configs", json=annotation_config)
    assert response.status_code == 200

    # Try to create another config with same name
    response = await httpx_client.post("/v1/annotation_configs", json=annotation_config)
    assert response.status_code == 409
    assert "name of the annotation configuration is already taken" in response.text


async def test_create_categorical_config_with_empty_values_returns_expected_error(
    httpx_client: AsyncClient,
) -> None:
    config = {
        "name": "test_categorical",
        "type": AnnotationType.CATEGORICAL.value,
        "optimization_direction": OptimizationDirection.NONE.value,
        "values": [],  # empty values are disallowed
    }
    response = await httpx_client.post("/v1/annotation_configs", json=config)
    assert response.status_code == 400
    assert "Values must be non-empty" in response.text


@pytest.mark.parametrize(
    "config",
    [
        pytest.param(
            {
                "name": "config-name",
                "type": AnnotationType.CATEGORICAL.value,
                "description": "config description",
                "optimization_direction": OptimizationDirection.MAXIMIZE.value,
                "values": [
                    {"label": "Good", "score": 1.0},
                    {"label": "Bad", "score": 0.0},
                ],
            },
            id="categorical",
        ),
        pytest.param(
            {
                "name": "config-name",
                "type": AnnotationType.CONTINUOUS.value,
                "description": "config description",
                "optimization_direction": OptimizationDirection.MAXIMIZE.value,
                "lower_bound": 0.0,
                "upper_bound": 1.0,
            },
            id="continuous",
        ),
        pytest.param(
            {
                "name": "config-name",
                "type": AnnotationType.FREEFORM.value,
                "description": "config description",
            },
            id="freeform",
        ),
    ],
)
async def test_updated_annotation_config_name_cannot_collide_with_existing_config_name(
    httpx_client: AsyncClient,
    config: dict[str, Any],
) -> None:
    # First create first config
    first_config = {
        "name": "collide-config-name",
        "type": AnnotationType.FREEFORM.value,
        "description": "config description",
    }
    response = await httpx_client.post("/v1/annotation_configs", json=first_config)
    assert response.status_code == 200

    # Create second config
    response = await httpx_client.post("/v1/annotation_configs", json=config)
    assert response.status_code == 200
    config_id = response.json()["data"]["id"]

    # Try to update second config name to collide with first
    update_config = config.copy()
    update_config["name"] = "collide-config-name"
    response = await httpx_client.put(f"/v1/annotation_configs/{config_id}", json=update_config)
    assert response.status_code == 409
    assert "name of the annotation configuration is already taken" in response.text


async def test_update_continuous_annotation_config_with_invalid_bounds_returns_expected_error(
    httpx_client: AsyncClient,
) -> None:
    # First create a valid continuous config
    config = {
        "name": "test-config",
        "type": AnnotationType.CONTINUOUS.value,
        "description": "test description",
        "optimization_direction": OptimizationDirection.MAXIMIZE.value,
        "lower_bound": 0.0,
        "upper_bound": 1.0,
    }
    response = await httpx_client.post("/v1/annotation_configs", json=config)
    assert response.status_code == 200
    config_id = response.json()["data"]["id"]

    # Try to update with invalid bounds
    update_config = config.copy()
    update_config["lower_bound"] = 1.0
    update_config["upper_bound"] = 0.0

    response = await httpx_client.put(f"/v1/annotation_configs/{config_id}", json=update_config)
    assert response.status_code == 400
    assert "Lower bound must be strictly less than upper bound" in response.text


async def test_create_freeform_annotation_config_with_invalid_bounds_returns_expected_error(
    httpx_client: AsyncClient,
) -> None:
    config = {
        "name": "test-config",
        "type": AnnotationType.FREEFORM.value,
        "description": "test description",
        "lower_bound": 1.0,
        "upper_bound": 0.0,
    }
    response = await httpx_client.post("/v1/annotation_configs", json=config)
    assert response.status_code == 400
    assert "Lower bound must be strictly less than upper bound" in response.text


async def _create_project(httpx_client: AsyncClient, name: str) -> str:
    response = await httpx_client.post("/v1/projects", json={"name": name})
    assert response.status_code == 200, response.text
    return str(response.json()["data"]["id"])


async def _create_config(httpx_client: AsyncClient, name: str) -> dict[str, Any]:
    response = await httpx_client.post(
        "/v1/annotation_configs",
        json={
            "name": name,
            "type": AnnotationType.CATEGORICAL.value,
            "description": "Human review rubric",
            "optimization_direction": OptimizationDirection.MAXIMIZE.value,
            "values": [
                {"label": "helpful", "score": 1.0},
                {"label": "not_helpful", "score": 0.0},
            ],
        },
    )
    assert response.status_code == 200, response.text
    data: dict[str, Any] = response.json()["data"]
    return data


async def test_assign_annotation_config_to_project_is_idempotent_and_listable(
    httpx_client: AsyncClient,
) -> None:
    project_id = await _create_project(httpx_client, "assign-project")
    config = await _create_config(httpx_client, "assign-config")
    base = f"/v1/projects/{project_id}/annotation_configs"
    item = f"{base}/{config['id']}"

    # Assign returns 200 and echoes the assigned config.
    response = await httpx_client.put(item)
    assert response.status_code == 200, response.text
    assert response.json()["data"] == config

    # Re-assigning an already-assigned config is an idempotent no-op that still returns 200.
    response = await httpx_client.put(item)
    assert response.status_code == 200, response.text
    assert response.json()["data"] == config

    # The config now shows up in the project's list (paginated, same item shape as the collection).
    response = await httpx_client.get(base)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["data"] == [config]
    assert body["next_cursor"] is None


async def test_assign_and_list_annotation_configs_by_name(
    httpx_client: AsyncClient,
) -> None:
    await _create_project(httpx_client, "by-name-project")
    config = await _create_config(httpx_client, "by-name-config")
    base = "/v1/projects/by-name-project/annotation_configs"

    # Both the project and the config identifiers accept a name as well as a GlobalID.
    response = await httpx_client.put(f"{base}/by-name-config")
    assert response.status_code == 200, response.text
    assert response.json()["data"] == config

    response = await httpx_client.get(base)
    assert response.status_code == 200, response.text
    assert response.json()["data"] == [config]


async def test_unassign_annotation_config_from_project(
    httpx_client: AsyncClient,
) -> None:
    project_id = await _create_project(httpx_client, "unassign-project")
    config = await _create_config(httpx_client, "unassign-config")
    config_id = config["id"]
    base = f"/v1/projects/{project_id}/annotation_configs"
    item = f"{base}/{config_id}"

    await httpx_client.put(item)

    # Unassigning removes the link without deleting the underlying config.
    response = await httpx_client.delete(item)
    assert response.status_code == 204, response.text
    assert (await httpx_client.get(base)).json()["data"] == []
    assert (await httpx_client.get(f"/v1/annotation_configs/{config_id}")).status_code == 200

    # Unassigning a config that is not assigned is an idempotent no-op (204).
    response = await httpx_client.delete(item)
    assert response.status_code == 204, response.text


async def test_set_project_annotation_configs_replaces_the_whole_set(
    httpx_client: AsyncClient,
) -> None:
    project_id = await _create_project(httpx_client, "bulk-project")
    config_a = await _create_config(httpx_client, "bulk-config-a")
    config_b = await _create_config(httpx_client, "bulk-config-b")
    config_c = await _create_config(httpx_client, "bulk-config-c")
    base = f"/v1/projects/{project_id}/annotation_configs"

    # Start with A assigned.
    await httpx_client.put(f"{base}/{config_a['id']}")

    # Replace the set with {B, C}: A is removed, B and C are added.
    body = {"annotation_config_ids": [config_b["id"], config_c["id"]]}
    response = await httpx_client.put(base, json=body)
    assert response.status_code == 200, response.text
    assert {item["id"] for item in response.json()["data"]} == {config_b["id"], config_c["id"]}

    response = await httpx_client.get(base)
    assert {item["id"] for item in response.json()["data"]} == {config_b["id"], config_c["id"]}

    # An empty array clears all assignments.
    response = await httpx_client.put(base, json={"annotation_config_ids": []})
    assert response.status_code == 200, response.text
    assert response.json()["data"] == []
    assert (await httpx_client.get(base)).json()["data"] == []


async def test_assign_with_missing_project_or_config_returns_404(
    httpx_client: AsyncClient,
) -> None:
    project_id = await _create_project(httpx_client, "missing-project")
    config = await _create_config(httpx_client, "missing-config")

    # Unknown project.
    response = await httpx_client.put(
        f"/v1/projects/does-not-exist/annotation_configs/{config['id']}"
    )
    assert response.status_code == 404, response.text

    # Unknown config.
    response = await httpx_client.put(
        f"/v1/projects/{project_id}/annotation_configs/does-not-exist"
    )
    assert response.status_code == 404, response.text


async def test_set_project_annotation_configs_with_unknown_id_returns_422(
    httpx_client: AsyncClient,
) -> None:
    project_id = await _create_project(httpx_client, "bulk-422-project")
    base = f"/v1/projects/{project_id}/annotation_configs"

    # A malformed (non-GlobalID) value in the body is a 422.
    response = await httpx_client.put(base, json={"annotation_config_ids": ["not-a-global-id"]})
    assert response.status_code == 422, response.text

    # A well-formed GlobalID that refers to a nonexistent config is also a 422.
    config = await _create_config(httpx_client, "bulk-422-config")
    await httpx_client.delete(f"/v1/annotation_configs/{config['id']}")
    response = await httpx_client.put(base, json={"annotation_config_ids": [config["id"]]})
    assert response.status_code == 422, response.text


@pytest.fixture
async def annotation_configs(db: DbSessionFactory) -> list[models.AnnotationConfig]:
    """
    Creates five annotation configs.
    """
    configs = []
    async with db() as session:
        for index in range(5):
            config = models.AnnotationConfig(
                name=f"config-name-{index}",
                config=CategoricalAnnotationConfig(
                    type=AnnotationType.CATEGORICAL.value,
                    description=f"config-description-{index}",
                    optimization_direction=OptimizationDirection.MAXIMIZE,
                    values=[
                        CategoricalAnnotationValue(label="Good", score=1.0),
                        CategoricalAnnotationValue(label="Bad", score=0.0),
                    ],
                ),
            )
            session.add(config)
            configs.append(config)
        await session.flush()
    return configs


@pytest.mark.parametrize(
    "limit,expected_page_size,expected_next_cursor",
    [
        pytest.param(
            4,
            4,
            str(GlobalID("CategoricalAnnotationConfig", str(2))),
            id="page_size_less_than_total_has_next_cursor",
        ),
        pytest.param(
            5,
            5,
            str(GlobalID("CategoricalAnnotationConfig", str(1))),
            id="page_size_less_than_total_has_next_cursor_for_seeded_config",
        ),
        pytest.param(
            6,
            6,
            None,
            id="page_size_greater_than_total_no_next_cursor",
        ),
    ],
)
async def test_list_annotation_configs_pagination_without_cursor(
    httpx_client: AsyncClient,
    annotation_configs: list[models.AnnotationConfig],
    limit: int,
    expected_page_size: int,
    expected_next_cursor: Optional[str],
) -> None:
    response = await httpx_client.get(f"/v1/annotation_configs?limit={limit}")
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == expected_page_size
    assert data["next_cursor"] == expected_next_cursor


@pytest.mark.parametrize(
    "limit,expected_page_size,expected_next_cursor",
    [
        pytest.param(
            2,
            2,
            str(GlobalID("CategoricalAnnotationConfig", str(2))),
            id="page_size_less_than_remaining_has_next_cursor",
        ),
        pytest.param(
            3,
            3,
            str(GlobalID("CategoricalAnnotationConfig", str(1))),
            id="page_size_equals_remaining_no_next_cursor",
        ),
        pytest.param(
            4,
            4,
            None,
            id="page_size_greater_than_remaining_no_next_cursor",
        ),
    ],
)
async def test_list_annotation_configs_pagination_with_cursor(
    httpx_client: AsyncClient,
    annotation_configs: list[models.AnnotationConfig],
    limit: int,
    expected_page_size: int,
    expected_next_cursor: Optional[str],
) -> None:
    # First get first page
    first_response = await httpx_client.get("/v1/annotation_configs?limit=2")
    assert first_response.status_code == 200
    first_data = first_response.json()
    assert len(first_data["data"]) == 2
    cursor = first_data["next_cursor"]
    assert cursor is not None

    # Then get second page using cursor
    response = await httpx_client.get(f"/v1/annotation_configs?limit={limit}&cursor={cursor}")
    assert response.status_code == 200
    data = response.json()
    assert len(data["data"]) == expected_page_size
    assert data["next_cursor"] == expected_next_cursor
