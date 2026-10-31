"""Built-in evaluators and their registration catalog."""

import json
import logging
import re
from abc import abstractmethod
from datetime import datetime, timezone
from typing import Any, Optional, Sequence, TypeVar

import openinference.instrumentation as oi
from opentelemetry.context import Context
from opentelemetry.trace import NoOpTracer, Status, StatusCode, Tracer, format_trace_id

from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationValue,
    CategoricalOutputConfig,
    ContinuousOutputConfig,
    OptimizationDirection,
    OutputConfigType,
)
from phoenix.db.types.evaluators import InputMapping
from phoenix.server.evaluators.input_mapping import (
    apply_input_mapping,
    cast_template_variable_types,
    validate_template_variables,
)
from phoenix.server.evaluators.runtime.base import (
    BaseEvaluator,
    EvaluationResult,
    result_annotation_names,
)

logger = logging.getLogger(__name__)


class BuiltInEvaluator(BaseEvaluator):
    """
    Base class for built-in evaluators with registry support.

    Built-in evaluators are class-based (instantiated fresh for each evaluation)
    and registered via the @register_builtin_evaluator decorator.

    Note: BuiltInEvaluator uses class-level `name` and `description` attributes
    which satisfy the BaseEvaluator ABC's abstract property requirements.
    """

    # _key is a unique identifier for this evaluator used for registry lookups.
    # It should be lowercase snake_case and should NEVER change once an evaluator
    # is released to ensure stable references.
    _key: str
    implementation_version: str
    # Class-level attributes that define the evaluator's identity
    # These satisfy the abstract properties from the BaseEvaluator ABC
    name: str
    description: Optional[str] = None
    metadata: dict[str, Any] = {}

    @property
    @abstractmethod
    def input_schema(self) -> dict[str, Any]:
        """Returns the JSON schema describing the input format for this evaluator."""
        ...

    @property
    @abstractmethod
    def output_configs(self) -> list[OutputConfigType]:
        """Returns the output configurations for this evaluator."""
        ...

    async def evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: InputMapping,
        name: str,
        output_configs: Sequence[OutputConfigType],
        tracer: Optional[Tracer] = None,
    ) -> list[EvaluationResult]:
        results: list[EvaluationResult] = []
        annotation_names = result_annotation_names(name, output_configs)
        for annotation_name, config in zip(annotation_names, output_configs):
            result = await self._evaluate(
                context=context,
                input_mapping=input_mapping,
                name=annotation_name,
                output_config=config,
                tracer=tracer,
            )
            results.append(result)
        return results

    @abstractmethod
    async def _evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: InputMapping,
        name: str,
        output_config: OutputConfigType,
        tracer: Optional[Tracer] = None,
    ) -> EvaluationResult: ...

    def _map_boolean_to_label_and_score(
        self,
        matched: bool,
        output_config: OutputConfigType,
    ) -> tuple[Optional[str], Optional[float]]:
        """
        Map a boolean result to a label and score using the output config.
        For categorical configs, uses positional indexing where:
        - values[0] is the "matched/pass" case
        - values[1] is the "not matched/fail" case
        """
        if isinstance(output_config, CategoricalOutputConfig):
            index = 0 if matched else 1
            if index < len(output_config.values):
                value = output_config.values[index]
                return value.label, value.score
            return None, 1.0 if matched else 0.0
        else:
            return None, 1.0 if matched else 0.0


_BUILTIN_EVALUATORS: dict[str, type[BuiltInEvaluator]] = {}
_BUILTIN_EVALUATORS_BY_KEY: dict[str, type[BuiltInEvaluator]] = {}

T = TypeVar("T", bound=BuiltInEvaluator)


def register_builtin_evaluator(cls: type[T]) -> type[T]:
    implementation_version = getattr(cls, "implementation_version", None)
    if not isinstance(implementation_version, str) or not implementation_version.strip():
        raise ValueError(f"{cls.__name__}.implementation_version must be a non-empty string")
    _BUILTIN_EVALUATORS[cls.name] = cls
    _BUILTIN_EVALUATORS_BY_KEY[cls._key] = cls
    return cls


def get_builtin_evaluators() -> list[tuple[str, type[BuiltInEvaluator]]]:
    """Returns list of (key, evaluator_class) tuples."""
    return [(cls._key, cls) for cls in _BUILTIN_EVALUATORS.values()]


