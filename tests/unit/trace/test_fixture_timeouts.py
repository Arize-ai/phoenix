"""Regression tests: trace fixture HTTP calls must use bounded timeouts.

Covers issues #13744, #13745, #13746. Previously the fixture download used
``urllib.request.urlopen`` with no timeout (genuinely unbounded), and the
readiness probe / upload relied on httpx's implicit 5s default (too long for the
startup budget, too short for large uploads).
"""

from types import SimpleNamespace
from unittest import mock

import phoenix.trace.fixtures as fixtures
import phoenix.trace.utils as trace_utils


def test_download_json_traces_fixture_passes_bounded_timeout() -> None:
    captured: dict = {}

    class _Resp:
        def __enter__(self) -> "_Resp":
            return self

        def __exit__(self, *exc: object) -> bool:
            return False

        def readlines(self) -> list[str]:
            return ["{}"]

    def fake_urlopen(url: str, *args: object, **kwargs: object) -> "_Resp":
        captured["timeout"] = kwargs.get("timeout")
        return _Resp()

    with mock.patch.object(trace_utils.request, "urlopen", side_effect=fake_urlopen):
        trace_utils.download_json_traces_fixture("https://example.com/traces.jsonl")

    assert captured["timeout"] == trace_utils.DEFAULT_FIXTURE_DOWNLOAD_TIMEOUT_SECONDS
    assert captured["timeout"] is not None


def test_send_dataset_fixtures_readiness_probe_is_bounded() -> None:
    captured: dict = {}

    class _Ok:
        def raise_for_status(self) -> None:
            return None

    def fake_get(url: str, **kwargs: object) -> "_Ok":
        captured["timeout"] = kwargs.get("timeout")
        return _Ok()

    with mock.patch.object(fixtures.httpx, "get", side_effect=fake_get):
        fixtures.send_dataset_fixtures(endpoint="http://localhost:6006", fixtures=[])

    # Bounded, and within the ~5s startup budget (not httpx's implicit 5s default).
    assert captured["timeout"] is not None
    assert 0 < captured["timeout"] <= 5


def test_send_dataset_fixtures_upload_is_bounded() -> None:
    captured: dict = {}

    class _Ok:
        def raise_for_status(self) -> None:
            return None

    def fake_post(url: str, **kwargs: object) -> "_Ok":
        captured["timeout"] = kwargs.get("timeout")
        return _Ok()

    fixture = SimpleNamespace(
        input_keys=["question"],
        output_keys=["answer"],
        metadata_keys=[],
        csv="question,answer\n",
        name="demo",
        description="demo fixture",
        dataframe=[0, 0],
    )

    with mock.patch.object(fixtures.httpx, "get", return_value=_Ok()), mock.patch.object(
        fixtures.httpx, "post", side_effect=fake_post
    ), mock.patch.object(
        fixtures, "_prepare_csv_bytes", return_value=("demo.csv", b"data", "text/csv", {})
    ):
        fixtures.send_dataset_fixtures(endpoint="http://localhost:6006", fixtures=[fixture])

    assert captured["timeout"] == fixtures.DATASET_UPLOAD_TIMEOUT_SECONDS
