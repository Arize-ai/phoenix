from unittest.mock import MagicMock

import httpx
import pytest
from fastapi import FastAPI

from phoenix.server.api.routers.v1 import utils
from phoenix.server.api.routers.v1.spans import router as spans_router
from phoenix.server.api.routers.v1.traces import router as traces_router
from phoenix.server.authorization import is_not_locked


@pytest.mark.parametrize("path", ["/v1/projects/project/spans", "/v1/traces"])
async def test_full_span_queue_rejects_ingestion_before_database_access(
    path: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    rejections = MagicMock()
    monkeypatch.setattr(utils, "SPAN_QUEUE_REJECTIONS", rejections)
    app = FastAPI()
    app.include_router(spans_router, prefix="/v1")
    app.include_router(traces_router, prefix="/v1")
    app.dependency_overrides[is_not_locked] = lambda: None
    app.state.span_queue_is_full = lambda: True
    app.state.db = MagicMock(side_effect=AssertionError("must reject before database access"))
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(path, json={"data": []})
    assert response.status_code == 503
    assert response.json() == {"detail": "Server is at capacity and cannot process more requests"}
    app.state.db.assert_not_called()
    rejections.inc.assert_called_once_with()


def test_create_spans_documents_capacity_response() -> None:
    app = FastAPI()
    app.include_router(spans_router, prefix="/v1")
    responses = app.openapi()["paths"]["/v1/projects/{project_identifier}/spans"]["post"][
        "responses"
    ]
    assert "503" in responses
