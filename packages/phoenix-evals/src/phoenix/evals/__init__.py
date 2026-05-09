import importlib
from importlib.metadata import version
from typing import Any

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


def __getattr__(name: str) -> Any:
    # TODO(v4): drop this lazy alias and delete phoenix/evals/templating/.
    # Deprecated 2025-12-04 in favor of phoenix.evals.llm.prompts; kept lazy
    # so importing phoenix.evals does not trigger the templating DeprecationWarning.
    if name == "templating":
        return importlib.import_module(f"{__name__}.templating")
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
