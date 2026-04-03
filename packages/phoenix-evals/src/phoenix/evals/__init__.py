from importlib.metadata import version

from . import llm, metrics, templating, tracing, utils
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
