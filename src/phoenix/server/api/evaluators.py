import zlib
from dataclasses import dataclass
from typing import Any, Callable, Optional, TypeVar


@dataclass
class BuiltInEvaluatorDefinition:
    id: int
    name: str
    description: Optional[str]
    metadata: dict[str, Any]


_BUILTIN_EVALUATORS: dict[str, BuiltInEvaluatorDefinition] = {}
_BUILTIN_EVALUATORS_BY_ID: dict[int, BuiltInEvaluatorDefinition] = {}

T = TypeVar("T")


def _generate_builtin_evaluator_id(name: str) -> int:
    """Generate a stable negative ID using CRC32 checksum."""
    return -abs(zlib.crc32(name.encode("utf-8")))


def register_builtin_evaluator(
    name: str,
    description: Optional[str] = None,
    metadata: Optional[dict[str, Any]] = None,
) -> Callable[[type[T]], type[T]]:
    """Decorator to register a built-in evaluator class."""
    def decorator(cls: type[T]) -> type[T]:
        evaluator_id = _generate_builtin_evaluator_id(name)
        definition = BuiltInEvaluatorDefinition(
            id=evaluator_id,
            name=name,
            description=description,
            metadata=metadata or {},
        )
        _BUILTIN_EVALUATORS[name] = definition
        _BUILTIN_EVALUATORS_BY_ID[evaluator_id] = definition
        return cls
    return decorator


def get_builtin_evaluators() -> list[BuiltInEvaluatorDefinition]:
    """Get all registered built-in evaluators."""
    return list(_BUILTIN_EVALUATORS.values())


def get_builtin_evaluator_by_id(evaluator_id: int) -> Optional[BuiltInEvaluatorDefinition]:
    """Get a built-in evaluator by its ID."""
    return _BUILTIN_EVALUATORS_BY_ID.get(evaluator_id)


@register_builtin_evaluator(
    name="ContainsEvaluator",
    description="Evaluates whether the output contains a specific string",
    metadata={"type": "string_matching"},
)
class ContainsEvaluator:
    def __init__(self, contains: str):
        self.contains = contains

    def evaluate(self, output: str) -> bool:
        return self.contains in output
