import asyncio
import inspect
import itertools
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Literal, Optional, Set, Tuple, Union, cast

import pandas as pd
from pydantic import BaseModel, ValidationError, create_model
from typing_extensions import Mapping

from phoenix.evals.executors import AsyncExecutor, ExecutionDetails, SyncExecutor

from .llm import LLM
from .llm.types import ObjectGenerationMethod
from .templating import Template
from .utils import remap_eval_input

# --- Type Aliases ---
EvalInput = Dict[str, Any]
ToolSchema = Optional[Dict[str, Any]]
SourceType = Literal["human", "llm", "heuristic"]
DirectionType = Literal["maximize", "minimize"]
InputMappingType = Optional[Mapping[str, Union[str, Callable[[Mapping[str, Any]], Any]]]]


# --- Score model ---
@dataclass(frozen=True)
class Score:
    """Score dataclass for evaluator results.

    Attributes:
        name: The name of the score.
        score: The score value if applicable.
        label: The label of the score if applicable.
        explanation: The explanation of the score if applicable.
        metadata: Any metadata attached to the score as key-value pairs.
        source: The source of the score (human, llm, or heuristic).
        direction: The optimization direction of the score (maximize or minimize).
    """

    name: Optional[str] = None
    score: Optional[Union[float, int]] = None
    label: Optional[str] = None
    explanation: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    source: Optional[SourceType] = None
    direction: DirectionType = "maximize"

    def to_dict(self) -> Dict[str, Any]:
        """Convert the Score to a dictionary, excluding None values.

        Returns:
            Dict[str, Any]: A dictionary representation of the Score with None values excluded.
        """
        result: Dict[str, Any] = {}

        for field_name, field_value in self.__dict__.items():
            if field_value is not None:
                result[field_name] = field_value

        return result

    def pretty_print(self, indent: int = 2) -> None:
        """Pretty print the Score as formatted JSON.

        Args:
            indent (int): Number of spaces for indentation. Defaults to 2.
        """
        score_dict = self.to_dict()
        print(json.dumps(score_dict, indent=indent))


# --- Async helper ---
def to_thread(fn: Callable[..., Any]) -> Callable[..., Any]:
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: fn(*args, **kwargs))

    return wrapper


