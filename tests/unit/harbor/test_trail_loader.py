import json
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest

from scripts import load_patronus_trail as loader


@pytest.mark.parametrize("scores_on_trace", [False, True])
def test_annotations_are_persisted_when_loading_returns(
    tmp_path: Path, scores_on_trace: bool
) -> None:
    trace_id = "1" * 32
    span_id = "2" * 16
    rows = tmp_path / "rows.json"
    rows.write_text(
        json.dumps(
            [
                {
                    "trace": json.dumps(
                        {
                            "trace_id": trace_id,
                            "spans": [
                                {
                                    "trace_id": trace_id,
                                    "span_id": span_id,
                                    "timestamp": "2025-03-19T16:40:00Z",
                                    "duration": "PT1S",
                                }
                            ],
                        }
                    ),
                    "labels": json.dumps(
                        {
                            "errors": [
                                {"location": span_id, "category": f"error-{i}", "impact": "HIGH"}
                                for i in range(101)
                            ],
                            "scores": [{"reliability_score": 3.0}],
                        }
                    ),
                }
            ]
        )
    )
    persisted_spans: list[dict[str, Any]] = []
    persisted_traces: list[dict[str, Any]] = []

    def log_span_annotations(*, span_annotations: list[dict[str, Any]], sync: bool = False) -> None:
        if sync:
            persisted_spans.extend(span_annotations)

    def log_trace_annotations(
        *, trace_annotations: list[dict[str, Any]], sync: bool = False
    ) -> None:
        if sync:
            persisted_traces.extend(trace_annotations)

    client = MagicMock()
    client.spans.get_spans.return_value = [{"context": {"span_id": span_id}}]
    client.spans.log_span_annotations.side_effect = log_span_annotations
    client.traces.log_trace_annotations.side_effect = log_trace_annotations
    loader._load_source(
        client,
        "gaia",
        rows,
        None,
        shift_to_now=False,
        annotations=True,
        scores_on_trace=scores_on_trace,
        mapper=loader.IdMapper(regenerate=False),
    )

    assert len(persisted_spans) == (101 if scores_on_trace else 102)
    assert len(persisted_traces) == (1 if scores_on_trace else 0)
    reliability = next(
        a for a in persisted_spans + persisted_traces if a["name"] == "trail_reliability"
    )
    assert reliability["result"]["score"] == 3.0
