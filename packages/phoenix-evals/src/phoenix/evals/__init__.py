from importlib.metadata import version

from . import llm, metrics, tracing, utils
from .evaluators import (
    ClassificationEvaluator,
    EvalInput,
    Evaluator,
    KindType,
    LLMEvaluator,
    Score,
    ToolSchema,
    async_evaluate_dataframe,
    bind_evaluator,
    create_classifier,
    create_evaluator,
    evaluate_dataframe,
)
from .llm import LLM, phoenix_prompt_to_prompt_template
from .utils import download_benchmark_dataset

__version__ = version("arize-phoenix-evals")


def __getattr__(name: str) -> object:
    """Lazily load the deprecated ``templating`` submodule (PEP 562).

    Deferring the import means the ``DeprecationWarning`` only fires when a
    caller explicitly accesses ``phoenix.evals.templating``, not on every
    ``import phoenix.evals``.
    """
    if name == "templating":
        from . import templating

        return templating
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "ClassificationEvaluator",
    "EvalInput",
    "Evaluator",
    "LLMEvaluator",
    "Score",
    "ToolSchema",
    "KindType",
    "create_classifier",
    "create_evaluator",
    "async_evaluate_dataframe",
    "evaluate_dataframe",
    "metrics",
    "templating",
    "llm",
    "LLM",
    "phoenix_prompt_to_prompt_template",
    "bind_evaluator",
    "tracing",
    "utils",
    "download_benchmark_dataset",
]