# --- Base Evaluator ---
class Evaluator(ABC):
    """
    Core abstraction for evaluators.

    Evaluators support both synchronous and asynchronous evaluation:

    - `evaluator.evaluate(eval_input)` or `evaluator(eval_input)`
    - `evaluator.aevaluate(eval_input)`

    Single record evaluations return a list of `Score` objects. Often, this will be a list of
    length 1, but some evaluators may return multiple scores for a single `eval_input`
    (e.g. precision, recall or multi-criteria evals).

    Evaluators have a well-defined `input_schema` that, if not provided at instantiation, is
    inferred from the evaluator's signature when possible.

    Evaluators accept an arbitrary `eval_input` payload, and an optional `input_mapping` to
    map/transform the `eval_input` to match the `input_schema`. Input remapping is handled by the
    base `Evaluator` class.

    Inheritors of the base class only have to implement `_evaluate` and the remaining methods come
    for free unless explicitly overwritten.

    Args:
        name (str): The name of this evaluator, used for identification and Score naming.
        source (SourceType): The source of this evaluator (human, llm, or heuristic).
        direction (DirectionType): The direction for score optimization ("maximize"
            or "minimize"). Defaults to "maximize".
        input_schema (Optional[type[BaseModel]]): Optional Pydantic BaseModel for input typing
            and validation. If None, subclasses infer fields from prompts or function signatures
            and may construct a model dynamically.
    """

    def __init__(
        self,
        name: str,
        source: SourceType,
        direction: DirectionType = "maximize",
        input_schema: Optional[type[BaseModel]] = None,
    ):
        self._name = name
        self._source = source
        self._direction = direction
        self._input_schema: Optional[type[BaseModel]] = input_schema

    @property
    def name(self) -> str:
        """The name of this evaluator."""
        return self._name

    @property
    def source(self) -> SourceType:
        """The source of this evaluator."""
        return self._source

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

    async def _aevaluate(self, eval_input: EvalInput) -> List[Score]:
        """Implement async core logic assuming `eval_input` has required fields per schema/mapping.

        By default, this runs the synchronous _evaluate method in a thread pool.
        Subclasses can override this for more efficient async implementations.
        """
        result = await to_thread(self._evaluate)(eval_input)
        return cast(List[Score], result)

    def evaluate(
        self, eval_input: EvalInput, input_mapping: Optional[InputMappingType] = None
    ) -> List[Score]:
        """Validate and remap `eval_input` using the evaluator's input fields before calling
        `_evaluate`.

        Args:
            eval_input (EvalInput): The input data to evaluate.
            input_mapping (Optional[InputMappingType]): Optional mapping from evaluator-required
                field names to keys/paths in `eval_input`.

        Returns:
            List[Score]: A list of Score objects.

        Raises:
            ValueError: If input validation fails.

        Notes:
            - Uses the evaluator's input fields (from `input_schema` when available, otherwise from
              the provided `input_mapping`). An optional per-call `input_mapping` maps
              evaluator-required field names to keys/paths in `eval_input`.
            - Mapping is optional per-field; unspecified fields are read directly from `eval_input`.
            - Evaluators are also directly callable: `scores = evaluator(eval_input)` is equivalent
              to `scores = evaluator.evaluate(eval_input)`.
        """
        required_fields = self._get_required_fields(input_mapping)
        remapped_eval_input = remap_eval_input(
            eval_input,
            required_fields,
            input_mapping,
        )
        if self.input_schema is not None:
            try:
                model_instance = self.input_schema.model_validate(remapped_eval_input)
                remapped_eval_input = model_instance.model_dump()
            except ValidationError as e:
                raise ValueError(f"Input validation failed: {e}")
        return self._evaluate(remapped_eval_input)

    async def aevaluate(
        self, eval_input: EvalInput, input_mapping: Optional[InputMappingType] = None
    ) -> List[Score]:
        """Async variant of `evaluate`.

        Validates and remaps input as described in `evaluate`.

        Args:
            eval_input (EvalInput): The input data to evaluate.
            input_mapping (Optional[InputMappingType]): Optional mapping from evaluator-required
                field names to keys/paths in `eval_input`.

        Returns:
            List[Score]: A list of Score objects.

        Raises:
            ValueError: If input validation fails.
        """
        required_fields = self._get_required_fields(input_mapping)
        remapped_eval_input = remap_eval_input(
            eval_input,
            required_fields,
            input_mapping,
        )
        if self.input_schema is not None:
            try:
                model_instance = self.input_schema.model_validate(remapped_eval_input)
                remapped_eval_input = model_instance.model_dump()
            except ValidationError as e:
                raise ValueError(f"Input validation failed: {e}")
        return await self._aevaluate(remapped_eval_input)

    # allow instances to be called directly: `evaluator(eval_input)`
    __call__ = evaluate
    # ensure the callable inherits evaluate's docs for IDE support
    __call__.__doc__ = evaluate.__doc__

    def _get_required_fields(self, input_mapping: Optional[InputMappingType]) -> Set[str]:
        """Determine required field names for mapping/validation.

        Prefers Pydantic schema; falls back to mapping keys if no schema.

        Args:
            input_mapping (Optional[InputMappingType]): Optional mapping to determine required
            fields.

        Returns:
            Set[str]: A set of required field names.

        Raises:
            ValueError: If neither input_schema nor input_mapping is available.
        """

        def _required_fields_from_model(model: Optional[type[BaseModel]]) -> Set[str]:
            """Extract required field names from a Pydantic model.

            Args:
                model (Optional[type[BaseModel]]): The Pydantic model to analyze.

            Returns:
                Set[str]: A set of required field names.
            """
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
        """Return a JSON-serializable description of the evaluator.

        Includes its name, source, direction, and input fields derived from the
        Pydantic input schema when available.

        Returns:
            Dict[str, Any]: A dictionary containing evaluator metadata.
        """
        # TODO add other serializable properties from subclasses
        if self.input_schema is not None:
            schema = self.input_schema.model_json_schema()
        else:
            schema = {"unspecified": {"type": "any", "required": False}}
        return {
            "name": self.name,
            "source": self.source,
            "direction": self.direction,
            "input_schema": schema,
        }


