from __future__ import annotations

import logging
from collections import defaultdict
from functools import partial

import httpx
import pytest

import phoenix.server.api.routers.v1.client_errors as client_errors_module
from phoenix.server.rate_limiters import TokenBucket

REPORT = {
    "message": "Cannot read properties of undefined (reading 'id')",
    "stack": "TypeError: Cannot read properties of undefined\n    at SpanDetails (index.js:1:2)",
    "component_stack": "\n    at SpanDetails\n    at ErrorBoundary",
    "url": "/projects/UHJvamVjdDox/spans",
    "user_agent": "Mozilla/5.0",
    "platform_version": "20.22.0",
}


class TestReportClientError:
    async def test_report_is_logged_at_error_level_with_fields(
        self,
        httpx_client: httpx.AsyncClient,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        with caplog.at_level(logging.ERROR, logger="phoenix.client_errors"):
            response = await httpx_client.post("v1/client_errors", json=REPORT)
        assert response.status_code == 204, response.text

        records = [record for record in caplog.records if record.name == "phoenix.client_errors"]
        assert len(records) == 1
        record = records[0]
        assert record.levelno == logging.ERROR
        assert REPORT["message"] in record.getMessage()
        assert REPORT["url"] in record.getMessage()
        for field_name, value in REPORT.items():
            assert getattr(record, f"client_error.{field_name}") == value

    async def test_message_alone_is_enough(self, httpx_client: httpx.AsyncClient) -> None:
        response = await httpx_client.post("v1/client_errors", json={"message": "boom"})
        assert response.status_code == 204, response.text

    @pytest.mark.parametrize(
        "body",
        [
            pytest.param({}, id="missing-message"),
            pytest.param({"message": ""}, id="empty-message"),
            pytest.param(
                {"message": "x" * (client_errors_module.MESSAGE_MAX_LENGTH + 1)},
                id="oversized-message",
            ),
            pytest.param(
                {"message": "boom", "stack": "x" * (client_errors_module.STACK_MAX_LENGTH + 1)},
                id="oversized-stack",
            ),
            pytest.param({"message": "bo\x00om"}, id="null-byte-in-message"),
            pytest.param({"message": "boom", "url": "/a\x00b"}, id="null-byte-in-url"),
        ],
    )
    async def test_invalid_report_is_rejected(
        self,
        httpx_client: httpx.AsyncClient,
        caplog: pytest.LogCaptureFixture,
        body: dict[str, str],
    ) -> None:
        with caplog.at_level(logging.ERROR, logger="phoenix.client_errors"):
            response = await httpx_client.post("v1/client_errors", json=body)
        assert response.status_code == 422, response.text
        assert not [r for r in caplog.records if r.name == "phoenix.client_errors"]

    async def test_reports_over_the_limit_are_rejected_with_429(
        self,
        httpx_client: httpx.AsyncClient,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        rate_limiter = client_errors_module.rate_limiter
        two_token_bucket = partial(
            TokenBucket, per_second_request_rate=0.001, enforcement_window_seconds=2_000
        )
        monkeypatch.setattr(rate_limiter, "bucket_factory", two_token_bucket)
        monkeypatch.setattr(
            rate_limiter,
            "cache_partitions",
            [defaultdict(two_token_bucket) for _ in range(rate_limiter.num_partitions)],
        )

        statuses = [
            (await httpx_client.post("v1/client_errors", json=REPORT)).status_code for _ in range(3)
        ]
        assert statuses == [204, 204, 429]
