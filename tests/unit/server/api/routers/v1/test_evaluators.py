"""Request-contract tests for evaluator management."""

import pytest
from pydantic import ValidationError

from phoenix.server.api.routers.v1.evaluators import (
    CreateProjectEvaluatorRequest,
    PatchProjectEvaluatorRequest,
)


@pytest.mark.parametrize(
    "body",
    [
        {},
        {"enabled": None},
        {"sampling_rate": 1.1},
        {"sampling_rate": float("nan")},
        {"evaluation_target": "SESSION"},
        {"evaluator_id": "another"},
        {"source_code": "def evaluate(): return 1"},
    ],
)
def test_invalid_binding_patch(body: dict[str, object]) -> None:
    with pytest.raises(ValidationError):
        PatchProjectEvaluatorRequest.model_validate(body)


def test_patch_preserves_omitted_fields_and_explicit_null() -> None:
    patch = PatchProjectEvaluatorRequest.model_validate({"enabled": False, "input_mapping": None})
    assert patch.model_fields_set == {"enabled", "input_mapping"}
    assert patch.enabled is False
    assert patch.input_mapping is None


def test_reference_creation_requires_no_definition() -> None:
    body = CreateProjectEvaluatorRequest.model_validate(
        {
            "name": "quality",
            "evaluation_target": "SPAN",
            "sampling_rate": 1,
            "evaluator": {"type": "reference", "evaluator_id": "existing"},
        }
    )
    assert body.evaluator.type == "reference"


def test_reference_rejects_inline_definition() -> None:
    with pytest.raises(ValidationError):
        CreateProjectEvaluatorRequest.model_validate(
            {
                "name": "quality",
                "evaluation_target": "SPAN",
                "sampling_rate": 1,
                "evaluator": {
                    "type": "reference",
                    "evaluator_id": "existing",
                    "source_code": "...",
                },
            }
        )