# --- LLM Evaluator base ---
class LLMEvaluator(Evaluator):
    """
    Base LLM evaluator that infers required input fields from its prompt template and
    constructs a default Pydantic input schema when none is supplied.

    Args:
        name (str): Identifier for this evaluator and the name used in produced Scores.
        llm (LLM): The LLM instance to use for evaluation.
        prompt_template (Union[str, Template]): The prompt template (string or Template) with
            placeholders for required fields; used to infer required variables.
        schema (Optional[ToolSchema]): Optional tool/JSON schema for structured output when
            supported by the LLM.
        input_schema (Optional[type[BaseModel]]): Optional Pydantic model describing/validating
            inputs. If not provided, a model is dynamically created from the prompt variables
            (assuming all variables are strings and required).
        direction (DirectionType): The score optimization direction ("maximize" or "minimize").
            Defaults to "maximize".
    """

    def __init__(
        self,
        name: str,
        llm: LLM,
        prompt_template: Union[str, Template],
        schema: Optional[ToolSchema] = None,
        input_schema: Optional[type[BaseModel]] = None,
        direction: DirectionType = "maximize",
    ):
        # Infer required fields from prompt_template
        if isinstance(prompt_template, str):
            prompt_template = Template(template=prompt_template)
        required_fields = prompt_template.variables

        # If no explicit input_schema, create a Pydantic model with all fields as required str
        if input_schema is None:
            model_name = f"{name.capitalize()}Input"
            field_defs: Dict[str, Tuple[Any, Any]] = {var: (str, ...) for var in required_fields}
            input_schema = create_model(
                model_name,
                **cast(Any, field_defs),
            )

        super().__init__(
            name=name,
            source="llm",
            direction=direction,
            input_schema=input_schema,
        )
        self.llm = llm
        self.prompt_template = prompt_template
        self.schema = schema

    def _evaluate(self, eval_input: EvalInput) -> List[Score]:
        raise NotImplementedError("Subclasses must implement _evaluate")

    async def _aevaluate(self, eval_input: EvalInput) -> List[Score]:
        raise NotImplementedError("Subclasses must implement _aevaluate")

    def evaluate(
        self, eval_input: EvalInput, input_mapping: Optional[InputMappingType] = None
    ) -> List[Score]:
        return super().evaluate(eval_input, input_mapping)

    async def aevaluate(
        self, eval_input: EvalInput, input_mapping: Optional[InputMappingType] = None
    ) -> List[Score]:
        return await super().aevaluate(eval_input, input_mapping)


# --- LLM ClassificationEvaluator ---
class ClassificationEvaluator(LLMEvaluator):
    """
    LLM-based evaluator for classification tasks. Supports label-only or label+score mappings,
    and returns explanations by default.

    Args:
        name (str): Identifier for this evaluator and the name used in produced Scores.
        llm (LLM): The LLM instance to use for evaluation.
        prompt_template (Union[str, Template]): The prompt template (string or Template) with
            placeholders for inputs.
        choices: One of

            - List[str]: set of label names; scores will be None.
            - Dict[str, Union[float, int]]: map label -> score.
            - Dict[str, Tuple[Union[float, int], str]]: map label -> (score, description).

        include_explanation (bool): If True, request an explanation in addition to the label.
        input_schema (Optional[type[BaseModel]]): Optional Pydantic model describing/validating
            inputs. If not provided, a model is dynamically created from the prompt variables
            (assuming all variables are strings and required).
        direction (DirectionType): The score optimization direction ("maximize" or "minimize").
            Defaults to "maximize".

    Notes:
        - The `choices` argument can be one of
            - A list of labels: `["positive", "negative", "neutral"]`
            - A label mapped to a score: `{"positive": 1.0, "negative": 0.0, "neutral": 0.5}`
              (recommended)
            - A label mapped to a tuple of (score, description): `{"positive": (1.0, "Positive"),
              "negative": (0.0, "Negative"), "neutral": (0.5, "Neutral")}` (less reliable b/c of
              tool calling consistency issues across models)

    Examples::

        >>> from phoenix.evals.preview import ClassificationEvaluator
        >>> from phoenix.evals.preview.llm import LLM
        >>> llm = LLM(provider="openai", model="gpt-4o")
        >>> evaluator = ClassificationEvaluator(name="sentiment", llm=llm,
        ...     prompt_template="What is the sentiment of the following document: {document}?",
        ...     choices={"positive": 1.0, "negative": 0.0, "neutral": 0.5})
        >>> evaluator.evaluate({"document": "I love this product!"})
        [Score(name='sentiment', score=1.0, label='positive')]

    """

    def __init__(
        self,
        name: str,
        llm: LLM,
        prompt_template: Union[str, Template],
        choices: Union[
            List[str], Dict[str, Union[float, int]], Dict[str, Tuple[Union[float, int], str]]
        ],
        include_explanation: bool = True,
        input_schema: Optional[type[BaseModel]] = None,
        direction: DirectionType = "maximize",
    ):
        super().__init__(
            name=name,
            llm=llm,
            prompt_template=prompt_template,
            input_schema=input_schema,
            direction=direction,
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
        prompt_filled = self.prompt_template.render(variables=eval_input)
        method = (
            ObjectGenerationMethod.TOOL_CALLING
            if isinstance(self.labels, Dict)
            else ObjectGenerationMethod.AUTO
        )
        response = self.llm.generate_classification(
            prompt=prompt_filled,
            labels=self.labels,
            include_explanation=self.include_explanation,
            method=method,
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
                source=self.source,
                direction=self.direction,
            )
        ]

    async def _aevaluate(self, eval_input: EvalInput) -> List[Score]:
        prompt_filled = self.prompt_template.render(variables=eval_input)
        method = (
            ObjectGenerationMethod.TOOL_CALLING
            if isinstance(self.labels, Dict)
            else ObjectGenerationMethod.AUTO
        )
        response = await self.llm.agenerate_classification(
            prompt=prompt_filled,
            labels=self.labels,
            include_explanation=self.include_explanation,
            method=method,
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
                source=self.source,
                direction=self.direction,
            )
        ]


