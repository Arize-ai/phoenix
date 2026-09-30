"""Contract test for the shared problem-details adapter (`ProblemDetailsRoute` /
`evaluator_api_errors`), used by the evaluator, dataset-binding, project-binding, and
sandbox routes.

Each distinct, externally observable error condition is checked once here against
whichever route triggers it most simply, rather than re-checked on every route that could
raise it: the adapter renders every one of them the same way, so testing it per-route would
be testing the same rendering code repeatedly instead of testing more of the contract.

Not covered here: `forbidden` (403) needs a viewer-role-restricted client, which no unit
fixture in this suite provides; `concurrent_change` needs two overlapping requests racing
on the same row, already exercised for `version_mismatch`'s sibling case in
`test_evaluator_definitions.py`; `incompatible_override` on a *binding* PATCH is exercised
in `test_dataset_evaluators.py` and on a *definition* PATCH in `test_evaluator_definitions.py`.
"""

from secrets import token_hex
from typing import Any, Iterator, Optional

import httpx
import pytest
from strawberry.relay import GlobalID

from phoenix.db import models
from phoenix.db.types.annotation_configs import ContinuousOutputConfig, OptimizationDirection
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.identifier import Identifier as IdentifierModel
from phoenix.server.types import DbSessionFactory

_SCORE_JSON = {"type": "CONTINUOUS", "name": "score", "optimization_direction": "MAXIMIZE"}


def _assert_problem(
    response: httpx.Response,
    *,
    status: int,
    code: str,
    reason: Optional[str] = None,
    **fields: Any,
) -> dict[str, Any]:
    """The shared shape every problem-detail response must have, plus whatever `reason`-
    specific fields the caller expects."""
    assert response.status_code == status, response.text
    assert response.headers["content-type"] == "application/problem+json", response.text
    problem = response.json()
    assert problem["type"] == f"urn:phoenix:problem:{code}", problem
    assert problem["title"], problem
    assert problem["status"] == status
    assert problem["detail"]
    assert problem["code"] == code
    if reason is not None:
        assert problem["reason"] == reason, problem
    for key, value in fields.items():
        assert problem[key] == value, (key, problem)
    return problem


async def test_not_found(httpx_client: httpx.AsyncClient) -> None:
    response = await httpx_client.get(f"v1/evaluators/{GlobalID('CodeEvaluator', '999999999')}")
    _assert_problem(response, status=404, code="not_found")


async def test_already_exists_carries_the_existing_id(
    httpx_client: httpx.AsyncClient, sandbox_config: models.SandboxConfig
) -> None:
    body = {
        "type": "code",
        "name": f"taken-{token_hex(4)}",
        "source_code": "def evaluate(output):\n    return {'score': 1.0}",
        "language": sandbox_config.language,
        "sandbox_config_id": str(GlobalID("SandboxConfig", str(sandbox_config.id))),
        "input_mapping": {"literal_mapping": {}, "path_mapping": {}},
        "output_configs": [_SCORE_JSON],
    }
    first = await httpx_client.post("v1/evaluators", json=body)
    assert first.status_code == 201, first.text
    second = await httpx_client.post("v1/evaluators", json=body)
    _assert_problem(
        second, status=409, code="already_exists", existing_id=first.json()["data"]["id"]
    )


async def test_still_bound_carries_binding_counts(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> None:
    async with db() as session:
        evaluator = models.CodeEvaluator(
            name=IdentifierModel.model_validate(f"bound-{token_hex(4)}"),
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
        session.add(evaluator)
        await session.flush()
        project = models.Project(name=f"bound-{token_hex(4)}")
        trace_project = models.Project(name=f"bound-traces-{token_hex(4)}")
        session.add_all([project, trace_project])
        await session.flush()
        session.add(
            models.ProjectEvaluator(
                project_id=project.id,
                trace_project_id=trace_project.id,
                evaluator_id=evaluator.id,
                name=IdentifierModel.model_validate(f"binding-{token_hex(4)}"),
                evaluation_target="SPAN",
                sampling_rate=1.0,
                filter_condition="",
                enabled=True,
            )
        )
        await session.flush()

    response = await httpx_client.delete(
        f"v1/evaluators/{GlobalID('CodeEvaluator', str(evaluator.id))}"
    )
    _assert_problem(
        response,
        status=409,
        code="conflict",
        reason="still_bound",
        binding_counts={"project": 1, "dataset": 0},
    )


async def test_version_mismatch_carries_current_version_id(
    httpx_client: httpx.AsyncClient,
    db: DbSessionFactory,
    sandbox_config: models.SandboxConfig,
) -> None:
    async with db() as session:
        evaluator = models.CodeEvaluator(
            name=IdentifierModel.model_validate(f"mismatch-{token_hex(4)}"),
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
        session.add(evaluator)
        await session.flush()
        current_version_id = str(GlobalID("CodeEvaluatorVersion", str(evaluator.versions[0].id)))

    response = await httpx_client.post(
        f"v1/evaluators/{GlobalID('CodeEvaluator', str(evaluator.id))}/versions",
        json={
            "source_code": "def evaluate(output):\n    return {'score': 2.0}",
            "expected_current_version_id": str(GlobalID("CodeEvaluatorVersion", "999999999")),
        },
    )
    _assert_problem(
        response,
        status=409,
        code="conflict",
        reason="version_mismatch",
        current_version_id=current_version_id,
    )


async def test_validation_error_lists_normalized_field_errors(
    httpx_client: httpx.AsyncClient,
) -> None:
    response = await httpx_client.post(
        "v1/evaluators",
        json={
            "type": "code",
            "name": f"bad-{token_hex(4)}",
            "source_code": "def evaluate(output):\n    return {'score': 1.0}",
            "language": "PYTHON",
            "sandbox_config_id": str(GlobalID("SandboxConfig", "1")),
            "input_mapping": {"literal_mapping": {}, "path_mapping": {}},
            "output_configs": [],
        },
    )
    problem = _assert_problem(response, status=422, code="validation_error")
    assert problem["errors"] == [
        {
            "field": "body.output_configs",
            "code": "too_short",
            "message": ("List should have at least 1 item after validation, not 0"),
        }
    ]


async def test_invalid_argument_for_a_malformed_id(httpx_client: httpx.AsyncClient) -> None:
    response = await httpx_client.get("v1/evaluators/not-a-real-id")
    _assert_problem(response, status=422, code="invalid_argument")


@pytest.fixture
def locked_storage(db: DbSessionFactory) -> Iterator[None]:
    """Put the database in the state the disk-usage monitor sets when full."""
    db.should_not_insert_or_update = True
    try:
        yield
    finally:
        db.should_not_insert_or_update = False


async def test_insufficient_storage_when_writes_are_locked(
    httpx_client: httpx.AsyncClient, locked_storage: None
) -> None:
    response = await httpx_client.post(
        "v1/evaluators",
        json={
            "type": "code",
            "name": f"locked-{token_hex(4)}",
            "source_code": "def evaluate(output):\n    return {'score': 1.0}",
            "language": "PYTHON",
            "sandbox_config_id": str(GlobalID("SandboxConfig", "1")),
            "input_mapping": {"literal_mapping": {}, "path_mapping": {}},
            "output_configs": [_SCORE_JSON],
        },
    )
    _assert_problem(response, status=507, code="insufficient_storage")
