import copy
import functools
import inspect
from collections.abc import Callable
from typing import Any, Optional, Union, cast

from phoenix.client.resources.experiments.types import (
    AnnotatorKind,
    BaseEvaluator,
    EvalsEvaluator,
    EvaluationResult,
    EvaluationScore,
    Evaluator,
    ExampleProxy,
    ExperimentEvaluation,
    ExperimentEvaluator,
    ScoreResult,
    is_evaluation_result,
    is_score_result,
)


def _score_to_experiment_evaluation(score: EvaluationScore) -> ExperimentEvaluation:
    result: ExperimentEvaluation = {}
    s = getattr(score, "score", None)
    if s is not None:
        result["score"] = float(s)
    if label := getattr(score, "label", None):
        result["label"] = label
    if explanation := getattr(score, "explanation", None):
        result["explanation"] = explanation
    if name := getattr(score, "name", None):
        result["name"] = name
    if metadata := getattr(score, "metadata", None):
        result["metadata"] = metadata
    return result


def _score_result_to_evaluation_result(score: ScoreResult) -> EvaluationResult:
    if isinstance(score, EvaluationScore):
        return _score_to_experiment_evaluation(score)
    else:
        return [_score_to_experiment_evaluation(s) for s in score]


def get_func_name(fn: Callable[..., Any]) -> str:
    """
    Makes a best-effort attempt to get the name of the function.
    """
    if isinstance(fn, functools.partial):
        return fn.func.__qualname__
    if hasattr(fn, "__qualname__") and not fn.__qualname__.endswith("<lambda>"):
        return fn.__qualname__.split(".<locals>.")[-1]
    return str(fn)


def validate_evaluator_signature(sig: inspect.Signature) -> None:
    """Check that the wrapped function has a valid signature for use as an evaluator."""
    params = sig.parameters
    valid_named_params = {"input", "output", "expected", "reference", "metadata", "example"}
    if len(params) == 0:
        raise ValueError("Evaluation function must have at least one parameter.")
    if len(params) > 1:
        for not_found in set(params) - valid_named_params:
            param = params[not_found]
            if (
                param.kind is inspect.Parameter.VAR_KEYWORD
                or param.default is not inspect.Parameter.empty
            ):
                continue
            raise ValueError(
                f"Invalid parameter names in evaluation function: {not_found}. "
                "Parameter names for multi-argument functions must be "
                f"any of: {', '.join(valid_named_params)}."
            )


def _bind_evaluator_signature(sig: inspect.Signature, **kwargs: Any) -> inspect.BoundArguments:
    """Bind evaluator function parameters with provided arguments."""
    if (example := kwargs.get("example")) is not None:
        example_proxy: Union[ExampleProxy, None] = ExampleProxy(example)
    else:
        example_proxy = None

    parameter_mapping = {
        "input": copy.deepcopy(kwargs.get("input")),
        "output": copy.deepcopy(kwargs.get("output")),
        "expected": copy.deepcopy(kwargs.get("expected")),
        # `reference` is an alias for `expected`
        "reference": copy.deepcopy(kwargs.get("reference")),
        "metadata": copy.deepcopy(kwargs.get("metadata")),
        "example": example_proxy,
    }

    params = sig.parameters
    if len(params) == 1:
        parameter_name = next(iter(params))
        if parameter_name in parameter_mapping:
            return sig.bind(parameter_mapping[parameter_name])
        else:
            return sig.bind(parameter_mapping["output"])
    return sig.bind_partial(
        **{name: parameter_mapping[name] for name in set(parameter_mapping).intersection(params)}
    )


