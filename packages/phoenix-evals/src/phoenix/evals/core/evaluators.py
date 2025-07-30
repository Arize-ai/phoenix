import asyncio
import inspect
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from functools import wraps
from string import Formatter
from textwrap import dedent
from typing import Any, Callable, Dict, List, Literal, Optional, Set, Tuple, Union

from typing_extensions import Mapping

from phoenix.evals.llm import LLM, AsyncLLM

# --- Type Aliases ---
EvalInput = Mapping[str, Any]
Schema = Optional[Dict[str, Any]]
SourceType = Literal["human", "llm", "heuristic"]


ERROR_SCORE = "ERROR"


# --- Score model ---
@dataclass(frozen=True)
class Score:
    name: Optional[str] = None
    score: Optional[Union[float, int]] = None
    label: Optional[str] = None
    explanation: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    source: Optional[SourceType] = None


# --- Async helper ---
def to_thread(fn: Callable[..., Any]) -> Callable[..., Any]:
    async def wrapper(*args: Any, **kwargs: Any) -> Any:
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, fn, *args, **kwargs)

    return wrapper


class AsyncifyMixin:
    """
    Mixin to provide async versions for evaluate and batch_evaluate methods if not implemented.
    """

    def __getattribute__(self, name: str) -> Any:
        # First try to get the attribute normally
        try:
            return object.__getattribute__(self, name)
        except AttributeError:
            # Only provide async versions if they don't exist and sync versions do
            if name == "_aevaluate" and hasattr(self, "_evaluate"):
                return to_thread(object.__getattribute__(self, "_evaluate"))
            if name == "abatch_evaluate" and hasattr(self, "batch_evaluate"):
                return to_thread(object.__getattribute__(self, "batch_evaluate"))
            raise


# --- Utilities ---
def extract_fields_from_template(tmpl: str) -> Set[str]:
    return {name for _, name, _, _ in Formatter().parse(tmpl) if name}


def remap_eval_input(
    eval_input: Mapping[str, Any],
    required_fields: Set[str],
    template_mapping: Optional[Mapping[str, str]] = None,
) -> Dict[str, Any]:
    """
    Remap eval_input keys based on required_fields and an optional template_mapping.

    Args:
        eval_input: The input dictionary to be remapped.
        required_fields: The set of required field names.
        template_mapping: Optional mapping from evaluator-required field -> eval_input key.

    Returns:
        A dictionary with keys as required_fields and values from eval_input.

    Raises:
        ValueError: If a required field is missing in eval_input.
    """
    # TODO add nested remapping
    mapping = template_mapping or {}
    remapped_eval_input: Dict[str, Any] = {}
    for field_name in required_fields:
        key = mapping.get(field_name, field_name)
        if key not in eval_input:
            raise ValueError(
                f"Missing required field: '{field_name}' (from '{key}'). "
                f"eval_input keys={list(eval_input)}"
            )
        remapped_eval_input[field_name] = eval_input[key]
    return remapped_eval_input


