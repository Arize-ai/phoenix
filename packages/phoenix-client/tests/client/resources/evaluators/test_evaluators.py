from __future__ import annotations

import json

import httpx
import pytest

from phoenix.client.__generated__ import v1
from phoenix.client.constants.server_requirements import (
    CREATE_EVALUATOR,
    CREATE_EVALUATOR_VERSION,
    DELETE_EVALUATOR,
    GET_EVALUATOR,
    LIST_EVALUATOR_VERSIONS,
    LIST_EVALUATORS,
    PATCH_EVALUATOR,
)
from phoenix.client.resources.evaluators import AsyncEvaluators, Evaluators

CODE_ID = "Q29kZUV2YWx1YXRvcjoy"
LLM_ID = "TExNRXZhbHVhdG9yOjE="
VERSION_ID = "Q29kZUV2YWx1YXRvclZlcnNpb246MQ=="
CREATED_AT = "2026-01-01T00:00:00+00:00"
INPUT_MAPPING: v1.InputMapping = {"literal_mapping": {}, "path_mapping": {"output": "output"}}
SCORE: v1.ContinuousAnnotationConfigData = {
    "type": "CONTINUOUS",
    "name": "score",
    "optimization_direction": "MAXIMIZE",
}


def _make_llm_definition(**overrides: object) -> v1.LLMEvaluatorDefinition:
    definition: v1.LLMEvaluatorDefinition = {
        "type": "llm",
        "id": LLM_ID,
        "name": "toxicity",
        "description": "toxicity",
        "prompt_id": "UHJvbXB0OjE=",
        "prompt_version": None,
        "output_configs": [
            {
                "type": "CATEGORICAL",
                "name": "toxicity",
                "optimization_direction": "MINIMIZE",
                "values": [{"label": "toxic", "score": 1}, {"label": "clean", "score": 0}],
            }
        ],
    }
    definition.update(overrides)  # type: ignore[typeddict-item]
    return definition


def _make_code_definition(**overrides: object) -> v1.CodeEvaluatorDefinition:
    definition: v1.CodeEvaluatorDefinition = {
        "type": "code",
        "id": CODE_ID,
        "name": "exact-match",
        "description": None,
        "language": "PYTHON",
        "sandbox_config_id": "U2FuZGJveENvbmZpZzox",
        "input_mapping": INPUT_MAPPING,
        "output_configs": [SCORE],
        "current_version_id": VERSION_ID,
        "source_code": "def evaluate(output: str) -> float:\n    return 1.0\n",
    }
    definition.update(overrides)  # type: ignore[typeddict-item]
    return definition


def _make_version(**overrides: object) -> v1.CodeEvaluatorVersion:
    version: v1.CodeEvaluatorVersion = {
        "id": VERSION_ID,
        "evaluator_id": CODE_ID,
        "source_code": "def evaluate(output: str) -> float:\n    return 0.0\n",
        "created_at": CREATED_AT,
    }
    version.update(overrides)  # type: ignore[typeddict-item]
    return version


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


def _client(handler: object) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler), base_url="http://test")  # type: ignore[arg-type]


class TestEvaluatorsList:
    def test_list_follows_pagination_and_forwards_filters(self) -> None:
        first = _make_code_definition()
        second = _make_code_definition(id="Q29kZUV2YWx1YXRvcjoz")
        seen: list[dict[str, str]] = []

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "GET"
            assert request.url.path == "/v1/evaluators"
            seen.append(dict(request.url.params))
            if "cursor" in request.url.params:
                return httpx.Response(200, json={"data": [second], "next_cursor": None})
            return httpx.Response(200, json={"data": [first], "next_cursor": "next"})

        result = Evaluators(_client(handler)).list(type="code", name="exact-match")
        assert result == [first, second]
        assert seen == [
            {"limit": "100", "type": "code", "name": "exact-match"},
            {"limit": "100", "type": "code", "name": "exact-match", "cursor": "next"},
        ]

    def test_list_stops_at_limit_and_shrinks_the_page(self) -> None:
        calls = 0

        def handler(request: httpx.Request) -> httpx.Response:
            nonlocal calls
            calls += 1
            assert request.url.params["limit"] == "2"
            assert "type" not in request.url.params
            return httpx.Response(
                200,
                json={
                    "data": [_make_code_definition(), _make_code_definition(id="x")],
                    "next_cursor": "more",
                },
            )

        result = Evaluators(_client(handler)).list(limit=2)
        assert [item["id"] for item in result] == [CODE_ID, "x"]
        assert calls == 1

    def test_list_calls_guard_before_request(self) -> None:
        with pytest.raises(_GuardSentinel):
            Evaluators(
                _unreachable_client(),
                _guard=_refusing_guard(LIST_EVALUATORS),  # type: ignore[arg-type]
            ).list()