def _default_eval_scorer(result: Any) -> EvaluationResult:
    """Convert function result to EvaluationResult."""
    if is_score_result(result):
        return _score_result_to_evaluation_result(result)

    if is_evaluation_result(result):
        return result
    elif isinstance(result, bool):
        return {"score": float(result), "label": str(result)}
    elif isinstance(result, (int, float)):
        return {"score": float(result)}
    elif isinstance(result, str):
        return {"label": result}
    elif isinstance(result, tuple) and len(result) >= 2:  # pyright: ignore[reportUnknownArgumentType]
        # Handle tuple results like (score, label) or (score, label, explanation)
        score_val = result[0]  # pyright: ignore[reportUnknownVariableType]
        label_val = result[1]  # pyright: ignore[reportUnknownVariableType]
        score = float(score_val) if score_val is not None else None  # pyright: ignore[reportUnknownArgumentType]
        label = str(label_val) if label_val is not None else None  # pyright: ignore[reportUnknownArgumentType]
        explanation = str(result[2]) if len(result) > 2 and result[2] is not None else None  # pyright: ignore[reportUnknownArgumentType, reportUnknownArgumentType]

        result_dict: dict[str, Any] = {}
        if score is not None:
            result_dict["score"] = score
        if label is not None:
            result_dict["label"] = label
        if explanation is not None:
            result_dict["explanation"] = explanation
        return cast(EvaluationResult, result_dict)
    else:
        raise ValueError(f"Unsupported evaluation result type: {type(result)}")  # pyright: ignore[reportUnknownArgumentType]

    # Default case - convert to string label
    return {"label": str(result)}  # pyright: ignore[reportUnknownArgumentType]


def create_evaluator(
    kind: Union[str, AnnotatorKind] = AnnotatorKind.CODE,
    name: Optional[str] = None,
    scorer: Optional[Callable[[Any], EvaluationResult]] = None,
) -> Callable[[ExperimentEvaluator], Evaluator]:
    """
    A decorator that configures a sync or async function to be used as an experiment evaluator.

    If the `evaluator` is a function of one argument then that argument will be
    bound to the `output` of an experiment task. Alternatively, the `evaluator` can be a function
    of any combination of specific argument names that will be bound to special values:
        `input`: The input field of the dataset example
        `output`: The output of an experiment task
        `expected`: The expected or reference output of the dataset example
        `reference`: An alias for `expected`
        `metadata`: Metadata associated with the dataset example
        `example`: The dataset `Example` object with all associated fields

    Args:
        kind (str | AnnotatorKind): Broadly indicates how the evaluator scores an experiment run.
            Valid kinds are: "CODE", "LLM". Defaults to "CODE".
        name (str, optional): The name of the evaluator. If not provided, the name of the function
            will be used.
        scorer (callable, optional): An optional function that converts the output of the wrapped
            function into an `EvaluationResult`. This allows configuring the evaluation
            payload by setting a label, score and explanation. By default, numeric outputs will
            be recorded as scores, boolean outputs will be recorded as scores and labels, and
            string outputs will be recorded as labels. If the output is a 2-tuple, the first item
            will be recorded as the score and the second item will recorded as the explanation.

    Examples:
        Configuring an evaluator that returns a boolean

        .. code-block:: python
            @create_evaluator(kind="CODE", name="exact-match")
            def match(output: str, expected: str) -> bool:
                return output == expected

        Configuring an evaluator that returns a label

        .. code-block:: python
            client = openai.Client()

            @create_evaluator(kind="LLM")
            def label(output: str) -> str:
                res = client.chat.completions.create(
                    model = "gpt-4",
                    messages = [
                        {
                            "role": "user",
                            "content": (
                                "in one word, characterize the sentiment of the following customer "
                                f"request: {output}"
                            )
                        },
                    ],
                )
                label = res.choices[0].message.content
                return label

        Configuring an evaluator that returns a score and explanation

        .. code-block:: python
            from textdistance import levenshtein

            @create_evaluator(kind="CODE", name="levenshtein-distance")
            def ld(output: str, expected: str) -> tuple[float, str]:
                return (
                    levenshtein(output, expected),
                    f"Levenshtein distance between {output} and {expected}"
                )
    """
    if scorer is None:
        scorer = _default_eval_scorer

    if isinstance(kind, str):
        kind = AnnotatorKind(kind.upper())

    def wrapper(obj: ExperimentEvaluator) -> Evaluator:
        if isinstance(obj, EvalsEvaluator):
            return wrap_phoenix_evals_evaluator(obj)
        elif isinstance(obj, Evaluator):
            return obj

        nonlocal name
        if not name:
            name = get_func_name(obj)
        assert name is not None

        wrapped_signature = inspect.signature(obj)
        validate_evaluator_signature(wrapped_signature)

        if inspect.iscoroutinefunction(obj):
            return _wrap_coroutine_evaluation_function(name, kind, wrapped_signature, scorer)(obj)
        else:
            return _wrap_sync_evaluation_function(name, kind, wrapped_signature, scorer)(obj)

    return wrapper


