from __future__ import annotations

import asyncio
import http.client
import io
import json
import logging
import threading
import urllib.error
import urllib.request
from contextlib import AsyncExitStack
from email.message import Message
from typing import Any, Callable, Optional
from unittest.mock import patch

import pytest
from asgi_lifespan import LifespanManager

from phoenix.db.facilitator import _ensure_enums
from phoenix.server.app import create_app
from phoenix.server.cost_tracking.apply_manifest import get_applied_manifest_version
from phoenix.server.cost_tracking.manifest import (
    DEFAULT_MANIFEST_URL,
    SUPPORTED_SCHEMA_VERSION,
    ManifestError,
)
from phoenix.server.daemons import model_cost_manifest_fetcher as fetcher_module
from phoenix.server.daemons.model_cost_manifest_fetcher import (
    _MAX_MANIFEST_BYTES,
    ModelCostManifestFetcher,
    _download,
)
from phoenix.server.types import DbSessionFactory
from tests.unit.conftest import TestBulkInserter, patch_dml_event_handler, patch_grpc_server
from tests.unit.server.cost_tracking.test_apply_manifest import _active_built_in_prices

# The suite stubs the fetcher's loop; these tests drive the real one.
pytestmark = pytest.mark.real_model_cost_fetcher

_URLOPEN = "phoenix.server.daemons.model_cost_manifest_fetcher.urllib.request.urlopen"
_SLEEP = "phoenix.server.daemons.model_cost_manifest_fetcher.sleep"
_URL = "https://example.com/manifests/v1.json"


def _manifest_body(generated_at: str = "2026-10-01T00:00:00Z") -> bytes:
    return json.dumps(
        {
            "schema_version": SUPPORTED_SCHEMA_VERSION,
            "generated_at": generated_at,
            "models": [
                {
                    "name": "test-model",
                    "name_pattern": "(?i)^(test-model)$",
                    "token_prices": [
                        {"base_rate": 1.0, "is_prompt": True, "token_type": "input"},
                    ],
                }
            ],
        }
    ).encode()


class _Response(io.BytesIO):
    """A urlopen response: a context manager that read() drains."""


def _http_error(code: int) -> urllib.error.HTTPError:
    return urllib.error.HTTPError(_URL, code, "error", Message(), None)


def _fetcher(db: DbSessionFactory, url: str = _URL) -> ModelCostManifestFetcher:
    return ModelCostManifestFetcher(db, url)


def _info_messages(caplog: pytest.LogCaptureFixture) -> list[str]:
    return [
        record.getMessage()
        for record in caplog.records
        if record.name == fetcher_module.__name__ and record.levelno == logging.INFO
    ]


class TestDownload:
    def test_returns_the_body(self) -> None:
        with patch(_URLOPEN, return_value=_Response(b"body")) as urlopen:
            assert _download(_URL) == b"body"
        assert urlopen.call_args.args[0] == _URL
        assert urlopen.call_args.kwargs["timeout"] == fetcher_module._TIMEOUT_SECONDS

    def test_oversized_body_raises(self) -> None:
        with patch(_URLOPEN, return_value=_Response(b"x" * (_MAX_MANIFEST_BYTES + 1))):
            with pytest.raises(ManifestError, match="larger than"):
                _download(_URL)

    def test_reads_a_file_url(self, tmp_path: Any) -> None:
        path = tmp_path / "v1.json"
        path.write_bytes(_manifest_body())
        assert _download(path.as_uri()) == _manifest_body()


class TestFetchAndApply:
    async def test_applies_a_newer_manifest_and_logs_the_url(
        self, db: DbSessionFactory, caplog: pytest.LogCaptureFixture
    ) -> None:
        await _ensure_enums(db)
        fetcher = _fetcher(db)
        with (
            patch(_URLOPEN, return_value=_Response(_manifest_body())),
            caplog.at_level(logging.INFO, logger=fetcher_module.__name__),
        ):
            await fetcher._fetch_and_apply()

        assert await _active_built_in_prices(db) == {"test-model": 1.0}
        async with db() as session:
            marker = await get_applied_manifest_version(session)
        assert marker is not None
        (message,) = _info_messages(caplog)
        assert _URL in message

    async def test_manifest_not_newer_is_not_applied(
        self, db: DbSessionFactory, caplog: pytest.LogCaptureFixture
    ) -> None:
        await _ensure_enums(db)
        fetcher = _fetcher(db)
        with patch(_URLOPEN, return_value=_Response(_manifest_body())):
            await fetcher._fetch_and_apply()
        with (
            patch(_URLOPEN, return_value=_Response(_manifest_body())),
            caplog.at_level(logging.INFO, logger=fetcher_module.__name__),
        ):
            await fetcher._fetch_and_apply()
        assert _info_messages(caplog) == []


