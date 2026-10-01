"""REST dataset evaluator bindings: checks that only the unit harness can drive cheaply."""

from secrets import token_hex
from typing import Any

import httpx
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import ContinuousOutputConfig, OptimizationDirection
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.types import DbSessionFactory


async def test_output_config_overrides_hold_at_least_one_config(
    httpx_client: httpx.AsyncClient, db: DbSessionFactory, sandbox_config: models.SandboxConfig
) -> None:
    """Null inherits the evaluator's output configs, so a stored override is never empty."""
    async with db() as session:
        dataset = models.Dataset(name=f"overrides-{token_hex(4)}", metadata_={})
        evaluator = models.CodeEvaluator(
            name=Identifier(f"overrides-{token_hex(4)}"),
            description=None,
            metadata_={},
            language=sandbox_config.language,
            sandbox_config_id=sandbox_config.id,
            input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
            output_configs=[
                ContinuousOutputConfig(
                    type="CONTINUOUS",
                    name="score",
                    optimization_direction=OptimizationDirection.MAXIMIZE,
                )
            ],
            versions=[models.CodeEvaluatorVersion(source_code="def evaluate(output): ...")],
        )
        session.add_all([dataset, evaluator])
        await session.flush()
    route = f"v1/datasets/{GlobalID('Dataset', str(dataset.id))}/evaluators"
    body = {
        "name": "code-binding",
        "input_mapping": {"literal_mapping": {}, "path_mapping": {}},
        "evaluator_id": str(GlobalID("CodeEvaluator", str(evaluator.id))),
    }

    rejected = await httpx_client.post(route, json={**body, "output_configs": []})
    assert rejected.status_code == 422, rejected.text
    created = await httpx_client.post(route, json=body)
    assert created.status_code == 201, created.text
    binding = created.json()["data"]
    assert binding["output_configs"] is None

    binding_route = f"v1/dataset_evaluators/{binding['id']}"
    rejected = await httpx_client.patch(binding_route, json={"output_configs": []})
    assert rejected.status_code == 422, rejected.text
    assert (await httpx_client.get(binding_route)).json()["data"] == binding


async def test_patch_rename_to_taken_name_is_already_exists(
    httpx_client: httpx.AsyncClient, db: DbSessionFactory, sandbox_config: models.SandboxConfig
) -> None:
    """Renaming a binding to a name another binding on the same dataset already holds is
    the same already_exists conflict a create would give, not a generic one."""
    async with db() as session:
        dataset = models.Dataset(name=f"rename-{token_hex(4)}", metadata_={})
        evaluator = models.CodeEvaluator(
            name=Identifier(f"rename-{token_hex(4)}"),
            description=None,
            metadata_={},
            language=sandbox_config.language,
            sandbox_config_id=sandbox_config.id,
            input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
            output_configs=[
                ContinuousOutputConfig(
                    type="CONTINUOUS",
                    name="score",
                    optimization_direction=OptimizationDirection.MAXIMIZE,
                )
            ],
            versions=[models.CodeEvaluatorVersion(source_code="def evaluate(output): ...")],
        )
        session.add_all([dataset, evaluator])
        await session.flush()
    route = f"v1/datasets/{GlobalID('Dataset', str(dataset.id))}/evaluators"
    input_mapping: dict[str, Any] = {"literal_mapping": {}, "path_mapping": {}}
    evaluator_id = str(GlobalID("CodeEvaluator", str(evaluator.id)))

    holder = (
        await httpx_client.post(
            route,
            json={
                "name": "holder",
                "input_mapping": input_mapping,
                "evaluator_id": evaluator_id,
            },
        )
    ).json()["data"]
    renamer = (
        await httpx_client.post(
            route,
            json={
                "name": "renamer",
                "input_mapping": input_mapping,
                "evaluator_id": evaluator_id,
            },
        )
    ).json()["data"]

    response = await httpx_client.patch(
        f"v1/dataset_evaluators/{renamer['id']}", json={"name": "holder"}
    )
    assert response.status_code == 409, response.text
    problem = response.json()
    assert problem["code"] == "already_exists"
    assert problem["existing_id"] == holder["id"]


async def test_wrong_typed_ids_are_invalid_argument_not_a_crash(
    httpx_client: httpx.AsyncClient, db: DbSessionFactory, sandbox_config: models.SandboxConfig
) -> None:
    """A well-formed GlobalID of the wrong node type is a client error on every id field
    these routes decode -- path, query, and body -- never a raw ValueError."""
    wrong_type = str(GlobalID("Project", "1"))
    async with db() as session:
        dataset = models.Dataset(name=f"wrong-type-{token_hex(4)}", metadata_={})
        evaluator = models.CodeEvaluator(
            name=Identifier(f"wrong-type-{token_hex(4)}"),
            description=None,
            metadata_={},
            language=sandbox_config.language,
            sandbox_config_id=sandbox_config.id,
            input_mapping=InputMapping(literal_mapping={}, path_mapping={}),
            output_configs=[
                ContinuousOutputConfig(
                    type="CONTINUOUS",
                    name="score",
                    optimization_direction=OptimizationDirection.MAXIMIZE,
                )
            ],
            versions=[models.CodeEvaluatorVersion(source_code="def evaluate(output): ...")],
        )
        session.add_all([dataset, evaluator])
        await session.flush()
    dataset_route = f"v1/datasets/{GlobalID('Dataset', str(dataset.id))}/evaluators"
    body = {
        "name": f"wrong-type-binding-{token_hex(4)}",
        "input_mapping": {"literal_mapping": {}, "path_mapping": {}},
        "evaluator_id": str(GlobalID("CodeEvaluator", str(evaluator.id))),
    }
    created = await httpx_client.post(dataset_route, json=body)
    assert created.status_code == 201, created.text
    binding_route = f"v1/dataset_evaluators/{created.json()['data']['id']}"

    responses = (
        # path: dataset_evaluator_id, on every verb that takes one
        await httpx_client.get(f"v1/dataset_evaluators/{wrong_type}"),
        await httpx_client.patch(f"v1/dataset_evaluators/{wrong_type}", json={"name": "x"}),
        await httpx_client.delete(f"v1/dataset_evaluators/{wrong_type}"),
        # query: the list route's cursor, and the bulk delete's repeated id
        await httpx_client.get(dataset_route, params={"cursor": wrong_type}),
        await httpx_client.delete(dataset_route, params={"dataset_evaluator_id": wrong_type}),
        # body: evaluator_id, on create
        await httpx_client.post(dataset_route, json={**body, "evaluator_id": wrong_type}),
    )
    for response in responses:
        assert response.status_code == 422, response.text
        assert response.json()["code"] == "invalid_argument", response.text

    # none of the refused calls above touched the binding created before them
    assert (await httpx_client.get(binding_route)).status_code == 200
