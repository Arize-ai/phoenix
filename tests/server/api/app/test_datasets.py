from phoenix.db import models
from sqlalchemy import select


async def test_datasets(test_client, dataset_0):
    response = test_client.get("/v1/datasets/0")
    assert response.status_code == 200
    assert response.json() == {
        "id": 0,
        "name": "dataset 0",
        "description": "a test dataset",
    }