def get_builtin_evaluator_by_key(key: str) -> Optional[type[BuiltInEvaluator]]:
    return _BUILTIN_EVALUATORS_BY_KEY.get(key)


@register_builtin_evaluator
class ContainsEvaluator(BuiltInEvaluator):
    _key = "contains"
    implementation_version = "1"
    name = "contains"
    description = (
        "Evaluates whether the text contains any (or all) of the specified comma-separated words"
    )
    metadata = {"type": "string_matching"}

    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "words": {
                    "type": "string",
                    "description": "A comma separated list of words to search for in the output",
                },
                "text": {
                    "type": "string",
                    "description": "The text to search for the words in",
                },
                "case_sensitive": {
                    "type": "boolean",
                    "description": "Whether to match the string case sensitive",
                },
                "require_all": {
                    "type": "boolean",
                    "description": (
                        "If true, all words must be present. If false (default), any word matches."
                    ),
                },
            },
            "required": ["words", "text"],
        }

    @property
    def output_configs(self) -> list[OutputConfigType]:
        return [
            CategoricalOutputConfig(
                type="CATEGORICAL",
                name="contains",
                optimization_direction=OptimizationDirection.MAXIMIZE,
                values=[
                    CategoricalAnnotationValue(label="true", score=1.0),
                    CategoricalAnnotationValue(label="false", score=0.0),
                ],
            )
        ]

    async def _evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: InputMapping,
        name: str,
        output_config: OutputConfigType,
        tracer: Optional[Tracer] = None,
    ) -> EvaluationResult:
        start_time = datetime.now(timezone.utc)
        tracer_ = tracer or NoOpTracer()

        with tracer_.start_as_current_span(
            f"Evaluator: {name}",
            attributes={
                **oi.get_span_kind_attributes("evaluator"),
                **oi.get_input_attributes(context),
            },
            context=Context(),
        ) as evaluator_span:
            trace_id = (
                format_trace_id(evaluator_span.get_span_context().trace_id) if tracer else None
            )

            try:
                with tracer_.start_as_current_span(
                    "Input Mapping",
                    attributes={
                        **oi.get_span_kind_attributes("chain"),
                        **oi.get_input_attributes(
                            {
                                "input_mapping": {
                                    "path_mapping": input_mapping.path_mapping or {},
                                    "literal_mapping": input_mapping.literal_mapping or {},
                                },
                                "template_variables": context,
                            }
                        ),
                    },
                ) as template_span:
                    inputs = apply_input_mapping(
                        input_schema=self.input_schema,
                        input_mapping=input_mapping,
                        context=context,
                    )
                    inputs = cast_template_variable_types(
                        template_variables=inputs,
                        input_schema=self.input_schema,
                    )
                    validate_template_variables(
                        template_variables=inputs,
                        input_schema=self.input_schema,
                    )
                    template_span.set_attributes(oi.get_output_attributes(inputs))
                    template_span.set_status(Status(StatusCode.OK))

                words = [
                    word.strip() for word in inputs.get("words", "").split(",") if word.strip()
                ]
                text = inputs.get("text", "")
                case_sensitive = inputs.get("case_sensitive", False)
                require_all = inputs.get("require_all", False)

                with tracer_.start_as_current_span(
                    self.name,
                    attributes={
                        **oi.get_span_kind_attributes("chain"),
                        **oi.get_input_attributes(
                            {
                                "words": words,
                                "text": text,
                                "case_sensitive": case_sensitive,
                                "require_all": require_all,
                            }
                        ),
                    },
                ) as execution_span:
                    if not words:
                        matched = False
                    elif case_sensitive:
                        match_fn = all if require_all else any
                        matched = match_fn(word in text for word in words)
                    else:
                        match_fn = all if require_all else any
                        matched = match_fn(word.lower() in text.lower() for word in words)

                    if not words:
                        explanation = "No valid words were provided to check."
                    else:
                        word_list = ", ".join(words)
                        truncated_text = (text[:100] + "...") if len(text) > 100 else text
                        if case_sensitive:
                            found_words = [w for w in words if w in text]
                            missing_words = [w for w in words if w not in text]
                        else:
                            text_lower = text.lower()
                            found_words = [w for w in words if w.lower() in text_lower]
                            missing_words = [w for w in words if w.lower() not in text_lower]

                        if require_all:
                            if matched:
                                explanation = (
                                    f"All of the words [{word_list}] were found"
                                    f" in the text: '{truncated_text}'."
                                )
                            else:
                                missing_list = ", ".join(missing_words)
                                explanation = (
                                    f"Not all of the words [{word_list}] were"
                                    f" found in the text: '{truncated_text}'."
                                    f" Missing: {missing_list}"
                                )
                        else:
                            if matched:
                                matched_list = ", ".join(found_words)
                                explanation = (
                                    f"One or more of the words [{word_list}]"
                                    f" were found in the text:"
                                    f" '{truncated_text}'."
                                    f" Matched: {matched_list}"
                                )
                            else:
                                explanation = (
                                    f"None of the words [{word_list}]"
                                    f" were found in the text:"
                                    f" '{truncated_text}'."
                                )

                    execution_span.set_attributes(
                        oi.get_output_attributes(json.dumps(matched), mime_type="application/json")
                    )
                    execution_span.set_status(Status(StatusCode.OK))

                with tracer_.start_as_current_span(
                    "Parse Eval Result",
                    attributes={
                        **oi.get_span_kind_attributes("chain"),
                        **oi.get_input_attributes(
                            json.dumps(matched), mime_type="application/json"
                        ),
                    },
                ) as parse_span:
                    label, score = self._map_boolean_to_label_and_score(matched, output_config)

                    parse_span.set_attributes(
                        oi.get_output_attributes(
                            {
                                "label": label,
                                "score": score,
                                "explanation": explanation,
                            }
                        )
                    )
                    parse_span.set_status(Status(StatusCode.OK))

                evaluator_span.set_attributes(
                    oi.get_output_attributes(
                        {
                            "label": label,
                            "score": score,
                            "explanation": explanation,
                        }
                    )
                )
                evaluator_span.set_status(Status(StatusCode.OK))

                end_time = datetime.now(timezone.utc)
                result = EvaluationResult(
                    name=name,
                    annotator_kind="CODE",
                    label=label,
                    score=score,
                    explanation=explanation,
                    metadata={
                        "words": words,
                        "text": text,
                        "case_sensitive": case_sensitive,
                        "require_all": require_all,
                    },
                    error=None,
                    trace_id=trace_id,
                    start_time=start_time,
                    end_time=end_time,
                )
            except Exception as e:
                logger.exception(f"Builtin evaluator '{self.name}' failed")
                evaluator_span.record_exception(e)
                evaluator_span.set_status(Status(StatusCode.ERROR, str(e)))

                end_time = datetime.now(timezone.utc)
                result = EvaluationResult(
                    name=name,
                    annotator_kind="CODE",
                    label=None,
                    score=None,
                    explanation=None,
                    metadata={},
                    error=str(e),
                    trace_id=trace_id,
                    start_time=start_time,
                    end_time=end_time,
                )

        return result


