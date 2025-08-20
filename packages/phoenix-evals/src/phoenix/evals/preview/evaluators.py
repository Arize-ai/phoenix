import asyncio
import inspect
import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Literal, Optional, Set, Tuple, Union, cast

from pydantic import BaseModel, ValidationError, create_model
from typing_extensions import Mapping

from .llm import LLM, AsyncLLM
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
    name: Optional[str] = None
    score: Optional[Union[float, int]] = None
    label: Optional[str] = None
    explanation: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    source: Optional[SourceType] = None
    direction: DirectionType = "maximize"

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
        direction: DirectionType = "maximize",
        input_schema: Optional[type[BaseModel]] = None,
    ):
        """
        Initialize the evaluator with a required name, source, and optional input schema.

        Args:
            name: The name of this evaluator, used for identification and Score naming.
            source: The source of this evaluator (human, llm, or heuristic).
            input_schema: Optional Pydantic BaseModel for input typing and validation. If None,
                subclasses infer fields from prompts or function signatures and may construct a
                model dynamically.
            direction: The direction for score optimization ("maximize" or "minimize"). Defaults
                to "maximize".
        """
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
        """
        Validate and remap `eval_input` using the evaluator's input fields (from
        `input_schema` when available, otherwise from the provided `input_mapping`). An optional
        per-call `input_mapping` maps evaluator-required field names to keys/paths in `eval_input`.

        Returns:
            A list of Score objects.
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
        """
        Async variant of `evaluate`. Validates and remaps input as described in `evaluate`.

        Returns:
            A list of Score objects.
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
        its name, source, direction, and input fields derived from the
        Pydantic input schema when available.
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
    """

    def __init__(
        self,
        name: str,
        llm: Union[LLM, AsyncLLM],
        prompt_template: Union[str, Template],
        schema: Optional[ToolSchema] = None,
        input_schema: Optional[type[BaseModel]] = None,
        direction: DirectionType = "maximize",
    ):
        """
        Initialize the LLM evaluator.

        Args:
            name: Identifier for this evaluator and the name used in produced Scores.
            llm: The LLM or AsyncLLM instance to use for evaluation.
            prompt_template: The prompt template (string or Template) with placeholders for
                required fields; used to infer required variables.
            schema: Optional tool/JSON schema for structured output when supported by the LLM.
            input_schema: Optional Pydantic model describing/validating inputs. If not provided,
                a model is dynamically created from the prompt variables (all str, required).
            direction: The score optimization direction ("maximize" or "minimize"). Defaults to
                "maximize".
        """
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
        if isinstance(self.llm, AsyncLLM):
            raise ValueError(
                "AsyncLLM is not supported for synchronous evaluation. Use aevaluate instead."
            )
        return super().evaluate(eval_input, input_mapping)

    async def aevaluate(
        self, eval_input: EvalInput, input_mapping: Optional[InputMappingType] = None
    ) -> List[Score]:
        if isinstance(self.llm, LLM):
            raise ValueError(
                "LLM is not supported for asynchronous evaluation. Use evaluate instead."
            )
        return await super().aevaluate(eval_input, input_mapping)


# --- LLM ClassificationEvaluator ---
class ClassificationEvaluator(LLMEvaluator):
    """
    LLM-based evaluator for classification tasks. Supports label-only or label+score mappings,
    and returns explanations by default.
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
        input_schema: Optional[type[BaseModel]] = None,
        direction: DirectionType = "maximize",
    ):
        """
        Initialize the LLM evaluator.

        Args:
            name: Identifier for this evaluator and the name used in produced Scores.
            llm: The LLM or AsyncLLM instance to use for evaluation.
            prompt_template: The prompt template (string or Template) with placeholders for inputs.
            choices: One of:
                - List[str]: set of label names; scores will be None.
                - Dict[str, Union[float, int]]: map label -> score.
                - Dict[str, Tuple[Union[float, int], str]]: map label -> (score, description).
            include_explanation: If True, request an explanation in addition to the label.
            input_schema: Optional Pydantic model describing/validating inputs. If not provided,
                a model is derived from prompt variables.
            direction: The score optimization direction ("maximize" or "minimize"). Defaults to
                "maximize".
        """
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
) -> Callable[[Callable[..., Any]], Evaluator]:
    """
    Decorator that turns a simple function into an Evaluator instance.

    The decorated function should accept keyword args matching its required fields and return a
    value that can be converted to a Score. The returned object is an Evaluator with full support
    for evaluate/aevaluate and direct callability.

    Args:
        name: Identifier for the evaluator and the name used in produced Scores.
        source: The source of this evaluator ("human", "llm", or "heuristic"). Defaults to
            "heuristic".
        direction: The score optimization direction ("maximize" or "minimize"). Defaults to
            "maximize".

    Returns:
        An `Evaluator` instance.

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
    Also registers the evaluator's evaluate callable in the registry so list_evaluators works.
    """

    def _convert_to_score(
        result: Any, name: str, source: SourceType, direction: DirectionType
    ) -> Score:
        """Convert various return types to a Score object."""
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
        sig = inspect.signature(fn)

        class _FunctionEvaluator(Evaluator):
            def __init__(self) -> None:
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
    llm: Union[LLM, AsyncLLM],
    choices: Union[
        List[str], Dict[str, Union[float, int]], Dict[str, Tuple[Union[float, int], str]]
    ],
    direction: DirectionType = "maximize",
) -> ClassificationEvaluator:
    """
    Factory to create a `ClassificationEvaluator`.

    Args:
        name: Identifier for this evaluator and the name used in produced Scores.
        llm: The LLM or AsyncLLM instance to use for evaluation.
        prompt_template: Prompt template string with placeholders for inputs.
        choices: One of List[str], Dict[str, number], or Dict[str, Tuple[number, str]] describing
            classification labels (and optional scores/descriptions).
        direction: The score optimization direction ("maximize" or "minimize"). Defaults to
            "maximize".

    Returns:
        A `ClassificationEvaluator` instance.
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
    """
    A prepared evaluator with a fixed mapping specification. Evaluates payloads without
    requiring per-call mapping arguments.
    """

    def __init__(
        self,
        evaluator: Evaluator,
        mapping: InputMappingType,
    ) -> None:
        # Mapping is optional per-field; unspecified fields will be read directly
        # from eval_input using their field name. Static syntax checks happen later.
        self._evaluator = evaluator
        self._mapping = mapping

    @property
    def input_schema(self) -> Optional[type[BaseModel]]:
        return self._evaluator.input_schema

    @property
    def name(self) -> str:
        return self._evaluator.name

    def evaluate(self, payload: EvalInput) -> List[Score]:
        return self._evaluator.evaluate(payload, input_mapping=self._mapping)

    async def aevaluate(self, payload: EvalInput) -> List[Score]:
        return await self._evaluator.aevaluate(payload, input_mapping=self._mapping)

    def mapping_description(self) -> Dict[str, Any]:
        keys = list(self._mapping.keys()) if self._mapping is not None else []
        return {"evaluator": self._evaluator.name, "mapping_keys": keys}

    # Introspection passthroughs
    def describe(self) -> Dict[str, Any]:
        return self._evaluator.describe()


def bind_evaluator(
    evaluator: Evaluator,
    mapping: InputMappingType,
) -> BoundEvaluator:
    """Helper to create a `BoundEvaluator` with a fixed input mapping."""
    return BoundEvaluator(evaluator, mapping)