def wrap_phoenix_evals_evaluator(evaluator: EvalsEvaluator) -> Evaluator:
    class PhoenixEvalsEvaluator(BaseEvaluator):
        def __init__(self) -> None:
            self._name = evaluator.name
            if evaluator.source == "llm":
                self._kind = AnnotatorKind.LLM
            else:
                self._kind = AnnotatorKind.CODE

        def evaluate(self, **kwargs: Any) -> EvaluationResult:
            scores = evaluator.evaluate(kwargs)
            if isinstance(scores, EvaluationScore):
                return _score_to_experiment_evaluation(scores)
            else:
                return _score_to_experiment_evaluation(scores[0])

        async def async_evaluate(self, **kwargs: Any) -> EvaluationResult:
            scores = await evaluator.async_evaluate(kwargs)
            if isinstance(scores, EvaluationScore):
                return _score_to_experiment_evaluation(scores)
            else:
                return _score_to_experiment_evaluation(scores[0])

    return PhoenixEvalsEvaluator()


def _wrap_coroutine_evaluation_function(
    name: str,
    annotator_kind: AnnotatorKind,
    sig: inspect.Signature,
    convert_to_score: Callable[[Any], EvaluationResult],
) -> Callable[[Callable[..., Any]], "Evaluator"]:
    def wrapper(func: Callable[..., Any]) -> "Evaluator":
        # Import here to avoid circular import
        from phoenix.client.resources.experiments.types import BaseEvaluator

        class AsyncEvaluator(BaseEvaluator):
            def __init__(self) -> None:
                self._name = name
                self._kind = annotator_kind

            @functools.wraps(func)
            async def __call__(self, *args: Any, **kwargs: Any) -> Any:
                return await func(*args, **kwargs)

            def evaluate(self, **kwargs: Any) -> EvaluationResult:
                raise NotImplementedError("Async evaluator must use async_evaluate")

            async def async_evaluate(self, **kwargs: Any) -> EvaluationResult:
                bound_signature = _bind_evaluator_signature(sig, **kwargs)
                result = await func(*bound_signature.args, **bound_signature.kwargs)
                return convert_to_score(result)

        return AsyncEvaluator()

    return wrapper


def _wrap_sync_evaluation_function(
    name: str,
    annotator_kind: AnnotatorKind,
    sig: inspect.Signature,
    convert_to_score: Callable[[Any], EvaluationResult],
) -> Callable[[Callable[..., Any]], "Evaluator"]:
    def wrapper(func: Callable[..., Any]) -> "Evaluator":
        # Import here to avoid circular import
        from phoenix.client.resources.experiments.types import BaseEvaluator

        class SyncEvaluator(BaseEvaluator):
            def __init__(self) -> None:
                self._name = name
                self._kind = annotator_kind

            @functools.wraps(func)
            def __call__(self, *args: Any, **kwargs: Any) -> Any:
                return func(*args, **kwargs)

            def evaluate(self, **kwargs: Any) -> EvaluationResult:
                bound_signature = _bind_evaluator_signature(sig, **kwargs)
                result = func(*bound_signature.args, **bound_signature.kwargs)
                return convert_to_score(result)

            async def async_evaluate(self, **kwargs: Any) -> EvaluationResult:
                return self.evaluate(**kwargs)

        return SyncEvaluator()

    return wrapper
