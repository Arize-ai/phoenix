import zlib
from abc import ABC, abstractmethod
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


_BUILTIN_EVALUATORS: dict[str, type[BuiltInEvaluator]] = {}
_BUILTIN_EVALUATORS_BY_ID: dict[int, type[BuiltInEvaluator]] = {}

T = TypeVar("T", bound=BuiltInEvaluator)


def _generate_builtin_evaluator_id(name: str) -> int:
    """Generate a stable negative ID using CRC32 checksum."""
    return -abs(zlib.crc32(name.encode("utf-8")))


def register_builtin_evaluator(cls: type[T]) -> type[T]:
    evaluator_id = _generate_builtin_evaluator_id(cls.name)
    _BUILTIN_EVALUATORS[cls.name] = cls
    _BUILTIN_EVALUATORS_BY_ID[evaluator_id] = cls
    return cls


def get_builtin_evaluators() -> list[tuple[int, type[BuiltInEvaluator]]]:
    """Returns list of (id, evaluator_class) tuples."""
    return [
        (_generate_builtin_evaluator_id(cls.name), cls)
        for cls in _BUILTIN_EVALUATORS.values()
    ]


def get_builtin_evaluator_by_id(evaluator_id: int) -> Optional[type[BuiltInEvaluator]]:
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
