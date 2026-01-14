import asyncio
import copy
import inspect
import itertools
import json
import warnings
from abc import ABC, abstractmethod
from collections import defaultdict
from dataclasses import dataclass, field
from typing import (
    Any,
    Callable,
    DefaultDict,
    Dict,
    List,
    Literal,
    Optional,
    Set,
    Tuple,
    Union,
    cast,
)

import pandas as pd
from openinference.semconv.trace import OpenInferenceSpanKindValues, SpanAttributes
from pydantic import BaseModel, BeforeValidator, ValidationError, create_model
from typing_extensions import Annotated, Mapping

from phoenix.evals.executors import AsyncExecutor, ExecutionDetails, SyncExecutor

from .legacy.evaluators import (
    HallucinationEvaluator,
    QAEvaluator,
    RelevanceEvaluator,
    SQLEvaluator,
    SummarizationEvaluator,
    ToxicityEvaluator,
)
from .llm import LLM, PromptLike
from .llm.prompts import PromptTemplate, Template
from .llm.types import ObjectGenerationMethod
from .tracing import trace
from .utils import (
    _deprecate_positional_args,
    _deprecate_source_and_heuristic,
    default_tqdm_progress_bar_formatter,
    remap_eval_input,
)

# --- Type Aliases ---
EvalInput = Dict[str, Any]
ToolSchema = Optional[Dict[str, Any]]
KindType = Literal["human", "llm", "heuristic", "code"]
DirectionType = Literal["maximize", "minimize", "neutral"]
InputMappingType = Optional[Mapping[str, Union[str, Callable[[Mapping[str, Any]], Any]]]]


def _coerce_to_str(value: Any) -> str:
    return value if isinstance(value, str) else str(value)


EnforcedString = Annotated[str, BeforeValidator(_coerce_to_str)]


# --- Helper Functions ---
def _get_evaluator_span_name_sync(bound: Any) -> str:
    """Extract span name from evaluator instance for sync evaluation."""
    evaluator = bound.arguments.get("self")
    return f"{evaluator.name}.evaluate" if evaluator else "evaluator.evaluate"


def _get_evaluator_span_name_async(bound: Any) -> str:
    """Extract span name from evaluator instance for async evaluation."""
    evaluator = bound.arguments.get("self")
    return f"{evaluator.name}.async_evaluate" if evaluator else "evaluator.async_evaluate"


def _get_evaluator_metadata(bound: Any) -> str:
    """Extract evaluator metadata as JSON for the metadata span attribute."""
    evaluator = bound.arguments.get("self")
    metadata = {}
    if evaluator:
        metadata["evaluator.kind"] = evaluator.kind
        metadata["evaluator.class"] = evaluator.__class__.__name__
    return json.dumps(metadata)


def _get_remapped_input(bound: Any) -> str:
    """Extract and serialize remapped eval input."""
    return json.dumps(bound.arguments.get("remapped_eval_input", {}))


def _get_scores_output(result: Any) -> str:
    """Serialize list of Score objects."""
    return json.dumps([s.to_dict() for s in result])


def _remap_and_validate_input(
    eval_input: EvalInput,
    required_fields: Set[str],
    input_mapping: InputMappingType,
    input_schema: Optional[type[BaseModel]],
) -> EvalInput:
    """Remap and validate evaluation input.

    Args:
        eval_input: The raw evaluation input dictionary.
        required_fields: Set of required field names.
        input_mapping: Mapping from evaluator field names to input keys.
        input_schema: Optional Pydantic model for validation.

    Returns:
        The remapped and validated evaluation input.

    Raises:
        ValueError: If input validation fails.
    """
    remapped_eval_input = remap_eval_input(
        eval_input=eval_input,
        required_fields=required_fields,
        input_mapping=input_mapping,
    )
    if input_schema is not None:
        try:
            model_instance = input_schema.model_validate(remapped_eval_input)
            remapped_eval_input = model_instance.model_dump()
        except ValidationError as e:
            raise ValueError(f"Input validation failed: {e}")
    return cast(EvalInput, remapped_eval_input)