# --- Registry & simple evaluator decorator ---
_registry: Dict[str, Callable[..., List[Score]]] = {}


def list_evaluators() -> List[str]:
    """Return a list of names of all registered evaluators.

    Returns:
        List[str]: A list of evaluator names.
    """
    return list(_registry.keys())


def create_evaluator(
    name: str, source: SourceType = "heuristic", direction: DirectionType = "maximize"
) -> Callable[[Callable[..., Any]], Evaluator]:
    """Decorator that turns a simple function into an Evaluator instance.

    The decorated function should accept keyword args matching its required fields and return a
    value that can be converted to a Score. The returned object is an Evaluator with full support
    for evaluate/aevaluate and direct callability.

    Args:
        name (str): Identifier for the evaluator and the name used in produced Scores.
        source (SourceType): The source of this evaluator ("human", "llm", or "heuristic"). Defaults
            to "heuristic".
        direction (DirectionType): The score optimization direction ("maximize" or "minimize").
            Defaults to "maximize".

    Returns:
        Callable[[Callable[..., Any]], Evaluator]: An `Evaluator` instance.

    Notes:
        The decorated function can return:

        - A Score object (no conversion needed)
        - A number (converted to Score.score)
        - A boolean (converted to integer Score.score and string Score.label)
        - A short string (≤3 words, converted to Score.label)
        - A long string (≥4 words, converted to Score.explanation)
        - A dictionary with keys "score", "label", and/or "explanation"
        - A tuple of values (only bool, number, str types allowed)

        The decorator automatically handles conversion to a valid Score object.

        An input_schema is automatically created from the function signature, capturing the required
        input fields, their types, and any defaults. For best results, do not use `*args` or
        `**kwargs`

    Examples:
        1) Function returns a Score object + uses the default source and direction:
            >>> from phoenix.evals.preview import Score, create_evaluator
            >>> @create_evaluator(name="test_evaluator")
            ... def test_func(input_text: str, input_int: int) -> Score:
            ...     return Score(score=0.8, label="good", explanation="test explanation")
            ...
            >>> test_func({"input_text": "test", "input_int": 5})
            [Score(name='test_evaluator', score=0.8, label='good', explanation='test explanation')]

        2) Function that returns a tuple of a number and a short string label:
            >>> from phoenix.evals.preview import create_evaluator
            >>> @create_evaluator(name="test_evaluator")
            ... def test_func(input_text: str) -> tuple[float, str]:
            ...     return 0.8, "short label"
            ...
            >>> test_func({"input_text": "test"})
            [Score(name='test_evaluator', score=0.8, label='short label')]

        3) Function that returns a dictionary with keys "score", "label", and "explanation":
            >>> from phoenix.evals.preview import create_evaluator
            >>> @create_evaluator(name="test_evaluator")
            ... def test_func(input_text: str) -> dict:
            ...     return {"score": 0.8, "label": "short label", "explanation": "test explanation"}
            ...
            >>> test_func({"input_text": "test"})
            [Score(name='test_evaluator', score=0.8, label='short label',
                   explanation='test explanation')]

    """

    def _convert_to_score(
        result: Any, name: str, source: SourceType, direction: DirectionType
    ) -> Score:
        """Convert various return types to a Score object.

        Args:
            result (Any): The result to convert to a Score.
            name (str): The name for the Score.
            source (SourceType): The source of the Score.
            direction (DirectionType): The direction for score optimization.

        Returns:
            Score: A Score object.

        Raises:
            ValueError: If the return type is not supported.
        """
        LABEL_WORD_COUNT_THRESHOLD = 3  # ≤3 words = label, ≥4 words = explanation
        ERROR_MESSAGE = (
            f"Unsupported return type '{type(result).__name__}' for evaluator '{name}'. "
            f"Supported return types are: Score, numbers, booleans, strings, dictionaries, and "
            f"tuples of numbers, booleans, and strings. "
            f"Got: {repr(result)}"
        )
        # If already a Score object, ensure name, source, and direction are set correctly
        if isinstance(result, Score):
            # Create a new Score with the correct name, source, and direction
            return Score(
                score=result.score,
                name=name,
                label=result.label,
                explanation=result.explanation,
                metadata=result.metadata,
                source=source,
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
            return Score(name=name, source=source, direction=direction, **tuple_score_data)

        # Handle dictionaries
        if isinstance(result, dict):
            dict_score_data: Dict[str, Any] = {}
            for key, value in result.items():
                if key in ["score", "label", "explanation"]:
                    dict_score_data[key] = value
            return Score(name=name, source=source, direction=direction, **dict_score_data)

        # Handle numbers and booleans
        if isinstance(result, (int, float, bool)):
            return Score(
                score=float(result) if isinstance(result, bool) else result,
                label=str(result) if isinstance(result, bool) else None,
                name=name,
                source=source,
                direction=direction,
            )

        # Handle strings
        if isinstance(result, str):
            if result.count(" ") <= LABEL_WORD_COUNT_THRESHOLD - 1:
                return Score(
                    label=result,
                    name=name,
                    source=source,
                    direction=direction,
                )
            else:
                return Score(
                    explanation=result,
                    name=name,
                    source=source,
                    direction=direction,
                )

        # Raise informative error for unsupported types
        raise ValueError(ERROR_MESSAGE)

    def deco(fn: Callable[..., Any]) -> Evaluator:
        """Decorator function that creates an evaluator from a function.

        Args:
            fn (Callable[..., Any]): The function to wrap.

        Returns:
            Evaluator: An evaluator instance.
        """
        sig = inspect.signature(fn)

        class _FunctionEvaluator(Evaluator):
            """Internal evaluator class that wraps a function."""

            def __init__(self) -> None:
                """Initialize the function evaluator.

                Creates an input schema from the function signature.
                """
                super().__init__(
                    name=name,
                    source=source,
                    direction=direction,
                    # infer input schema from function signature
                    # TODO make it work with *args, **kwargs
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
                                    (param.default if param.default is not inspect._empty else ...),
                                )
                                for p, param in sig.parameters.items()
                            },
                        ),
                    ),
                )
                self._fn = fn

            def _evaluate(self, eval_input: EvalInput) -> List[Score]:
                """Evaluate the input using the wrapped function.

                Args:
                    eval_input (EvalInput): The input data to evaluate.

                Returns:
                    List[Score]: A list containing the evaluation score.
                """
                # eval_input is already remapped by Evaluator.evaluate(...)
                result = self._fn(**eval_input)
                score = _convert_to_score(result, name, source, direction)
                return [score]

        evaluator_instance = _FunctionEvaluator()
        # Keep registry compatibility by storing a callable with expected signature
        _registry[name] = evaluator_instance.evaluate
        return evaluator_instance

    return deco


