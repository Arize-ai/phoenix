import asyncio
from secrets import token_hex
from typing import Any, cast

import httpx
import pytest
import sqlalchemy
from fastapi import FastAPI
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    OptimizationDirection,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.db.types.model_provider import ModelProvider
from phoenix.db.types.prompts import (
    PromptChatTemplate,
    PromptMessage,
    PromptOpenAIInvocationParameters,
    PromptOpenAIInvocationParametersContent,
    PromptTemplateFormat,
    PromptTemplateType,
)
from phoenix.server.api.exceptions import Conflict
from phoenix.server.api.helpers.evaluator_service import (
    CreateCodeEvaluatorVersionInput,
    EvaluatorServiceContext,
    create_code_evaluator_version,
)
from phoenix.server.api.routers.v1.evaluators import router
from phoenix.server.api.routers.v1.sandbox_configs import router as sandbox_configs_router
from phoenix.server.app import _db
from phoenix.server.sandbox.types import SandboxRuntimeContext
from phoenix.server.types import DbSessionFactory

_SCORE = ContinuousOutputConfig(
    type="CONTINUOUS", name="score", optimization_direction=OptimizationDirection.MAXIMIZE
)
_SCORE_JSON = {"type": "CONTINUOUS", "name": "score", "optimization_direction": "MAXIMIZE"}


def test_evaluator_definition_schema() -> None:
    app = FastAPI()
    app.include_router(router)
    schema = app.openapi()
    paths = schema["paths"]
    for method in ("get", "patch"):
        response = paths["/evaluators/{evaluator_id}"][method]["responses"]["200"]
        assert response["content"]["application/json"]["schema"] == {
            "$ref": "#/components/schemas/EvaluatorDefinitionResponseBody"
        }
    assert paths["/evaluators"]["get"]["operationId"] == "getEvaluators"
    assert paths["/evaluators"]["post"]["operationId"] == "createEvaluator"
    assert paths["/evaluators/{evaluator_id}"]["delete"]["operationId"] == "deleteEvaluator"
    versions = paths["/evaluators/{evaluator_id}/versions"]
    assert versions["get"]["operationId"] == "listCodeEvaluatorVersions"
    assert versions["post"]["operationId"] == "createCodeEvaluatorVersion"
    assert {p["name"] for p in paths["/evaluators"]["get"]["parameters"]} == {
        "type",
        "name",
        "cursor",
        "limit",
    }

    schemas = schema["components"]["schemas"]
    for name in ("CodeEvaluatorDefinition", "LLMEvaluatorDefinition", "CodeEvaluatorVersion"):
        assert "id" in schemas[name]["required"], name
        assert "evaluator_version_id" not in schemas[name]["properties"], name
    assert "evaluator_id" not in schemas["LLMEvaluatorDefinition"]["properties"]
    assert "evaluator_id" in schemas["CodeEvaluatorVersion"]["required"]
    assert "prompt" in schemas["LLMEvaluatorDefinition"]["required"]
    assert set(schemas["LLMEvaluatorPrompt"]["required"]) == {
        "prompt_id",
        "selector",
        "resolved_prompt_version_id",
    }
    assert "prompt_version" not in schemas["LLMEvaluatorDefinition"]["properties"]

    assert (
        schemas["LLMEvaluatorDefinition"]["properties"]["output_configs"]["items"]
        == (schemas["PatchLLMEvaluatorRequest"]["properties"]["output_configs"]["items"])
    )
    assert schemas["LLMEvaluatorDefinition"]["properties"]["output_configs"]["items"] == {
        "$ref": "#/components/schemas/CategoricalAnnotationConfigData"
    }
    code_output_refs = {
        option["$ref"]
        for option in schemas["CodeEvaluatorDefinition"]["properties"]["output_configs"]["items"][
            "oneOf"
        ]
    }
    assert code_output_refs == {
        "#/components/schemas/CategoricalAnnotationConfigData",
        "#/components/schemas/ContinuousAnnotationConfigData",
        "#/components/schemas/FreeformAnnotationConfigData",
    }

    selector = schemas["LLMEvaluatorPrompt"]["properties"]["selector"]
    assert {option["$ref"] for option in selector["oneOf"]} == {
        "#/components/schemas/PromptVersionSelector",
        "#/components/schemas/LatestPromptVersionSelector",
    }
    for name in ("PatchLLMEvaluatorRequest", "CreateLLMEvaluatorRequest"):
        prompt = schemas[name]["properties"]["prompt"]
        assert prompt["$ref"] == "#/components/schemas/LLMEvaluatorPromptInput", name
    selector_input = schemas["LLMEvaluatorPromptInput"]["properties"]["selector"]
    assert selector_input["$ref"] == "#/components/schemas/PromptVersionSelector"
    for name in ("PatchLLMEvaluatorRequest", "PatchCodeEvaluatorRequest"):
        assert schemas[name]["minProperties"] == 2, name

    version_request = schemas["CodeEvaluatorVersionRequest"]
    assert version_request["required"] == ["source_code"]
    assert {
        "expected_current_version_id",
        "description",
        "sandbox_config_id",
        "input_mapping",
        "output_configs",
    } <= set(version_request["properties"])
    create_request = schemas["CreateCodeEvaluatorRequest"]
    assert set(create_request["required"]) == {
        "type",
        "name",
        "source_code",
        "language",
        "sandbox_config_id",
        "input_mapping",
        "output_configs",
    }
    for request in (create_request, schemas["PatchCodeEvaluatorRequest"], version_request):
        assert request["properties"]["output_configs"]["minItems"] == 1

    unprocessable = paths["/evaluators/{evaluator_id}"]["patch"]["responses"]["422"]["content"]
    assert unprocessable == {
        "application/problem+json": {"schema": {"$ref": "#/components/schemas/ProblemDetail"}}
    }


