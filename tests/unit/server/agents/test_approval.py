import json

import pytest

from phoenix.server.agents.approval import (
    APPROVAL_DECISION_ATTRIBUTE,
    APPROVAL_SOURCE_ATTRIBUTE,
    approval_attributes,
)


class TestApprovalAttributes:
    @pytest.mark.parametrize("source", ["user", "auto"])
    def test_extracts_marker_from_mapping_result(self, source: str) -> None:
        result = {
            "status": "accepted",
            "acceptedBy": source,
            "approval": {"decision": "accepted", "source": source},
        }
        assert approval_attributes(result) == {
            APPROVAL_DECISION_ATTRIBUTE: "accepted",
            APPROVAL_SOURCE_ATTRIBUTE: source,
        }

    def test_extracts_marker_from_json_string_result(self) -> None:
        result = json.dumps(
            {
                "status": "rejected",
                "message": "User rejected the proposed prompt edit.",
                "approval": {"decision": "rejected", "source": "user"},
            }
        )
        assert approval_attributes(result) == {
            APPROVAL_DECISION_ATTRIBUTE: "rejected",
            APPROVAL_SOURCE_ATTRIBUTE: "user",
        }

    def test_ignores_output_without_a_marker(self) -> None:
        assert approval_attributes({"status": "loaded", "datasetId": "abc"}) == {}
        assert approval_attributes(json.dumps({"rows": [1, 2, 3]})) == {}

    @pytest.mark.parametrize(
        "marker",
        [
            {"decision": "maybe", "source": "user"},
            {"decision": "accepted", "source": "system"},
            {"decision": "accepted"},
            {"source": "user"},
            {},
            "accepted",
            None,
            [],
            {"decision": {}, "source": "user"},
            {"decision": ["accepted"], "source": "user"},
            {"decision": "accepted", "source": {"a": 1}},
            {"decision": "accepted", "source": ["user"]},
        ],
    )
    def test_ignores_malformed_markers(self, marker: object) -> None:
        assert approval_attributes({"approval": marker}) == {}

    @pytest.mark.parametrize(
        "result",
        ["Prompt saved.", "", "not json {", 42, None, [1, 2], object()],
    )
    def test_ignores_unparseable_or_non_mapping_results(self, result: object) -> None:
        assert approval_attributes(result) == {}
