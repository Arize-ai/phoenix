from __future__ import annotations

import logging
from collections import defaultdict
from functools import partial
from typing import Any

import httpx
import pytest

import phoenix.server.api.routers.client_errors as client_errors_module
from phoenix.server.rate_limiters import TokenBucket

REPORT: dict[str, Any] = {
    "message": "Cannot read properties of undefined (reading 'id')",
    "stack": "TypeError: Cannot read properties of undefined\n    at SpanDetails (index.js:1:2)",
    "url": "/projects/UHJvamVjdDox/spans",
    "user_agent": "Mozilla/5.0",
    "attributes": {
        "component_stack": "\n    at SpanDetails\n    at ErrorBoundary",
        "platform_version": "20.22.0",
    },
}


def _error_records(caplog: pytest.LogCaptureFixture) -> list[logging.LogRecord]:
    return [record for record in caplog.records if record.name == "phoenix.client_errors"]


class TestReportClientError:
    async def test_report_is_logged_at_error_level_with_fields(
        self,
        httpx_client: httpx.AsyncClient,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        with caplog.at_level(logging.ERROR, logger="phoenix.client_errors"):
            response = await httpx_client.post("client_errors", json=REPORT)
        assert response.status_code == 204, response.text

        records = _error_records(caplog)
        assert len(records) == 1
        record = records[0]
        assert record.levelno == logging.ERROR
        assert record.getMessage() == f"Client error at {REPORT['url']}: {REPORT['message']}"
        for field_name in ("message", "stack", "url", "user_agent"):
            assert getattr(record, f"error.{field_name}") == REPORT[field_name]
        for key, value in REPORT["attributes"].items():
            assert getattr(record, f"error.attributes.{key}") == value

    async def test_message_alone_is_enough(self, httpx_client: httpx.AsyncClient) -> None:
        response = await httpx_client.post("client_errors", json={"message": "boom"})
        assert response.status_code == 204, response.text

    @pytest.mark.parametrize(
        "body",
        [
            pytest.param({}, id="missing-message"),
            pytest.param({"message": ""}, id="empty-message"),
            pytest.param({"message": "boom", "attributes": {"key": 1}}, id="non-string-attribute"),
            pytest.param({"message": "bo\x00om"}, id="null-byte-in-message"),
            pytest.param({"message": "boom", "url": "/a\x00b"}, id="null-byte-in-url"),
            pytest.param(
                {"message": "boom", "attributes": {"key": "a\x00b"}},
                id="null-byte-in-attribute",
            ),
        ],
    )
    async def test_invalid_report_is_rejected(
        self,
        httpx_client: httpx.AsyncClient,
        caplog: pytest.LogCaptureFixture,
        body: dict[str, Any],
    ) -> None:
        with caplog.at_level(logging.ERROR, logger="phoenix.client_errors"):
            response = await httpx_client.post("client_errors", json=body)
        assert response.status_code == 422, response.text
        assert not _error_records(caplog)

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
            (await httpx_client.post("client_errors", json=REPORT)).status_code for _ in range(3)
        ]
        assert statuses == [204, 204, 429]
