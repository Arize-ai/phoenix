"""Regression tests: trace fixture HTTP calls must use bounded timeouts.

Covers issues #13744, #13745, #13746. The fixture download previously used
``urllib.request.urlopen`` with no timeout (genuinely unbounded), and the
readiness probe / upload relied on httpx's implicit 5s default (too long for the
fixed startup budget, too short for large uploads).
"""

from types import SimpleNamespace
from typing import Any
from unittest import mock

from phoenix.trace import fixtures
from phoenix.trace import utils as trace_utils


class _FakeResponse:
    def __enter__(self) -> "_FakeResponse":
        return self

    def __exit__(self, *exc: object) -> None:
        return None

    def readlines(self) -> list[str]:
        return ["{}"]


class _FakeOkResponse:
    def raise_for_status(self) -> None:
        return None


def test_download_json_traces_fixture_passes_bounded_timeout() -> None:
    captured: dict[str, Any] = {}

    def fake_urlopen(url: str, *args: object, **kwargs: object) -> _FakeResponse:
        captured["timeout"] = kwargs.get("timeout")
        return _FakeResponse()

    with mock.patch("phoenix.trace.utils.request.urlopen", side_effect=fake_urlopen):
        trace_utils.download_json_traces_fixture("https://example.com/traces.jsonl")

    assert captured["timeout"] == trace_utils.DEFAULT_FIXTURE_DOWNLOAD_TIMEOUT_SECONDS
    assert captured["timeout"] is not None


def test_send_dataset_fixtures_readiness_probe_is_bounded() -> None:
    captured: dict[str, Any] = {}

    def fake_get(url: str, **kwargs: object) -> _FakeOkResponse:
        captured["timeout"] = kwargs.get("timeout")
        return _FakeOkResponse()

    with mock.patch("phoenix.trace.fixtures.httpx.get", side_effect=fake_get):
        fixtures.send_dataset_fixtures(endpoint="http://localhost:6006", fixtures=[])

    # Bounded, and within the ~5s startup budget (not httpx's implicit 5s default).
    assert captured["timeout"] is not None
    assert 0 < captured["timeout"] <= 5


def test_send_dataset_fixtures_upload_is_bounded() -> None:
    captured: dict[str, Any] = {}

    def fake_post(url: str, **kwargs: object) -> _FakeOkResponse:
        captured["timeout"] = kwargs.get("timeout")
        return _FakeOkResponse()

    fixture: Any = SimpleNamespace(
        input_keys=["question"],
        output_keys=["answer"],
        metadata_keys=[],
        csv="question,answer\n",
        name="demo",
        description="demo fixture",
        dataframe=[0, 0],
    )

    with (
        mock.patch("phoenix.trace.fixtures.httpx.get", return_value=_FakeOkResponse()),
        mock.patch("phoenix.trace.fixtures.httpx.post", side_effect=fake_post),
        mock.patch(
            "phoenix.trace.fixtures._prepare_csv_bytes",
            return_value=("demo.csv", b"data", "text/csv", {}),
        ),
    ):
        fixtures.send_dataset_fixtures(
            endpoint="http://localhost:6006",
            fixtures=[fixture],
        )

    assert captured["timeout"] == fixtures.DATASET_UPLOAD_TIMEOUT_SECONDS