# --- Factory functions ---
def create_classifier(
    name: str,
    prompt_template: str,
    llm: LLM,
    choices: Union[
        List[str], Dict[str, Union[float, int]], Dict[str, Tuple[Union[float, int], str]]
    ],
    direction: DirectionType = "maximize",
) -> ClassificationEvaluator:
    """Factory to create a ClassificationEvaluator (an LLM-based single-criteria classifier).
    Supports label-only or label+score mappings, and returns explanations by default.

    Args:
        name (str): Identifier for this evaluator and the name used in produced Scores.
        llm (LLM): The LLM instance to use for evaluation.
        prompt_template (Union[str, Template]): The prompt template (string or Template) with
            placeholders for inputs.
        choices: One of

            - List[str]: set of label names; scores will be None.
            - Dict[str, Union[float, int]]: map label -> score.
            - Dict[str, Tuple[Union[float, int], str]]: map label -> (score, description).

        include_explanation (bool): If True, request an explanation in addition to the label.
        input_schema (Optional[type[BaseModel]]): Optional Pydantic model describing/validating
            inputs. If not provided, a model is dynamically created from the prompt variables
            (assuming all variables are strings and required).
        direction (DirectionType): The score optimization direction ("maximize" or "minimize").
            Defaults to "maximize".

    Notes:
        - The `choices` argument can be one of
            - A list of labels: `["positive", "negative", "neutral"]`
            - A label mapped to a score: `{"positive": 1.0, "negative": 0.0, "neutral": 0.5}`
              (recommended)
            - A label mapped to a tuple of (score, description): `{"positive": (1.0, "Positive"),
              "negative": (0.0, "Negative"), "neutral": (0.5, "Neutral")}` (less reliable b/c of
              tool calling consistency issues across models)

    Examples:
        >>> from phoenix.evals.preview import create_classifier
        >>> from phoenix.evals.preview.llm import LLM
        >>> llm = LLM(provider="openai", model="gpt-4o")
        >>> evaluator = create_classifier(name="sentiment", llm=llm,
        ...     prompt_template="What is the sentiment of the following document: {document}?",
        ...     choices={"positive": 1.0, "negative": 0.0, "neutral": 0.5})
        >>> evaluator.evaluate({"document": "I love this product!"})
        [Score(name='sentiment', score=1.0, label='positive')]

    """
    return ClassificationEvaluator(
        name=name,
        llm=llm,
        prompt_template=prompt_template,
        choices=choices,
        direction=direction,
    )


