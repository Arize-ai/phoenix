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
