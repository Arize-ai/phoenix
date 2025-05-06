from copy import deepcopy
from typing import Any, Optional

import pytest
from httpx import AsyncClient
from starlette.status import (
    HTTP_200_OK,
    HTTP_400_BAD_REQUEST,
    HTTP_404_NOT_FOUND,
    HTTP_409_CONFLICT,
)
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
            },
            {
                "name": "updated-config-name",
                "type": AnnotationType.FREEFORM.value,
                "description": "Updated description",
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
    assert create_response.status_code == HTTP_200_OK
    created_config = create_response.json()["data"]
    config_id = created_config["id"]

    expected_config = create_config
    expected_config["id"] = config_id
    assert created_config == expected_config

    # List annotation configs
    list_response = await httpx_client.get("/v1/annotation_configs")
    assert list_response.status_code == HTTP_200_OK
    configs = list_response.json()["data"]
    assert len(configs) == 1
    assert configs[0] == created_config

    # Get config by ID
    get_response = await httpx_client.get(f"/v1/annotation_configs/{config_id}")
    assert get_response.status_code == HTTP_200_OK
    assert get_response.json()["data"] == created_config

    # Get config by name
    get_by_name_response = await httpx_client.get("/v1/annotation_configs/config-name")
    assert get_by_name_response.status_code == HTTP_200_OK
    assert get_by_name_response.json()["data"] == created_config

    # Update the annotation config
    update_response = await httpx_client.put(
        f"/v1/annotation_configs/{config_id}",
        json=update_config,
    )
    assert update_response.status_code == HTTP_200_OK
    updated_config = update_response.json()["data"]
    expected_updated_config = update_config
    expected_updated_config["id"] = config_id
    assert updated_config == expected_updated_config

    # Delete the annotation config
    delete_response = await httpx_client.delete(f"/v1/annotation_configs/{config_id}")
    assert delete_response.status_code == HTTP_200_OK
    assert delete_response.json()["data"] == expected_updated_config

    # Verify the config is deleted by listing
    list_response = await httpx_client.get("/v1/annotation_configs")
    assert list_response.status_code == HTTP_200_OK
    configs = list_response.json()["data"]
    assert len(configs) == 0

    # Verify the config is deleted by getting
    get_response = await httpx_client.get(f"/v1/annotation_configs/{config_id}")
    assert get_response.status_code == HTTP_404_NOT_FOUND


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
    assert response.status_code == HTTP_409_CONFLICT
    assert "The name 'note' is reserved" in response.text


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
    assert response.status_code == HTTP_200_OK
    config_id = response.json()["data"]["id"]

    # Try to update the name to "note"
    update_config = deepcopy(annotation_config)
    update_config["name"] = "note"
    response = await httpx_client.put(f"/v1/annotation_configs/{config_id}", json=update_config)
    assert response.status_code == HTTP_409_CONFLICT
    assert "The name 'note' is reserved" in response.text


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
    assert response.status_code == HTTP_200_OK

    # Try to create another config with same name
    response = await httpx_client.post("/v1/annotation_configs", json=annotation_config)
    assert response.status_code == HTTP_409_CONFLICT
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
    assert response.status_code == HTTP_400_BAD_REQUEST
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
    assert response.status_code == HTTP_200_OK

    # Create second config
    response = await httpx_client.post("/v1/annotation_configs", json=config)
    assert response.status_code == HTTP_200_OK
    config_id = response.json()["data"]["id"]

    # Try to update second config name to collide with first
    update_config = config.copy()
    update_config["name"] = "collide-config-name"
    response = await httpx_client.put(f"/v1/annotation_configs/{config_id}", json=update_config)
    assert response.status_code == HTTP_409_CONFLICT
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
    assert response.status_code == HTTP_200_OK
    config_id = response.json()["data"]["id"]

    # Try to update with invalid bounds
    update_config = config.copy()
    update_config["lower_bound"] = 1.0
    update_config["upper_bound"] = 0.0

    response = await httpx_client.put(f"/v1/annotation_configs/{config_id}", json=update_config)
    assert response.status_code == HTTP_400_BAD_REQUEST
    assert "Lower bound must be strictly less than upper bound" in response.text


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
            str(GlobalID("CategoricalAnnotationConfig", str(1))),
            id="page_size_less_than_total_has_next_cursor",
        ),
        pytest.param(
            5,
            5,
            None,
            id="page_size_equals_total_no_next_cursor",
        ),
        pytest.param(
            6,
            5,
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
    assert response.status_code == HTTP_200_OK
    data = response.json()
    assert len(data["data"]) == expected_page_size
    assert data["next_cursor"] == expected_next_cursor


@pytest.mark.parametrize(
    "limit,expected_page_size,expected_next_cursor",
    [
        pytest.param(
            2,
            2,
            str(GlobalID("CategoricalAnnotationConfig", str(1))),
            id="page_size_less_than_remaining_has_next_cursor",
        ),
        pytest.param(
            3,
            3,
            None,
            id="page_size_equals_remaining_no_next_cursor",
        ),
        pytest.param(
            4,
            3,
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
    assert first_response.status_code == HTTP_200_OK
    first_data = first_response.json()
    assert len(first_data["data"]) == 2
    cursor = first_data["next_cursor"]
    assert cursor is not None

    # Then get second page using cursor
    response = await httpx_client.get(f"/v1/annotation_configs?limit={limit}&cursor={cursor}")
    assert response.status_code == HTTP_200_OK
    data = response.json()
    assert len(data["data"]) == expected_page_size
    assert data["next_cursor"] == expected_next_cursor