# --- Bound Evaluator ---
class BoundEvaluator:
    """A prepared evaluator with a fixed mapping specification.

    Evaluates payloads without requiring per-call mapping arguments.

    Args:
        evaluator (Evaluator): The evaluator to bind.
        mapping (InputMappingType): The input mapping to bind to the evaluator.

    Notes:
        - Mapping is optional per-field; unspecified fields will be read directly from
          `eval_input` using their field name.
    """

    def __init__(
        self,
        evaluator: Evaluator,
        mapping: InputMappingType,
    ) -> None:
        self._evaluator = evaluator
        self._mapping = mapping

    @property
    def input_schema(self) -> Optional[type[BaseModel]]:
        return self._evaluator.input_schema

    @property
    def name(self) -> str:
        return self._evaluator.name

    def evaluate(self, payload: EvalInput) -> List[Score]:
        """Evaluate a payload using the bound evaluator.

        Args:
            payload (EvalInput): The input payload to evaluate.

        Returns:
            List[Score]: A list of scores from the evaluation.
        """
        return self._evaluator.evaluate(payload, input_mapping=self._mapping)

    async def aevaluate(self, payload: EvalInput) -> List[Score]:
        """Asynchronously evaluate a payload using the bound evaluator.

        Args:
            payload (EvalInput): The input payload to evaluate.

        Returns:
            List[Score]: A list of scores from the evaluation.
        """
        return await self._evaluator.aevaluate(payload, input_mapping=self._mapping)

    def mapping_description(self) -> Dict[str, Any]:
        """Get a description of the evaluator mapping.

        Returns:
            Dict[str, Any]: A dictionary containing evaluator name and mapping keys.
        """
        keys = list(self._mapping.keys()) if self._mapping is not None else []
        return {"evaluator": self._evaluator.name, "mapping_keys": keys}

    # Introspection passthroughs
    def describe(self) -> Dict[str, Any]:
        """Get a description of the bound evaluator.

        Returns:
            Dict[str, Any]: A dictionary containing evaluator metadata.
        """
        return self._evaluator.describe()


def bind_evaluator(
    evaluator: Evaluator,
    mapping: InputMappingType,
) -> BoundEvaluator:
    """Helper to create a `BoundEvaluator` with a fixed input mapping.

    Args:
        evaluator (Evaluator): The evaluator to bind.
        mapping (InputMappingType): The input mapping to bind to the evaluator.

    Returns:
        BoundEvaluator: A bound evaluator with fixed input mapping.

    Examples:
        >>> from phoenix.evals.preview import create_evaluator, bind_evaluator
        >>> @create_evaluator(name="test_evaluator")
        ... def test_func(input_text: str) -> Score:
        ...     return Score(score=0.8, label="good", explanation="test explanation")
        ...
        >>> bound_evaluator = bind_evaluator(test_func, mapping={"input_text": "input.text"})
        >>> bound_evaluator({"input": {"text": "test"}})
        [Score(name='test_evaluator', score=0.8, label='good', explanation='test explanation')]
    """
    return BoundEvaluator(evaluator, mapping)


