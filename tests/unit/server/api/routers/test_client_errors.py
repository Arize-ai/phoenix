from __future__ import annotations

import logging
from collections import defaultdict
from functools import partial
from typing import Any

import httpx2
import pytest

import phoenix.server.api.routers.client_errors as client_errors_module
from phoenix.server.api.routers.client_errors import route_path, strip_origins
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
        httpx_client: httpx2.AsyncClient,
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

    async def test_url_is_logged_as_the_route_only(
        self,
        httpx_client: httpx2.AsyncClient,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        url = "https://phoenix.example.com/projects/UHJvamVjdDox/spans?filter=name+%3D%3D+%27secret%27#top"
        with caplog.at_level(logging.ERROR, logger="phoenix.client_errors"):
            response = await httpx_client.post("client_errors", json={**REPORT, "url": url})
        assert response.status_code == 204, response.text

        (record,) = _error_records(caplog)
        assert (
            record.getMessage()
            == f"Client error at /projects/UHJvamVjdDox/spans: {REPORT['message']}"
        )
        assert getattr(record, "error.url") == "/projects/UHJvamVjdDox/spans"

    async def test_stack_and_message_urls_are_logged_without_their_origin(
        self,
        httpx_client: httpx2.AsyncClient,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        report = {
            **REPORT,
            "message": "Failed to fetch https://phoenix.example.com/graphql",
            "stack": (
                "TypeError: Failed to fetch\n"
                "    at fetchJson (https://phoenix.example.com/assets/index-Bx1.js:12:3456)\n"
                "    at https://phoenix.example.com/assets/vendor-9f.js:1:2"
            ),
        }
        with caplog.at_level(logging.ERROR, logger="phoenix.client_errors"):
            response = await httpx_client.post("client_errors", json=report)
        assert response.status_code == 204, response.text

        (record,) = _error_records(caplog)
        assert record.getMessage() == f"Client error at {REPORT['url']}: Failed to fetch /graphql"
        assert getattr(record, "error.message") == "Failed to fetch /graphql"
        assert getattr(record, "error.stack") == (
            "TypeError: Failed to fetch\n"
            "    at fetchJson (/assets/index-Bx1.js:12:3456)\n"
            "    at /assets/vendor-9f.js:1:2"
        )

    async def test_message_alone_is_enough(self, httpx_client: httpx2.AsyncClient) -> None:
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
        httpx_client: httpx2.AsyncClient,
        caplog: pytest.LogCaptureFixture,
        body: dict[str, Any],
    ) -> None:
        with caplog.at_level(logging.ERROR, logger="phoenix.client_errors"):
            response = await httpx_client.post("client_errors", json=body)
        assert response.status_code == 422, response.text
        assert not _error_records(caplog)

    async def test_reports_over_the_limit_are_rejected_with_429(
        self,
        httpx_client: httpx2.AsyncClient,
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


@pytest.mark.parametrize(
    "url,root_path,expected",
    [
        pytest.param(None, "", None, id="absent"),
        pytest.param("/projects/abc/spans", "", "/projects/abc/spans", id="route-unchanged"),
        pytest.param("/projects/abc/spans?filter=x", "", "/projects/abc/spans", id="query-dropped"),
        pytest.param(
            "https://phoenix.example.com/projects/abc#top", "", "/projects/abc", id="origin-dropped"
        ),
        pytest.param("/s/acme/projects/abc", "/s/acme", "/projects/abc", id="root-path-dropped"),
        pytest.param("/s/acme", "/s/acme", "/", id="root-path-alone"),
        pytest.param("/s/acme-corp/projects", "/s/acme", "/s/acme-corp/projects", id="prefix-only"),
    ],
)
def test_route_path(url: str | None, root_path: str, expected: str | None) -> None:
    assert route_path(url, root_path=root_path) == expected


@pytest.mark.parametrize(
    "text,root_path,expected",
    [
        pytest.param(None, "", None, id="absent"),
        pytest.param(
            "at SpanDetails (index.js:1:2)", "", "at SpanDetails (index.js:1:2)", id="no-url"
        ),
        pytest.param(
            "at f (https://phoenix.example.com/assets/a.js:1:2)",
            "",
            "at f (/assets/a.js:1:2)",
            id="chrome-frame",
        ),
        pytest.param(
            "f@https://phoenix.example.com:6006/assets/a.js:1:2",
            "",
            "f@/assets/a.js:1:2",
            id="firefox-frame-with-port",
        ),
        pytest.param(
            "at f (https://phoenix.example.com/s/acme/assets/a.js:1:2)",
            "/s/acme",
            "at f (/assets/a.js:1:2)",
            id="root-path-dropped",
        ),
        pytest.param(
            "Failed to fetch https://phoenix.example.com/s/acme",
            "/s/acme",
            "Failed to fetch ",
            id="root-path-alone",
        ),
        pytest.param(
            "Failed to fetch https://phoenix.example.com/s/acme-corp/graphql",
            "/s/acme",
            "Failed to fetch /s/acme-corp/graphql",
            id="prefix-only",
        ),
        pytest.param(
            "at a (http://localhost:6006/x.js:1:1)\n    at b (http://localhost:6006/y.js:2:2)",
            "",
            "at a (/x.js:1:1)\n    at b (/y.js:2:2)",
            id="every-frame",
        ),
    ],
)
def test_strip_origins(text: str | None, root_path: str, expected: str | None) -> None:
    assert strip_origins(text, root_path=root_path) == expected