class TestEvaluatorsGet:
    def test_get_requests_definition_by_id(self) -> None:
        definition = _make_code_definition()

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "GET"
            assert request.url.path == f"/v1/evaluators/{CODE_ID}"
            return httpx.Response(200, json={"data": definition})

        result = Evaluators(_client(handler)).get(evaluator_id=CODE_ID)
        assert result == definition
        assert result["type"] == "code"

    def test_get_calls_guard_before_request(self) -> None:
        with pytest.raises(_GuardSentinel):
            Evaluators(
                _unreachable_client(),
                _guard=_refusing_guard(GET_EVALUATOR),  # type: ignore[arg-type]
            ).get(evaluator_id=CODE_ID)


class TestEvaluatorsCreateAndDelete:
    def test_create_code_posts_the_definition(self) -> None:
        created = _make_code_definition(description="matches exactly")

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "POST"
            assert request.url.path == "/v1/evaluators"
            assert json.loads(request.content) == {
                "type": "code",
                "name": "exact-match",
                "source_code": created["source_code"],
                "language": "PYTHON",
                "sandbox_config_id": "U2FuZGJveENvbmZpZzox",
                "input_mapping": INPUT_MAPPING,
                "output_configs": [SCORE],
                "description": "matches exactly",
            }
            return httpx.Response(201, json={"data": created})

        result = Evaluators(_client(handler)).create_code(
            name="exact-match",
            source_code=created["source_code"] or "",
            language="PYTHON",
            sandbox_config_id="U2FuZGJveENvbmZpZzox",
            input_mapping=INPUT_MAPPING,
            output_configs=[SCORE],
            description="matches exactly",
        )
        assert result == created

    def test_create_code_calls_guard_before_request(self) -> None:
        with pytest.raises(_GuardSentinel):
            Evaluators(
                _unreachable_client(),
                _guard=_refusing_guard(CREATE_EVALUATOR),  # type: ignore[arg-type]
            ).create_code(
                name="n",
                source_code="x",
                language="PYTHON",
                sandbox_config_id="s",
                input_mapping=INPUT_MAPPING,
                output_configs=[SCORE],
            )

    def test_delete_sends_delete(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "DELETE"
            assert request.url.path == f"/v1/evaluators/{CODE_ID}"
            return httpx.Response(204)

        Evaluators(_client(handler)).delete(evaluator_id=CODE_ID)

    def test_delete_calls_guard_before_request(self) -> None:
        with pytest.raises(_GuardSentinel):
            Evaluators(
                _unreachable_client(),
                _guard=_refusing_guard(DELETE_EVALUATOR),  # type: ignore[arg-type]
            ).delete(evaluator_id=CODE_ID)


class TestEvaluatorsUpdateLlm:
    def test_update_llm_sends_only_given_fields(self) -> None:
        updated = _make_llm_definition(description="updated")

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "PATCH"
            assert request.url.path == f"/v1/evaluators/{LLM_ID}"
            assert json.loads(request.content) == {"type": "llm", "description": "updated"}
            return httpx.Response(200, json={"data": updated})

        result = Evaluators(_client(handler)).update_llm(evaluator_id=LLM_ID, description="updated")
        assert result == updated

    def test_update_llm_sends_prompt_version_id_and_null_description(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert json.loads(request.content) == {
                "type": "llm",
                "description": None,
                "prompt_version_id": "UHJvbXB0VmVyc2lvbjo3",
            }
            return httpx.Response(200, json={"data": _make_llm_definition()})

        Evaluators(_client(handler)).update_llm(
            evaluator_id=LLM_ID, description=None, prompt_version_id="UHJvbXB0VmVyc2lvbjo3"
        )

    def test_update_llm_requires_a_field(self) -> None:
        with pytest.raises(ValueError, match="At least one field"):
            Evaluators(_unreachable_client()).update_llm(evaluator_id=LLM_ID)

    def test_update_llm_calls_guard_before_request(self) -> None:
        with pytest.raises(_GuardSentinel):
            Evaluators(
                _unreachable_client(),
                _guard=_refusing_guard(PATCH_EVALUATOR),  # type: ignore[arg-type]
            ).update_llm(evaluator_id=LLM_ID, name="x")


class TestEvaluatorsUpdateCode:
    def test_update_code_sends_only_given_fields(self) -> None:
        updated = _make_code_definition()
        input_mapping: v1.InputMapping = {
            "literal_mapping": {"threshold": 0.5},
            "path_mapping": {"output": "output.text"},
        }

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "PATCH"
            assert json.loads(request.content) == {
                "type": "code",
                "name": "renamed",
                "input_mapping": input_mapping,
            }
            return httpx.Response(200, json={"data": updated})

        result = Evaluators(_client(handler)).update_code(
            evaluator_id=CODE_ID, name="renamed", input_mapping=input_mapping
        )
        assert result == updated

    def test_update_code_sends_nulls_and_output_configs(self) -> None:
        configs: list[v1.ContinuousAnnotationConfigData] = [
            {
                "type": "CONTINUOUS",
                "name": "score",
                "optimization_direction": "MAXIMIZE",
                "lower_bound": 0,
                "upper_bound": 1,
            }
        ]

        def handler(request: httpx.Request) -> httpx.Response:
            assert json.loads(request.content) == {
                "type": "code",
                "description": None,
                "sandbox_config_id": None,
                "output_configs": configs,
            }
            return httpx.Response(200, json={"data": _make_code_definition()})

        Evaluators(_client(handler)).update_code(
            evaluator_id=CODE_ID, description=None, sandbox_config_id=None, output_configs=configs
        )

    def test_update_code_requires_a_field(self) -> None:
        with pytest.raises(ValueError, match="At least one field"):
            Evaluators(_unreachable_client()).update_code(evaluator_id=CODE_ID)


class TestEvaluatorsVersions:
    def test_list_code_versions_follows_pagination(self) -> None:
        newest = _make_version(id="Q29kZUV2YWx1YXRvclZlcnNpb246Mg==")
        oldest = _make_version()

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "GET"
            assert request.url.path == f"/v1/evaluators/{CODE_ID}/versions"
            assert request.url.params["limit"] == "100"
            if "cursor" in request.url.params:
                return httpx.Response(200, json={"data": [oldest], "next_cursor": None})
            return httpx.Response(200, json={"data": [newest], "next_cursor": "next"})

        result = Evaluators(_client(handler)).list_code_versions(evaluator_id=CODE_ID)
        assert result == [newest, oldest]

    def test_list_code_versions_honors_limit(self) -> None:
        def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.params["limit"] == "1"
            return httpx.Response(200, json={"data": [_make_version()], "next_cursor": "more"})

        result = Evaluators(_client(handler)).list_code_versions(evaluator_id=CODE_ID, limit=1)
        assert len(result) == 1

    def test_list_code_versions_calls_guard_before_request(self) -> None:
        with pytest.raises(_GuardSentinel):
            Evaluators(
                _unreachable_client(),
                _guard=_refusing_guard(LIST_EVALUATOR_VERSIONS),  # type: ignore[arg-type]
            ).list_code_versions(evaluator_id=CODE_ID)

    def test_create_code_version_posts_source_and_configuration(self) -> None:
        version: v1.CreatedCodeEvaluatorVersion = {**_make_version(), "was_created": True}

        def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "POST"
            assert request.url.path == f"/v1/evaluators/{CODE_ID}/versions"
            assert json.loads(request.content) == {
                "source_code": version["source_code"],
                "expected_current_version_id": VERSION_ID,
                "sandbox_config_id": None,
                "input_mapping": INPUT_MAPPING,
            }
            return httpx.Response(201, json={"data": version})

        result = Evaluators(_client(handler)).create_code_version(
            evaluator_id=CODE_ID,
            source_code=version["source_code"],
            expected_current_version_id=VERSION_ID,
            sandbox_config_id=None,
            input_mapping=INPUT_MAPPING,
        )
        assert result == version

    def test_create_code_version_accepts_unchanged_source(self) -> None:
        version: v1.CreatedCodeEvaluatorVersion = {
            **_make_version(source_code="x"),
            "was_created": False,
        }

        def handler(request: httpx.Request) -> httpx.Response:
            assert json.loads(request.content) == {"source_code": "x"}
            return httpx.Response(200, json={"data": version})

        result = Evaluators(_client(handler)).create_code_version(
            evaluator_id=CODE_ID, source_code="x"
        )
        assert result["was_created"] is False

    def test_create_code_version_calls_guard_before_request(self) -> None:
        with pytest.raises(_GuardSentinel):
            Evaluators(
                _unreachable_client(),
                _guard=_refusing_guard(CREATE_EVALUATOR_VERSION),  # type: ignore[arg-type]
            ).create_code_version(evaluator_id=CODE_ID, source_code="x")


class TestAsyncEvaluators:
    @pytest.mark.asyncio
    async def test_list_follows_pagination(self) -> None:
        first = _make_llm_definition()
        second = _make_code_definition()

        async def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == "/v1/evaluators"
            if "cursor" in request.url.params:
                return httpx.Response(200, json={"data": [second], "next_cursor": None})
            return httpx.Response(200, json={"data": [first], "next_cursor": "next"})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        assert await AsyncEvaluators(client).list() == [first, second]

    @pytest.mark.asyncio
    async def test_create_code_and_delete(self) -> None:
        created = _make_code_definition()

        async def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path.startswith("/v1/evaluators")
            if request.method == "POST":
                assert json.loads(request.content)["name"] == "exact-match"
                return httpx.Response(201, json={"data": created})
            assert request.method == "DELETE"
            return httpx.Response(204)

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        evaluators = AsyncEvaluators(client)
        result = await evaluators.create_code(
            name="exact-match",
            source_code="x",
            language="PYTHON",
            sandbox_config_id="U2FuZGJveENvbmZpZzox",
            input_mapping=INPUT_MAPPING,
            output_configs=[SCORE],
        )
        assert result == created
        await evaluators.delete(evaluator_id=CODE_ID)

    @pytest.mark.asyncio
    async def test_update_llm_sends_only_given_fields(self) -> None:
        updated = _make_llm_definition(name="renamed")

        async def handler(request: httpx.Request) -> httpx.Response:
            assert request.method == "PATCH"
            assert json.loads(request.content) == {"type": "llm", "name": "renamed"}
            return httpx.Response(200, json={"data": updated})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        result = await AsyncEvaluators(client).update_llm(evaluator_id=LLM_ID, name="renamed")
        assert result == updated

    @pytest.mark.asyncio
    async def test_update_code_requires_a_field(self) -> None:
        client = httpx.AsyncClient(
            transport=httpx.MockTransport(lambda r: pytest.fail("transport must not be reached")),
            base_url="http://test",
        )
        with pytest.raises(ValueError, match="At least one field"):
            await AsyncEvaluators(client).update_code(evaluator_id=CODE_ID)

    @pytest.mark.asyncio
    async def test_list_and_create_code_versions(self) -> None:
        version = _make_version(source_code="x")

        async def handler(request: httpx.Request) -> httpx.Response:
            assert request.url.path == f"/v1/evaluators/{CODE_ID}/versions"
            if request.method == "GET":
                return httpx.Response(200, json={"data": [version], "next_cursor": None})
            assert json.loads(request.content) == {"source_code": "x"}
            return httpx.Response(201, json={"data": {**version, "was_created": True}})

        client = httpx.AsyncClient(transport=httpx.MockTransport(handler), base_url="http://test")
        evaluators = AsyncEvaluators(client)
        assert await evaluators.list_code_versions(evaluator_id=CODE_ID) == [version]
        created = await evaluators.create_code_version(evaluator_id=CODE_ID, source_code="x")
        assert created == {**version, "was_created": True}
