import asyncio
import inspect
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Iterable, List, Literal, Optional, Set, Tuple, Union

from typing_extensions import Mapping

from .llm import LLM, AsyncLLM
from .llm.types import ObjectGenerationMethod
from .templating import Template

# --- Type Aliases ---
EvalInput = Dict[str, Any]
Schema = Optional[Dict[str, Any]]
SourceType = Literal["human", "llm", "heuristic"]
DirectionType = Literal["maximize", "minimize"]
RequiredFieldsType = Optional[Union[Set[str], List[str], Iterable[str]]]


# --- Score model ---
@dataclass(frozen=True)
class Score:
    name: Optional[str] = None
    score: Optional[Union[float, int]] = None
    label: Optional[str] = None
    explanation: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    source: Optional[SourceType] = None
    direction: Optional[DirectionType] = "maximize"

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


# --- Async helper ---
def to_thread(fn: Callable[..., Any]) -> Callable[..., Any]:
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, lambda: fn(*args, **kwargs))

    return wrapper


def _validate_field_value(value: Any, field_name: str, key: str) -> None:
    """
    Validate that a field value is not null or empty.

    Args:
        value: The value to validate
        field_name: The evaluator's expected field name
        key: The actual key in the input dictionary

    Raises:
        ValueError: If the value is null or empty
    """
    if value is None:
        raise ValueError(
            f"Required field '{field_name}' (from '{key}') cannot be None. "
            f"eval_input[{key}] = {value}"
        )

    # Check for empty strings (including whitespace-only)
    if isinstance(value, str) and not value.strip():
        raise ValueError(
            f"Required field '{field_name}' (from '{key}') cannot be empty or whitespace-only. "
            f"eval_input[{key}] = {repr(value)}"
        )

    # Check for empty collections
    if isinstance(value, (list, tuple, dict)) and len(value) == 0:
        raise ValueError(
            f"Required field '{field_name}' (from '{key}') cannot be empty. "
            f"eval_input[{key}] = {value}"
        )


def remap_eval_input(
    eval_input: Mapping[str, Any],
    required_fields: RequiredFieldsType,
    input_mapping: Optional[Mapping[str, str]] = None,
) -> Dict[str, Any]:
    """
    Remap eval_input keys based on required_fields and an optional input_mapping.

    Args:
        eval_input: The input dictionary to be remapped.
        required_fields: The required field names. Can be a set, list, or any iterable of strings.
        input_mapping: Optional mapping from evaluator-required field -> eval_input key.

    Returns:
        A dictionary with keys as required_fields and values from eval_input.

    Raises:
        ValueError: If a required field is missing in eval_input or has a null/empty value.
    """
    # TODO add nested remapping
    mapping = input_mapping or {}
    remapped_eval_input: Dict[str, Any] = {}

    # Convert required_fields to a set if it's not already
    if required_fields is None:
        required_fields_set: Set[str] = set()
    else:
        required_fields_set = set(required_fields)

    for field_name in required_fields_set:
        key = mapping.get(field_name, field_name)
        if key not in eval_input:
            raise ValueError(
                f"Missing required field: '{field_name}' (from '{key}'). "
                f"eval_input keys={list(eval_input)}"
            )

        value = eval_input[key]
        _validate_field_value(value, field_name, key)
        remapped_eval_input[field_name] = value

    return remapped_eval_input


