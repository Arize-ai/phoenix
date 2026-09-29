import asyncio
from secrets import token_hex
from typing import Any, cast

import httpx
import pytest
from fastapi import FastAPI
from sqlalchemy.ext.asyncio import AsyncEngine
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import ContinuousOutputConfig, OptimizationDirection
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.server.api.exceptions import Conflict
from phoenix.server.api.helpers.evaluator_service import (
    CreateCodeEvaluatorVersionInput,
    EvaluatorServiceContext,
    create_code_evaluator_version,
)
from phoenix.server.api.routers.v1.evaluators import router
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
    assert "prompt_id" in schemas["LLMEvaluatorDefinition"]["required"]

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

    prompt_schema = schemas["LLMEvaluatorDefinition"]["properties"]["prompt_version"]
    assert {"$ref": "#/components/schemas/PromptVersion"} in prompt_schema["anyOf"]
    assert "prompt_version" not in schemas["PatchLLMEvaluatorRequest"]["properties"]
    assert "prompt_version_id" in schemas["PatchLLMEvaluatorRequest"]["properties"]
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
    assert set(unprocessable) == {"application/json", "text/plain"}
    assert unprocessable["application/json"]["schema"] == {
        "$ref": "#/components/schemas/HTTPValidationError"
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
    with pytest.raises(Conflict):
        await deploy


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
        assert response.json()["detail"][0]["loc"] == ["body", "output_configs"]

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
    assert patch.json()["detail"][0]["loc"][-1] == "output_configs"
    deploy = await httpx_client.post(
        f"v1/evaluators/{evaluator_id}/versions",
        json={
            "source_code": "def evaluate(output):\n    return {'score': 0.0}",
            "output_configs": [],
        },
    )
    assert deploy.status_code == 422, deploy.text
    assert deploy.json()["detail"][0]["loc"] == ["body", "output_configs"]

    kept = await httpx_client.get(f"v1/evaluators/{evaluator_id}")
    assert kept.status_code == 200, kept.text
    assert [config["name"] for config in kept.json()["data"]["output_configs"]] == ["score"]
    assert kept.json()["data"]["source_code"] == "def evaluate(output): ..."
