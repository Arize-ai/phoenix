from __future__ import annotations

import json

import httpx
import pytest

from phoenix.client.__generated__ import v1
from phoenix.client.constants.server_requirements import (
    CREATE_PROJECT_EVALUATOR,
    DELETE_PROJECT_EVALUATORS,
)
from phoenix.client.resources.evaluators import AsyncEvaluators, Evaluators
from phoenix.client.resources.evaluators.project_evaluators import (
    AsyncProjectEvaluators,
    ProjectEvaluators,
)

BINDING_ID = "UHJvamVjdEV2YWx1YXRvcjox"
EVALUATOR_ID = "RXZhbHVhdG9yOjE="


def _make_binding(**overrides: object) -> v1.ProjectEvaluator:
    binding: v1.ProjectEvaluator = {
        "id": BINDING_ID,
        "project_id": "UHJvamVjdDox",
        "evaluator_id": EVALUATOR_ID,
        "evaluator_type": "llm",
        "trace_project_id": "UHJvamVjdDo5",
        "name": "toxicity",
        "evaluation_target": "SPAN",
        "sampling_rate": 0.25,
        "filter_condition": "",
        "enabled": True,
        "input_mapping": None,
        "evaluation_delay_seconds": 0,
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


def test_evaluators_exposes_project_evaluators() -> None:
    client = httpx.Client(base_url="http://test")
    assert isinstance(Evaluators(client).project_evaluators, ProjectEvaluators)
    assert isinstance(
        AsyncEvaluators(httpx.AsyncClient(base_url="http://test")).project_evaluators,
        AsyncProjectEvaluators,
    )


class TestProjectEvaluatorsCreate:
    def test_create_with_evaluator_id_sends_reference_and_required_fields(self) -> None:
        created = _make_binding()

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "POST"
            assert request.url.path == "/v1/projects/support-bot/evaluators"
            assert json.loads(request.content) == {
                "name": "toxicity",
                "evaluation_target": "SPAN",
                "sampling_rate": 0.25,
                "evaluator": {"type": "reference", "evaluator_id": EVALUATOR_ID},
            }
            return httpx.Response(201, json={"data": created})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = ProjectEvaluators(client).create(
            project="support-bot",
            name="toxicity",
            evaluation_target="SPAN",
            sampling_rate=0.25,
            evaluator_id=EVALUATOR_ID,
        )
        assert result == created

    def test_create_sends_optional_scheduling_fields(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            body = json.loads(request.content)
            assert body["filter_condition"] == "span_kind == 'LLM'"
            assert body["enabled"] is False
            assert body["input_mapping"] == {"literal_mapping": {}, "path_mapping": {}}
            assert body["evaluation_delay_seconds"] == 600
            assert body["evaluator"]["type"] == "llm"
            return httpx.Response(201, json={"data": _make_binding(enabled=False)})

        evaluator: v1.NewLLMEvaluator = {
            "type": "llm",
            "prompt_version": {
                "model_provider": "OPENAI",
                "model_name": "gpt-4o",
                "template": {
                    "type": "chat",
                    "messages": [{"role": "user", "content": "Toxic? {{output}}"}],
                },
                "template_type": "CHAT",
                "template_format": "MUSTACHE",
                "invocation_parameters": {"type": "openai", "openai": {}},
            },
            "output_configs": [
                {
                    "type": "CATEGORICAL",
                    "name": "toxicity",
                    "optimization_direction": "MINIMIZE",
                    "values": [{"label": "toxic", "score": 1}, {"label": "clean", "score": 0}],
                }
            ],
        }
        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = ProjectEvaluators(client).create(
            project="support-bot",
            name="toxicity",
            evaluation_target="SESSION",
            sampling_rate=1.0,
            evaluator=evaluator,
            filter_condition="span_kind == 'LLM'",
            enabled=False,
            input_mapping={"literal_mapping": {}, "path_mapping": {}},
            evaluation_delay_seconds=600,
        )
        assert result["enabled"] is False

    @pytest.mark.parametrize("kwargs", [{}, {"evaluator_id": EVALUATOR_ID, "evaluator": {}}])
    def test_create_requires_exactly_one_evaluator_source(self, kwargs: dict[str, object]) -> None:
        with pytest.raises(ValueError, match="Exactly one of evaluator or evaluator_id"):
            ProjectEvaluators(_unreachable_client()).create(
                project="p",
                name="n",
                evaluation_target="SPAN",
                sampling_rate=1.0,
                **kwargs,  # type: ignore[arg-type]
            )

    def test_create_calls_guard_before_request(self) -> None:
        with pytest.raises(_GuardSentinel):
            ProjectEvaluators(
                _unreachable_client(),
                _guard=_refusing_guard(CREATE_PROJECT_EVALUATOR),  # type: ignore[arg-type]
            ).create(
                project="p", name="n", evaluation_target="SPAN", sampling_rate=1.0, evaluator_id="e"
            )


class TestProjectEvaluatorsList:
    def test_list_follows_pagination(self) -> None:
        cursors: list[str | None] = []

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/v1/projects/support-bot/evaluators"
            assert request.url.params.get("limit") == "100"
            cursors.append(request.url.params.get("cursor"))
            if len(cursors) == 1:
                return httpx.Response(
                    200,
                    json={"data": [_make_binding(id="a")], "next_cursor": "c1"},
                )
            return httpx.Response(200, json={"data": [_make_binding(id="b")], "next_cursor": None})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = ProjectEvaluators(client).list(project="support-bot")
        assert [b["id"] for b in result] == ["a", "b"]
        assert cursors == [None, "c1"]


class TestProjectEvaluatorsGetUpdate:
    def test_get_requests_binding_by_id(self) -> None:
        binding = _make_binding()

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "GET"
            assert request.url.path == f"/v1/project_evaluators/{BINDING_ID}"
            return httpx.Response(200, json={"data": binding})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        assert ProjectEvaluators(client).get(project_evaluator_id=BINDING_ID) == binding

    def test_update_sends_only_given_fields(self) -> None:
        updated = _make_binding(enabled=False, sampling_rate=0.5)

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "PATCH"
            assert request.url.path == f"/v1/project_evaluators/{BINDING_ID}"
            assert json.loads(request.content) == {"sampling_rate": 0.5, "enabled": False}
            return httpx.Response(200, json={"data": updated})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        result = ProjectEvaluators(client).update(
            project_evaluator_id=BINDING_ID, sampling_rate=0.5, enabled=False
        )
        assert result == updated

    def test_update_sends_explicit_null_to_restore_defaults(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert json.loads(request.content) == {
                "input_mapping": None,
                "evaluation_delay_seconds": None,
            }
            return httpx.Response(200, json={"data": _make_binding()})

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        ProjectEvaluators(client).update(
            project_evaluator_id=BINDING_ID, input_mapping=None, evaluation_delay_seconds=None
        )

    def test_update_requires_a_field(self) -> None:
        with pytest.raises(ValueError, match="At least one field"):
            ProjectEvaluators(_unreachable_client()).update(project_evaluator_id=BINDING_ID)


class TestProjectEvaluatorsDelete:
    def test_delete_keeps_prompt_by_default(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "DELETE"
            assert request.url.path == f"/v1/project_evaluators/{BINDING_ID}"
            assert request.url.params.get("delete_associated_prompt") == "false"
            return httpx.Response(204)

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        ProjectEvaluators(client).delete(project_evaluator_id=BINDING_ID)

    def test_delete_forwards_prompt_flag(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.params.get("delete_associated_prompt") == "true"
            return httpx.Response(204)

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        ProjectEvaluators(client).delete(
            project_evaluator_id=BINDING_ID, delete_associated_prompt=True
        )

    def test_delete_many_posts_ids_in_body(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "POST"
            assert request.url.path == "/v1/project_evaluators/delete"
            assert json.loads(request.content) == {
                "project_evaluator_ids": ["a", "b"],
                "delete_associated_prompt": False,
            }
            return httpx.Response(204)

        client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
        ProjectEvaluators(client).delete_many(project_evaluator_ids=["a", "b"])

    def test_delete_many_requires_ids(self) -> None:
        with pytest.raises(ValueError, match="At least one project_evaluator_id"):
            ProjectEvaluators(_unreachable_client()).delete_many(project_evaluator_ids=[])

    def test_delete_many_calls_guard_before_request(self) -> None:
        with pytest.raises(_GuardSentinel):
            ProjectEvaluators(
                _unreachable_client(),
                _guard=_refusing_guard(DELETE_PROJECT_EVALUATORS),  # type: ignore[arg-type]
            ).delete_many(project_evaluator_ids=["a"])


class TestAsyncProjectEvaluators:
    @pytest.mark.asyncio
    async def test_create_with_evaluator_id_sends_reference(self) -> None:
        created = _make_binding()

        async def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/v1/projects/support-bot/evaluators"
            body = json.loads(request.content)
            assert body["evaluator"] == {"type": "reference", "evaluator_id": EVALUATOR_ID}
            assert body["evaluation_target"] == "SPAN"
            return httpx.Response(201, json={"data": created})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        result = await AsyncProjectEvaluators(client).create(
            project="support-bot",
            name="toxicity",
            evaluation_target="SPAN",
            sampling_rate=0.25,
            evaluator_id=EVALUATOR_ID,
        )
        assert result == created

    @pytest.mark.asyncio
    async def test_update_sends_only_given_fields(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            assert json.loads(request.content) == {"enabled": False}
            return httpx.Response(200, json={"data": _make_binding(enabled=False)})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        result = await AsyncProjectEvaluators(client).update(
            project_evaluator_id=BINDING_ID, enabled=False
        )
        assert result["enabled"] is False

    @pytest.mark.asyncio
    async def test_delete_many_posts_ids_in_body(self) -> None:
        async def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "POST"
            assert request.url.path == "/v1/project_evaluators/delete"
            assert json.loads(request.content) == {
                "project_evaluator_ids": ["a", "b"],
                "delete_associated_prompt": True,
            }
            return httpx.Response(204)

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        await AsyncProjectEvaluators(client).delete_many(
            project_evaluator_ids=["a", "b"], delete_associated_prompt=True
        )


def test_list_stops_at_limit() -> None:
    calls = 0

    def handler(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        assert request.url.params.get("limit") == "1"
        return httpx.Response(200, json={"data": [_make_binding()], "next_cursor": "c1"})

    client = httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")
    assert len(ProjectEvaluators(client).list(project="support-bot", limit=1)) == 1
    assert calls == 1
