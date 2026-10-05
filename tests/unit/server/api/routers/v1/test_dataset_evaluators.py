"""REST dataset evaluator bindings: checks that only the unit harness can drive cheaply."""

from secrets import token_hex
from typing import Any

import httpx
from sqlalchemy import select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import ContinuousOutputConfig, OptimizationDirection
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.types import DbSessionFactory


async def test_detach_removes_trace_projects_atomically_and_keeps_definition_and_prompt(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    correctness_llm_evaluator: models.LLMEvaluator,
) -> None:
    async with db() as session:
        datasets = [models.Dataset(name=f"detach-{token_hex(4)}", metadata_={}) for _ in range(2)]
        session.add_all(datasets)
        await session.flush()
    dataset_routes = [
        f"v1/datasets/{GlobalID('Dataset', str(dataset.id))}/evaluators" for dataset in datasets
    ]
    evaluator_id = str(GlobalID("LLMEvaluator", str(correctness_llm_evaluator.id)))
    input_mapping: dict[str, Any] = {"literal_mapping": {}, "path_mapping": {}}

    async def create_binding(route: str, name: str) -> dict[str, Any]:
        response = await httpx_client.post(
            route,
            json={"name": name, "evaluator_id": evaluator_id, "input_mapping": input_mapping},
        )
        assert response.status_code == 201, response.text
        binding: dict[str, Any] = response.json()["data"]
        return binding

    bindings = [
        await create_binding(dataset_routes[0], f"first-{token_hex(4)}"),
        await create_binding(dataset_routes[0], f"second-{token_hex(4)}"),
        await create_binding(dataset_routes[1], f"other-{token_hex(4)}"),
    ]
    nested_trace_project = models.Project(name=f"nested-trace-{token_hex(4)}")
    nested_project_id = int(GlobalID.from_id(bindings[2]["trace_project_id"]).node_id)
    async with db() as session:
        session.add(
            models.ProjectEvaluator(
                project_id=nested_project_id,
                evaluator_id=correctness_llm_evaluator.id,
                trace_project=nested_trace_project,
                name=Identifier(f"nested-{token_hex(4)}"),
                evaluation_target="SPAN",
                sampling_rate=1.0,
            )
        )
        await session.flush()
    wrong_owner = await httpx_client.delete(
        dataset_routes[0],
        params={"dataset_evaluator_id": [binding["id"] for binding in bindings]},
    )
    assert wrong_owner.status_code == 422, wrong_owner.text
    for binding in bindings:
        assert (await httpx_client.get(f"v1/dataset_evaluators/{binding['id']}")).status_code == 200
        assert (
            await httpx_client.get(f"v1/projects/{binding['trace_project_id']}")
        ).status_code == 200

    first_dataset_bindings = bindings[:2]
    delete_params = {"dataset_evaluator_id": [binding["id"] for binding in first_dataset_bindings]}
    assert (await httpx_client.delete(dataset_routes[0], params=delete_params)).status_code == 204
    assert (await httpx_client.delete(dataset_routes[0], params=delete_params)).status_code == 204
    for binding in first_dataset_bindings:
        assert (
            await httpx_client.get(f"v1/projects/{binding['trace_project_id']}")
        ).status_code == 404
    assert (
        await httpx_client.get(f"v1/projects/{bindings[2]['trace_project_id']}")
    ).status_code == 200

    assert (
        await httpx_client.delete(
            dataset_routes[1], params={"dataset_evaluator_id": bindings[2]["id"]}
        )
    ).status_code == 204
    assert (
        await httpx_client.get(f"v1/projects/{bindings[2]['trace_project_id']}")
    ).status_code == 404
    assert (
        await httpx_client.get(f"v1/projects/{GlobalID('Project', str(nested_trace_project.id))}")
    ).status_code == 404
    assert (
        await httpx_client.get(
            f"v1/evaluators/{GlobalID('LLMEvaluator', str(correctness_llm_evaluator.id))}"
        )
    ).status_code == 200
    async with db() as session:
        assert (
            await session.scalar(
                select(models.Prompt.id).where(
                    models.Prompt.id == correctness_llm_evaluator.prompt_id
                )
            )
            == correctness_llm_evaluator.prompt_id
        )


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