def evaluate_dataframe(
    dataframe: pd.DataFrame,
    evaluators: List[Evaluator],
    tqdm_bar_format: Optional[str] = None,
    exit_on_error: Optional[bool] = None,
    max_retries: Optional[int] = None,
) -> pd.DataFrame:
    """Evaluate a dataframe with a list of evaluators and return an augmented dataframe.

    This function uses a synchronous executor; for async evaluation, use `async_evaluate_dataframe`.

    Args:
        dataframe (pd.DataFrame): The input dataframe to evaluate. Each row will be converted to a
            dict and passed to each evaluator.
        evaluators (List[Evaluator]): List of evaluators to run. Input mapping should already be
            bound via `bind_evaluator` or column names should match evaluator input fields.
        tqdm_bar_format (Optional[str]): Optional format string for the progress bar. If None,
            the progress bar is disabled.
        exit_on_error (Optional[bool]): Optional flag to control whether execution should stop on
            the first error. If None, uses SyncExecutor's default (True).
        max_retries (Optional[int]): Optional number of times to retry on exceptions. If None,
            uses SyncExecutor's default (10).

    Returns:
        pd.DataFrame: A copy of the input dataframe with added columns for scores and exceptions.
        For each evaluator, columns are added for:

            - "{evaluator.name}_execution_details": Details about any exceptions encountered,
              execution time, and status.
            - "{score.name}_score": JSON-serialized Score objects for each score returned

    Notes:
        - Score name collisions: If multiple evaluators return scores with the same name,
          they will write to the same column (e.g., 'same_name_score'). This can lead to
          data loss as later scores overwrite earlier ones.
        - Similarly, evaluator names should be unique to ensure execution_details columns don't
          collide.
        - Do not use dot notation in the dataframe column names e.g. "input.query" because it will
          interfere with the input mapping.
        - Failed evaluations: If an evaluation fails, the failure details will be recorded
          in the execution_details column and the score will be None.

    """
    # Create a copy to avoid modifying the original dataframe
    result_df = dataframe.copy()

    # Prepare task inputs
    records = [{str(k): v for k, v in record.items()} for record in result_df.to_dict("records")]
    eval_inputs: Dict[int, Dict[str, Any]] = dict(enumerate(records))
    evaluator_mapping = {i: evaluator for i, evaluator in enumerate(evaluators)}
    task_inputs = list(itertools.product(eval_inputs.keys(), evaluator_mapping.keys()))

    # Pre-allocate columns for efficient assignment
    score_lists: Dict[str, List[Optional[str]]] = {}
    for evaluator in evaluators:
        evaluator_name = evaluator.name
        execution_details_col = f"{evaluator_name}_execution_details"
        result_df[execution_details_col] = [None] * len(dataframe)

    # Execution task: evaluate an eval_input with an evaluator
    def _task(task_input: Tuple[int, int]) -> List[Score]:
        """Execute a single evaluation task.

        Args:
            task_input (Tuple[int, int]): A tuple of (eval_input_index, evaluator_index).

        Returns:
            List[Score]: A list of scores from the evaluation.
        """
        eval_input_index, evaluator_index = task_input
        eval_input = eval_inputs[eval_input_index]
        evaluator = evaluators[evaluator_index]
        scores = evaluator.evaluate(eval_input)
        return scores

    # Only pass parameters that were explicitly provided, otherwise use SyncExecutor defaults
    executor_kwargs: Dict[str, Any] = {"generation_fn": _task, "fallback_return_value": None}
    if tqdm_bar_format is not None:
        executor_kwargs["tqdm_bar_format"] = tqdm_bar_format
    if exit_on_error is not None:
        executor_kwargs["exit_on_error"] = exit_on_error
    if max_retries is not None:
        executor_kwargs["max_retries"] = max_retries

    executor = SyncExecutor(**executor_kwargs)
    results, execution_details = executor.run(task_inputs)

    def _process_execution_details(eval_execution_details: ExecutionDetails) -> str:
        """Process execution details into a JSON string.

        Args:
            eval_execution_details (ExecutionDetails): The execution details to process.

        Returns:
            str: A JSON string representation of the execution details.
        """
        result: Dict[str, Any] = {}
        result["status"] = eval_execution_details.status.value
        result["exceptions"] = [repr(exc) for exc in eval_execution_details.exceptions]
        result["execution_seconds"] = eval_execution_details.execution_seconds
        return json.dumps(result)

    for i, (eval_input_index, evaluator_index) in enumerate(task_inputs):
        # Process and add execution details to dataframe
        details = execution_details[i]
        execution_details_col = f"{evaluators[evaluator_index].name}_execution_details"
        result_df.at[eval_input_index, execution_details_col] = _process_execution_details(details)

        # Process scores
        if results is None:
            continue
        scores = results[i]
        if scores is None:
            continue
        for score in scores:
            if not score.name:  # this shouldn't happen
                score_col = f"{evaluators[evaluator_index].name}_{i}"
            else:
                score_col = f"{score.name}_score"
            if score_col not in score_lists:
                score_lists[score_col] = [None] * len(dataframe)
            score_lists[score_col][eval_input_index] = json.dumps(score.to_dict())

    # Add scores to dataframe
    for score_col, score_list in score_lists.items():
        result_df[score_col] = score_list

    return result_df


