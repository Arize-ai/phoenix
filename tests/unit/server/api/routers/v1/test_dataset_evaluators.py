"""REST dataset evaluator bindings: checks that only the unit harness can drive cheaply."""

from secrets import token_hex
from typing import Any

import httpx
from sqlalchemy import func, select
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import ContinuousOutputConfig, OptimizationDirection
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier
from phoenix.server.encryption import EncryptionService
from phoenix.server.types import DbSessionFactory


def _llm_binding_body(name: str, custom_provider_id: str) -> dict[str, Any]:
    return {
        "name": name,
        "input_mapping": {"literal_mapping": {}, "path_mapping": {"output": "output"}},
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


async def _counts(db: DbSessionFactory, dataset_id: int) -> tuple[int, int]:
    async with db() as session:
        bindings = await session.scalar(
            select(func.count(models.DatasetEvaluators.id)).where(
                models.DatasetEvaluators.dataset_id == dataset_id
            )
        )
        evaluators = await session.scalar(select(func.count(models.LLMEvaluator.id)))
    return bindings or 0, evaluators or 0


async def test_llm_create_checks_the_custom_provider(
    httpx_client: httpx.AsyncClient, db: DbSessionFactory
) -> None:
    """An inline prompt version is held to the same provider rules as POST /v1/prompts."""
    async with db() as session:
        dataset = models.Dataset(name=f"provider-{token_hex(4)}", metadata_={})
        provider = models.GenerativeModelCustomProvider(
            name=token_hex(8),
            provider="anthropic",
            sdk="anthropic",
            config=EncryptionService().encrypt(b"{}"),
        )
        session.add_all([dataset, provider])
        await session.flush()
    route = f"v1/datasets/{GlobalID('Dataset', str(dataset.id))}/evaluators"
    before = await _counts(db, dataset.id)

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

    assert await _counts(db, dataset.id) == before


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
        "evaluator": {
            "type": "reference",
            "evaluator_id": str(GlobalID("CodeEvaluator", str(evaluator.id))),
        },
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