# --- Score model ---
@dataclass(frozen=True, init=False)
class Score:
    """
    Represents the result of an evaluation.

    A Score contains the evaluation result along with metadata about the evaluation.
    It can represent numeric scores, categorical labels, explanations, or combinations thereof.

    Examples:
        Creating different types of scores::

            from phoenix.evals.evaluators import Score

            # Numeric score only
            numeric_score = Score(
                name="accuracy",
                score=0.85,
                kind="llm",
                direction="maximize"
            )

            # Label only (categorical)
            label_score = Score(
                name="sentiment",
                label="positive",
                kind="llm",
                direction="maximize"
            )

            # Score with explanation
            detailed_score = Score(
                name="relevance",
                score=0.9,
                label="highly_relevant",
                explanation="The answer directly addresses all aspects of the question",
                metadata={"model": "gpt-4", "confidence": 0.95},
                kind="llm",
                direction="maximize"
            )

            # Boolean evaluation
            boolean_score = Score(
                name="has_citation",
                score=1.0,
                label="true",
                explanation="Found 3 citations in the text",
                kind="code",
                direction="maximize"
            )
    """

    name: Optional[str] = None
    score: Optional[Union[float, int]] = None
    label: Optional[str] = None
    explanation: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    kind: Optional[KindType] = None
    direction: DirectionType = "maximize"

    @_deprecate_source_and_heuristic
    def __init__(
        self,
        *,
        name: Optional[str] = None,
        score: Optional[Union[float, int]] = None,
        label: Optional[str] = None,
        explanation: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None,
        direction: DirectionType = "maximize",
        kind: Optional[KindType] = None,
    ) -> None:
        object.__setattr__(self, "name", name)
        object.__setattr__(self, "score", score)
        object.__setattr__(self, "label", label)
        object.__setattr__(self, "explanation", explanation)
        object.__setattr__(self, "metadata", {} if metadata is None else metadata)
        object.__setattr__(self, "kind", kind)
        object.__setattr__(self, "direction", direction)

    @property
    def source(self) -> Optional[KindType]:
        """The source of this score (deprecated)."""
        # TODO: Remove this once we deprecate the source attribute
        warnings.warn(
            "Score.source is deprecated; use Score.kind instead.",
            DeprecationWarning,
            stacklevel=2,
        )
        return self.kind

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert the Score to a dictionary, excluding None values.

        Returns:
            A dictionary representation of the Score with None values excluded.
        """
        result: Dict[str, Any] = {}

        for field_name, field_value in self.__dict__.items():
            if field_value is not None:
                result[field_name] = field_value
        return result

    def pretty_print(self, indent: int = 2) -> None:
        """
        Pretty print the Score as formatted JSON.

        Args:
            indent: Number of spaces for indentation. Defaults to 2.
        """
        score_dict = self.to_dict()
        print(json.dumps(score_dict, indent=indent))


def _add_trace_id_to_scores(scores: List[Score], trace_id: Optional[str]) -> List[Score]:
    """Add trace_id to Score metadata."""
    if not trace_id:
        return scores

    updated_scores = []
    for score in scores:
        updated_metadata = {**score.metadata, "trace_id": trace_id}
        updated_score = Score(
            name=score.name,
            score=score.score,
            label=score.label,
            explanation=score.explanation,
            metadata=updated_metadata,
            kind=score.kind,
            direction=score.direction,
        )
        updated_scores.append(updated_score)
    return updated_scores


def to_thread(fn: Callable[..., Any]) -> Callable[..., Any]:
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: fn(*args, **kwargs))

    return wrapper


# --- Base Evaluator ---
class Evaluator(ABC):
    """
    Core abstraction for evaluators.

    Supports single-record synchronous (`evaluate`) and asynchronous (`async_evaluate`) modes with
    optional per-call field_mapping.

    Note: Subclasses must implement either the `_evaluate` or `_async_evaluate` method.
    Implementing both methods is recommended.

    Args:
        name: The name of this evaluator, used for identification and Score naming.
        kind: The kind of this evaluator (human, llm, or code).
        input_schema: Optional Pydantic BaseModel for input typing and validation. If None,
            subclasses infer fields from prompts or function signatures and may construct a
            model dynamically.
        direction: The direction for score optimization ("maximize" or "minimize"). Defaults
            to "maximize".
    """

    @_deprecate_source_and_heuristic
    def __init__(
        self,
        *,
        name: str,
        kind: KindType,
        direction: DirectionType = "maximize",
        input_schema: Optional[type[BaseModel]] = None,
    ):
        self._name = name
        self._kind = kind
        self._direction = direction
        self._input_schema: Optional[type[BaseModel]] = input_schema
        self._input_mapping: Optional[InputMappingType] = None

    @property
    def name(self) -> str:
        """The name of this evaluator."""
        return self._name

    @property
    def source(self) -> KindType:
        # TODO: Remove this once we deprecate the source attribute
        """The source of this evaluator (deprecated)."""
        warnings.warn(
            "Evaluator.source is deprecated; use Evaluator.kind instead.",
            DeprecationWarning,
            stacklevel=2,
        )
        return self._kind

    @property
    def kind(self) -> KindType:
        """The kind of this evaluator."""
        return self._kind

    @property
    def direction(self) -> DirectionType:
        """The direction for score optimization."""
        return self._direction

    @property
    def input_schema(self) -> Optional[type[BaseModel]]:
        """Read-only Pydantic input schema for this evaluator, if set."""
        return self._input_schema

    @abstractmethod
    def _evaluate(self, eval_input: EvalInput) -> List[Score]:
        """Implement core logic assuming `eval_input` has required fields per schema/mapping."""
        raise NotImplementedError("Subclasses must implement _evaluate")

    async def _async_evaluate(self, eval_input: EvalInput) -> List[Score]:
        """Implement async core logic assuming `eval_input` has required fields per schema/mapping.

        By default, this runs the synchronous _evaluate method in a thread pool.
        Subclasses can override this for more efficient async implementations.
        """
        result = await to_thread(self._evaluate)(eval_input)
        return cast(List[Score], result)

    @trace(
        span_name=_get_evaluator_span_name_sync,
        span_kind=OpenInferenceSpanKindValues.EVALUATOR,
        process_input={
            SpanAttributes.INPUT_VALUE: _get_remapped_input,
            SpanAttributes.METADATA: _get_evaluator_metadata,
        },
        process_output={
            SpanAttributes.OUTPUT_VALUE: _get_scores_output,
        },
    )
    def _traced_evaluate(
        self, remapped_eval_input: EvalInput, trace_id: Optional[str] = None
    ) -> List[Score]:
        """Execute evaluation with tracing and inject trace_id into Score metadata."""
        scores = self._evaluate(remapped_eval_input)
        return _add_trace_id_to_scores(scores, trace_id)

    @trace(
        span_name=_get_evaluator_span_name_async,
        span_kind=OpenInferenceSpanKindValues.EVALUATOR,
        process_input={
            SpanAttributes.INPUT_VALUE: _get_remapped_input,
            SpanAttributes.METADATA: _get_evaluator_metadata,
        },
        process_output={
            SpanAttributes.OUTPUT_VALUE: _get_scores_output,
        },
    )
    async def _async_traced_evaluate(
        self, remapped_eval_input: EvalInput, trace_id: Optional[str] = None
    ) -> List[Score]:
        """Async variant of _traced_evaluate."""
        scores = await self._async_evaluate(remapped_eval_input)
        return _add_trace_id_to_scores(scores, trace_id)

    def evaluate(
        self, eval_input: EvalInput, input_mapping: Optional[InputMappingType] = None
    ) -> List[Score]:
        """
        Validate and remap `eval_input` using the evaluator's input fields (from
        `input_schema` when available, otherwise from the provided `input_mapping`). An optional
        per-call `input_mapping` maps evaluator-required field names to keys/paths in `eval_input`.

        Returns:
            A list of Score objects.
        """
        input_mapping = input_mapping or self._input_mapping
        required_fields = self._get_required_fields(input_mapping)
        remapped_eval_input = _remap_and_validate_input(
            eval_input=eval_input,
            required_fields=required_fields,
            input_mapping=input_mapping,
            input_schema=self.input_schema,
        )
        return cast(List[Score], self._traced_evaluate(remapped_eval_input))

    async def async_evaluate(
        self, eval_input: EvalInput, input_mapping: Optional[InputMappingType] = None
    ) -> List[Score]:
        """
        Async variant of `evaluate`. Validates and remaps input as described in `evaluate`.

        Returns:
            A list of Score objects.
        """
        input_mapping = input_mapping or self._input_mapping
        required_fields = self._get_required_fields(input_mapping)
        remapped_eval_input = _remap_and_validate_input(
            eval_input=eval_input,
            required_fields=required_fields,
            input_mapping=input_mapping,
            input_schema=self.input_schema,
        )
        return cast(List[Score], await self._async_traced_evaluate(remapped_eval_input))

    def bind(self, input_mapping: InputMappingType) -> None:
        """Binds an evaluator with a fixed input mapping."""
        self._input_mapping = input_mapping

    def unbind(self) -> None:
        """Unbinds an evaluator from an input mapping."""
        self._input_mapping = None

    def _get_required_fields(self, input_mapping: Optional[InputMappingType]) -> Set[str]:
        """
        Determine required field names for mapping/validation.
        Prefers Pydantic schema; falls back to mapping keys if no schema.
        """

        def _required_fields_from_model(model: Optional[type[BaseModel]]) -> Set[str]:
            if model is None:
                return set()
            return {name for name, field in model.model_fields.items() if field.is_required()}

        if self.input_schema is not None:
            return _required_fields_from_model(self.input_schema)
        if input_mapping is not None:
            return set(input_mapping.keys())
        raise ValueError(
            f"Cannot determine input fields for evaluator '{self.name}'. Provide an input_schema or"
            f" an input_mapping whose keys list the evaluator's required fields."
        )

    # --- Introspection helpers ---

    def describe(self) -> Dict[str, Any]:
        """
        Return a JSON-serializable description of the evaluator, including
        its name, kind, direction, and input fields derived from the
        Pydantic input schema when available.
        """
        # TODO add other serializable properties from subclasses
        if self.input_schema is not None:
            schema = self.input_schema.model_json_schema()
        else:
            schema = {"unspecified": {"type": "any", "required": False}}
        return {
            "name": self.name,
            "kind": self.kind,
            "direction": self.direction,
            "input_schema": schema,
        }


# --- LLM Evaluator base ---
class LLMEvaluator(Evaluator):
    """
    Base LLM evaluator that infers required input fields from its prompt template and
    constructs a default Pydantic input schema when none is supplied.

    Note: Subclasses must implement either the `_evaluate` or `_async_evaluate` method.
    Implementing both methods is recommended.

    Args:
        name: Identifier for this evaluator and the name used in produced Scores.
        llm: The LLM instance to use for evaluation.
        prompt_template: The prompt template with placeholders for required fields; used to infer
            required variables. Can be either a string template or a list of message dictionaries
            (for chat-based models).
        schema: Optional tool/JSON schema for structured output when supported by the LLM.
        input_schema: Optional Pydantic model describing/validating inputs. If not provided,
            a model is dynamically created from the prompt variables (all str, required).
        direction: The score optimization direction ("maximize" or "minimize"). Defaults to
            "maximize".
        **kwargs: Invocation parameters forwarded to the LLM client
    """

    def __init__(
        self,
        *,
        name: str,
        llm: LLM,
        prompt_template: Union[PromptLike, PromptTemplate, Template],
        schema: Optional[ToolSchema] = None,
        input_schema: Optional[type[BaseModel]] = None,
        direction: DirectionType = "maximize",
        **kwargs: Any,
    ):
        # Convert to PromptTemplate for uniform handling
        if isinstance(prompt_template, PromptTemplate):
            self._prompt_template = prompt_template
        else:
            self._prompt_template = PromptTemplate(template=prompt_template)

        required_fields = self._prompt_template.variables

        # If no explicit input_schema, create a Pydantic model with all fields as required str
        if input_schema is None:
            model_name = f"{name.capitalize()}Input"
            field_defs: Dict[str, Tuple[Any, Any]] = {
                var: (EnforcedString, ...) for var in required_fields
            }
            input_schema = create_model(
                model_name,
                **cast(Any, field_defs),
            )

        self.invocation_parameters = kwargs

        super().__init__(
            name=name,
            kind="llm",
            direction=direction,
            input_schema=input_schema,
        )
        self.llm = llm
        self.schema = schema

    @property
    def prompt_template(self) -> PromptTemplate:
        """Get the prompt template."""
        return self._prompt_template

    def _evaluate(self, eval_input: EvalInput) -> List[Score]:
        raise NotImplementedError("Subclasses must implement _evaluate")

    async def _async_evaluate(self, eval_input: EvalInput) -> List[Score]:
        raise NotImplementedError("Subclasses must implement _async_evaluate")

    def evaluate(
        self, eval_input: EvalInput, input_mapping: Optional[InputMappingType] = None
    ) -> List[Score]:
        return super().evaluate(eval_input=eval_input, input_mapping=input_mapping)

    async def async_evaluate(
        self, eval_input: EvalInput, input_mapping: Optional[InputMappingType] = None
    ) -> List[Score]:
        return await super().async_evaluate(eval_input=eval_input, input_mapping=input_mapping)


# --- LLM ClassificationEvaluator ---
class ClassificationEvaluator(LLMEvaluator):
    """
    LLM-based evaluator for classification-style judgements.

    Supports label-only or label+score mappings, and returns explanations by default.
    Note: Requires the LLM to have tool calling or structured output capabilities.

    Args:
        name: Identifier for this evaluator and the name used in produced Scores.
        llm: The LLM instance to use for evaluation. Must support tool calling or
            structured output for reliable classification.
        prompt_template: The prompt template with placeholders for required input fields.
            Can be either a string template or a list of message dictionaries (for chat-based
            models). Template variables are inferred automatically.
        choices: Classification choices in one of three formats:
            a. List[str]: Simple list of label names (e.g., ["positive", "negative"]).
                Scores will be None.
            b. Dict[str, Union[float, int]]: Labels mapped to numeric scores
                (e.g., {"positive": 1.0, "negative": 0.0}).
            c. Dict[str, Tuple[Union[float, int], str]]: Labels mapped to tuples of
                (score, description) (e.g., {"positive": (1.0, "Positive sentiment"),
                "negative": (0.0, "Negative sentiment")}). Not recommended as LLMs do not
                reliably follow this schema.
        include_explanation: Whether to request explanations for classification decisions.
            Defaults to True in accordance with best practices.
        input_schema: Optional Pydantic model for input validation. If not provided,
            a model is automatically created from prompt template variables.
        direction: Score optimization direction ("maximize" or "minimize"). Defaults to
            "maximize".
        **kwargs: Invocation parameters forwarded to the LLM client

    Returns:
        List[Score]: A list containing a single Score object with the classification
            result, including label, optional score, and optional explanation.

    Examples:
        Classification with labels only::

            from phoenix.evals import ClassificationEvaluator, LLM

            evaluator = ClassificationEvaluator(
                name="sentiment",
                llm=LLM(provider="openai", model="gpt-4"),
                prompt_template="Classify the sentiment of this text: {text}",
                choices=["positive", "negative", "neutral"]
            )

            result = evaluator.evaluate({"text": "I love this product!"})
            print(result[0].label)  # "positive"
            print(result[0].explanation)  # LLM's reasoning
            print(result[0].score)  # None

        Classification with scores::

            # Map labels to numeric scores
            evaluator = ClassificationEvaluator(
                name="quality",
                llm=llm,
                prompt_template="Rate the quality of this response: {response}",
                choices={
                    "excellent": 5,
                    "good": 4,
                    "fair": 3,
                    "poor": 2,
                    "terrible": 1
                }
            )

            result = evaluator.evaluate({"response": "Great explanation with examples"})
            print(result[0].label)  # "excellent"
            print(result[0].score)  # 5

        Classification with scores and descriptions (use with caution)::

            # Map labels to (score, description) tuples
            evaluator = ClassificationEvaluator(
                name="relevance",
                llm=llm,
                prompt_template="How relevant is this answer to the question?\\n"
                               "Question: {question}\\nAnswer: {answer}",
                choices={
                    "highly_relevant": (1.0, "Answer directly addresses the question"),
                    "somewhat_relevant": (0.5, "Answer partially addresses the question"),
                    "not_relevant": (0.0, "Answer does not address the question")
                }
            )

            result = evaluator.evaluate({
                "question": "What is the capital of France?",
                "answer": "Paris is the capital city of France."
            })
            print(result[0].label)  # "highly_relevant"
            print(result[0].score)  # 1.0

    """

    def __init__(
        self,
        *,
        name: str,
        llm: LLM,
        prompt_template: Union[PromptLike, PromptTemplate, Template],
        choices: Union[
            List[str], Dict[str, Union[float, int]], Dict[str, Tuple[Union[float, int], str]]
        ],
        include_explanation: bool = True,
        input_schema: Optional[type[BaseModel]] = None,
        direction: DirectionType = "maximize",
        **kwargs: Any,
    ):
        super().__init__(
            name=name,
            llm=llm,
            prompt_template=prompt_template,
            input_schema=input_schema,
            direction=direction,
            **kwargs,
        )

        self.include_explanation = include_explanation
        score_map: Optional[Dict[str, Union[float, int]]] = None
        labels: Union[List[str], Dict[str, str]]
        if isinstance(choices, list):
            # Case 1: List[str]
            score_map = None
            labels = choices
        else:
            first_value = next(iter(choices.values()))
            # Case 2: Score and description provided
            if isinstance(first_value, tuple):
                # Extract score and description from tuple
                score_map = {key: value[0] for key, value in choices.items()}  # type: ignore
                labels = {key: value[1] for key, value in choices.items()}  # type: ignore
            # Case 3: Only score provided
            else:
                # Extract score and labels from dictionary
                score_map = dict(choices)  # type: ignore
                labels = list(choices.keys())

        self.label_score_map = score_map
        self.labels = labels

    def _evaluate(self, eval_input: EvalInput) -> List[Score]:
        # Render template using PromptTemplate
        prompt_filled = self._prompt_template.render(variables=eval_input)

        method = (
            ObjectGenerationMethod.TOOL_CALLING
            if isinstance(self.labels, dict)
            else ObjectGenerationMethod.AUTO
        )
        response = self.llm.generate_classification(
            prompt=prompt_filled,
            labels=self.labels,
            include_explanation=self.include_explanation,
            method=method,
            **self.invocation_parameters,
        )
        label = response["label"]
        explanation = response.get("explanation", None)

        # Validate that the returned label is one of the valid choices
        valid_labels = (
            list(self.labels) if isinstance(self.labels, list) else list(self.labels.keys())
        )
        if label not in valid_labels:
            raise ValueError(
                f"ClassificationEvaluator '{self.name}' received invalid label '{label}'. "
                f"Valid labels are: {valid_labels}. "
            )

        score = self.label_score_map.get(label) if self.label_score_map else None
        return [
            Score(
                score=score,
                name=self.name,
                label=label,
                explanation=explanation,
                metadata={"model": self.llm.model},  # could add more metadata here
                kind=self.kind,
                direction=self.direction,
            )
        ]

    async def _async_evaluate(self, eval_input: EvalInput) -> List[Score]:
        # Render template using PromptTemplate
        prompt_filled = self._prompt_template.render(variables=eval_input)

        method = (
            ObjectGenerationMethod.TOOL_CALLING
            if isinstance(self.labels, dict)
            else ObjectGenerationMethod.AUTO
        )
        response = await self.llm.async_generate_classification(
            prompt=prompt_filled,
            labels=self.labels,
            include_explanation=self.include_explanation,
            method=method,
            **self.invocation_parameters,
        )
        label = response["label"]
        explanation = response.get("explanation", None)

        # Validate that the returned label is one of the valid choices
        valid_labels = (
            list(self.labels) if isinstance(self.labels, list) else list(self.labels.keys())
        )
        if label not in valid_labels:
            raise ValueError(
                f"ClassificationEvaluator '{self.name}' received invalid label '{label}'. "
                f"Valid labels are: {valid_labels}. "
            )

        score = self.label_score_map.get(label) if self.label_score_map else None
        return [
            Score(
                score=score,
                name=self.name,
                label=label,
                explanation=explanation,
                metadata={"model": self.llm.model},  # could add more metadata here
                kind=self.kind,
                direction=self.direction,
            )
        ]


def create_evaluator(
    name: str,
    source: Optional[KindType] = None,
    direction: DirectionType = "maximize",
    kind: Optional[KindType] = None,
) -> Callable[[Callable[..., Any]], Evaluator]:
    """
    Decorator that turns a simple function into an Evaluator instance.

    The decorated function should accept keyword args matching its required fields and return a
    value that can be converted to a Score. The returned object is an Evaluator with full support
    for evaluate/async_evaluate and maintains direct callability.

    Args:
        name: Identifier for the evaluator and the name used in produced Scores.
        kind: The kind of this evaluator ("human", "llm", or "code"). Defaults to
            "code".
        direction: The score optimization direction ("maximize" or "minimize"). Defaults to
            "maximize".

    Examples:
        Basic usage with numeric return::

            from phoenix.evals import create_evaluator

            @create_evaluator(name="precision")
            def precision(retrieved_documents: list[int], relevant_documents: list[int]) -> float:
                # Calculate precision for information retrieval
                relevant_set = set(relevant_documents)
                hits = sum(1 for doc in retrieved_documents if doc in relevant_set)
                return hits / len(retrieved_documents) if retrieved_documents else 0.0

            # Use the evaluator
            result = precision.evaluate({
                "retrieved_documents": [1, 2, 3, 4],
                "relevant_documents": [2, 4, 6]
            })
            print(result[0].score)  # 0.5

            # Direct callability maintained:
            result = precision(retrieved_documents=[1, 2, 3, 4], relevant_documents=[2, 4, 6])
            print(result)  # 0.5

        Different return types::

            # Boolean return (converted to score and label)
            @create_evaluator(name="is_valid")
            def is_valid(text: str) -> bool:
                return len(text.strip()) > 0

            # Dictionary return with multiple fields
            @create_evaluator(name="positive_sentiment")
            def positive_sentiment(text: str) -> dict:
                # Simplified sentiment analysis
                positive_words = ["good", "great", "excellent"]
                score = sum(1 for word in positive_words if word in text.lower())
                return {
                    "score": score / len(positive_words),
                    "label": "positive" if score > 0 else "neutral",
                    "explanation": f"Found {score} positive indicators"
                }

            # Tuple return (score, label, explanation)
            @create_evaluator(name="length_check")
            def length_check(text: str) -> tuple:
                length = len(text)
                is_good = 10 <= length <= 100
                return (float(is_good), "good" if is_good else "bad", f"Length: {length}")

        Using with dataframes::

            import pandas as pd
            from phoenix.evals import evaluate_dataframe

            @create_evaluator(name="word_count")
            def word_count(text: str) -> int:
                return len(text.split())

            df = pd.DataFrame({
                "text": ["Hello world", "This is a longer sentence", "Short"]
            })

            results_df = evaluate_dataframe(dataframe=df, evaluators=[word_count])
            print(results_df["word_count_score"])  # JSON scores for each row

    Notes:
        The decorated function can return:

        - A Score object (no conversion needed)
        - A number (converted to Score.score)
        - A boolean (converted to integer Score.score and string Score.label)
        - A short string (≤3 words, converted to Score.label)
        - A long string (≥4 words, converted to Score.explanation)
        - A dictionary with keys "score", "label", or "explanation"
        - A tuple of values (only bool, number, str types allowed)

        An input_schema is automatically created from the function signature, capturing the required
        input fields, their types, and any defaults. For best results, do not use *args or **kwargs.

        The decorator automatically handles conversion to a valid Score object.
    """
    # TODO: Remove this once we deprecate the source attribute
    if kind is not None and source is not None and kind != source:
        raise ValueError("Provide only one of 'kind' or 'source' (they differ). Use 'kind'.")
    # If neither is provided, default to "code".
    resolved_kind: KindType = (
        kind if kind is not None else (source if source is not None else "code")
    )
    if source is not None and (kind is None or kind == source):
        warnings.warn(
            "'source' is deprecated; next time, use 'kind' instead. This time, \
            we'll automatically convert it for you.",
            DeprecationWarning,
            stacklevel=2,
        )
    if resolved_kind == "heuristic":
        warnings.warn(
            "kind='heuristic' is deprecated; next time, use kind='code' instead. This time, we'll \
                automatically convert it for you.",
            DeprecationWarning,
            stacklevel=2,
        )
        resolved_kind = "code"

    def _convert_to_score(
        result: Any, name: str, kind: KindType, direction: DirectionType
    ) -> Score:
        """Convert various return types to a Score object."""
        LABEL_WORD_COUNT_THRESHOLD = 3  # ≤3 words = label, ≥4 words = explanation
        ERROR_MESSAGE = (
            f"Unsupported return type '{type(result).__name__}' for evaluator '{name}'. "
            f"Supported return types are: Score, numbers, booleans, strings, dictionaries, and "
            f"tuples of numbers, booleans, and strings. "
            f"Got: {repr(result)}"
        )
        # If already a Score object, ensure name, kind, and direction are set correctly
        if isinstance(result, Score):
            # Create a new Score with the correct name, kind, and direction
            return Score(
                score=result.score,
                name=name,
                label=result.label,
                explanation=result.explanation,
                metadata=result.metadata,
                kind=kind,
                direction=direction,
            )

        # Handle tuples by processing each element
        if isinstance(result, tuple):
            tuple_score_data: Dict[str, Any] = {}
            for item in result:
                if isinstance(item, (int, float, bool)):
                    tuple_score_data["score"] = float(item) if isinstance(item, bool) else item
                    if "label" not in tuple_score_data and isinstance(item, bool):
                        tuple_score_data["label"] = str(item)  # may get overwritten
                elif isinstance(item, str):
                    if item.count(" ") <= LABEL_WORD_COUNT_THRESHOLD - 1:
                        tuple_score_data["label"] = item
                    else:  # longer strings = explanations
                        tuple_score_data["explanation"] = item
                else:
                    raise ValueError(ERROR_MESSAGE)
            return Score(name=name, kind=kind, direction=direction, **tuple_score_data)

        # Handle dictionaries
        if isinstance(result, dict):
            dict_score_data: Dict[str, Any] = {}
            for key, value in result.items():
                if key in ["score", "label", "explanation"]:
                    dict_score_data[key] = value
            return Score(name=name, kind=kind, direction=direction, **dict_score_data)

        # Handle numbers and booleans
        if isinstance(result, (int, float, bool)):
            return Score(
                score=float(result) if isinstance(result, bool) else result,
                label=str(result) if isinstance(result, bool) else None,
                name=name,
                kind=kind,
                direction=direction,
            )

        # Handle strings
        if isinstance(result, str):
            if result.count(" ") <= LABEL_WORD_COUNT_THRESHOLD - 1:
                return Score(
                    label=result,
                    name=name,
                    kind=kind,
                    direction=direction,
                )
            else:
                return Score(
                    explanation=result,
                    name=name,
                    kind=kind,
                    direction=direction,
                )

        # Raise informative error for unsupported types
        raise ValueError(ERROR_MESSAGE)

    def deco(fn: Callable[..., Any]) -> Evaluator:
        sig = inspect.signature(fn)
        original_docstring = fn.__doc__
        evaluator_instance: Evaluator

        if inspect.iscoroutinefunction(fn):

            class _AsyncFunctionEvaluator(Evaluator):
                def __init__(self) -> None:
                    super().__init__(
                        name=name,
                        kind=resolved_kind,
                        direction=direction,
                        input_schema=create_model(
                            f"{name.capitalize()}Input",
                            **cast(
                                Any,
                                {
                                    p: (
                                        (
                                            param.annotation
                                            if param.annotation is not inspect._empty
                                            else Any
                                        ),
                                        (
                                            param.default
                                            if param.default is not inspect._empty
                                            else ...
                                        ),
                                    )
                                    for p, param in sig.parameters.items()
                                },
                            ),
                        ),
                    )
                    self._fn = fn
                    self._docstring = original_docstring

                def _evaluate(self, eval_input: EvalInput) -> List[Score]:
                    raise NotImplementedError("Async evaluator must use async_evaluate")

                async def _async_evaluate(self, eval_input: EvalInput) -> List[Score]:
                    result = await self._fn(**eval_input)
                    score = _convert_to_score(result, name, resolved_kind, direction)
                    return [score]

                async def __call__(self, *args: Any, **kwargs: Any) -> Any:
                    return await self._fn(*args, **kwargs)

            _AsyncFunctionEvaluator.__doc__ = original_docstring
            evaluator_instance = _AsyncFunctionEvaluator()
            return evaluator_instance
        else:

            class _FunctionEvaluator(Evaluator):
                def __init__(self) -> None:
                    super().__init__(
                        name=name,
                        kind=resolved_kind,
                        direction=direction,
                        input_schema=create_model(
                            f"{name.capitalize()}Input",
                            **cast(
                                Any,
                                {
                                    p: (
                                        (
                                            param.annotation
                                            if param.annotation is not inspect._empty
                                            else Any
                                        ),
                                        (
                                            param.default
                                            if param.default is not inspect._empty
                                            else ...
                                        ),
                                    )
                                    for p, param in sig.parameters.items()
                                },
                            ),
                        ),
                    )
                    self._fn = fn
                    self._docstring = original_docstring

                def _evaluate(self, eval_input: EvalInput) -> List[Score]:
                    result = self._fn(**eval_input)
                    score = _convert_to_score(result, name, resolved_kind, direction)
                    return [score]

                def __call__(self, *args: Any, **kwargs: Any) -> Any:
                    return self._fn(*args, **kwargs)

            _FunctionEvaluator.__doc__ = original_docstring
            evaluator_instance = _FunctionEvaluator()  # pyright: ignore
            return evaluator_instance

    return deco


# --- Factory functions ---
@_deprecate_positional_args("create_classifier")
def create_classifier(
    name: str,
    prompt_template: str,
    llm: LLM,
    choices: Union[
        List[str], Dict[str, Union[float, int]], Dict[str, Tuple[Union[float, int], str]]
    ],
    direction: DirectionType = "maximize",
) -> ClassificationEvaluator:
    """
    Factory to create a `ClassificationEvaluator`.

    Note: The evaluator requires the LLM to have tool calling or structured output capabilities.

    Args:
        name: Identifier for this evaluator and the name used in produced Scores.
        llm: The LLM instance to use for evaluation.
        prompt_template: Prompt template string with placeholders for inputs.
        choices: One of List[str], Dict[str, number], or Dict[str, Tuple[number, str]] describing
            classification labels (and optional scores/descriptions).
        direction: The score optimization direction ("maximize" or "minimize"). Defaults to
            "maximize".

    Returns:
        A `ClassificationEvaluator` instance.

    Examples:
        Creating a simple sentiment classifier::

            from phoenix.evals import create_classifier, LLM

            llm = LLM(provider="openai", model="gpt-4")

            sentiment_evaluator = create_classifier(
                name="sentiment",
                prompt_template="Analyze the sentiment: {text}",
                llm=llm,
                choices=["positive", "negative", "neutral"]
            )

            result = sentiment_evaluator.evaluate({"text": "Great product!"})
            print(result[0].label)  # "positive"
            print(result[0].score)  # None

        Creating a classifier with numeric scores::

            quality_evaluator = create_classifier(
                name="response_quality",
                prompt_template="Rate this response quality: {response}",
                llm=llm,
                choices={
                    "excellent": 5,
                    "good": 4,
                    "average": 3,
                    "poor": 2,
                    "terrible": 1
                }
            )

            result = quality_evaluator.evaluate({"response": "Detailed and helpful answer"})
            print(f"Quality: {result[0].label} (Score: {result[0].score})")

        Creating a classifier with scores and descriptions::

            accuracy_evaluator = create_classifier(
                name="factual_accuracy",
                prompt_template="Check factual accuracy: {claim}",
                llm=llm,
                choices={
                    "accurate": (1.0, "Factually correct information"),
                    "partially_accurate": (0.5, "Some correct, some incorrect information"),
                    "inaccurate": (0.0, "Factually incorrect information")
                }
            )

            result = accuracy_evaluator.evaluate({"claim": "Paris is the capital of France"})
            print(f"Accuracy: {result[0].label} (Score: {result[0].score})")
    """
    return ClassificationEvaluator(
        name=name,
        llm=llm,
        prompt_template=prompt_template,
        choices=choices,
        direction=direction,
    )


# --- Bound Evaluator ---
@_deprecate_positional_args("bind_evaluator")
def bind_evaluator(
    evaluator: Evaluator,
    input_mapping: InputMappingType,
) -> Evaluator:
    """
    Helper to bind an evaluator with a fixed input mapping.

    This function allows you to create a version of an evaluator that automatically
    maps input data fields to the evaluator's expected field names. This is useful
    when your data schema doesn't match the evaluator's expected inputs.

    Args:
        evaluator: The evaluator instance to bind.
        input_mapping: A dictionary mapping evaluator field names to either:
            - String keys for direct field mapping
            - Callable functions for computed field mapping

    Returns:
        The same evaluator instance with the input mapping bound.

    Examples:
        Basic field mapping::

            from phoenix.evals import create_evaluator, bind_evaluator

            @create_evaluator(name="text_length")
            def text_length(content: str) -> int:
                return len(content)

            # Map 'message' field to 'content' parameter
            mapping = {"content": "message"}
            bound_evaluator = bind_evaluator(evaluator=text_length, input_mapping=mapping)

            # Now we can use 'message' instead of 'content'
            result = bound_evaluator.evaluate({"message": "Hello world"})
            print(result[0].score)  # 11

        Using lambda functions for computed mappings::

            @create_evaluator(name="precision")
            def precision(retrieved_docs: list, relevant_docs: list) -> float:
                relevant_set = set(relevant_docs)
                hits = sum(1 for doc in retrieved_docs if doc in relevant_set)
                return hits / len(retrieved_docs) if retrieved_docs else 0.0

            # Convert single document to list format
            mapping = {
                "retrieved_docs": "retrieved_documents",
                "relevant_docs": lambda x: [x["expected_document"]]
            }
            bound_evaluator = bind_evaluator(evaluator=precision, input_mapping=mapping)

            data = {
                "retrieved_documents": [1, 2, 3],
                "expected_document": 2
            }
            result = bound_evaluator.evaluate(data)

        Complex data transformation::

            @create_evaluator(name="response_quality")
            def response_quality(question: str, answer: str, context: str) -> dict:
                # Simplified quality check
                has_context = context.lower() in answer.lower()
                return {
                    "score": 1.0 if has_context else 0.0,
                    "label": "good" if has_context else "poor",
                    "explanation": ("Answer uses context" if has_context
                                   else "Answer ignores context")
                }

            # Map nested data structure
            mapping = {
                "question": "query",
                "answer": "response.text",
                "context": lambda x: " ".join(x["documents"])
            }
            bound_evaluator = bind_evaluator(evaluator=response_quality, input_mapping=mapping)

            data = {
                "query": "What is the capital?",
                "response": {"text": "Paris is the capital of France"},
                "documents": ["France info", "Paris is the capital"]
            }
            result = bound_evaluator.evaluate(data)
    """
    # Create a shallow copy of the evaluator to avoid deepcopying LLM (contains locks)
    evaluator_copy = copy.copy(evaluator)
    # Deep copy the input mapping so the bound copy is fully independent
    mapping_copy = copy.deepcopy(input_mapping) if input_mapping is not None else None
    evaluator_copy.bind(input_mapping=mapping_copy)
    return evaluator_copy


# --- Helper functions for dataframe evaluation ---


def _prepare_dataframe_evaluation(
    dataframe: pd.DataFrame, evaluators: List[Evaluator]
) -> Tuple[
    pd.DataFrame,
    Dict[int, Dict[str, Any]],
    List[Tuple[int, int]],
]:
    """
    Prepare common data structures for dataframe evaluation.

    Returns:
        result_df: Copy of input dataframe
        eval_inputs: Dictionary mapping row indices to evaluation inputs
        task_inputs: List of (row_index, evaluator_index) tuples
    """
    # Create a copy to avoid modifying the original dataframe
    result_df = dataframe.copy()

    # Prepare task inputs - direct DataFrame iteration for better performance
    records = result_df.to_dict("records")
    eval_inputs: Dict[int, Dict[str, Any]] = {}
    for i, row in enumerate(records):
        eval_inputs[i] = {str(k): v for k, v in row.items()}
    task_inputs = list(itertools.product(range(len(result_df)), range(len(evaluators))))

    # Pre-allocate execution details columns
    for evaluator in evaluators:
        evaluator_name = evaluator.name
        execution_details_col = f"{evaluator_name}_execution_details"
        result_df[execution_details_col] = [None] * len(dataframe)

    return result_df, eval_inputs, task_inputs


def _process_execution_details(eval_execution_details: ExecutionDetails) -> Dict[str, Any]:
    """Process execution details into a JSON-serializable dict."""
    result: Dict[str, Any] = {
        "status": eval_execution_details.status.value,
        "exceptions": [repr(exc) for exc in eval_execution_details.exceptions],
        "execution_seconds": eval_execution_details.execution_seconds,
    }
    return result


def _process_results_and_add_to_dataframe(
    results: Optional[List[Optional[List[Score]]]],
    execution_details: List[ExecutionDetails],
    task_inputs: List[Tuple[int, int]],
    evaluators: List[Evaluator],
    result_df: pd.DataFrame,
) -> None:
    """
    Process evaluation results and add them directly to the dataframe.
    """
    # Pre-compute column locations for efficiency
    execution_details_cols = {
        evaluator.name: result_df.columns.get_loc(f"{evaluator.name}_execution_details")
        for evaluator in evaluators
    }

    # Pre-allocate score dictionaries - store dicts for each row index
    score_dicts: DefaultDict[str, Dict[int, Dict[str, Any]]] = defaultdict(dict)
    for i, (eval_input_index, evaluator_index) in enumerate(task_inputs):
        # Process and add execution details to dataframe
        details = execution_details[i]
        evaluator_name = evaluators[evaluator_index].name
        col_idx = execution_details_cols[evaluator_name]
        #  use iat to avoid Series alignment on dict
        result_df.iat[eval_input_index, col_idx] = _process_execution_details(details)

        # Process scores
        if results is None:
            continue
        scores = results[i]
        if scores is None:
            continue
        for score in scores:
            if not score.name:
                raise ValueError(f"Score has no name: {score}")
            score_col = f"{score.name}_score"
            score_dicts[score_col][eval_input_index] = score.to_dict()

    # Add scores to dataframe
    for score_col, score_dict in score_dicts.items():
        # Convert dictionary to list using positional indices
        score_list = [score_dict.get(pos, None) for pos in range(len(result_df))]
        result_df[score_col] = score_list


@_deprecate_positional_args("evaluate_dataframe")
def evaluate_dataframe(
    dataframe: pd.DataFrame,
    evaluators: List[Evaluator],
    tqdm_bar_format: Optional[str] = None,
    hide_tqdm_bar: bool = False,
    exit_on_error: Optional[bool] = None,
    max_retries: Optional[int] = None,
) -> pd.DataFrame:
    """
    Evaluate a dataframe with a list of evaluators and return an augmented dataframe.

    This function uses a synchronous executor; for async evaluation, use `async_evaluate_dataframe`.

    Args:
        dataframe: The input dataframe to evaluate. Each row will be converted to a dict and passed
            to each evaluator.
        evaluators: List of evaluators to apply to each row. Input mapping should be
            already bound via `bind_evaluator` or column names should match evaluator input fields.
        tqdm_bar_format: Optional format string for the progress bar. If None and hide_tqdm_bar is
            False, the default progress bar formatter is used.
        hide_tqdm_bar: Optional flag to control whether to hide the progress bar. If None, the
            progress bar is shown. Defaults to False.
        exit_on_error: Optional flag to control whether execution should stop on the first error.
            If None, uses SyncExecutor's default (True).
        max_retries: Optional number of times to retry on exceptions. If None, uses SyncExecutor's
            default (10).

    Returns:
        A copy of the input dataframe with additional columns for scores and exceptions.
        For each evaluator, columns are added for:
        - "{evaluator.name}_execution_details": Details about any exceptions encountered, execution
            time, and status.
        - "{score.name}_score": JSON-serialized Score objects for each score returned

    Examples:
        Basic dataframe evaluation::

            import pandas as pd
            from phoenix.evals import create_evaluator, evaluate_dataframe

            @create_evaluator(name="word_count")
            def word_count(text: str) -> int:
                return len(text.split())

            @create_evaluator(name="has_question")
            def has_question(text: str) -> bool:
                return "?" in text

            df = pd.DataFrame({
                "text": [
                    "Hello world",
                    "How are you today?",
                    "This is a longer sentence with multiple words"
                ]
            })

            evaluators = [word_count, has_question]
            results_df = evaluate_dataframe(dataframe=df, evaluators=evaluators, hide_tqdm_bar=True)

            # Results include original columns plus score columns
            print(results_df.columns)
            # ['text', 'word_count_execution_details', 'has_question_execution_details',
            #  'word_count_score', 'has_question_score']

        Using with input mapping::

            from phoenix.evals import bind_evaluator

            @create_evaluator(name="response_length")
            def response_length(response: str) -> int:
                return len(response)

            # Data has 'answer' column but evaluator expects 'response'
            mapping = {"response": "answer"}
            bound_evaluator = bind_evaluator(evaluator=response_length, input_mapping=mapping)

            df = pd.DataFrame({
                "question": ["What is AI?", "How does ML work?"],
                "answer": ["AI is artificial intelligence",
                          "ML uses algorithms to learn patterns"]
            })

            results_df = evaluate_dataframe(dataframe=df, evaluators=[bound_evaluator])

        With progress bar and error handling::

            results_df = evaluate_dataframe(
                dataframe=df,
                evaluators=evaluators,
                tqdm_bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]",
                exit_on_error=False,  # Continue on errors
                max_retries=3
            )

            # Check for evaluation errors
            import json
            for idx, row in results_df.iterrows():
                details = json.loads(row['word_count_execution_details'])
                if details['status'] != 'success':
                    print(f"Row {idx} failed: {details['exceptions']}")

    Notes:
        - Score name collisions: If multiple evaluators return scores with the same name,
          they will write to the same column (e.g., 'same_name_score'). This can lead to
          data loss as later scores overwrite earlier ones.
        - Similarly, evaluator names should be unique to ensure execution_details
          columns don't collide.
        - Failed evaluations: If an evaluation fails, the failure details will be recorded
          in the execution_details column and the score will be None.
    """

    # Prepare common data structures
    result_df, eval_inputs, task_inputs = _prepare_dataframe_evaluation(dataframe, evaluators)

    # Execution task: evaluate an eval_input with an evaluator
    def _task(task_input: Tuple[int, int]) -> List[Score]:
        eval_input_index, evaluator_index = task_input
        eval_input = eval_inputs[eval_input_index]
        evaluator = evaluators[evaluator_index]
        scores = evaluator.evaluate(eval_input=eval_input)
        return scores

    # Only pass parameters that were explicitly provided, otherwise use SyncExecutor defaults
    executor_kwargs: Dict[str, Any] = {"generation_fn": _task, "fallback_return_value": None}
    if hide_tqdm_bar:
        executor_kwargs["tqdm_bar_format"] = None
    else:
        if tqdm_bar_format is None:
            executor_kwargs["tqdm_bar_format"] = default_tqdm_progress_bar_formatter(
                "Evaluating Dataframe"
            )
        else:
            executor_kwargs["tqdm_bar_format"] = tqdm_bar_format
    if exit_on_error is not None:
        executor_kwargs["exit_on_error"] = exit_on_error
    if max_retries is not None:
        executor_kwargs["max_retries"] = max_retries

    executor = SyncExecutor(**executor_kwargs)
    results, execution_details = executor.run(task_inputs)

    # Process results and scores
    _process_results_and_add_to_dataframe(
        results, execution_details, task_inputs, evaluators, result_df
    )

    return result_df


@_deprecate_positional_args("async_evaluate_dataframe")
async def async_evaluate_dataframe(
    dataframe: pd.DataFrame,
    evaluators: List[Evaluator],
    concurrency: Optional[int] = None,
    tqdm_bar_format: Optional[str] = None,
    hide_tqdm_bar: Optional[bool] = False,
    exit_on_error: Optional[bool] = None,
    max_retries: Optional[int] = None,
) -> pd.DataFrame:
    """
    Evaluate a dataframe with a list of evaluators and return an augmented dataframe.

    This function uses an asynchronous executor; for sync evaluation, use `evaluate_dataframe`.

    Args:
        dataframe: The input dataframe to evaluate. Each row will be converted to a dict
            and passed to each evaluator.
        evaluators: List of evaluators to apply to each row. Input mapping should be
            already bound via `bind_evaluator` or column names should match evaluator input fields.
        concurrency: Optional number of concurrent consumers. If None, uses AsyncExecutor's default
            (3).
        tqdm_bar_format: Optional format string for the progress bar. If None, use the default
            formatter.
        hide_tqdm_bar: Optional flag to control whether to hide the progress bar. If None, the
            progress bar is shown. Defaults to False.
        exit_on_error: Optional flag to control whether execution should stop on the first
            error. If None, uses AsyncExecutor's default (True).
        max_retries: Optional number of times to retry on exceptions. If None, uses
            AsyncExecutor's default (10).

    Returns:
        A copy of the input dataframe with additional columns for scores and exceptions.
        For each evaluator, columns are added for:
        - "{evaluator.name}_execution_details": Details about any exceptions encountered, execution
            time, and status.
        - "{score.name}_score": JSON-serialized Score objects for each score returned

    Examples:
        Basic async evaluation::

            import asyncio
            import pandas as pd
            from phoenix.evals import create_evaluator, async_evaluate_dataframe

            @create_evaluator(name="text_analysis")
            def text_analysis(text: str) -> dict:
                return {
                    "score": len(text.split()),
                    "label": "long" if len(text) > 50 else "short"
                }

            df = pd.DataFrame({
                "text": [
                    "Short text",
                    "This is a much longer text that contains many more words and characters",
                    "Medium length text here"
                ]
            })

            async def main():
                results_df = await async_evaluate_dataframe(
                    dataframe=df,
                    evaluators=[text_analysis],
                    concurrency=5  # Process up to 5 rows concurrently
                    hide_tqdm_bar=True,
                )
                return results_df

            results_df = asyncio.run(main())
            print(results_df.columns)

        With LLM evaluators::

            from phoenix.evals import create_classifier, LLM

            llm = LLM(provider="openai", model="gpt-4")

            sentiment_evaluator = create_classifier(
                name="sentiment",
                prompt_template="Classify sentiment: {text}",
                llm=llm,
                choices=["positive", "negative", "neutral"]
            )

            df = pd.DataFrame({
                "text": [
                    "I love this product!",
                    "This is terrible quality",
                    "It's okay, nothing special"
                ]
            })

            async def evaluate_sentiment():
                results_df = await async_evaluate_dataframe(
                    dataframe=df,
                    evaluators=[sentiment_evaluator],
                    concurrency=2,  # Limit concurrent LLM calls
                    tqdm_bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt}"
                )
                return results_df

            results_df = asyncio.run(evaluate_sentiment())

        Error handling and retries::

            async def robust_evaluation():
                results_df = await async_evaluate_dataframe(
                    dataframe=df,
                    evaluators=evaluators,
                    concurrency=3,
                    exit_on_error=False,  # Continue despite errors
                    max_retries=5,        # Retry failed evaluations
                    tqdm_bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining}]"
                )

                # Check for failures
                import json
                failed_rows = []
                for idx, row in results_df.iterrows():
                    details = json.loads(row['sentiment_execution_details'])
                    if details['status'] != 'success':
                        failed_rows.append(idx)

                print(f"Failed evaluations: {len(failed_rows)} out of {len(results_df)}")
                return results_df

            results_df = asyncio.run(robust_evaluation())

    Notes:
        - Score name collisions: If multiple evaluators return scores with the same name,
          they will write to the same column (e.g., 'same_name_score'). This can lead to
          data loss as later scores overwrite earlier ones.
        - Similarly, evaluator names should be unique to ensure execution_details
          columns don't collide.
        - Failed evaluations: If an evaluation fails, the failure details will be recorded
          in the execution_details column and the score will be None.
    """
    # Prepare common data structures
    result_df, eval_inputs, task_inputs = _prepare_dataframe_evaluation(dataframe, evaluators)

    # Execution task: evaluate an eval_input with an evaluator
    async def _task(task_input: Tuple[int, int]) -> List[Score]:
        eval_input_index, evaluator_index = task_input
        eval_input = eval_inputs[eval_input_index]
        evaluator = evaluators[evaluator_index]
        scores = await evaluator.async_evaluate(eval_input=eval_input)
        return scores

    # Only pass parameters that were explicitly provided, otherwise use Executor defaults
    executor_kwargs: Dict[str, Any] = {"generation_fn": _task, "fallback_return_value": None}
    if hide_tqdm_bar:
        executor_kwargs["tqdm_bar_format"] = None
    else:
        if tqdm_bar_format is None:
            executor_kwargs["tqdm_bar_format"] = default_tqdm_progress_bar_formatter(
                "Evaluating Dataframe"
            )
        else:
            executor_kwargs["tqdm_bar_format"] = tqdm_bar_format
    if exit_on_error is not None:
        executor_kwargs["exit_on_error"] = exit_on_error
    if max_retries is not None:
        executor_kwargs["max_retries"] = max_retries
    if concurrency is not None:
        executor_kwargs["concurrency"] = concurrency

    executor = AsyncExecutor(**executor_kwargs)
    results, execution_details = await executor.execute(task_inputs)

    # Process results and scores
    _process_results_and_add_to_dataframe(
        results, execution_details, task_inputs, evaluators, result_df
    )

    return result_df


__all__ = [
    # evals 1.0
    "LLMEvaluator",
    "HallucinationEvaluator",
    "QAEvaluator",
    "RelevanceEvaluator",
    "ToxicityEvaluator",
    "SummarizationEvaluator",
    "SQLEvaluator",
    # evals 2.0
    "EnforcedString",
    "Score",
    "Evaluator",
    "LLMEvaluator",
    "ClassificationEvaluator",
    "create_evaluator",
    "create_classifier",
    "bind_evaluator",
    "evaluate_dataframe",
    "async_evaluate_dataframe",
]
