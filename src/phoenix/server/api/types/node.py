import re
from base64 import b64decode
from binascii import Error as BinasciiError
from collections.abc import Callable
from typing import TYPE_CHECKING, Annotated, TypeAlias, cast

from pydantic import AfterValidator
from strawberry.relay import GlobalID
from strawberry.relay.types import GlobalIDValueError

_COMPOSITE_GLOBAL_ID_PATTERN = re.compile(r"[^:]+:[^:]+(:[^:]+)+")

if TYPE_CHECKING:
    from phoenix.db.models import SandboxBackendType


def is_composite_global_id(node_id: str) -> bool:
    try:
        decoded_node_id = b64decode(node_id).decode()
    except (BinasciiError, UnicodeDecodeError):
        return False
    return _COMPOSITE_GLOBAL_ID_PATTERN.match(decoded_node_id) is not None


def from_global_id(global_id: GlobalID) -> tuple[str, int]:
    """
    Decode the given global id into a type and id.

    :param global_id: The global id to decode.
    :return: A tuple of type and id.
    """
    return global_id.type_name, int(global_id.node_id)


def from_global_id_with_expected_type(global_id: GlobalID, expected_type_name: str) -> int:
    """
    Decodes the given global id and return the id, checking that the type
    matches the expected type.
    """
    type_name = global_id.type_name
    if type_name != expected_type_name:
        raise ValueError(
            f"The node id must correspond to a node of type {expected_type_name}, "
            f"but instead corresponds to a node of type: {type_name}"
        )
    try:
        return int(global_id.node_id)
    except ValueError as exc:
        raise ValueError(
            f"The node id must correspond to a node of type {expected_type_name}, "
            f"but the id is not a valid integer"
        ) from exc


def from_global_id_str_with_expected_type(global_id: GlobalID, expected_type_name: str) -> str:
    """Decode a GlobalID with a non-integer Relay node payload (type-checked)."""
    type_name = global_id.type_name
    if type_name != expected_type_name:
        raise ValueError(
            f"The node id must correspond to a node of type {expected_type_name}, "
            f"but instead corresponds to a node of type: {type_name}"
        )
    return str(global_id.node_id)


def get_sandbox_backend_type_from_global_id(global_id: GlobalID) -> "SandboxBackendType":
    return cast(
        "SandboxBackendType",
        from_global_id_str_with_expected_type(
            global_id,
            expected_type_name="SandboxProvider",
        ),
    )


def relay_node_id_validator(node_type: Callable[[], type]) -> AfterValidator:
    """Pydantic validator for a Relay node id."""

    def check(value: str) -> str:
        try:
            global_id = GlobalID.from_id(value)
        except GlobalIDValueError as error:
            raise ValueError(f"{value!r} is not a Relay node id: {error}") from error
        from_global_id_with_expected_type(global_id, node_type().__name__)
        return value

    return AfterValidator(check)


def _project() -> type:
    from phoenix.server.api.types.Project import Project

    return Project


def _project_session() -> type:
    from phoenix.server.api.types.ProjectSession import ProjectSession

    return ProjectSession


def _span() -> type:
    from phoenix.server.api.types.Span import Span

    return Span


def _prompt() -> type:
    from phoenix.server.api.types.Prompt import Prompt

    return Prompt


def _prompt_version() -> type:
    from phoenix.server.api.types.PromptVersion import PromptVersion

    return PromptVersion


def _dataset() -> type:
    from phoenix.server.api.types.Dataset import Dataset

    return Dataset


def _dataset_version() -> type:
    from phoenix.server.api.types.DatasetVersion import DatasetVersion

    return DatasetVersion


def _experiment() -> type:
    from phoenix.server.api.types.Experiment import Experiment

    return Experiment


def _dataset_evaluator() -> type:
    from phoenix.server.api.types.Evaluator import DatasetEvaluator

    return DatasetEvaluator


def _code_evaluator() -> type:
    from phoenix.server.api.types.Evaluator import CodeEvaluator

    return CodeEvaluator


def _llm_evaluator() -> type:
    from phoenix.server.api.types.Evaluator import LLMEvaluator

    return LLMEvaluator


ProjectNodeId: TypeAlias = Annotated[str, relay_node_id_validator(_project)]
ProjectSessionNodeId: TypeAlias = Annotated[str, relay_node_id_validator(_project_session)]
SpanNodeId: TypeAlias = Annotated[str, relay_node_id_validator(_span)]
PromptNodeId: TypeAlias = Annotated[str, relay_node_id_validator(_prompt)]
PromptVersionNodeId: TypeAlias = Annotated[str, relay_node_id_validator(_prompt_version)]
DatasetNodeId: TypeAlias = Annotated[str, relay_node_id_validator(_dataset)]
DatasetVersionNodeId: TypeAlias = Annotated[str, relay_node_id_validator(_dataset_version)]
ExperimentNodeId: TypeAlias = Annotated[str, relay_node_id_validator(_experiment)]
DatasetEvaluatorNodeId: TypeAlias = Annotated[str, relay_node_id_validator(_dataset_evaluator)]
CodeEvaluatorNodeId: TypeAlias = Annotated[str, relay_node_id_validator(_code_evaluator)]
LLMEvaluatorNodeId: TypeAlias = Annotated[str, relay_node_id_validator(_llm_evaluator)]
