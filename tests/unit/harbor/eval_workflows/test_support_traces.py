from __future__ import annotations

import json
from importlib import import_module

import pytest

_support_traces = import_module("evals.harbor.datasets.eval-workflows.fixtures.support_traces")
BASE, Trace = _support_traces.BASE, _support_traces.Trace


@pytest.mark.parametrize(
    ("result", "expected_value", "expected_mime_type"),
    [
        ({"status": "ok"}, json.dumps({"status": "ok"}), "application/json"),
        ("CarrierTimeout", "CarrierTimeout", "text/plain"),
    ],
)
def test_tool_output_mime_type_matches_payload(
    result: object, expected_value: str, expected_mime_type: str
) -> None:
    trace = Trace("tool-output-mime-type", start=BASE)

    span = trace.tool("lookup", {"id": "A-1"}, result)

    assert span["attributes"]["output.value"] == expected_value
    assert span["attributes"]["output.mime_type"] == expected_mime_type
