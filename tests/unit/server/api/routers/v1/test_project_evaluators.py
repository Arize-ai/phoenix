"""REST project evaluator bindings: checks that only the unit harness can drive cheaply."""

from secrets import token_hex
from typing import Any

import httpx
from sqlalchemy import func, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.server.encryption import EncryptionService
from phoenix.server.types import DbSessionFactory

_MAPPING = {"literal_mapping": {}, "path_mapping": {"output": "output"}}


def _llm_binding_body(name: str, custom_provider_id: str) -> dict[str, Any]:
    return {
        "name": name,
        "evaluation_target": "SESSION",
        "sampling_rate": 0.5,
        "input_mapping": _MAPPING,
        "evaluator": {
            "type": "llm",
            "description": "correctness",
            "output_configs": [
                {
                    "type": "CATEGORICAL",
                    "name": "correctness",
                    "optimization_direction": "MAXIMIZE",
                    "values": [
                        {"label": "correct", "score": 1},
                        {"label": "incorrect", "score": 0},
                    ],
                }
            ],
            "prompt_version": {
                "model_provider": "OPENAI",
                "model_name": "gpt-4o-mini",
                "custom_provider_id": custom_provider_id,
                "template_type": "CHAT",
                "template_format": "MUSTACHE",
                "template": {
                    "type": "chat",
                    "messages": [
                        {"role": "user", "content": [{"type": "text", "text": "Judge {{output}}"}]}
                    ],
                },
                "invocation_parameters": {"type": "openai", "openai": {"temperature": 0}},
                "tools": {
                    "type": "tools",
                    "tools": [
                        {
                            "type": "function",
                            "function": {
                                "name": "correctness",
                                "description": "correctness",
                                "parameters": {
                                    "type": "object",
                                    "properties": {
                                        "label": {
                                            "type": "string",
                                            "enum": ["correct", "incorrect"],
                                            "description": "correctness",
                                        }
                                    },
                                    "required": ["label"],
                                },
                            },
                        }
                    ],
                    "tool_choice": {"type": "specific_function", "function_name": "correctness"},
                },
            },
        },
    }


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


async def test_llm_create_checks_the_custom_provider(
    httpx_client: httpx.AsyncClient, db: DbSessionFactory
) -> None:
    """An inline prompt version is held to the same provider rules as POST /v1/prompts."""
    project = await _project(db)
    async with db() as session:
        provider = models.GenerativeModelCustomProvider(
            name=token_hex(8),
            provider="anthropic",
            sdk="anthropic",
            config=EncryptionService().encrypt(b"{}"),
        )
        session.add(provider)
        await session.flush()
    route = f"v1/projects/{GlobalID('Project', str(project.id))}/evaluators"

    incompatible = await httpx_client.post(
        route,
        json=_llm_binding_body(
            "incompatible", str(GlobalID("GenerativeModelCustomProvider", str(provider.id)))
        ),
    )
    assert incompatible.status_code == 422, incompatible.text
    assert "cannot serve model provider OPENAI" in incompatible.text

    missing = await httpx_client.post(
        route,
        json=_llm_binding_body(
            "missing", str(GlobalID("GenerativeModelCustomProvider", str(provider.id + 1000)))
        ),
    )
    assert missing.status_code == 404, missing.text
    assert await _binding_count(db, project.id) == 0


async def test_referencing_a_missing_code_evaluator_is_not_found(
    httpx_client: httpx.AsyncClient, db: DbSessionFactory
) -> None:
    """A well-formed id for a definition that does not exist is 404, as on datasets."""
    project = await _project(db)
    response = await httpx_client.post(
        f"v1/projects/{GlobalID('Project', str(project.id))}/evaluators",
        json={
            "name": "missing-definition",
            "evaluation_target": "SPAN",
            "sampling_rate": 1.0,
            "evaluator": {
                "type": "reference",
                "evaluator_id": str(GlobalID("CodeEvaluator", "999999999")),
            },
        },
    )
    assert response.status_code == 404, response.text
    assert await _binding_count(db, project.id) == 0
