from typing import Any

import pytest
from pydantic import TypeAdapter, ValidationError
from strawberry.relay import GlobalID

from phoenix.server.api.types.Dataset import Dataset
from phoenix.server.api.types.DatasetVersion import DatasetVersion
from phoenix.server.api.types.Evaluator import CodeEvaluator, DatasetEvaluator, LLMEvaluator
from phoenix.server.api.types.Experiment import Experiment
from phoenix.server.api.types.node import (
    CodeEvaluatorNodeId,
    DatasetEvaluatorNodeId,
    DatasetNodeId,
    DatasetVersionNodeId,
    ExperimentNodeId,
    LLMEvaluatorNodeId,
    ProjectNodeId,
    ProjectSessionNodeId,
    PromptNodeId,
    PromptVersionNodeId,
    SpanNodeId,
    from_global_id,
    from_global_id_with_expected_type,
    is_composite_global_id,
)
from phoenix.server.api.types.Project import Project
from phoenix.server.api.types.ProjectSession import ProjectSession
from phoenix.server.api.types.Prompt import Prompt
from phoenix.server.api.types.PromptVersion import PromptVersion
from phoenix.server.api.types.Span import Span


def test_from_global_id_returns_type_name_and_node_id() -> None:
    global_id = GlobalID(type_name="Dimension", node_id=str(1))
    type_name, node_id = from_global_id(global_id)
    assert type_name == "Dimension"
    assert node_id == 1


def test_from_global_id_with_expected_type_returns_node_id() -> None:
    global_id = GlobalID(type_name="Dimension", node_id=str(1))
    node_id = from_global_id_with_expected_type(global_id=global_id, expected_type_name="Dimension")
    assert node_id == 1


def test_from_global_id_with_expected_type_raises_value_error_for_unexpected_type() -> None:
    global_id = GlobalID(type_name="EmbeddingDimension", node_id=str(1))
    with pytest.raises(ValueError):
        from_global_id_with_expected_type(global_id=global_id, expected_type_name="Dimension")


@pytest.mark.parametrize("node_id", ["default", "not base64", "////"])
def test_is_composite_global_id_returns_false_for_invalid_base64(node_id: str) -> None:
    assert is_composite_global_id(node_id) is False


def test_is_composite_global_id_returns_false_for_simple_global_id() -> None:
    node_id = str(GlobalID(type_name="Project", node_id="1"))
    assert is_composite_global_id(node_id) is False


def test_is_composite_global_id_returns_true_for_composite_global_id() -> None:
    node_id = str(GlobalID(type_name="ExperimentRepeatedRunGroup", node_id="1:2"))
    assert is_composite_global_id(node_id) is True


NODE_ID_TYPES: list[tuple[Any, type]] = [
    (ProjectNodeId, Project),
    (ProjectSessionNodeId, ProjectSession),
    (SpanNodeId, Span),
    (PromptNodeId, Prompt),
    (PromptVersionNodeId, PromptVersion),
    (DatasetNodeId, Dataset),
    (DatasetVersionNodeId, DatasetVersion),
    (ExperimentNodeId, Experiment),
    (DatasetEvaluatorNodeId, DatasetEvaluator),
    (CodeEvaluatorNodeId, CodeEvaluator),
    (LLMEvaluatorNodeId, LLMEvaluator),
]


@pytest.mark.parametrize("node_id_type,node_type", NODE_ID_TYPES)
def test_node_id_type_accepts_global_id_of_its_strawberry_node_type(
    node_id_type: Any, node_type: type
) -> None:
    global_id = str(GlobalID(node_type.__name__, "1"))
    assert TypeAdapter(node_id_type).validate_python(global_id) == global_id


@pytest.mark.parametrize("node_id_type,node_type", NODE_ID_TYPES)
def test_node_id_type_rejects_global_id_of_another_node_type(
    node_id_type: Any, node_type: type
) -> None:
    other = next(t for _, t in NODE_ID_TYPES if t is not node_type)
    with pytest.raises(ValidationError, match=f"a node of type {node_type.__name__}"):
        TypeAdapter(node_id_type).validate_python(str(GlobalID(other.__name__, "1")))


@pytest.mark.parametrize(
    "value,message",
    [
        ("not base64!", "is not a Relay node id"),
        (str(GlobalID("Project", "abc")), "not a valid integer"),
        (str(GlobalID("Project", "")), "not a valid integer"),
    ],
)
def test_project_node_id_rejects_malformed_ids(value: str, message: str) -> None:
    with pytest.raises(ValidationError, match=message):
        TypeAdapter(ProjectNodeId).validate_python(value)
