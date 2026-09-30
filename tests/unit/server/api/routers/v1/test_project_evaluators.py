"""REST project evaluator bindings: checks that only the unit harness can drive cheaply."""

from secrets import token_hex

import httpx
from sqlalchemy import func, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.types import DbSessionFactory


async def _binding_count(db: DbSessionFactory, project_id: int) -> int:
    async with db() as session:
        count = await session.scalar(
            select(func.count(models.ProjectEvaluator.id)).where(
                models.ProjectEvaluator.project_id == project_id
            )
        )
    return count or 0


async def _project(db: DbSessionFactory) -> models.Project:
    async with db() as session:
        project = models.Project(name=f"bindings-{token_hex(4)}")
        session.add(project)
        await session.flush()
    return project


async def test_llm_binding_without_input_mapping_stores_null(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    correctness_llm_evaluator: models.LLMEvaluator,
) -> None:
    """An LLM evaluator has no mapping of its own, so null binds variables by name."""
    project = await _project(db)
    response = await httpx_client.post(
        f"v1/projects/{GlobalID('Project', str(project.id))}/evaluators",
        json={
            "name": "unmapped",
            "evaluator_id": str(GlobalID("LLMEvaluator", str(correctness_llm_evaluator.id))),
            "evaluation_target": "SESSION",
            "sampling_rate": 0.5,
        },
    )
    assert response.status_code == 201, response.text
    assert response.json()["data"]["input_mapping"] is None
    async with db() as session:
        stored = await session.scalar(
            select(models.ProjectEvaluator.input_mapping).where(
                models.ProjectEvaluator.project_id == project.id
            )
        )
    assert stored is None


async def test_trace_target_binding_round_trips(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    correctness_llm_evaluator: models.LLMEvaluator,
) -> None:
    """TRACE-target bindings create and list like SPAN and SESSION do; only those two
    are covered elsewhere."""
    project = await _project(db)
    response = await httpx_client.post(
        f"v1/projects/{GlobalID('Project', str(project.id))}/evaluators",
        json={
            "name": "trace-target",
            "evaluator_id": str(GlobalID("LLMEvaluator", str(correctness_llm_evaluator.id))),
            "evaluation_target": "TRACE",
            "sampling_rate": 1.0,
        },
    )
    assert response.status_code == 201, response.text
    created = response.json()["data"]
    assert created["evaluation_target"] == "TRACE"

    response = await httpx_client.get(
        f"v1/projects/{GlobalID('Project', str(project.id))}/evaluators"
    )
    assert response.status_code == 200, response.text
    listed = response.json()["data"]
    assert [item["id"] for item in listed] == [created["id"]]
    assert listed[0]["evaluation_target"] == "TRACE"


async def test_referencing_a_missing_evaluator_is_not_found(
    httpx_client: httpx.AsyncClient, db: DbSessionFactory
) -> None:
    """A well-formed id for a definition that does not exist is 404, as on datasets."""
    project = await _project(db)
    for typename in ("CodeEvaluator", "LLMEvaluator"):
        response = await httpx_client.post(
            f"v1/projects/{GlobalID('Project', str(project.id))}/evaluators",
            json={
                "name": "missing-definition",
                "evaluator_id": str(GlobalID(typename, "999999999")),
                "evaluation_target": "SPAN",
                "sampling_rate": 1.0,
            },
        )
        assert response.status_code == 404, response.text
        assert response.json()["code"] == "not_found"
    assert await _binding_count(db, project.id) == 0