# --- Base Evaluator ---
class Evaluator(ABC):
    """
    Core abstraction for evaluators.
    Instances are callable: `scores = evaluator(eval_input)` (sync or async via `aevaluate`).
    Supports single-record (`evaluate`) mode with optional per-call field_mapping.
    """

    def __init__(
        self,
        name: str,
        source: SourceType,
        required_fields: RequiredFieldsType = None,
        direction: DirectionType = "maximize",
    ):
        """
        Initialize the evaluator with a required name, source, and optional required fields.

        Args:
            name: The name of this evaluator, used for identification and Score naming.
            source: The source of this evaluator (human, llm, or heuristic).
            required_fields: Optional field names this evaluator requires. Can be a set, list,
                or any iterable of strings. If None, subclasses should infer fields from prompts or
                function signatures.
            direction: The direction for score optimization ("maximize" or "minimize"). Defaults to
                "maximize".
        """
        self._name = name
        self._source = source
        self._direction = direction
        self.required_fields = set(required_fields) if required_fields is not None else set()

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

    @abstractmethod
    def _evaluate(self, eval_input: EvalInput) -> List[Score]:
        """Implement core logic assuming eval_input has required fields."""
        raise NotImplementedError("Subclasses must implement _evaluate")

    async def _aevaluate(self, eval_input: EvalInput) -> List[Score]:
        """Implement async core logic assuming eval_input has required fields.

        By default, this runs the synchronous _evaluate method in a thread pool.
        Subclasses can override this for more efficient async implementations.
        """
        from typing import cast

        result = await to_thread(self._evaluate)(eval_input)
        return cast(List[Score], result)

    def evaluate(
        self, eval_input: EvalInput, input_mapping: Optional[Mapping[str, str]] = None
    ) -> List[Score]:
        """
        Validate and remap `eval_input` keys based on `required_fields` and an optional
        per-call `input_mapping` (dict mapping evaluator-required field -> eval_input key).

        Returns:
            A list of Score objects from this evaluator.

        Raises:
            Exceptions raised by the underlying evaluator implementation are propagated as-is.
        """
        remapped_eval_input = remap_eval_input(eval_input, self.required_fields, input_mapping)
        return self._evaluate(remapped_eval_input)

    async def aevaluate(
        self, eval_input: EvalInput, input_mapping: Optional[Mapping[str, str]] = None
    ) -> List[Score]:
        """
        Validate and remap `eval_input` keys based on `required_fields` and an optional
        per-call `input_mapping` (dict mapping evaluator-required field -> eval_input key).

        Returns:
            A list of Score objects from this evaluator.

        Raises:
            Exceptions raised by the underlying evaluator implementation are propagated as-is.
        """
        remapped_eval_input = remap_eval_input(eval_input, self.required_fields, input_mapping)
        return await self._aevaluate(remapped_eval_input)

    # allow instances to be called directly: `evaluator(eval_input)`
    __call__ = evaluate
    # ensure the callable inherits evaluate's docs for IDE support
    __call__.__doc__ = evaluate.__doc__


# --- LLM Evaluator base ---
class LLMEvaluator(Evaluator):
    """
    Base LLM evaluator that:
      - Infers `required_fields` automatically from its prompt template.
    """

    def __init__(
        self,
        name: str,
        llm: Union[LLM, AsyncLLM],
        prompt_template: Union[str, Template],
        schema: Optional[Schema] = None,
        required_fields: RequiredFieldsType = None,
        direction: DirectionType = "maximize",
    ):
        """
        Initialize the LLM evaluator.

        Args:
            name: The name of this evaluator, used for identification and Score naming.
            llm: The LLM instance to use for evaluation.
            prompt_template: The prompt template string with placeholders for required fields.
            schema: Optional schema for structured output / tool calls.
            required_fields: Optional field names this evaluator requires. Can be a set, list,
                or any iterable of strings. If None, fields will be inferred from the prompt
                template.
            direction: The direction for score optimization ("maximize" or "minimize"). Defaults to
                "maximize".
        """
        # Infer required fields from prompt_template if not provided
        if isinstance(prompt_template, str):
            prompt_template = Template(template=prompt_template)
        if required_fields is None:
            required_fields = prompt_template.variables

        super().__init__(
            name=name, source="llm", required_fields=required_fields, direction=direction
        )
        self.llm = llm
        self.prompt_template = prompt_template
        self.schema = schema

    def _evaluate(self, eval_input: EvalInput) -> List[Score]:
        raise NotImplementedError("Subclasses must implement _evaluate")

    async def _aevaluate(self, eval_input: EvalInput) -> List[Score]:
        raise NotImplementedError("Subclasses must implement _aevaluate")

    def evaluate(
        self, eval_input: EvalInput, input_mapping: Optional[Mapping[str, str]] = None
    ) -> List[Score]:
        if isinstance(self.llm, AsyncLLM):
            raise ValueError(
                "AsyncLLM is not supported for synchronous evaluation. Use aevaluate instead."
            )
        return super().evaluate(eval_input, input_mapping)

    async def aevaluate(
        self, eval_input: EvalInput, input_mapping: Optional[Mapping[str, str]] = None
    ) -> List[Score]:
        if isinstance(self.llm, LLM):
            raise ValueError(
                "LLM is not supported for asynchronous evaluation. Use evaluate instead."
            )
        return await super().aevaluate(eval_input, input_mapping)