async def async_evaluate_dataframe(
    dataframe: pd.DataFrame,
    evaluators: List[Evaluator],
    concurrency: Optional[int] = None,
    tqdm_bar_format: Optional[str] = None,
    exit_on_error: Optional[bool] = None,
    max_retries: Optional[int] = None,
) -> pd.DataFrame:
    """Evaluate a dataframe with a list of evaluators and return an augmented dataframe.

    This function uses an asynchronous executor; for sync evaluation, use `evaluate_dataframe`.

    Args:
        dataframe (pd.DataFrame): The input dataframe to evaluate. Each row will be converted to a
            dict and passed to each evaluator.
        evaluators (List[Evaluator]): List of evaluators to run. Input mapping should already be
            bound via `bind_evaluator` or column names should match evaluator input fields.
        concurrency (Optional[int]): Optional number of concurrent consumers. If None, uses
            AsyncExecutor's default (3).
        tqdm_bar_format (Optional[str]): Optional format string for the progress bar. If None,
            the progress bar is disabled.
        exit_on_error (Optional[bool]): Optional flag to control whether execution should stop on
            the first error. If None, uses AsyncExecutor's default (True).
        max_retries (Optional[int]): Optional number of times to retry on exceptions. If None,
            uses AsyncExecutor's default (10).

    Returns:
        pd.DataFrame: A copy of the input dataframe with added columns for scores and exceptions.
        For each evaluator, columns are added for:

            - "{evaluator.name}_execution_details": Details about any exceptions encountered,
              execution time, and status.
            - "{score.name}_score": JSON-serialized Score objects for each score returned

    Notes:
        - Score name collisions: If multiple evaluators return scores with the same name,
          they will write to the same column (e.g., 'same_name_score'). This can lead to
          data loss as later scores overwrite earlier ones.
        - Similarly, evaluator names should be unique to ensure execution_details columns don't
          collide.
        - Failed evaluations: If an evaluation fails, the failure details will be recorded
          in the execution_details column and the score will be None.

    """
    # Create a copy to avoid modifying the original dataframe
    result_df = dataframe.copy()

    # Prepare task inputs
    records = [{str(k): v for k, v in record.items()} for record in result_df.to_dict("records")]
    eval_inputs: Dict[int, Dict[str, Any]] = dict(enumerate(records))
    evaluator_mapping = {i: evaluator for i, evaluator in enumerate(evaluators)}
    task_inputs = list(itertools.product(eval_inputs.keys(), evaluator_mapping.keys()))

    # Pre-allocate columns for efficient assignment
    score_lists: Dict[str, List[Optional[str]]] = {}
    for evaluator in evaluators:
        evaluator_name = evaluator.name
        execution_details_col = f"{evaluator_name}_execution_details"
        result_df[execution_details_col] = [None] * len(dataframe)

    # Execution task: evaluate an eval_input with an evaluator
    async def _task(task_input: Tuple[int, int]) -> List[Score]:
        """Execute a single async evaluation task.

        Args:
            task_input (Tuple[int, int]): A tuple of (eval_input_index, evaluator_index).

        Returns:
            List[Score]: A list of scores from the evaluation.
        """
        eval_input_index, evaluator_index = task_input
        eval_input = eval_inputs[eval_input_index]
        evaluator = evaluators[evaluator_index]
        scores = await evaluator.aevaluate(eval_input)
        return scores

    # Only pass parameters that were explicitly provided, otherwise use Executor defaults
    executor_kwargs: Dict[str, Any] = {"generation_fn": _task, "fallback_return_value": None}
    if tqdm_bar_format is not None:
        executor_kwargs["tqdm_bar_format"] = tqdm_bar_format
    if exit_on_error is not None:
        executor_kwargs["exit_on_error"] = exit_on_error
    if max_retries is not None:
        executor_kwargs["max_retries"] = max_retries
    if concurrency is not None:
        executor_kwargs["concurrency"] = concurrency

    executor = AsyncExecutor(**executor_kwargs)
    results, execution_details = await executor.execute(task_inputs)

    def _process_execution_details(eval_execution_details: ExecutionDetails) -> str:
        """Process execution details into a JSON string.

        Args:
            eval_execution_details (ExecutionDetails): The execution details to process.

        Returns:
            str: A JSON string representation of the execution details.
        """
        result: Dict[str, Any] = {}
        result["status"] = eval_execution_details.status.value
        result["exceptions"] = [repr(exc) for exc in eval_execution_details.exceptions]
        result["execution_seconds"] = eval_execution_details.execution_seconds
        return json.dumps(result)

    for i, (eval_input_index, evaluator_index) in enumerate(task_inputs):
        # Process and add execution details to dataframe
        details = execution_details[i]
        execution_details_col = f"{evaluators[evaluator_index].name}_execution_details"
        result_df.at[eval_input_index, execution_details_col] = _process_execution_details(details)

        # Process scores
        if results is None:
            continue
        scores = results[i]
        if scores is None:
            continue
        for score in scores:
            if not score.name:  # this shouldn't happen
                score_col = f"{evaluators[evaluator_index].name}_{i}"
            else:
                score_col = f"{score.name}_score"
            if score_col not in score_lists:
                score_lists[score_col] = [None] * len(dataframe)
            score_lists[score_col][eval_input_index] = json.dumps(score.to_dict())

    # Add scores to dataframe
    for score_col, score_list in score_lists.items():
        result_df[score_col] = score_list

    return result_df