async def test_patch_rename_to_taken_name_is_already_exists(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    correctness_llm_evaluator: models.LLMEvaluator,
) -> None:
    """Renaming a binding to a name another binding on the same project already holds is
    the same already_exists conflict a create would give, not a generic one."""
    project = await _project(db)
    route = f"v1/projects/{GlobalID('Project', str(project.id))}/evaluators"
    evaluator_id = str(GlobalID("LLMEvaluator", str(correctness_llm_evaluator.id)))

    holder = (
        await httpx_client.post(
            route,
            json={
                "name": "holder",
                "evaluator_id": evaluator_id,
                "evaluation_target": "SPAN",
                "sampling_rate": 1.0,
            },
        )
    ).json()["data"]
    renamer = (
        await httpx_client.post(
            route,
            json={
                "name": "renamer",
                "evaluator_id": evaluator_id,
                "evaluation_target": "SPAN",
                "sampling_rate": 1.0,
            },
        )
    ).json()["data"]

    response = await httpx_client.patch(
        f"v1/project_evaluators/{renamer['id']}", json={"name": "holder"}
    )
    assert response.status_code == 409, response.text
    problem = response.json()
    assert problem["code"] == "already_exists"
    assert problem["existing_id"] == holder["id"]


async def test_malformed_ids_are_invalid_argument_not_a_crash(
    httpx_client: httpx.AsyncClient,
) -> None:
    """A GlobalID that fails to parse is a client error on every route that takes one,
    matching the other evaluator-binding routes; none of them may leak a raw ValueError."""
    for response in (
        await httpx_client.patch("v1/project_evaluators/not-a-real-id", json={"name": "x"}),
        await httpx_client.delete("v1/project_evaluators/not-a-real-id"),
    ):
        assert response.status_code == 422, response.text
        assert response.json()["code"] == "invalid_argument"


async def test_malformed_bulk_delete_id_is_invalid_argument_not_a_crash(
    httpx_client: httpx.AsyncClient, db: DbSessionFactory
) -> None:
    """The bulk-delete route decodes each id in the list; a malformed one is still a client
    error, not a raw ValueError leaking past the project lookup that runs first."""
    project = await _project(db)
    response = await httpx_client.delete(
        f"v1/projects/{GlobalID('Project', str(project.id))}/evaluators",
        params={"project_evaluator_id": "not-a-real-id"},
    )
    assert response.status_code == 422, response.text
    assert response.json()["code"] == "invalid_argument"


async def test_wrong_typed_ids_are_invalid_argument_not_a_crash(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    correctness_llm_evaluator: models.LLMEvaluator,
) -> None:
    """A well-formed GlobalID of the wrong node type -- not just a malformed one -- is a
    client error on every id field these routes decode, in the path, the query, and the
    body, never a raw ValueError leaking as a 500."""
    wrong_type = str(GlobalID("Dataset", "1"))
    project = await _project(db)
    project_route = f"v1/projects/{GlobalID('Project', str(project.id))}/evaluators"
    body = {
        "name": f"wrong-type-{token_hex(4)}",
        "evaluator_id": str(GlobalID("LLMEvaluator", str(correctness_llm_evaluator.id))),
        "evaluation_target": "SESSION",
        "sampling_rate": 0.5,
    }
    created = await httpx_client.post(project_route, json=body)
    assert created.status_code == 201, created.text
    binding_route = f"v1/project_evaluators/{created.json()['data']['id']}"

    responses = (
        # path: project_evaluator_id, on every verb that takes one
        await httpx_client.get(f"v1/project_evaluators/{wrong_type}"),
        await httpx_client.patch(f"v1/project_evaluators/{wrong_type}", json={"name": "x"}),
        await httpx_client.delete(f"v1/project_evaluators/{wrong_type}"),
        # query: the list route's cursor, and the bulk delete's repeated id
        await httpx_client.get(project_route, params={"cursor": wrong_type}),
        await httpx_client.delete(project_route, params={"project_evaluator_id": wrong_type}),
        # body: evaluator_id, on create
        await httpx_client.post(project_route, json={**body, "evaluator_id": wrong_type}),
    )
    for response in responses:
        assert response.status_code == 422, response.text
        assert response.json()["code"] == "invalid_argument", response.text

    # none of the refused calls above touched the binding created before them
    assert (await httpx_client.get(binding_route)).status_code == 200