# --- LLM ClassificationEvaluator ---
class ClassificationEvaluator(LLMEvaluator):
    """
    A specialized LLM evaluator for classification tasks.
    """

    def __init__(
        self,
        name: str,
        llm: Union[LLM, AsyncLLM],
        prompt_template: Union[str, Template],
        choices: Union[
            List[str], Dict[str, Union[float, int]], Dict[str, Tuple[Union[float, int], str]]
        ],
        include_explanation: bool = True,
        required_fields: RequiredFieldsType = None,
        direction: DirectionType = "maximize",
    ):
        """
        Initialize the LLM evaluator.

        Args:
            name: The name of this evaluator, used for identification and Score naming.
            llm: The LLM instance to use for evaluation.
            prompt_template: The prompt template string with placeholders for required fields.
            choices: The labels to use for the classification. Can be a list of string labels,
                a dictionary mapping labels to scores, or a dictionary mapping labels to
                a tuple of (score, description).
            include_explanation: Whether to ask the LLM to provide an explanation for its
                classification.
            required_fields: Optional field names this evaluator requires. Can be a set, list,
                or any iterable of strings. If None, fields will be inferred from the prompt
                template.
            direction: The direction for score optimization ("maximize" or "minimize"). Defaults to
                "maximize".
        """
        super().__init__(
            name=name,
            llm=llm,
            prompt_template=prompt_template,
            required_fields=required_fields,
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
        label = response["label"]  # type: ignore
        explanation = response.get("explanation", None)  # type: ignore

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
        response = await self.llm.generate_classification(
            prompt=prompt_filled,
            labels=self.labels,
            include_explanation=self.include_explanation,
            method=method,
        )  # type: ignore
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
    """
    Return a list of names of all registered evaluators.
    """
    return list(_registry.keys())


def create_evaluator(
    name: str, source: SourceType = "heuristic", direction: DirectionType = "maximize"
) -> Callable[[Callable[..., Score]], Evaluator]:
    """
    Decorator that turns a simple function into an Evaluator instance.

    The decorated function should accept keyword args matching its required fields and return a
    single Score. The returned object is an Evaluator with full support for evaluate/aevaluate
    and direct callability.

    Args:
        name: The name of this evaluator, used for identification and Score naming.
        source: The source of this evaluator (human, llm, or heuristic). Defaults to "heuristic".
        direction: The direction for score optimization ("maximize" or "minimize"). Defaults to
        "maximize".

    Returns:
        An Evaluator instance.

    Notes:
    The decorated function should return Score objects. The name parameter is optional
        since the decorator will set it automatically.
    Also registers the evaluator's evaluate callable in the registry so list_evaluators works.
    """

    def deco(fn: Callable[..., Score]) -> Evaluator:
        sig = inspect.signature(fn)
        required: Set[str] = set(sig.parameters.keys())

        class _FunctionEvaluator(Evaluator):
            def __init__(self) -> None:
                super().__init__(
                    name=name,
                    source=source,
                    required_fields=required,
                    direction=direction,
                )
                self._fn = fn

            def _evaluate(self, eval_input: EvalInput) -> List[Score]:
                # eval_input is already remapped by Evaluator.evaluate(...)
                score = self._fn(**eval_input)
                if score.name != name or score.source != source or score.direction != direction:
                    score = Score(
                        score=score.score,
                        name=name,
                        label=score.label,
                        explanation=score.explanation,
                        metadata=score.metadata,
                        source=source,
                        direction=direction,
                    )
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
    llm: Union[LLM, AsyncLLM],
    choices: Union[
        List[str], Dict[str, Union[float, int]], Dict[str, Tuple[Union[float, int], str]]
    ],
    required_fields: RequiredFieldsType = None,
    direction: DirectionType = "maximize",
) -> ClassificationEvaluator:
    """
    Factory to create a ClassificationEvaluator.

    Args:
        name: The name of this evaluator, used for identification and Score naming.
        llm: The LLM instance to use for evaluation.
        prompt_template: The prompt template string with placeholders for required fields.
        choices: The labels to use for the classification. Can be a list of string labels,
            a dictionary mapping labels to scores, or a dictionary mapping labels to
            a tuple of (score, description).
        required_fields: Optional field names this evaluator requires. Can be a set, list, or any
            iterable of strings. If None, fields will be inferred from the prompt template.
        direction: The direction for score optimization ("maximize" or "minimize"). Defaults to
            "maximize".

    Returns:
        A ClassificationEvaluator instance.
    """
    return ClassificationEvaluator(
        name=name,
        llm=llm,
        prompt_template=prompt_template,
        choices=choices,
        required_fields=required_fields,
        direction=direction,
    )
