from __future__ import annotations

import json

import httpx
import pytest

from phoenix.client.__generated__ import v1
from phoenix.client.constants.server_requirements import (
    CREATE_DATASET_EVALUATOR,
    DELETE_DATASET_EVALUATORS,
)
from phoenix.client.resources.evaluators import AsyncEvaluators, Evaluators
from phoenix.client.resources.evaluators.dataset_evaluators import (
    AsyncDatasetEvaluators,
    DatasetEvaluators,
)

BINDING_ID = "RGF0YXNldEV2YWx1YXRvcjox"
EVALUATOR_ID = "RXZhbHVhdG9yOjI="
INPUT_MAPPING: v1.InputMapping = {"literal_mapping": {}, "path_mapping": {"output": "output"}}


def _make_binding(**overrides: object) -> v1.DatasetEvaluator:
    binding: v1.DatasetEvaluator = {
        "id": BINDING_ID,
        "dataset_id": "RGF0YXNldDox",
        "evaluator_id": EVALUATOR_ID,
        "evaluator_type": "code",
        "trace_project_id": "UHJvamVjdDo5",
        "name": "exact-match",
        "input_mapping": INPUT_MAPPING,
        "description": None,
        "output_configs": None,
    }
    binding.update(overrides)  # type: ignore[typeddict-item]
    return binding


class _GuardSentinel(Exception):
    pass


def _refusing_guard(requirement: object) -> object:
    class _Guard:
        def require(self, candidate: object) -> None:
            if candidate is requirement:
                raise _GuardSentinel

    return _Guard()


def _unreachable_client() -> httpx.Client:
    return httpx.Client(
        transport=httpx.MockTransport(lambda r: pytest.fail("transport must not be reached")),
        base_url="http://test",
    )


def test_evaluators_exposes_dataset_evaluators() -> None:
    client = httpx.Client(base_url="http://test")
    assert isinstance(Evaluators(client).dataset_evaluators, DatasetEvaluators)
    assert isinstance(
        AsyncEvaluators(httpx.AsyncClient(base_url="http://test")).dataset_evaluators,
        AsyncDatasetEvaluators,
    )


class TestDatasetEvaluatorsCreate:
    def test_create_with_evaluator_id_sends_reference(self) -> None:
        created = _make_binding()

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "POST"
            assert request.url.path == "/v1/datasets/golden-questions/evaluators"
            assert json.loads(request.content) == {
                "name": "exact-match",
                "input_mapping": INPUT_MAPPING,
                "evaluator": {"type": "reference", "evaluator_id": EVALUATOR_ID},
            }
            return httpx.Response(201, json={"data": created})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = DatasetEvaluators(client).create(
            dataset="golden-questions",
            name="exact-match",
            input_mapping=INPUT_MAPPING,
            evaluator_id=EVALUATOR_ID,
        )
        assert result == created
        assert result["evaluator_type"] == "code"

    def test_create_with_new_evaluator_and_overrides(self) -> None:
        evaluator: v1.NewCodeEvaluator = {
            "type": "code",
            "source_code": "def evaluate(output: str) -> float:\n    return 1.0\n",
            "language": "PYTHON",
            "sandbox_config_id": "U2FuZGJveENvbmZpZzox",
            "input_mapping": INPUT_MAPPING,
            "output_configs": [
                {"type": "CONTINUOUS", "name": "score", "optimization_direction": "MAXIMIZE"}
            ],
        }
        output_configs: list[v1.FreeformAnnotationConfigData] = [
            {"type": "FREEFORM", "name": "notes"}
        ]

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/v1/datasets/RGF0YXNldDox/evaluators"
            body = json.loads(request.content)
            assert body["evaluator"] == evaluator
            assert body["description"] == "override"
            assert body["output_configs"] == output_configs
            return httpx.Response(201, json={"data": _make_binding(description="override")})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = DatasetEvaluators(client).create(
            dataset="RGF0YXNldDox",
            name="exact-match",
            input_mapping=INPUT_MAPPING,
            evaluator=evaluator,
            description="override",
            output_configs=output_configs,
        )
        assert result["description"] == "override"

    @pytest.mark.parametrize("kwargs", [{}, {"evaluator_id": EVALUATOR_ID, "evaluator": {}}])
    def test_create_requires_exactly_one_evaluator_source(self, kwargs: dict[str, object]) -> None:
        with pytest.raises(ValueError, match="Exactly one of evaluator or evaluator_id"):
            DatasetEvaluators(_unreachable_client()).create(
                dataset="d",
                name="n",
                input_mapping=INPUT_MAPPING,
                **kwargs,  # type: ignore[arg-type]
            )

    def test_create_calls_guard_before_request(self) -> None:
        with pytest.raises(_GuardSentinel):
            DatasetEvaluators(
                _unreachable_client(),
                _guard=_refusing_guard(CREATE_DATASET_EVALUATOR),  # type: ignore[arg-type]
            ).create(dataset="d", name="n", input_mapping=INPUT_MAPPING, evaluator_id="e")


class TestDatasetEvaluatorsList:
    def test_list_follows_pagination(self) -> None:
        first = _make_binding(id="a")
        second = _make_binding(id="b")
        cursors: list[str | None] = []

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/v1/datasets/golden-questions/evaluators"
            assert request.url.params.get("limit") == "100"
            cursors.append(request.url.params.get("cursor"))
            if len(cursors) == 1:
                return httpx.Response(200, json={"data": [first], "next_cursor": "c1"})
            return httpx.Response(200, json={"data": [second], "next_cursor": None})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = DatasetEvaluators(client).list(dataset="golden-questions")
        assert [b["id"] for b in result] == ["a", "b"]
        assert cursors == [None, "c1"]