@register_builtin_evaluator
class ExactMatchEvaluator(BuiltInEvaluator):
    _key = "exact_match"
    implementation_version = "1"
    name = "exact_match"
    description = "Evaluates whether the actual text exactly matches the expected text"
    metadata = {"type": "string_matching"}

    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "expected": {
                    "type": "string",
                    "description": "The expected text",
                },
                "actual": {
                    "type": "string",
                    "description": "The actual text to compare",
                },
                "case_sensitive": {
                    "type": "boolean",
                    "description": "Whether comparison is case-sensitive (default: True)",
                },
            },
            "required": ["expected", "actual"],
        }

    @property
    def output_configs(self) -> list[OutputConfigType]:
        return [
            CategoricalOutputConfig(
                type="CATEGORICAL",
                name="exact_match",
                optimization_direction=OptimizationDirection.MAXIMIZE,
                values=[
                    CategoricalAnnotationValue(label="true", score=1.0),
                    CategoricalAnnotationValue(label="false", score=0.0),
                ],
            )
        ]

    async def _evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: InputMapping,
        name: str,
        output_config: OutputConfigType,
        tracer: Optional[Tracer] = None,
    ) -> EvaluationResult:
        start_time = datetime.now(timezone.utc)
        tracer_ = tracer or NoOpTracer()

        with tracer_.start_as_current_span(
            f"Evaluator: {name}",
            attributes={
                **oi.get_span_kind_attributes("evaluator"),
                **oi.get_input_attributes(context),
            },
            context=Context(),
        ) as evaluator_span:
            trace_id = (
                format_trace_id(evaluator_span.get_span_context().trace_id) if tracer else None
            )

            try:
                with tracer_.start_as_current_span(
                    "Input Mapping",
                    attributes={
                        **oi.get_span_kind_attributes("chain"),
                        **oi.get_input_attributes(
                            {
                                "input_mapping": {
                                    "path_mapping": input_mapping.path_mapping or {},
                                    "literal_mapping": input_mapping.literal_mapping or {},
                                },
                                "template_variables": context,
                            }
                        ),
                    },
                ) as template_span:
                    inputs = apply_input_mapping(
                        input_schema=self.input_schema,
                        input_mapping=input_mapping,
                        context=context,
                    )
                    inputs = cast_template_variable_types(
                        template_variables=inputs,
                        input_schema=self.input_schema,
                    )
                    validate_template_variables(
                        template_variables=inputs,
                        input_schema=self.input_schema,
                    )
                    template_span.set_attributes(oi.get_output_attributes(inputs))
                    template_span.set_status(Status(StatusCode.OK))

                expected = inputs.get("expected", "")
                actual = inputs.get("actual", "")
                case_sensitive = inputs.get("case_sensitive", True)

                with tracer_.start_as_current_span(
                    self.name,
                    attributes={
                        **oi.get_span_kind_attributes("chain"),
                        **oi.get_input_attributes(
                            {
                                "expected": expected,
                                "actual": actual,
                                "case_sensitive": case_sensitive,
                            }
                        ),
                    },
                ) as execution_span:
                    if case_sensitive:
                        matched = expected == actual
                    else:
                        matched = expected.lower() == actual.lower()

                    explanation = f"expected {'matches' if matched else 'does not match'} actual"

                    execution_span.set_attributes(
                        oi.get_output_attributes(json.dumps(matched), mime_type="application/json")
                    )
                    execution_span.set_status(Status(StatusCode.OK))

                with tracer_.start_as_current_span(
                    "Parse Eval Result",
                    attributes={
                        **oi.get_span_kind_attributes("chain"),
                        **oi.get_input_attributes(
                            json.dumps(matched), mime_type="application/json"
                        ),
                    },
                ) as parse_span:
                    label, score = self._map_boolean_to_label_and_score(matched, output_config)

                    parse_span.set_attributes(
                        oi.get_output_attributes(
                            {
                                "label": label,
                                "score": score,
                                "explanation": explanation,
                            }
                        )
                    )
                    parse_span.set_status(Status(StatusCode.OK))

                evaluator_span.set_attributes(
                    oi.get_output_attributes(
                        {
                            "label": label,
                            "score": score,
                            "explanation": explanation,
                        }
                    )
                )
                evaluator_span.set_status(Status(StatusCode.OK))

                end_time = datetime.now(timezone.utc)
                result = EvaluationResult(
                    name=name,
                    annotator_kind="CODE",
                    label=label,
                    score=score,
                    explanation=explanation,
                    metadata={
                        "expected": expected,
                        "actual": actual,
                        "case_sensitive": case_sensitive,
                    },
                    error=None,
                    trace_id=trace_id,
                    start_time=start_time,
                    end_time=end_time,
                )
            except Exception as e:
                logger.exception(f"Builtin evaluator '{self.name}' failed")
                evaluator_span.record_exception(e)
                evaluator_span.set_status(Status(StatusCode.ERROR, str(e)))

                end_time = datetime.now(timezone.utc)
                result = EvaluationResult(
                    name=name,
                    annotator_kind="CODE",
                    label=None,
                    score=None,
                    explanation=None,
                    metadata={},
                    error=str(e),
                    trace_id=trace_id,
                    start_time=start_time,
                    end_time=end_time,
                )

        return result


