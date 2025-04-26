from typing import Any

import pytest
from httpx import AsyncClient
from starlette.status import (
    HTTP_200_OK,
    HTTP_404_NOT_FOUND,
    HTTP_409_CONFLICT,
)

from phoenix.db.types.annotation_configs import AnnotationType, OptimizationDirection


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
    created_config = create_response.json()
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
    assert get_response.json() == created_config

    # Get config by name
    get_by_name_response = await httpx_client.get("/v1/annotation_configs/config-name")
    assert get_by_name_response.status_code == HTTP_200_OK
    assert get_by_name_response.json() == created_config

    # Update the annotation config
    update_response = await httpx_client.put(
        f"/v1/annotation_configs/{config_id}",
        json=update_config,
    )
    assert update_response.status_code == HTTP_200_OK
    updated_config = update_response.json()
    expected_updated_config = update_config
    expected_updated_config["id"] = config_id
    assert updated_config == expected_updated_config

    # Delete the annotation config
    delete_response = await httpx_client.delete(f"/v1/annotation_configs/{config_id}")
    assert delete_response.status_code == HTTP_200_OK
    assert delete_response.json() == expected_updated_config

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
