import asyncio
import inspect
import json
import warnings
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Literal, Optional, Set, Tuple, Union, cast

from pydantic import BaseModel, ValidationError, create_model
from typing_extensions import Mapping

from .llm import LLM, AsyncLLM
from .llm.types import ObjectGenerationMethod
from .templating import Template

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


def _tokenize_path(path: str) -> List[Union[str, int]]:
    """
    Convert a dotted/bracket path into tokens.
    Supports:
      - dict traversal via dots: input.query
      - list index via brackets: items[0]

    This is intentionally simple; quoted keys and complex expressions are not supported yet.

    Returns:
        A list of tokens.

    Raises:
        ValueError: If the path is invalid.
    """
    tokens: List[Union[str, int]] = []
    # Split on '.' first
    parts = path.split(".") if path else []
    for part in parts:
        # Handle zero or more [index] suffixes
        buf = ""
        i = 0
        # accumulate leading identifier
        while i < len(part) and part[i] != "[":
            buf += part[i]
            i += 1
        if buf:
            tokens.append(buf)
        # parse any bracket segments
        while i < len(part):
            if part[i] != "[":
                break
            j = part.find("]", i + 1)
            if j == -1:
                # malformed; treat the rest literally
                break
            index_str = part[i + 1 : j]
            try:
                idx = int(index_str)
                tokens.append(idx)
            except ValueError:
                # non-integer indexes not supported in this minimal version
                tokens.append(index_str)
            i = j + 1
    return tokens


TransformFunc = Callable[[Any], Any]


def _get_builtin_transform(name: str) -> Optional[TransformFunc]:
    """
    Get a built-in transform function by name.

    Supported transforms for input mapping pipes (used after a path with `|`):

    - first: Return the first element of a list/tuple; None if the sequence is empty or if
      the value is not a sequence.
    - strip: Trim leading and trailing whitespace on strings; pass through non-strings unchanged.
    - lower: Convert strings to lowercase; pass through non-strings unchanged.
    - upper: Convert strings to uppercase; pass through non-strings unchanged.
    - as_str, coerce:str: Convert non-None values to str.
    - coerce:int: Convert non-None values to int.
    - coerce:float: Convert non-None values to float.
    - coerce:bool: Convert non-None values to bool.

    Notes:
    - Unknown transform names are ignored with a warning.
    - Transforms are applied left-to-right.
    - String-specific transforms (strip/lower/upper) pass through non-string values unchanged.

    Examples:
    - "input.docs[0] | strip | lower"
    - "response.score | coerce:float"
    - "metadata.tags | first | as_str"
    """
    simple = name.strip().lower()
    if simple == "first":
        return lambda v: (v[0] if isinstance(v, (list, tuple)) and v else None)
    if simple == "strip":
        return lambda v: (v.strip() if isinstance(v, str) else v)
    if simple == "lower":
        return lambda v: (v.lower() if isinstance(v, str) else v)
    if simple == "upper":
        return lambda v: (v.upper() if isinstance(v, str) else v)
    if simple in {"as_str", "coerce:str"}:
        return lambda v: (str(v) if v is not None else v)
    if simple == "coerce:int":
        return lambda v: (int(v) if v is not None else v)
    if simple == "coerce:float":
        return lambda v: (float(v) if v is not None else v)
    if simple == "coerce:bool":
        return lambda v: (bool(v) if v is not None else v)
    return None


def _apply_transforms(value: Any, transforms: List[TransformFunc]) -> Any:
    """
    Apply a list of transforms to a value.
    """
    result = value
    for transform in transforms:
        result = transform(result)
    return result


def _validate_field_value(value: Any, field_name: str, key: str) -> None:
    """
    Validate that a required field value is present and not empty.

    Raises ValueError if:
      - value is None
      - value is an empty or whitespace-only string
      - value is an empty list/tuple/dict
    """
    if value is None:
        raise ValueError(f"Required field '{field_name}' (from '{key}') cannot be None")
    if isinstance(value, str):
        if value.strip() == "":
            raise ValueError(
                f"Required field '{field_name}' (from '{key}') cannot be empty or whitespace-only"
            )
    elif isinstance(value, (list, tuple)) and len(value) == 0:
        raise ValueError(f"Required field '{field_name}' (from '{key}') cannot be empty")
    elif isinstance(value, dict) and len(value) == 0:
        raise ValueError(f"Required field '{field_name}' (from '{key}') cannot be empty")


def _extract_with_path(payload: Mapping[str, Any], path: str) -> Any:
    """
    Extract a value from a nested JSON structure using a path.

    The path is a string with the following format:
    - dict traversal via dots: input.query
    - list index via brackets: items[0]
    - combination of both: input.docs[0]
    - can be combined with transforms: input.docs[0] | strip | lower

    Returns:
        The extracted value.

    Raises:
        ValueError: If the path is invalid or the value is not found.
    """
    if not path:
        return None
    tokens = _tokenize_path(path)
    current: Any = payload
    for tok in tokens:
        if isinstance(tok, int):
            if not isinstance(current, (list, tuple)) or tok >= len(current):
                msg = f"Index out of range at '{tok}' for path '{path}'"
                raise ValueError(msg)
            current = current[tok]
        else:
            if not isinstance(current, Mapping) or tok not in current:
                msg = f"Missing key '{tok}' while resolving path '{path}'"
                raise ValueError(msg)
            current = current[tok]
    return current