class TestRun:
    # Factories, since a response can be read only once and each dialect's run needs its own.
    @pytest.mark.parametrize(
        "make_failure",
        [
            pytest.param(lambda: urllib.error.URLError("unreachable"), id="url-error"),
            pytest.param(lambda: _http_error(500), id="http-error"),
            pytest.param(lambda: http.client.IncompleteRead(b""), id="incomplete-read"),
            pytest.param(lambda: _Response(b"not json"), id="bad-json"),
        ],
    )
    async def test_failures_are_logged_and_the_loop_carries_on(
        self,
        db: DbSessionFactory,
        make_failure: Callable[[], Any],
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        await _ensure_enums(db)
        fetcher = _fetcher(db)
        responses = [make_failure(), _Response(_manifest_body())]

        def urlopen(*_: Any, **__: Any) -> Any:
            response = responses.pop(0)
            if isinstance(response, BaseException):
                raise response
            return response

        sleeps: list[float] = []

        async def sleep(seconds: float) -> None:
            sleeps.append(seconds)
            fetcher._running = len(sleeps) < 2

        fetcher._running = True
        with (
            patch(_URLOPEN, side_effect=urlopen),
            patch(_SLEEP, sleep),
            caplog.at_level(logging.WARNING, logger=fetcher_module.__name__),
        ):
            await fetcher._run()

        warnings = [r for r in caplog.records if r.name == fetcher_module.__name__]
        assert len(warnings) == 1
        assert warnings[0].levelno == logging.WARNING
        assert warnings[0].exc_info is None
        assert _URL in warnings[0].getMessage()
        # The second fetch still ran and applied.
        assert await _active_built_in_prices(db) == {"test-model": 1.0}

    async def test_unexpected_errors_are_logged_and_the_loop_carries_on(
        self,
        db: DbSessionFactory,
        caplog: pytest.LogCaptureFixture,
    ) -> None:
        await _ensure_enums(db)
        fetcher = _fetcher(db)
        sleeps: list[float] = []

        async def sleep(seconds: float) -> None:
            sleeps.append(seconds)
            fetcher._running = len(sleeps) < 2

        fetcher._running = True
        with (
            patch(_URLOPEN, side_effect=lambda *_, **__: _Response(_manifest_body())),
            patch.object(
                fetcher_module,
                "apply_manifest_if_newer",
                side_effect=[RuntimeError("boom"), None],
            ) as apply,
            patch(_SLEEP, sleep),
            caplog.at_level(logging.WARNING, logger=fetcher_module.__name__),
        ):
            await fetcher._run()

        (record,) = [r for r in caplog.records if r.name == fetcher_module.__name__]
        assert record.levelno == logging.ERROR
        assert record.exc_info is not None
        assert _URL in record.getMessage()
        # The second fetch still ran.
        assert apply.await_count == 2

    async def test_fetches_on_every_iteration(self, db: DbSessionFactory) -> None:
        fetcher = _fetcher(db)
        sleeps: list[float] = []

        async def sleep(seconds: float) -> None:
            sleeps.append(seconds)
            fetcher._running = len(sleeps) < 3

        fetcher._running = True
        with (
            patch(_URLOPEN, side_effect=_http_error(500)) as urlopen,
            patch(_SLEEP, sleep),
        ):
            await fetcher._run()
        assert urlopen.call_count == 3


class TestAppWiring:
    @pytest.mark.parametrize(
        "env, read_only, expected_url",
        [
            pytest.param({}, False, DEFAULT_MANIFEST_URL, id="default"),
            pytest.param({"PHOENIX_MODEL_COST_MANIFEST_URL": _URL}, True, None, id="read-only"),
        ],
    )
    async def test_fetcher_is_built_only_when_there_is_a_url_to_fetch(
        self,
        db: DbSessionFactory,
        monkeypatch: pytest.MonkeyPatch,
        env: dict[str, str],
        read_only: bool,
        expected_url: Optional[str],
    ) -> None:
        for name in (
            "PHOENIX_ALLOW_EXTERNAL_RESOURCES",
            "PHOENIX_MODEL_COST_MANIFEST_URL",
            "PHOENIX_DISABLE_MODEL_COST_FETCH",
        ):
            monkeypatch.delenv(name, raising=False)
        for name, value in env.items():
            monkeypatch.setenv(name, value)
        with patch("phoenix.server.app.ModelCostManifestFetcher") as fetcher_cls:
            create_app(
                db=db,
                authentication_enabled=False,
                serve_ui=False,
                read_only=read_only,
                bulk_inserter_factory=TestBulkInserter,
            )
        if expected_url is None:
            fetcher_cls.assert_not_called()
        else:
            fetcher_cls.assert_called_once()
            assert fetcher_cls.call_args.args[1] == expected_url

    async def test_lifespan_starts_and_stops_while_the_fetch_hangs(
        self,
        db: DbSessionFactory,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        monkeypatch.setenv("PHOENIX_MODEL_COST_MANIFEST_URL", _URL)
        monkeypatch.delenv("PHOENIX_DISABLE_MODEL_COST_FETCH", raising=False)
        fetch_started = threading.Event()
        release = threading.Event()

        def urlopen(*_: Any, **__: Any) -> Any:
            fetch_started.set()
            release.wait(timeout=30)
            raise TimeoutError("timed out")

        try:
            with patch(_URLOPEN, side_effect=urlopen):
                async with AsyncExitStack() as stack:
                    await stack.enter_async_context(patch_dml_event_handler())
                    await stack.enter_async_context(patch_grpc_server())
                    app = create_app(
                        db=db,
                        authentication_enabled=False,
                        serve_ui=False,
                        bulk_inserter_factory=TestBulkInserter,
                    )
                    async with LifespanManager(app):
                        assert await asyncio.to_thread(fetch_started.wait, 10)
        finally:
            release.set()
