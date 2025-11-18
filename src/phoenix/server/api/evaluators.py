import zlib
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Optional, TypeVar

from jsonpath_ng import parse as parse_jsonpath
from jsonschema import ValidationError, validate
from typing_extensions import TypedDict

from phoenix.db import models
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import EvaluatorInputMapping


class EvaluationResult(TypedDict):
    name: str
    annotator_kind: str
    label: Optional[str]
    score: Optional[float]
    explanation: Optional[str]
    metadata: dict[str, Any]
    error: Optional[str]
    trace_id: Optional[str]
    start_time: datetime
    end_time: datetime


class BuiltInEvaluator(ABC):
    name: str
    description: Optional[str] = None
    metadata: dict[str, Any] = {}
    input_schema: dict[str, Any] = {}

    @abstractmethod
    def evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: EvaluatorInputMapping,
    ) -> EvaluationResult:
        raise NotImplementedError


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
    return [(_generate_builtin_evaluator_id(cls.name), cls) for cls in _BUILTIN_EVALUATORS.values()]


def get_builtin_evaluator_by_id(evaluator_id: int) -> Optional[type[BuiltInEvaluator]]:
    return _BUILTIN_EVALUATORS_BY_ID.get(evaluator_id)


def apply_input_mapping(
    input_schema: dict[str, Any],
    input_mapping: "EvaluatorInputMapping",
    context: dict[str, Any],
) -> dict[str, Any]:
    result: dict[str, Any] = {}
    # apply literal mappings
    if hasattr(input_mapping, "literal_mapping"):
        for key, value in input_mapping.literal_mapping.items():
            result[key] = value

    if hasattr(input_mapping, "path_mapping"):
        for key, path_expr in input_mapping.path_mapping.items():
            try:
                jsonpath = parse_jsonpath(path_expr)
                matches = jsonpath.find(context)
                if matches:
                    result[key] = matches[0].value
            except Exception:
                pass

    try:
        validate(instance=result, schema=input_schema)
    except ValidationError as e:
        raise ValueError(f"Input validation failed: {e.message}")

    return result


def evaluation_result_to_model(
    result: EvaluationResult,
    *,
    experiment_run_id: int,
) -> models.ExperimentRunAnnotation:
    return models.ExperimentRunAnnotation(
        experiment_run_id=experiment_run_id,
        name=result["name"],
        annotator_kind=result["annotator_kind"],
        label=result["label"],
        score=result["score"],
        explanation=result["explanation"],
        trace_id=result["trace_id"],
        error=result["error"],
        metadata_=result["metadata"],
        start_time=result["start_time"],
        end_time=result["end_time"],
    )


def evaluation_result_to_span_annotation(
    result: EvaluationResult,
    *,
    span_rowid: int,
) -> models.SpanAnnotation:
    return models.SpanAnnotation(
        span_rowid=span_rowid,
        name=result["name"],
        annotator_kind=result["annotator_kind"],
        label=result["label"],
        score=result["score"],
        explanation=result["explanation"],
        metadata_=result["metadata"],
        identifier=result["name"],
        source="API",
        created_at=result["start_time"],
        updated_at=result["end_time"],
        user_id=None,
    )


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

    def evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: EvaluatorInputMapping,
    ) -> EvaluationResult:
        inputs = apply_input_mapping(self.input_schema, input_mapping, context)
        contains = inputs.get("contains")
        output = context.get("output", "")
        now = datetime.now(timezone.utc)
        matched = str(contains) in str(output)
        return EvaluationResult(
            name=self.name,
            annotator_kind="CODE",
            label=None,
            score=1.0 if matched else 0.0,
            explanation=(
                f"the string {repr(contains)} was {'found' if matched else 'not found'} "
                "in the output"
            ),
            metadata={"contains": contains},
            error=None,
            trace_id=None,
            start_time=now,
            end_time=now,
        )
