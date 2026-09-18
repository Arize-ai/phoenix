from __future__ import annotations

from typing import Literal, Union

from phoenix.client.__generated__ import v1

__all__ = [
    "DatasetEvaluatorInput",
    "EvaluatorDefinition",
    "EvaluatorOutputConfig",
    "EvaluatorType",
    "Language",
]

EvaluatorDefinition = Union[
    v1.LLMEvaluatorDefinition,
    v1.CodeEvaluatorDefinition,
    v1.BuiltInEvaluatorDefinition,
]
"""A shared evaluator definition. The ``type`` field discriminates the variants."""

EvaluatorType = Literal["llm", "code", "builtin"]
"""A kind of evaluator definition, as accepted by the ``type`` filter when listing."""

Language = Literal["PYTHON", "TYPESCRIPT"]
"""The language a code evaluator is written in."""

EvaluatorOutputConfig = Union[
    v1.CategoricalAnnotationConfigData,
    v1.ContinuousAnnotationConfigData,
    v1.FreeformAnnotationConfigData,
]
"""An output configuration produced by an evaluator or overridden on a binding."""

DatasetEvaluatorInput = Union[
    v1.NewLLMEvaluator,
    v1.NewCodeEvaluator,
    v1.ExistingEvaluator,
]
"""The evaluator a dataset binding creates or references. ``type`` is ``"llm"``,
``"code"``, or ``"reference"``."""