@register_builtin_evaluator
class RegexEvaluator(BuiltInEvaluator):
    _key = "regex"
    implementation_version = "1"
    name = "regex"
    description = "Evaluates whether the text matches a regex pattern"
    metadata = {"type": "pattern_matching"}

    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "The regex pattern to match",
                },
                "text": {
                    "type": "string",
                    "description": "The text to search",
                },
                "full_match": {
                    "type": "boolean",
                    "description": (
                        "If true, pattern must match entire text; "
                        "if false, searches for pattern anywhere (default: False)"
                    ),
                },
            },
            "required": ["pattern", "text"],
        }

    @property
    def output_configs(self) -> list[OutputConfigType]:
        return [
            CategoricalOutputConfig(
                type="CATEGORICAL",
                name="regex",
                optimization_direction=OptimizationDirection.MAXIMIZE,
                values=[
                    CategoricalAnnotationValue(label="true", score=1.0),
                    CategoricalAnnotationValue(label="false", score=0.0),
                ],
            )
        ]

    async def _evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: InputMapping,
        name: str,
        output_config: OutputConfigType,
        tracer: Optional[Tracer] = None,
    ) -> EvaluationResult:
        start_time = datetime.now(timezone.utc)
        tracer_ = tracer or NoOpTracer()

        with tracer_.start_as_current_span(
            f"Evaluator: {name}",
            attributes={
                **oi.get_span_kind_attributes("evaluator"),
                **oi.get_input_attributes(context),
            },
            context=Context(),
        ) as evaluator_span:
            trace_id = (
                format_trace_id(evaluator_span.get_span_context().trace_id) if tracer else None
            )

            try:
                with tracer_.start_as_current_span(
                    "Input Mapping",
                    attributes={
                        **oi.get_span_kind_attributes("chain"),
                        **oi.get_input_attributes(
                            {
                                "input_mapping": {
                                    "path_mapping": input_mapping.path_mapping or {},
                                    "literal_mapping": input_mapping.literal_mapping or {},
                                },
                                "template_variables": context,
                            }
                        ),
                    },
                ) as template_span:
                    inputs = apply_input_mapping(
                        input_schema=self.input_schema,
                        input_mapping=input_mapping,
                        context=context,
                    )
                    inputs = cast_template_variable_types(
                        template_variables=inputs,
                        input_schema=self.input_schema,
                    )
                    validate_template_variables(
                        template_variables=inputs,
                        input_schema=self.input_schema,
                    )
                    template_span.set_attributes(oi.get_output_attributes(inputs))
                    template_span.set_status(Status(StatusCode.OK))

                pattern = inputs.get("pattern", "")
                text = inputs.get("text", "")
                full_match = inputs.get("full_match", False)

                with tracer_.start_as_current_span(
                    self.name,
                    attributes={
                        **oi.get_span_kind_attributes("chain"),
                        **oi.get_input_attributes(
                            {
                                "pattern": pattern,
                                "text": text,
                                "full_match": full_match,
                            }
                        ),
                    },
                ) as execution_span:
                    try:
                        if full_match:
                            match = re.fullmatch(pattern, text)
                        else:
                            match = re.search(pattern, text)
                        matched = match is not None
                        error = None
                    except re.error as e:
                        matched = False
                        error = f"Invalid regex pattern: {e}"

                    if error:
                        explanation = error
                    else:
                        match_type = "full match" if full_match else "search"
                        explanation = (
                            f"pattern {'matched' if matched else 'did not match'} ({match_type})"
                        )

                    execution_span.set_attributes(
                        oi.get_output_attributes(json.dumps(matched), mime_type="application/json")
                    )
                    execution_span.set_status(Status(StatusCode.OK))

                with tracer_.start_as_current_span(
                    "Parse Eval Result",
                    attributes={
                        **oi.get_span_kind_attributes("chain"),
                        **oi.get_input_attributes(
                            json.dumps(matched), mime_type="application/json"
                        ),
                    },
                ) as parse_span:
                    if error:
                        label, score = None, None
                    else:
                        label, score = self._map_boolean_to_label_and_score(matched, output_config)

                    parse_span.set_attributes(
                        oi.get_output_attributes(
                            {
                                "label": label,
                                "score": score,
                                "explanation": explanation,
                            }
                        )
                    )
                    parse_span.set_status(Status(StatusCode.OK))

                evaluator_span.set_attributes(
                    oi.get_output_attributes(
                        {
                            "label": label,
                            "score": score,
                            "explanation": explanation,
                        }
                    )
                )
                evaluator_span.set_status(Status(StatusCode.OK))

                end_time = datetime.now(timezone.utc)
                result = EvaluationResult(
                    name=name,
                    annotator_kind="CODE",
                    label=label,
                    score=score,
                    explanation=explanation,
                    metadata={"pattern": pattern, "text": text, "full_match": full_match},
                    error=error,
                    trace_id=trace_id,
                    start_time=start_time,
                    end_time=end_time,
                )
            except Exception as e:
                logger.exception(f"Builtin evaluator '{self.name}' failed")
                evaluator_span.record_exception(e)
                evaluator_span.set_status(Status(StatusCode.ERROR, str(e)))

                end_time = datetime.now(timezone.utc)
                result = EvaluationResult(
                    name=name,
                    annotator_kind="CODE",
                    label=None,
                    score=None,
                    explanation=None,
                    metadata={},
                    error=str(e),
                    trace_id=trace_id,
                    start_time=start_time,
                    end_time=end_time,
                )

        return result


