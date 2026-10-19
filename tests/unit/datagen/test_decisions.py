"""Native decision seeds retain workflow semantics and are safe to repeat."""

import json
from copy import deepcopy
from typing import Any
from unittest.mock import MagicMock

import httpx
import pytest

from phoenix.experimental.datagen.datasets import DatasetError
from phoenix.experimental.datagen.decisions import build_workflow_decision, seed_workflow_decisions
from tests.unit.datagen.test_prompts import _dataset, _questions

_WORKFLOWS = (
    "agent_trace_observability",
    "customer_service",
    "invoice_processing",
    "security_incidents",
)


def _saved_version(version: dict[str, Any], version_id: str) -> dict[str, Any]:
    saved = deepcopy(version)
    saved.update(id=version_id, customProvider=None)
    saved.pop("customProviderId")
    saved["state"] = {"__typename": "DecisionInputState", "input": "state"}
    type_names = {
        "predicate": "DecisionPredicateQuestion",
        "choice": "DecisionChoiceQuestion",
        "scale": "DecisionScaleQuestion",
    }
    saved["questions"] = [
        {"__typename": type_names[kind], **content}
        for question in saved["questions"]
        for kind, content in question.items()
    ]
    return saved


def test_native_questions_preserve_workflow_criteria_and_zero_based_scores() -> None:
    questions = _questions()
    version = build_workflow_decision(
        "customer_service",
        questions,
        source_metadata={"source_revision": "pinned", "unrelated": "omit"},
    )
    assert version["state"] == {"input": "state"}
    assert version["inputs"][0]["name"] == "state"
    assert version["modelProvider"] == "TYPESAFE"
    assert version["modelName"] == "jev-latest"
    choice, predicate, *scales = version["questions"]
    assert choice == {
        "choice": {
            "name": "action",
            "instructions": questions["action"]["instructions"],
            "choices": [
                {"value": name, "description": description}
                for name, description in questions["action"]["criteria"].items()
            ],
        }
    }
    assert predicate["predicate"]["criteria"] == questions["needs_review"]["criteria"]
    assert [scale["scale"]["name"] for scale in scales] == ["risk", "urgency", "severity"]
    assert all(
        scale["scale"]["levels"]
        == [{"label": "0", "description": "Low"}, {"label": "1", "description": "High"}]
        for scale in scales
    )
    assert version["metadata"]["source_revision"] == "pinned"
    assert "unrelated" not in version["metadata"]
    assert (
        version["metadata"]["counterpart_prompt_name"]
        == "px-datagen-typed-decisions-customer_service"
    )


