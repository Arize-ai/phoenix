from httpx import AsyncClient

from phoenix.db.types.annotation_configs import AnnotationType, OptimizationDirection


async def test_categorical_annotation_config_crud_operations(
    httpx_client: AsyncClient,
) -> None:
    # Create a categorical annotation config
    create_response = await httpx_client.post(
        "/v1/annotation_configs",
        json={
            "name": "categorical-config-name",
            "type": AnnotationType.CATEGORICAL.value,
            "description": "Test description",
            "optimization_direction": OptimizationDirection.MAXIMIZE.value,
            "values": [
                {"label": "Good", "score": 1.0},
                {"label": "Bad", "score": 0.0},
            ],
        },
    )
    assert create_response.status_code == 200
    created_config = create_response.json()
    config_id = created_config["id"]

    expected_config = {
        "name": "categorical-config-name",
        "id": config_id,
        "type": AnnotationType.CATEGORICAL.value,
        "description": "Test description",
        "optimization_direction": OptimizationDirection.MAXIMIZE.value,
        "values": [
            {"label": "Good", "score": 1.0},
            {"label": "Bad", "score": 0.0},
        ],
    }
    assert created_config == expected_config

    # List annotation configs
    list_response = await httpx_client.get("/v1/annotation_configs")
    assert list_response.status_code == 200
    configs = list_response.json()["data"]
    assert len(configs) == 1
    assert configs[0] == created_config

    # Get config by ID
    get_response = await httpx_client.get(f"/v1/annotation_configs/{config_id}")
    assert get_response.status_code == 200
    assert get_response.json() == created_config

    # Get config by name
    get_by_name_response = await httpx_client.get("/v1/annotation_configs/categorical-config-name")
    assert get_by_name_response.status_code == 200
    assert get_by_name_response.json() == created_config

    # Update the annotation config
    update_response = await httpx_client.put(
        f"/v1/annotation_configs/{config_id}",
        json={
            "name": "updated-categorical-config-name",
            "type": AnnotationType.CATEGORICAL.value,
            "description": "Updated description",
            "optimization_direction": OptimizationDirection.MINIMIZE.value,
            "values": [
                {"label": "Excellent", "score": 1.0},
                {"label": "Poor", "score": 0.0},
            ],
        },
    )
    assert update_response.status_code == 200
    updated_config = update_response.json()
    expected_updated_config = {
        "name": "updated-categorical-config-name",
        "id": config_id,
        "type": AnnotationType.CATEGORICAL.value,
        "description": "Updated description",
        "optimization_direction": OptimizationDirection.MINIMIZE.value,
        "values": [
            {"label": "Excellent", "score": 1.0},
            {"label": "Poor", "score": 0.0},
        ],
    }
    assert updated_config == expected_updated_config

    # Delete the annotation config
    delete_response = await httpx_client.delete(f"/v1/annotation_configs/{config_id}")
    assert delete_response.status_code == 200
    assert delete_response.json() == expected_updated_config

    # Verify the config is deleted by listing
    list_response = await httpx_client.get("/v1/annotation_configs")
    assert list_response.status_code == 200
    configs = list_response.json()["data"]
    assert len(configs) == 0

    # Verify the config is deleted by getting
    get_response = await httpx_client.get(f"/v1/annotation_configs/{config_id}")
    assert get_response.status_code == 404


async def test_categorical_annotation_config_validation(
    httpx_client: AsyncClient,
) -> None:
    # Test reserved name
    response = await httpx_client.post(
        "/v1/annotation_configs",
        json={
            "name": "note",  # Reserved name
            "type": AnnotationType.CATEGORICAL.value,
            "description": "Test description",
            "optimization_direction": OptimizationDirection.MAXIMIZE.value,
            "values": [
                {"label": "Good", "score": 1.0},
                {"label": "Bad", "score": 0.0},
            ],
        },
    )
    assert response.status_code == 400
    assert "The name 'note' is reserved" in response.text

    # Test duplicate name
    # First create a config
    response = await httpx_client.post(
        "/v1/annotation_configs",
        json={
            "name": "Test Config",
            "type": AnnotationType.CATEGORICAL.value,
            "description": "Test description",
            "optimization_direction": OptimizationDirection.MAXIMIZE.value,
            "values": [
                {"label": "Good", "score": 1.0},
                {"label": "Bad", "score": 0.0},
            ],
        },
    )
    assert response.status_code == 200

    # Try to create another config with same name
    response = await httpx_client.post(
        "/v1/annotation_configs",
        json={
            "name": "Test Config",
            "type": AnnotationType.CATEGORICAL.value,
            "description": "Test description",
            "optimization_direction": OptimizationDirection.MAXIMIZE.value,
            "values": [
                {"label": "Good", "score": 1.0},
                {"label": "Bad", "score": 0.0},
            ],
        },
    )
    assert response.status_code == 409
    assert "name of the annotation configuration is already taken" in response.text

    # Test invalid config ID
    response = await httpx_client.get("/v1/annotation_configs/invalid-id")
    assert response.status_code == 404

    # Test invalid config type
    response = await httpx_client.post(
        "/v1/annotation_configs",
        json={
            "name": "Test Config",
            "type": "INVALID_TYPE",
            "description": "Test description",
            "optimization_direction": OptimizationDirection.MAXIMIZE.value,
            "values": [
                {"label": "Good", "score": 1.0},
                {"label": "Bad", "score": 0.0},
            ],
        },
    )
    assert response.status_code == 422  # Validation error
