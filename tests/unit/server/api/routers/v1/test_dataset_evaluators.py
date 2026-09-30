"""REST dataset evaluator bindings: checks that only the unit harness can drive cheaply."""

from secrets import token_hex

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