# --- Base Evaluator ---
class Evaluator(ABC, AsyncifyMixin):
    """
    Core abstraction for evaluators.
    Instances are callable: `scores = evaluator(eval_input)` (sync or async via `aevaluate`).
    Supports single-record (`evaluate`) and batch (`batch_evaluate`) modes,
    with optional per-call field_mapping.
    """

    def __init__(
        self,
        name: str,
        source: SourceType,
        required_fields: Optional[Set[str]] = None,
    ):
        """
        Initialize the evaluator with a required name, source, and optional required fields.

        Args:
            name: The name of this evaluator, used for identification and Score naming.
            source: The source of this evaluator (human, llm, or heuristic).
            required_fields: Optional set of field names this evaluator requires. If None,
                           subclasses should infer fields from prompts or function signatures.
        """
        self._name = name
        self._source = source
        self.required_fields = required_fields or set()

    @property
    def name(self) -> str:
        """The name of this evaluator."""
        return self._name

    @property
    def source(self) -> SourceType:
        """The source of this evaluator."""
        return self._source

    @abstractmethod
    def _evaluate(self, eval_input: EvalInput) -> List[Score]:
        """Implement core logic assuming eval_input has required fields."""
        raise NotImplementedError("Subclasses must implement _evaluate")

    @abstractmethod
    async def _aevaluate(self, eval_input: EvalInput) -> List[Score]:
        """Implement async core logic assuming eval_input has required fields."""
        raise NotImplementedError("Subclasses must implement _aevaluate")

    def evaluate(
        self, eval_input: EvalInput, template_mapping: Optional[Mapping[str, str]] = None
    ) -> List[Score]:
        """
        Validate and remap `eval_input` keys based on `required_fields` and an optional
        per-call `template_mapping` (dict mapping evaluator-required field -> eval_input key).

        Returns:
            A list of Score objects from this evaluator.  If evaluation fails, returns a single
            Score with name "error", score 0.0, explanation set to the exception message,
            and metadata containing exception details and retry count.
        """
        remapped_eval_input = remap_eval_input(eval_input, self.required_fields, template_mapping)
        try:
            return self._evaluate(remapped_eval_input)
        except Exception as e:
            err_score = Score(
                score=0.0,
                name=ERROR_SCORE,
                explanation=str(e),
                metadata={
                    "exception_type": type(e).__name__,
                },
                source=self.source,
            )
            return [err_score]

    async def aevaluate(
        self, eval_input: EvalInput, template_mapping: Optional[Mapping[str, str]] = None
    ) -> List[Score]:
        """
        Validate and remap `eval_input` keys based on `required_fields` and an optional
        per-call `template_mapping` (dict mapping evaluator-required field -> eval_input key).

        Returns:
            A list of Score objects from this evaluator.  If evaluation fails, returns a
            Score with name "error", score 0.0, explanation set to the exception message,
            and metadata containing exception details.
        """
        remapped_eval_input = remap_eval_input(eval_input, self.required_fields, template_mapping)
        try:
            return await self._aevaluate(remapped_eval_input)
        except Exception as e:
            err_score = Score(
                score=0.0,
                name=ERROR_SCORE,
                explanation=str(e),
                metadata={
                    "exception_type": type(e).__name__,
                },
                source=self.source,
            )
            return [err_score]

    # allow instances to be called directly: `evaluator(eval_input)`
    __call__ = evaluate
    # ensure the callable inherits evaluate's docs for IDE support
    __call__.__doc__ = evaluate.__doc__

    def batch_evaluate(
        self, eval_inputs: List[EvalInput], template_mapping: Optional[Mapping[str, str]] = None
    ) -> List[List[Score]]:
        """
        Apply `evaluate` to a list of `eval_input` mappings, reusing the same `template_mapping`.
        """
        return [self.evaluate(inp, template_mapping=template_mapping) for inp in eval_inputs]


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
        prompt: str,
        schema: Optional[Schema] = None,
        required_fields: Optional[Set[str]] = None,
    ):
        """
        Initialize the LLM evaluator.

        Args:
            name: The name of this evaluator, used for identification and Score naming.
            llm: The LLM instance to use for evaluation.
            prompt: The prompt template string with placeholders for required fields.
            schema: Optional schema for structured output / tool calls.
            required_fields: Optional set of field names this evaluator requires. If None,fields
                will be inferred from the prompt template.
        """
        # Infer required fields from prompt if not provided
        if required_fields is None:
            required_fields = extract_fields_from_template(prompt)

        super().__init__(name=name, source="llm", required_fields=required_fields)
        self.llm = llm
        self.prompt = dedent(prompt)
        self.schema = schema

    def _evaluate(self, eval_input: EvalInput) -> List[Score]:
        raise NotImplementedError("Subclasses must implement _evaluate")

    async def _aevaluate(self, eval_input: EvalInput) -> List[Score]:
        raise NotImplementedError("Subclasses must implement _aevaluate")