def test_seed_creates_four_decisions_then_only_changed_versions() -> None:
    dataset = _dataset(*_WORKFLOWS)
    stored: dict[str, dict[str, Any]] = {}
    mutations: list[str] = []

    def handle(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        query, variables = body["query"], body["variables"]
        if "query DatagenWorkflowDecisions" in query:
            matches = [
                {"node": value} for name, value in stored.items() if variables["name"] in name
            ]
            data = {
                "decisions": {
                    "edges": matches,
                    "pageInfo": {"hasNextPage": False, "endCursor": None},
                }
            }
        else:
            input = variables["input"]
            mutations.append(query)
            if "mutation DatagenCreateDecisionVersion" in query:
                decision = next(
                    value for value in stored.values() if value["id"] == input["decisionId"]
                )
                field = "createDecisionVersion"
            else:
                decision = {"id": str(len(stored) + 1), "name": input["name"]}
                stored[input["name"]] = decision
                field = "createDecision"
            decision["version"] = _saved_version(input["version"], f"version-{len(mutations)}")
            data = {field: {"version": {"id": decision["version"]["id"]}}}
        return httpx.Response(200, json={"data": data})

    with httpx.Client(base_url="http://local/", transport=httpx.MockTransport(handle)) as http:
        first = seed_workflow_decisions(http, [dataset])
        assert [name for name, _ in first] == [
            f"px-datagen-typed-decisions-{workflow}" for workflow in _WORKFLOWS
        ]
        assert len(mutations) == 4
        assert seed_workflow_decisions(http, [dataset]) == first
        assert len(mutations) == 4
        for example in dataset.examples:
            if example["metadata"]["workflow"] == _WORKFLOWS[0]:
                example["input"]["questions"]["action"]["instructions"] = "A revised instruction."
        updated = seed_workflow_decisions(http, [dataset])
        assert len(mutations) == 5
        assert updated[0][1] != first[0][1]
        assert updated[1:] == first[1:]
        # Fingerprints alone cannot hide a changed definition copied by a user.
        stored[first[1][0]]["version"]["modelName"] = "user-changed-model"
        seed_workflow_decisions(http, [dataset])
        assert len(mutations) == 6
        assert all("DatagenCreateDecisionVersion" in query for query in mutations[4:])


@pytest.mark.parametrize("change", ["questions", "workflow", "empty", "unsupported"])
def test_invalid_definition_prevents_all_decision_requests(change: str) -> None:
    valid = _dataset("customer_service")
    invalid = _dataset("security_incidents")
    if change == "questions":
        invalid.examples[1] = deepcopy(invalid.examples[1])
        invalid.examples[1]["input"]["questions"]["action"]["instructions"] = "Different."
    elif change == "workflow":
        invalid.examples[0]["metadata"]["workflow"] = "unknown"
    elif change == "unsupported":
        for example in invalid.examples:
            example["input"]["questions"]["action"]["type"] = "unknown"
    else:
        invalid.examples = []
    http = MagicMock()
    with pytest.raises(DatasetError):
        seed_workflow_decisions(http, [valid, invalid])
    http.post.assert_not_called()


@pytest.mark.parametrize("status", [403, 503])
def test_read_errors_are_not_treated_as_missing_decisions(status: int) -> None:
    requests = []

    def handle(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(status)

    with httpx.Client(base_url="http://local/", transport=httpx.MockTransport(handle)) as http:
        with pytest.raises(httpx.HTTPStatusError):
            seed_workflow_decisions(http, [_dataset("customer_service")])
    assert len(requests) == 1


def test_graphql_errors_stop_seeding() -> None:
    with httpx.Client(
        base_url="http://local/",
        transport=httpx.MockTransport(
            lambda request: httpx.Response(200, json={"errors": [{"message": "permission denied"}]})
        ),
    ) as http:
        with pytest.raises(DatasetError, match="permission denied"):
            seed_workflow_decisions(http, [_dataset("customer_service")])


def test_unrelated_datasets_are_not_seeded() -> None:
    dataset = MagicMock()
    dataset.name = "px-datagen-boolq"
    http = MagicMock()
    assert seed_workflow_decisions(http, [dataset]) == []
    http.post.assert_not_called()


def test_find_uses_exact_names_and_follows_pagination() -> None:
    dataset = _dataset("customer_service")
    name = "px-datagen-typed-decisions-customer_service"
    version = build_workflow_decision(
        "customer_service", _questions(), source_metadata={"source_revision": "pinned"}
    )
    requests = []

    def handle(request: httpx.Request) -> httpx.Response:
        variables = json.loads(request.content)["variables"]
        requests.append(variables)
        if variables["after"] is None:
            node: dict[str, Any] = {"id": "clone", "name": f"{name}-clone", "version": None}
            page = {"hasNextPage": True, "endCursor": "next"}
        else:
            node = {"id": "correct", "name": name, "version": _saved_version(version, "version-1")}
            page = {"hasNextPage": False, "endCursor": None}
        return httpx.Response(
            200, json={"data": {"decisions": {"edges": [{"node": node}], "pageInfo": page}}}
        )

    with httpx.Client(base_url="http://local/", transport=httpx.MockTransport(handle)) as http:
        assert seed_workflow_decisions(http, [dataset]) == [(name, "version-1")]
    assert [request["after"] for request in requests] == [None, "next"]