def _parse_mapping_spec(spec: str) -> Tuple[str, List[TransformFunc]]:
    """
    Parse a mapping spec like "input.docs[0] | strip | lower" into (path, transforms).
    Unknown transforms are ignored with a warning.
    """
    parts = [p.strip() for p in spec.split("|")]
    path = parts[0] if parts else ""
    transforms: List[TransformFunc] = []
    for p in parts[1:]:
        tf = _get_builtin_transform(p)
        if tf is not None:
            transforms.append(tf)
        else:
            # warn on unknown transform names to surface typos early
            if p:
                warnings.warn(f"Unknown transform '{p}' in mapping spec: '{spec}'", RuntimeWarning)
    return path, transforms


def _required_fields_from_model(model: Optional[type[BaseModel]]) -> Set[str]:
    if model is None:
        return set()
    return {name for name, field in model.model_fields.items() if field.is_required()}


def remap_eval_input(
    eval_input: Mapping[str, Any],
    required_fields: Set[str],
    input_mapping: Optional[InputMappingType] = None,
) -> Dict[str, Any]:
    """
    Remap eval_input keys based on required_fields and an optional input_mapping.

    Args:
        eval_input: The input dictionary to be remapped.
        required_fields: The required field names as a set of strings.
        input_mapping: Optional mapping from evaluator-required field -> eval_input key.

    Returns:
        A dictionary with keys as required_fields and values from eval_input.

    Raises:
        ValueError: If a required field is missing in eval_input or has a null/empty value.
    """
    mapping = input_mapping or {}
    remapped_eval_input: Dict[str, Any] = {}

    for field_name in required_fields:
        extractor = mapping.get(field_name, field_name)
        # Compute value
        if callable(extractor):
            value = extractor(eval_input)
        elif isinstance(extractor, str):
            path, transforms = _parse_mapping_spec(extractor)
            # If path is empty, try direct key
            if not path:
                key = field_name
                if key not in eval_input:
                    msg = (
                        f"Missing required field: '{field_name}' (no path). "
                        f"eval_input keys={list(eval_input.keys())}"
                    )
                    raise ValueError(msg)
                value = eval_input[key]
            else:
                value = _extract_with_path(eval_input, path)
            value = _apply_transforms(value, transforms)
        else:
            # Unsupported extractor type
            msg = (
                f"Invalid mapping for field '{field_name}': expected str or callable, "
                f"got {type(extractor)}"
            )
            raise TypeError(msg)

        # Minimal presence check; defer strict checks to Pydantic
        key_repr = (
            extractor
            if isinstance(extractor, str)
            else f"callable:{getattr(extractor, '__name__', 'lambda')}"
        )
        _validate_field_value(value, field_name, str(key_repr))

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
        direction: DirectionType = "maximize",
        input_schema: Optional[type[BaseModel]] = None,
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
        self.input_schema: Optional[type[BaseModel]] = input_schema

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
        result = await to_thread(self._evaluate)(eval_input)
        return cast(List[Score], result)

    def evaluate(
        self, eval_input: EvalInput, input_mapping: Optional[InputMappingType] = None
    ) -> List[Score]:
        """
        Validate and remap `eval_input` keys based on `required_fields` and an optional
        per-call `input_mapping` (dict mapping evaluator-required field -> eval_input key).

        Returns:
            A list of Score objects from this evaluator.  If evaluation fails, returns a single
            Score with name "error", score 0.0, explanation set to the exception message,
            and metadata containing exception details and retry count.
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
        Validate and remap `eval_input` keys based on `required_fields` and an optional
        per-call `input_mapping` (dict mapping evaluator-required field -> eval_input key).

        Returns:
            A list of Score objects from this evaluator.  If evaluation fails, returns a
            Score with name "error", score 0.0, explanation set to the exception message,
            and metadata containing exception details.
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
        fields: Dict[str, Any] = {}
        if self.input_schema is not None:
            for field_name, field in self.input_schema.model_fields.items():
                # Best-effort human-readable type
                annotation = getattr(field, "annotation", Any)
                type_repr = getattr(annotation, "__name__", str(annotation))
                fields[field_name] = {
                    "type": type_repr,
                    "required": field.is_required(),
                }
        else:
            # Fallback minimal description when no schema is provided
            fields = {"unspecified": {"type": "any", "required": False}}

        return {
            "name": self.name,
            "source": self.source,
            "direction": self.direction,
            "input_fields": fields,
        }

    def describe_schema(self) -> Dict[str, Any]:
        """
        Return the JSON Schema of the evaluator's input, if available.
        If no schema is available, returns a minimal placeholder.
        """
        if self.input_schema is not None:
            return self.input_schema.model_json_schema()
        return {
            "$schema": "https://json-schema.org/draft/2020-12/schema",
            "title": f"{self.name}Input",
            "type": "object",
            "additionalProperties": True,
        }


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
        schema: Optional[ToolSchema] = None,
        input_schema: Optional[type[BaseModel]] = None,
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
        input_schema: Optional[type[BaseModel]] = None,
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

        class _FunctionEvaluator(Evaluator):
            def __init__(self) -> None:
                super().__init__(
                    name=name,
                    source=source,
                    direction=direction,
                    # infer input schema from function signature
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
        return {"evaluator": self._evaluator.name, "mapping_keys": list(self._mapping.keys())}

    # Introspection passthroughs
    def describe(self) -> Dict[str, Any]:
        return self._evaluator.describe()

    def describe_schema(self) -> Dict[str, Any]:
        return self._evaluator.describe_schema()


def bind_evaluator(
    evaluator: Evaluator,
    mapping: InputMappingType,
) -> BoundEvaluator:
    """Helper to create a BoundEvaluator."""
    return BoundEvaluator(evaluator, mapping)
