import zlib
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Optional, TypeVar


class BuiltInEvaluator(ABC):
    name: str
    description: Optional[str] = None
    metadata: dict[str, Any] = {}
    input_schema: dict[str, Any] = {}

    @abstractmethod
    def evaluate(self, **kwargs: Any) -> Any:
        """Evaluate the input and return a result."""
        ...


@dataclass
class BuiltInEvaluatorInfo:
    id: int
    evaluator_class: type[BuiltInEvaluator]

    @property
    def name(self) -> str:
        return self.evaluator_class.name

    @property
    def description(self) -> Optional[str]:
        return self.evaluator_class.description

    @property
    def metadata(self) -> dict[str, Any]:
        return self.evaluator_class.metadata

    @property
    def input_schema(self) -> dict[str, Any]:
        return self.evaluator_class.input_schema


_BUILTIN_EVALUATORS: dict[str, BuiltInEvaluatorInfo] = {}
_BUILTIN_EVALUATORS_BY_ID: dict[int, BuiltInEvaluatorInfo] = {}

T = TypeVar("T", bound=BuiltInEvaluator)


def _generate_builtin_evaluator_id(name: str) -> int:
    """Generate a stable negative ID using CRC32 checksum."""
    return -abs(zlib.crc32(name.encode("utf-8")))


def register_builtin_evaluator(cls: type[T]) -> type[T]:
    evaluator_id = _generate_builtin_evaluator_id(cls.name)
    definition = BuiltInEvaluatorInfo(
        id=evaluator_id,
        evaluator_class=cls,
    )
    _BUILTIN_EVALUATORS[cls.name] = definition
    _BUILTIN_EVALUATORS_BY_ID[evaluator_id] = definition
    return cls


def get_builtin_evaluators() -> list[BuiltInEvaluatorInfo]:
    return list(_BUILTIN_EVALUATORS.values())


def get_builtin_evaluator_by_id(evaluator_id: int) -> Optional[BuiltInEvaluatorInfo]:
    return _BUILTIN_EVALUATORS_BY_ID.get(evaluator_id)


@register_builtin_evaluator
class ContainsEvaluator(BuiltInEvaluator):
    name = "ContainsEvaluator"
    description = "Evaluates whether the output contains a specific string"
    metadata = {"type": "string_matching"}
    input_schema = {
        "type": "object",
        "properties": {
            "contains": {
                "type": "string",
                "description": "String to search for in the output",
            }
        },
        "required": ["contains"],
    }

    def __init__(self, contains: str):
        self.contains = contains

    def evaluate(self, **kwargs: Any) -> bool:
        output = kwargs.get("output", "")
        return self.contains in str(output)