def levenshtein_distance(s1: str, s2: str) -> int:
    if len(s1) < len(s2):
        s1, s2 = s2, s1
    if len(s2) == 0:
        return len(s1)

    previous_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


@register_builtin_evaluator
class LevenshteinDistanceEvaluator(BuiltInEvaluator):
    _key = "levenshtein_distance"
    implementation_version = "1"
    name = "levenshtein_distance"
    description = "Calculates the Levenshtein (edit) distance between two strings"
    metadata = {"type": "string_distance"}

    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "expected": {
                    "type": "string",
                    "description": "The expected text",
                },
                "actual": {
                    "type": "string",
                    "description": "The actual text to compare",
                },
                "case_sensitive": {
                    "type": "boolean",
                    "description": "Whether comparison is case-sensitive (default: True)",
                },
            },
            "required": ["expected", "actual"],
        }

    @property
    def output_configs(self) -> list[OutputConfigType]:
        return [
            ContinuousOutputConfig(
                type="CONTINUOUS",
                name="levenshtein_distance",
                optimization_direction=OptimizationDirection.MINIMIZE,
                lower_bound=0.0,
            )
        ]

    async def _evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: InputMapping,
        name: str,
        output_config: OutputConfigType,
        tracer: Optional[Tracer] = None,
    ) -> EvaluationResult:
        start_time = datetime.now(timezone.utc)
        tracer_ = tracer or NoOpTracer()

        with tracer_.start_as_current_span(
            f"Evaluator: {name}",
            attributes={
                **oi.get_span_kind_attributes("evaluator"),
                **oi.get_input_attributes(context),
            },
            context=Context(),
        ) as evaluator_span:
            trace_id = (
                format_trace_id(evaluator_span.get_span_context().trace_id) if tracer else None
            )

            try:
                with tracer_.start_as_current_span(
                    "Input Mapping",
                    attributes={
                        **oi.get_span_kind_attributes("chain"),
                        **oi.get_input_attributes(
                            {
                                "input_mapping": {
                                    "path_mapping": input_mapping.path_mapping or {},
                                    "literal_mapping": input_mapping.literal_mapping or {},
                                },
                                "template_variables": context,
                            }
                        ),
                    },
                ) as template_span:
                    inputs = apply_input_mapping(
                        input_schema=self.input_schema,
                        input_mapping=input_mapping,
                        context=context,
                    )
                    inputs = cast_template_variable_types(
                        template_variables=inputs,
                        input_schema=self.input_schema,
                    )
                    validate_template_variables(
                        template_variables=inputs,
                        input_schema=self.input_schema,
                    )
                    template_span.set_attributes(oi.get_output_attributes(inputs))
                    template_span.set_status(Status(StatusCode.OK))

                expected = inputs.get("expected", "")
                actual = inputs.get("actual", "")
                case_sensitive = inputs.get("case_sensitive", True)

                with tracer_.start_as_current_span(
                    self.name,
                    attributes={
                        **oi.get_span_kind_attributes("chain"),
                        **oi.get_input_attributes(
                            {
                                "expected": expected,
                                "actual": actual,
                                "case_sensitive": case_sensitive,
                            }
                        ),
                    },
                ) as execution_span:
                    if case_sensitive:
                        distance = levenshtein_distance(expected, actual)
                    else:
                        distance = levenshtein_distance(expected.lower(), actual.lower())

                    explanation = f"edit distance between expected and actual is {distance}"

                    execution_span.set_attributes(
                        oi.get_output_attributes(distance, mime_type="application/json")
                    )
                    execution_span.set_status(Status(StatusCode.OK))

                with tracer_.start_as_current_span(
                    "Parse Eval Result",
                    attributes={
                        **oi.get_span_kind_attributes("chain"),
                        **oi.get_input_attributes(distance, mime_type="application/json"),
                    },
                ) as parse_span:
                    label = None
                    score = float(distance)

                    parse_span.set_attributes(
                        oi.get_output_attributes(
                            {
                                "label": label,
                                "score": score,
                                "explanation": explanation,
                            }
                        )
                    )
                    parse_span.set_status(Status(StatusCode.OK))

                evaluator_span.set_attributes(
                    oi.get_output_attributes(
                        {
                            "label": label,
                            "score": score,
                            "explanation": explanation,
                        }
                    )
                )
                evaluator_span.set_status(Status(StatusCode.OK))

                end_time = datetime.now(timezone.utc)
                result = EvaluationResult(
                    name=name,
                    annotator_kind="CODE",
                    label=None,
                    score=float(distance),
                    explanation=explanation,
                    metadata={
                        "expected": expected,
                        "actual": actual,
                        "case_sensitive": case_sensitive,
                    },
                    error=None,
                    trace_id=trace_id,
                    start_time=start_time,
                    end_time=end_time,
                )
            except Exception as e:
                logger.exception(f"Builtin evaluator '{self.name}' failed")
                evaluator_span.record_exception(e)
                evaluator_span.set_status(Status(StatusCode.ERROR, str(e)))

                end_time = datetime.now(timezone.utc)
                result = EvaluationResult(
                    name=name,
                    annotator_kind="CODE",
                    label=None,
                    score=None,
                    explanation=None,
                    metadata={},
                    error=str(e),
                    trace_id=trace_id,
                    start_time=start_time,
                    end_time=end_time,
                )

        return result