# --- LLM ClassificationEvaluator ---
class ClassificationEvaluator(LLMEvaluator):
    """
    A specialized LLM evaluator for classification tasks.
    """

    def __init__(
        self,
        name: str,
        llm: Union[LLM, AsyncLLM],
        prompt: str,
        choices: Union[
            List[str], Dict[str, Union[float, int]], Dict[str, Tuple[Union[float, int], str]]
        ],
        include_explanation: bool = True,
        required_fields: Optional[Set[str]] = None,
    ):
        """
        Initialize the LLM evaluator.

        Args:
            name: The name of this evaluator, used for identification and Score naming.
            llm: The LLM instance to use for evaluation.
            prompt: The prompt template string with placeholders for required fields.
            choices: The labels to use for the classification. Can be a list of string labels,
                a dictionary mapping labels to scores, or a dictionary mapping labels to
                a tuple of (score, description).
            include_explanation: Whether to ask the LLM to provide an explanation for its
                classification.
            required_fields: Optional set of field names this evaluator requires for the prompt.
                If None,fields will be inferred from the prompt template.
        """
        super().__init__(name=name, llm=llm, prompt=prompt, required_fields=required_fields)

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
        if isinstance(self.llm, AsyncLLM):
            raise ValueError(
                "AsyncLLM is not supported for synchronous evaluation. Use aevaluate instead."
            )

        prompt_filled = self.prompt.format(**eval_input)
        response = self.llm.generate_classification(
            prompt=prompt_filled,
            labels=self.labels,
            include_explanation=self.include_explanation,
        )
        label = response["label"]
        explanation = response.get("explanation", None)
        score = self.label_score_map.get(label) if self.label_score_map else None
        return [
            Score(
                score=score,
                name=self.name,
                label=label,
                explanation=explanation,
                metadata={"model": self.llm.model},  # could add more metadata here
                source=self.source,
            )
        ]

    async def _aevaluate(self, eval_input: EvalInput) -> List[Score]:
        if isinstance(self.llm, LLM):
            raise ValueError(
                "LLM is not supported for asynchronous evaluation. Use evaluate instead."
            )

        prompt_filled = self.prompt.format(**eval_input)
        response = await self.llm.generate_classification(
            prompt=prompt_filled,
            labels=self.labels,
            include_explanation=self.include_explanation,
        )
        label = response["label"]
        explanation = response.get("explanation", None)
        score = self.label_score_map.get(label) if self.label_score_map else None
        return [
            Score(
                score=score,
                name=self.name,
                label=label,
                explanation=explanation,
                metadata={"model": self.llm.model},  # could add more metadata here
                source=self.source,
            )
        ]


# --- Registry & simple evaluator decorator ---
_registry: Dict[str, Callable[..., List[Score]]] = {}


def list_evaluators() -> List[str]:
    """
    Return a list of names of all registered evaluators.
    """
    return list(_registry.keys())


def simple_evaluator(
    name: str, source: SourceType
) -> Callable[
    [Callable[..., Score]], Callable[[EvalInput, Optional[Mapping[str, str]]], List[Score]]
]:
    """
    Decorator to register a simple heuristic evaluator function.
    The decorated function should accept keyword args matching its required fields and return a
    single Score.
    The wrapper provides:
      - automatic required_fields inference from function signature
      - per-call template_mapping support
      - registration under the given name (queryable via list_evaluators)

    Note:
        The decorated function should create Score objects. The name parameter is optional
        since the decorator will set it automatically. The wrapper will also set the source.
    """

    def deco(
        fn: Callable[..., Score],
    ) -> Callable[[EvalInput, Optional[Mapping[str, str]]], List[Score]]:
        sig = inspect.signature(fn)
        required: Set[str] = set(sig.parameters.keys())

        @wraps(fn)
        def wrapper(
            eval_input: EvalInput, template_mapping: Optional[Mapping[str, str]] = None
        ) -> List[Score]:
            """
            Evaluate by extracting required fields from eval_input and calling the original
            function.
            """
            mapping = template_mapping or {}
            args = {}
            for param in required:
                key = mapping.get(param, param)
                if key not in eval_input:
                    raise ValueError(
                        f"{name} evaluator needs '{param}' (from '{key}') "
                        f"but eval_input keys={list(eval_input)}"
                    )
                args[param] = eval_input[key]
            score = fn(**args)
            # Create a new Score with the correct name and source if needed
            if score.name != name or score.source != source:
                score = Score(
                    score=score.score,
                    name=name,
                    label=score.label,
                    explanation=score.explanation,
                    metadata=score.metadata,
                    source=source,
                )
            return [score]

        # Add attributes to the wrapper function
        wrapper.required_fields = required  # type: ignore
        wrapper.name = name  # type: ignore
        wrapper.source = source  # type: ignore
        _registry[name] = wrapper
        return wrapper

    return deco


# --- Factory functions ---
def create_classifier(
    name: str,
    prompt: str,
    llm: Union[LLM, AsyncLLM],
    choices: Union[
        List[str], Dict[str, Union[float, int]], Dict[str, Tuple[Union[float, int], str]]
    ],
    required_fields: Optional[Set[str]] = None,
) -> ClassificationEvaluator:
    """
    Factory to create a ClassificationEvaluator.

    Args:
        name: The name of this evaluator, used for identification and Score naming.
        llm: The LLM instance to use for evaluation.
        prompt: The prompt template string with placeholders for required fields.
        choices: The labels to use for the classification. Can be a list of string labels,
            a dictionary mapping labels to scores, or a dictionary mapping labels to
            a tuple of (score, description).
        required_fields: Optional set of field names this evaluator requires. If None,
            fields will be inferred from the prompt template.

    """
    return ClassificationEvaluator(
        name=name,
        llm=llm,
        prompt=prompt,
        choices=choices,
        required_fields=required_fields,
    )
