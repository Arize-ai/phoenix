import copy
import json
from unittest.mock import Mock

import pytest
from scripts.prepare_patronus_trail import prepare

from fixture import await_ready, seed


def row(trace_id="trace-a", span_id="span-a"):
    return {
        "trace": json.dumps(
            {
                "trace_id": trace_id,
                "spans": [
                    {
                        "trace_id": trace_id,
                        "span_id": span_id,
                        "span_name": "original synthetic test",
                        "timestamp": "2025-01-01T00:00:00Z",
                        "duration": "PT0.125S",
                        "span_attributes": {"llm.token_count.prompt": "3"},
                        "child_spans": [],
                    }
                ],
            }
        ),
        "labels": json.dumps({"errors": [], "scores": []}),
    }


def test_semantics_are_stable_across_row_order_and_repeated_preparation():
    rows = [row(), row("trace-b", "span-b")]
    first = prepare(rows, revision="a" * 40, source="gaia")
    assert first == prepare(list(reversed(rows)), revision="a" * 40, source="gaia")
    assert first["truth"]["trace_count"] == 2
    assert first["payload"]["spans"][0]["attributes"]["llm.token_count.prompt"] == 3
    assert first["payload"]["spans"][0]["end_time"].endswith("00.125000+00:00")
    assert (
        first["manifest"]["fixture_hash"]
        != prepare(rows, revision="b" * 40, source="gaia")["manifest"]["fixture_hash"]
    )


def test_duplicate_ids_empty_traces_and_dangling_annotations_fail():
    with pytest.raises(ValueError, match="Duplicate"):
        prepare([row(), row()], revision="a" * 40, source="gaia")
    bad = copy.deepcopy(row())
    bad["labels"] = json.dumps({"errors": [{"location": "missing"}]})
    with pytest.raises(ValueError, match="missing span"):
        prepare([bad], revision="a" * 40, source="gaia")
    with pytest.raises(ValueError, match="empty"):
        prepare([], revision="a" * 40, source="gaia")


def test_seed_refuses_existing_project_and_readiness_requires_state():
    client = Mock()
    client.projects.list.return_value = [{"name": "mcp-trail-gaia"}]
    fixture = prepare([row()], revision="a" * 40, source="gaia")
    with pytest.raises(ValueError, match="already exists"):
        seed(client, fixture["payload"])
    client.projects.create.assert_not_called()
    with pytest.raises(TimeoutError):
        await_ready(lambda: {"healthy": True}, fixture["truth"], timeout=0)
    await_ready(lambda: fixture["truth"], fixture["truth"], timeout=0)