def json_diff_count(expected: Any, actual: Any) -> int:
    if type(expected) is not type(actual):
        return 1

    if isinstance(expected, dict) and isinstance(actual, dict):
        diff = 0
        all_keys = set(expected.keys()) | set(actual.keys())
        for key in all_keys:
            if key not in expected:
                diff += 1
            elif key not in actual:
                diff += 1
            else:
                diff += json_diff_count(expected[key], actual[key])
        return diff

    if isinstance(expected, list) and isinstance(actual, list):
        diff = abs(len(expected) - len(actual))
        for i in range(min(len(expected), len(actual))):
            diff += json_diff_count(expected[i], actual[i])
        return diff

    return 0 if expected == actual else 1


@register_builtin_evaluator
class JSONDistanceEvaluator(BuiltInEvaluator):
    _key = "json_distance"
    implementation_version = "1"
    name = "json_distance"
    description = "Compares two JSON structures and returns the number of differences"
    metadata = {"type": "json_comparison"}

    @property
    def input_schema(self) -> dict[str, Any]:
        return {
            "type": "object",
            "properties": {
                "expected": {
                    "description": "The expected JSON structure",
                },
                "actual": {
                    "description": "The actual JSON structure to compare",
                },
                "parse_strings": {
                    "type": "boolean",
                    "description": (
                        "Whether to parse string inputs as JSON before comparison (default: True)"
                    ),
                },
            },
            "required": ["expected", "actual"],
        }

    @property
    def output_configs(self) -> list[OutputConfigType]:
        return [
            ContinuousOutputConfig(
                type="CONTINUOUS",
                name="json_distance",
                optimization_direction=OptimizationDirection.MINIMIZE,
                lower_bound=0.0,
            )
        ]

    async def _evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: InputMapping,
        name: str,
        output_config: OutputConfigType,
        tracer: Optional[Tracer] = None,
    ) -> EvaluationResult:
        start_time = datetime.now(timezone.utc)
        tracer_ = tracer or NoOpTracer()

        with tracer_.start_as_current_span(
            f"Evaluator: {name}",
            attributes={
                **oi.get_span_kind_attributes("evaluator"),
                **oi.get_input_attributes(context),
            },
            context=Context(),
        ) as evaluator_span:
            trace_id = (
                format_trace_id(evaluator_span.get_span_context().trace_id) if tracer else None
            )
            try:
                with tracer_.start_as_current_span(
                    "Input Mapping",
                    attributes={
                        **oi.get_span_kind_attributes("chain"),
                        **oi.get_input_attributes(
                            {
                                "input_mapping": {
                                    "path_mapping": input_mapping.path_mapping or {},
                                    "literal_mapping": input_mapping.literal_mapping or {},
                                },
                                "template_variables": context,
                            }
                        ),
                    },
                ) as template_span:
                    inputs = apply_input_mapping(
                        input_schema=self.input_schema,
                        input_mapping=input_mapping,
                        context=context,
                    )
                    inputs = cast_template_variable_types(
                        template_variables=inputs,
                        input_schema=self.input_schema,
                    )
                    validate_template_variables(
                        template_variables=inputs,
                        input_schema=self.input_schema,
                    )
                    template_span.set_attributes(oi.get_output_attributes(inputs))
                    template_span.set_status(Status(StatusCode.OK))

                expected_raw = inputs.get("expected", "")
                actual_raw = inputs.get("actual", "")
                parse_strings = inputs.get("parse_strings", True)

                def _serialize_for_trace(value: Any) -> str:
                    if isinstance(value, str):
                        return value
                    if isinstance(value, (dict, list)):
                        return json.dumps(value)
                    return str(value)

                expected_trace = _serialize_for_trace(expected_raw)
                actual_trace = _serialize_for_trace(actual_raw)

                with tracer_.start_as_current_span(
                    self.name,
                    attributes={
                        **oi.get_span_kind_attributes("chain"),
                        **oi.get_input_attributes(
                            {
                                "expected": expected_trace,
                                "actual": actual_trace,
                                "parse_strings": parse_strings,
                            }
                        ),
                    },
                ) as execution_span:
                    distance = -1
                    error = None
                    explanation = None
                    expected: Any = expected_raw
                    actual: Any = actual_raw

                    if parse_strings and isinstance(expected_raw, str):
                        try:
                            expected = json.loads(expected_raw)
                        except json.JSONDecodeError as e:
                            error = f"Invalid JSON in 'expected': {e}"
                            explanation = (
                                f"{error}. If 'expected' is a Python object (not a JSON string),"
                                " set parse_strings=False to compare without parsing."
                                " Otherwise ensure the value uses valid JSON formatting"
                                " (double-quoted keys and string values)."
                            )

                    if error is None and parse_strings and isinstance(actual_raw, str):
                        try:
                            actual = json.loads(actual_raw)
                        except json.JSONDecodeError as e:
                            error = f"Invalid JSON in 'actual': {e}"
                            explanation = (
                                f"{error}. If 'actual' is a Python object (not a JSON string),"
                                " set parse_strings=False to compare without parsing."
                                " Otherwise ensure the value uses valid JSON formatting"
                                " (double-quoted keys and string values)."
                            )

                    if error is None:
                        distance = json_diff_count(expected, actual)
                        explanation = f"JSON structures have {distance} difference(s)"

                    execution_span.set_attributes(
                        oi.get_output_attributes(distance, mime_type="application/json")
                    )
                    execution_span.set_status(Status(StatusCode.OK))

                with tracer_.start_as_current_span(
                    "Parse Eval Result",
                    attributes={
                        **oi.get_span_kind_attributes("chain"),
                        **oi.get_input_attributes(distance, mime_type="application/json"),
                    },
                ) as parse_span:
                    label = None
                    score = float(distance) if error is None else None

                    parse_span.set_attributes(
                        oi.get_output_attributes(
                            {
                                "label": label,
                                "score": score,
                                "explanation": explanation,
                            }
                        )
                    )
                    parse_span.set_status(Status(StatusCode.OK))

                end_time = datetime.now(timezone.utc)
                result = EvaluationResult(
                    name=name,
                    annotator_kind="CODE",
                    label=None,
                    score=float(distance) if error is None else None,
                    explanation=explanation,
                    metadata={
                        "expected": expected_trace,
                        "actual": actual_trace,
                        "parse_strings": parse_strings,
                    },
                    error=error,
                    trace_id=trace_id,
                    start_time=start_time,
                    end_time=end_time,
                )
                evaluator_span.set_attributes(
                    oi.get_output_attributes(
                        {
                            "label": result["label"],
                            "score": result["score"],
                            "explanation": result["explanation"],
                        }
                    )
                )
                evaluator_span.set_status(Status(StatusCode.OK))
            except Exception as e:
                logger.exception(f"Builtin evaluator '{self.name}' failed")
                evaluator_span.record_exception(e)
                evaluator_span.set_status(Status(StatusCode.ERROR, str(e)))
                end_time = datetime.now(timezone.utc)
                result = EvaluationResult(
                    name=name,
                    annotator_kind="CODE",
                    label=None,
                    score=None,
                    explanation=None,
                    metadata={},
                    error=str(e),
                    trace_id=trace_id,
                    start_time=start_time,
                    end_time=end_time,
                )

        return result