async def test_list_cursor_accepts_item_ids(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> None:
    """next_cursor is typed like the row it points at, and any item id works as a cursor."""
    async with db() as session:
        rows = [
            models.CodeEvaluator(
                name=IdentifierModel.model_validate(f"cursor-{token_hex(4)}"),
                description="cursor",
                metadata_={},
                language=sandbox_config.language,
                sandbox_config_id=sandbox_config.id,
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                output_configs=[_SCORE],
                versions=[models.CodeEvaluatorVersion(source_code="def evaluate(output): ...")],
            )
            for _ in range(3)
        ]
        session.add_all(rows)
        await session.flush()

    first = await httpx_client.get("v1/evaluators", params={"type": "code", "limit": 2})
    assert first.status_code == 200, first.text
    page = first.json()
    assert len(page["data"]) == 2
    assert GlobalID.from_id(page["next_cursor"]).type_name == "CodeEvaluator"

    second = await httpx_client.get(
        "v1/evaluators", params={"type": "code", "limit": 2, "cursor": page["next_cursor"]}
    )
    assert second.status_code == 200, second.text
    assert second.json()["data"][0]["id"] == page["next_cursor"]

    from_item = await httpx_client.get(
        "v1/evaluators", params={"type": "code", "limit": 1, "cursor": page["data"][-1]["id"]}
    )
    assert from_item.status_code == 200, from_item.text
    assert from_item.json()["data"][0]["id"] == page["data"][-1]["id"]

    foreign = await httpx_client.get(
        "v1/evaluators", params={"cursor": str(GlobalID("Dataset", str(rows[0].id)))}
    )
    assert foreign.status_code == 422, foreign.text


async def test_list_by_name_that_cannot_exist_matches_nothing(
    httpx_client: httpx.AsyncClient,
) -> None:
    """A name filter that no evaluator name could ever equal (it fails the Identifier
    pattern) is just an empty result, not a 422."""
    response = await httpx_client.get("v1/evaluators", params={"name": "Exact-Match"})
    assert response.status_code == 200, response.text
    assert response.json()["data"] == []


@pytest.mark.postgres_only
async def test_version_deploy_rechecks_expected_version_after_a_concurrent_deploy(
    postgresql_engine: AsyncEngine,
) -> None:
    """A deploy that waited on another compares its expected version with the new tip."""
    db = DbSessionFactory(db=_db(postgresql_engine), dialect="postgresql")
    async with db() as session:
        first_version = models.CodeEvaluatorVersion(
            source_code="def evaluate(output):\n    return {'score': 1.0}"
        )
        evaluator = models.CodeEvaluator(
            name=IdentifierModel.model_validate(f"deploy-{token_hex(4)}"),
            description="deploy",
            metadata_={},
            language="PYTHON",
            input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
            output_configs=[_SCORE],
            versions=[first_version],
        )
        session.add(evaluator)
        await session.flush()
        evaluator_id = evaluator.id
        first_version_id = first_version.id

    holding = asyncio.Event()
    release = asyncio.Event()

    async def concurrent_deploy() -> None:
        async with db() as session:
            await session.get(models.CodeEvaluator, evaluator_id, with_for_update=True)
            session.add(
                models.CodeEvaluatorVersion(
                    code_evaluator_id=evaluator_id,
                    source_code="def evaluate(output):\n    return {'score': 2.0}",
                )
            )
            await session.flush()
            holding.set()
            await release.wait()

    other = asyncio.create_task(concurrent_deploy())
    await holding.wait()
    context = EvaluatorServiceContext(
        db=db, sandbox_runtime=SandboxRuntimeContext(monty=cast(Any, None))
    )
    deploy = asyncio.create_task(
        create_code_evaluator_version(
            context,
            CreateCodeEvaluatorVersionInput(
                code_evaluator_id=GlobalID("CodeEvaluator", str(evaluator_id)),
                source_code="def evaluate(output):\n    return {'score': 3.0}",
                expected_current_version_id=GlobalID("CodeEvaluatorVersion", str(first_version_id)),
            ),
        )
    )
    with pytest.raises(asyncio.TimeoutError):
        await asyncio.wait_for(asyncio.shield(deploy), timeout=0.5)
    release.set()
    await other
    with pytest.raises(Conflict) as excinfo:
        await deploy
    assert excinfo.value.reason == "version_mismatch"
    assert excinfo.value.extra["current_version_id"] is not None


async def test_create_with_missing_sandbox_is_not_found(httpx_client: httpx.AsyncClient) -> None:
    """A well-formed sandbox id with no row is 404, like other missing references."""
    response = await httpx_client.post(
        "v1/evaluators",
        json={
            "type": "code",
            "name": f"missing-sandbox-{token_hex(4)}",
            "source_code": "def evaluate(output):\n    return {'score': 1.0}",
            "language": "PYTHON",
            "sandbox_config_id": str(GlobalID("SandboxConfig", "999999999")),
            "input_mapping": {"literal_mapping": {}, "path_mapping": {}},
            "output_configs": [_SCORE_JSON],
        },
    )
    assert response.status_code == 404, response.text
    assert "Sandbox config not found" in response.text


async def test_writes_require_an_output_config(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> None:
    """Creating, patching, and deploying a code evaluator never store an empty output list."""
    create_body: dict[str, Any] = {
        "type": "code",
        "name": f"outputs-{token_hex(4)}",
        "source_code": "def evaluate(output):\n    return {'score': 1.0}",
        "language": sandbox_config.language,
        "sandbox_config_id": str(GlobalID("SandboxConfig", str(sandbox_config.id))),
        "input_mapping": {"literal_mapping": {}, "path_mapping": {}},
    }
    for body in ({**create_body, "output_configs": []}, create_body):
        response = await httpx_client.post("v1/evaluators", json=body)
        assert response.status_code == 422, response.text
        assert response.headers["content-type"] == "application/problem+json"
        problem = response.json()
        assert problem["code"] == "validation_error"
        assert [error["field"] for error in problem["errors"]] == ["body.output_configs"]

    async with db() as session:
        evaluator = models.CodeEvaluator(
            name=IdentifierModel.model_validate(f"outputs-{token_hex(4)}"),
            description="outputs",
            metadata_={},
            language=sandbox_config.language,
            sandbox_config_id=sandbox_config.id,
            input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
            output_configs=[_SCORE],
            versions=[models.CodeEvaluatorVersion(source_code="def evaluate(output): ...")],
        )
        session.add(evaluator)
        await session.flush()
    evaluator_id = str(GlobalID("CodeEvaluator", str(evaluator.id)))

    patch = await httpx_client.patch(
        f"v1/evaluators/{evaluator_id}", json={"type": "code", "output_configs": []}
    )
    assert patch.status_code == 422, patch.text
    assert patch.json()["errors"][0]["field"].endswith("output_configs")
    deploy = await httpx_client.post(
        f"v1/evaluators/{evaluator_id}/versions",
        json={
            "source_code": "def evaluate(output):\n    return {'score': 0.0}",
            "output_configs": [],
        },
    )
    assert deploy.status_code == 422, deploy.text
    assert [error["field"] for error in deploy.json()["errors"]] == ["body.output_configs"]

    kept = await httpx_client.get(f"v1/evaluators/{evaluator_id}")
    assert kept.status_code == 200, kept.text
    assert [config["name"] for config in kept.json()["data"]["output_configs"]] == ["score"]
    assert kept.json()["data"]["source_code"] == "def evaluate(output): ..."


async def test_untagged_llm_definition_follows_its_prompts_latest_version(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    correctness_llm_evaluator: models.LLMEvaluator,
) -> None:
    """An evaluator without a pin reads as latest, stays unpinned across edits that leave its
    prompt alone, and is pinned once a version is selected."""
    route = f"v1/evaluators/{GlobalID('LLMEvaluator', str(correctness_llm_evaluator.id))}"
    async with db() as session:
        latest_id = await session.scalar(
            select(models.PromptVersion.id)
            .where(models.PromptVersion.prompt_id == correctness_llm_evaluator.prompt_id)
            .order_by(models.PromptVersion.id.desc())
            .limit(1)
        )
    latest = str(GlobalID("PromptVersion", str(latest_id)))

    response = await httpx_client.get(route)
    assert response.status_code == 200, response.text
    assert response.json()["data"]["prompt"]["selector"] == {"type": "latest"}
    assert response.json()["data"]["prompt"]["resolved_prompt_version_id"] == latest

    renamed = f"renamed-{token_hex(4)}"
    response = await httpx_client.patch(route, json={"type": "llm", "name": renamed})
    assert response.status_code == 200, response.text
    assert response.json()["data"]["name"] == renamed
    assert response.json()["data"]["prompt"]["selector"] == {"type": "latest"}
    async with db() as session:
        row = await session.get(models.LLMEvaluator, correctness_llm_evaluator.id)
        assert row is not None and row.prompt_version_tag_id is None

    response = await httpx_client.patch(
        route,
        json={
            "type": "llm",
            "prompt": {"selector": {"type": "version", "prompt_version_id": latest}},
        },
    )
    assert response.status_code == 200, response.text
    assert response.json()["data"]["prompt"]["selector"] == {
        "type": "version",
        "prompt_version_id": latest,
    }


async def _add_llm_evaluator(
    session: AsyncSession, name: str, *, tagged: bool
) -> models.LLMEvaluator:
    """A minimal LLM evaluator with a real prompt version, tagged (pinned) or not."""
    version = models.PromptVersion(
        template_type=PromptTemplateType.CHAT,
        template_format=PromptTemplateFormat.MUSTACHE,
        template=PromptChatTemplate(
            type="chat", messages=[PromptMessage(role="user", content="Judge {{output}}")]
        ),
        invocation_parameters=PromptOpenAIInvocationParameters(
            type="openai", openai=PromptOpenAIInvocationParametersContent()
        ),
        model_provider=ModelProvider.OPENAI,
        model_name="gpt-4",
        metadata_={},
    )
    evaluator = models.LLMEvaluator(
        name=IdentifierModel.model_validate(name),
        kind="LLM",
        output_configs=[
            CategoricalOutputConfig(
                type="CATEGORICAL",
                name="correctness",
                optimization_direction=OptimizationDirection.MAXIMIZE,
                values=[
                    CategoricalAnnotationValue(label="correct", score=1.0),
                    CategoricalAnnotationValue(label="incorrect", score=0.0),
                ],
            )
        ],
        prompt=models.Prompt(
            name=IdentifierModel.model_validate(f"{name}-prompt"), prompt_versions=[version]
        ),
    )
    session.add(evaluator)
    await session.flush()
    if tagged:
        evaluator.prompt_version_tag = models.PromptVersionTag(
            name=IdentifierModel.model_validate(f"{name}-tag"),
            prompt_id=evaluator.prompt_id,
            prompt_version_id=version.id,
        )
        await session.flush()
    return evaluator


def _add_code_evaluator(
    session: AsyncSession, name: str, sandbox_config: models.SandboxConfig
) -> models.CodeEvaluator:
    evaluator = models.CodeEvaluator(
        name=IdentifierModel.model_validate(name),
        description=None,
        metadata_={},
        language=sandbox_config.language,
        sandbox_config_id=sandbox_config.id,
        input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
        output_configs=[_SCORE],
        versions=[models.CodeEvaluatorVersion(source_code="def evaluate(output): ...")],
    )
    session.add(evaluator)
    return evaluator


async def _get_builtin_evaluator(
    session: AsyncSession, key: str = "exact_match"
) -> models.BuiltinEvaluator:
    """The app's startup facilitator seeds one row per registered built-in class, so there
    is always one to read back rather than one for a test to insert."""
    builtin = await session.scalar(
        select(models.BuiltinEvaluator).where(models.BuiltinEvaluator.key == key)
    )
    assert builtin is not None, f"Built-in evaluator '{key}' was not seeded"
    return builtin


async def _add_mixed_page(
    session: AsyncSession, count: int, sandbox_config: models.SandboxConfig
) -> None:
    """`count` evaluators cycling through untagged LLM, tagged LLM, and code, on top of the
    built-ins the app seeds at startup: together, every kind `get_evaluators` can return."""
    for i in range(count):
        stem = f"mixed-{token_hex(4)}-{i}"
        kind = i % 3
        if kind == 0:
            await _add_llm_evaluator(session, stem, tagged=False)
        elif kind == 1:
            await _add_llm_evaluator(session, stem, tagged=True)
        else:
            _add_code_evaluator(session, stem, sandbox_config)
    await session.flush()


async def _count_queries(coro: Any) -> int:
    """Run `coro`, counting every statement executed against the engine meanwhile."""
    count = 0

    def _count(*_args: Any, **_kwargs: Any) -> None:
        nonlocal count
        count += 1

    sqlalchemy.event.listen(sqlalchemy.engine.Engine, "before_cursor_execute", _count)
    try:
        await coro
    finally:
        sqlalchemy.event.remove(sqlalchemy.engine.Engine, "before_cursor_execute", _count)
    return count


async def test_list_batches_queries_independent_of_page_size(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> None:
    """A page of definitions costs the same fixed number of queries whether it holds a
    handful of rows or dozens: the N+1 per-item lookup this replaces would instead grow
    with page size. Both fetches reach every one of the app's 5 seeded built-ins too, so
    the built-in batch is exercised at both sizes as well."""
    async with db() as session:
        await _add_mixed_page(session, 4, sandbox_config)
    small = await _count_queries(httpx_client.get("v1/evaluators", params={"limit": 9}))

    async with db() as session:
        await _add_mixed_page(session, 26, sandbox_config)
    large = await _count_queries(httpx_client.get("v1/evaluators", params={"limit": 35}))
    assert small == large, (small, large)


async def test_list_mixed_page_matches_individual_reads(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> None:
    """Every kind the batched list assembles (untagged LLM, tagged LLM, code with a version,
    and built-in) reads back exactly like the single-item route it shares its conversion
    with."""
    async with db() as session:
        untagged = await _add_llm_evaluator(session, f"untagged-{token_hex(4)}", tagged=False)
        tagged = await _add_llm_evaluator(session, f"tagged-{token_hex(4)}", tagged=True)
        code = _add_code_evaluator(session, f"code-{token_hex(4)}", sandbox_config)
        builtin = await _get_builtin_evaluator(session)
        await session.flush()

    ids = [
        str(GlobalID("LLMEvaluator", str(untagged.id))),
        str(GlobalID("LLMEvaluator", str(tagged.id))),
        str(GlobalID("CodeEvaluator", str(code.id))),
        str(GlobalID("BuiltInEvaluator", str(builtin.id))),
    ]
    listing = await httpx_client.get("v1/evaluators", params={"limit": 1000})
    assert listing.status_code == 200, listing.text
    by_id = {item["id"]: item for item in listing.json()["data"]}
    for evaluator_id in ids:
        single = await httpx_client.get(f"v1/evaluators/{evaluator_id}")
        assert single.status_code == 200, single.text
        assert by_id[evaluator_id] == single.json()["data"]


async def test_patch_llm_rename_to_taken_name_is_already_exists(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Renaming an LLM evaluator to a name another evaluator already holds is the same
    already_exists conflict a create would give, not a generic one."""
    async with db() as session:
        holder = await _add_llm_evaluator(session, f"holder-{token_hex(4)}", tagged=False)
        renamer = await _add_llm_evaluator(session, f"renamer-{token_hex(4)}", tagged=False)

    route = f"v1/evaluators/{GlobalID('LLMEvaluator', str(renamer.id))}"
    response = await httpx_client.patch(route, json={"type": "llm", "name": str(holder.name)})
    assert response.status_code == 409, response.text
    problem = response.json()
    assert problem["code"] == "already_exists"
    assert problem["existing_id"] == str(GlobalID("LLMEvaluator", str(holder.id)))


async def test_patch_code_rename_to_taken_name_is_already_exists(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> None:
    """Renaming a code evaluator to a name another evaluator already holds is the same
    already_exists conflict a create would give, not a generic one."""
    async with db() as session:
        holder = _add_code_evaluator(session, f"holder-{token_hex(4)}", sandbox_config)
        renamer = _add_code_evaluator(session, f"renamer-{token_hex(4)}", sandbox_config)
        await session.flush()

    route = f"v1/evaluators/{GlobalID('CodeEvaluator', str(renamer.id))}"
    response = await httpx_client.patch(route, json={"type": "code", "name": str(holder.name)})
    assert response.status_code == 409, response.text
    problem = response.json()
    assert problem["code"] == "already_exists"
    assert problem["existing_id"] == str(GlobalID("CodeEvaluator", str(holder.id)))


async def test_delete_still_bound_llm_evaluator_reports_binding_counts(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
) -> None:
    """Deleting an evaluator a dataset binding still references is refused with
    still_bound and the binding counts, not a bare conflict."""
    async with db() as session:
        evaluator = await _add_llm_evaluator(session, f"bound-{token_hex(4)}", tagged=False)
        dataset = models.Dataset(name=f"bound-{token_hex(4)}", description=None, metadata_={})
        session.add(dataset)
        await session.flush()
        session.add(
            models.DatasetEvaluators(
                dataset_id=dataset.id,
                evaluator_id=evaluator.id,
                name=IdentifierModel.model_validate(f"binding-{token_hex(4)}"),
                input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
                project=models.Project(name=f"bound-project-{token_hex(4)}"),
            )
        )
        await session.flush()

    route = f"v1/evaluators/{GlobalID('LLMEvaluator', str(evaluator.id))}"
    response = await httpx_client.delete(route)
    assert response.status_code == 409, response.text
    problem = response.json()
    assert problem["type"] == "urn:phoenix:problem:conflict"
    assert problem["title"] == "Conflict"
    assert problem["reason"] == "still_bound"
    assert problem["binding_counts"] == {"project": 0, "dataset": 1}


async def test_wrong_typed_ids_are_invalid_argument_not_a_crash(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    correctness_llm_evaluator: models.LLMEvaluator,
    sandbox_config: models.SandboxConfig,
) -> None:
    """A well-formed GlobalID of the wrong node type -- not just a malformed one -- is a
    client error on every id field these routes decode, in the path, the query, and the
    body, never a raw ValueError leaking as a 500."""
    wrong_type = str(GlobalID("Project", "1"))
    async with db() as session:
        code = _add_code_evaluator(session, f"wrong-type-{token_hex(4)}", sandbox_config)
        await session.flush()
        code_route = f"v1/evaluators/{GlobalID('CodeEvaluator', str(code.id))}"
    llm_route = f"v1/evaluators/{GlobalID('LLMEvaluator', str(correctness_llm_evaluator.id))}"
    categorical_output_configs = [
        {
            "type": "CATEGORICAL",
            "name": "correctness",
            "optimization_direction": "MAXIMIZE",
            "values": [{"label": "correct", "score": 1.0}],
        }
    ]

    responses = (
        # path: evaluator_id, on every verb and sub-route that takes one
        await httpx_client.get(f"v1/evaluators/{wrong_type}"),
        await httpx_client.patch(f"v1/evaluators/{wrong_type}", json={"type": "llm", "name": "x"}),
        await httpx_client.delete(f"v1/evaluators/{wrong_type}"),
        await httpx_client.get(f"v1/evaluators/{wrong_type}/versions"),
        await httpx_client.post(
            f"v1/evaluators/{wrong_type}/versions", json={"source_code": "def evaluate(): ..."}
        ),
        # query: the list route's cursor
        await httpx_client.get("v1/evaluators", params={"cursor": wrong_type}),
        # body: sandbox_config_id, on create, patch, and deploy
        await httpx_client.post(
            "v1/evaluators",
            json={
                "type": "code",
                "name": f"wrong-sandbox-{token_hex(4)}",
                "source_code": "def evaluate(output):\n    return {'score': 1.0}",
                "language": "PYTHON",
                "sandbox_config_id": wrong_type,
                "input_mapping": {"literal_mapping": {}, "path_mapping": {}},
                "output_configs": [_SCORE_JSON],
            },
        ),
        await httpx_client.patch(
            code_route,
            json={"type": "code", "sandbox_config_id": wrong_type, "description": "wrong sandbox"},
        ),
        await httpx_client.post(
            f"{code_route}/versions",
            json={
                "source_code": "def evaluate(output):\n    return {'score': 9.0}",
                "sandbox_config_id": wrong_type,
            },
        ),
        # body: expected_current_version_id, on deploy
        await httpx_client.post(
            f"{code_route}/versions",
            json={
                "source_code": "def evaluate(output):\n    return {'score': 9.0}",
                "expected_current_version_id": wrong_type,
            },
        ),
        # body: prompt.selector.prompt_version_id, on create and patch LLM
        await httpx_client.post(
            "v1/evaluators",
            json={
                "type": "llm",
                "name": f"wrong-prompt-{token_hex(4)}",
                "prompt": {"selector": {"type": "version", "prompt_version_id": wrong_type}},
                "output_configs": categorical_output_configs,
            },
        ),
        await httpx_client.patch(
            llm_route,
            json={
                "type": "llm",
                "prompt": {"selector": {"type": "version", "prompt_version_id": wrong_type}},
            },
        ),
    )
    for response in responses:
        assert response.status_code == 422, response.text
        assert response.json()["code"] == "invalid_argument", response.text


def test_problem_details_cover_every_declared_error_response() -> None:
    """Every error status the opted-in routers (evaluators, sandbox_configs) declare must be
    problem+json referencing ProblemDetail, including the 403 the outer /v1 router otherwise
    documents as plain text and the 422 FastAPI would otherwise document as HTTPValidationError."""
    app = FastAPI()
    app.include_router(router)
    app.include_router(sandbox_configs_router)
    schema = app.openapi()
    checked = 0
    for path, operations in schema["paths"].items():
        for method, operation in operations.items():
            for status, response in operation.get("responses", {}).items():
                if status.startswith("2"):
                    continue
                checked += 1
                content = response.get("content", {})
                assert content.get("application/problem+json", {}).get("schema") == {
                    "$ref": "#/components/schemas/ProblemDetail"
                }, (path, method, status, content)
    assert checked > 0