class TestDatasetEvaluatorsGetUpdate:
    def test_get_requests_binding_by_id(self) -> None:
        binding = _make_binding()

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "GET"
            assert request.url.path == f"/v1/dataset_evaluators/{BINDING_ID}"
            return httpx.Response(200, json={"data": binding})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        assert DatasetEvaluators(client).get(dataset_evaluator_id=BINDING_ID) == binding

    def test_update_sends_only_given_fields(self) -> None:
        updated = _make_binding(name="renamed")

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "PATCH"
            assert request.url.path == f"/v1/dataset_evaluators/{BINDING_ID}"
            assert json.loads(request.content) == {"name": "renamed"}
            return httpx.Response(200, json={"data": updated})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = DatasetEvaluators(client).update(dataset_evaluator_id=BINDING_ID, name="renamed")
        assert result == updated

    def test_update_sends_explicit_null_to_clear_overrides(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert json.loads(request.content) == {"description": None, "output_configs": None}
            return httpx.Response(200, json={"data": _make_binding()})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        DatasetEvaluators(client).update(
            dataset_evaluator_id=BINDING_ID, description=None, output_configs=None
        )

    def test_update_requires_a_field(self) -> None:
        with pytest.raises(ValueError, match="At least one field"):
            DatasetEvaluators(_unreachable_client()).update(dataset_evaluator_id=BINDING_ID)


class TestDatasetEvaluatorsDelete:
    def test_delete_keeps_prompt_by_default(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "DELETE"
            assert request.url.path == f"/v1/dataset_evaluators/{BINDING_ID}"
            assert request.url.params.get("delete_associated_prompt") == "false"
            return httpx.Response(204)

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        DatasetEvaluators(client).delete(dataset_evaluator_id=BINDING_ID)

    def test_delete_forwards_prompt_flag(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.params.get("delete_associated_prompt") == "true"
            return httpx.Response(204)

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        DatasetEvaluators(client).delete(
            dataset_evaluator_id=BINDING_ID, delete_associated_prompt=True
        )

    def test_delete_many_posts_ids_in_body(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "POST"
            assert request.url.path == "/v1/dataset_evaluators/delete"
            assert json.loads(request.content) == {
                "dataset_evaluator_ids": ["a", "b"],
                "delete_associated_prompt": False,
            }
            return httpx.Response(204)

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        DatasetEvaluators(client).delete_many(dataset_evaluator_ids=["a", "b"])

    def test_delete_many_requires_ids(self) -> None:
        with pytest.raises(ValueError, match="At least one dataset_evaluator_id"):
            DatasetEvaluators(_unreachable_client()).delete_many(dataset_evaluator_ids=[])

    def test_delete_many_calls_guard_before_request(self) -> None:
        with pytest.raises(_GuardSentinel):
            DatasetEvaluators(
                _unreachable_client(),
                _guard=_refusing_guard(DELETE_DATASET_EVALUATORS),  # type: ignore[arg-type]
            ).delete_many(dataset_evaluator_ids=["a"])


class TestAsyncDatasetEvaluators:
    @pytest.mark.asyncio
    async def test_create_with_evaluator_id_sends_reference(self) -> None:
        created = _make_binding()

        async def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/v1/datasets/golden-questions/evaluators"
            assert json.loads(request.content)["evaluator"] == {
                "type": "reference",
                "evaluator_id": EVALUATOR_ID,
            }
            return httpx.Response(201, json={"data": created})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        result = await AsyncDatasetEvaluators(client).create(
            dataset="golden-questions",
            name="exact-match",
            input_mapping=INPUT_MAPPING,
            evaluator_id=EVALUATOR_ID,
        )
        assert result == created

    @pytest.mark.asyncio
    async def test_list_follows_pagination(self) -> None:
        calls = 0

        async def handler(request: httpx.Request) -> httpx.Response:
            nonlocal calls
            calls += 1
            if calls == 1:
                return httpx.Response(200, json={"data": [_make_binding()], "next_cursor": "c1"})
            assert request.url.params.get("cursor") == "c1"
            return httpx.Response(200, json={"data": [_make_binding()], "next_cursor": None})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        result = await AsyncDatasetEvaluators(client).list(dataset="golden-questions")
        assert len(result) == 2

    @pytest.mark.asyncio
    async def test_delete_many_posts_ids_in_body(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "POST"
            assert request.url.path == "/v1/dataset_evaluators/delete"
            assert json.loads(request.content) == {
                "dataset_evaluator_ids": ["a", "b"],
                "delete_associated_prompt": True,
            }
            return httpx.Response(204)

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        await AsyncDatasetEvaluators(client).delete_many(
            dataset_evaluator_ids=["a", "b"], delete_associated_prompt=True
        )


def test_list_stops_at_limit() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        assert request.url.params.get("limit") == "1"
        return httpx.Response(200, json={"data": [_make_binding()], "next_cursor": "c1"})

    client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
    assert len(DatasetEvaluators(client).list(dataset="golden-questions", limit=1)) == 1
    assert calls == 1
