"""
Pydantic models describing the evaluator a request asked to run.

A definition is either an inline draft (an LLM judge prompt or a piece of code) or a
reference to a stored evaluator. It is what the ``evaluatorPreviews`` mutation receives, and
what an experiment evaluator task freezes in its ``definition`` JSON column so the experiment
runner can rebuild the same evaluator when it starts or resumes the experiment.
"""

from __future__ import annotations

from typing import Annotated, Literal, Union

from pydantic import ConfigDict, Field, RootModel

from phoenix.db.types.annotation_configs import CategoricalOutputConfig, OutputConfigType
from phoenix.db.types.db_helper_types import DBBaseModel
from phoenix.db.types.model_provider import ModelProvider
from phoenix.db.types.prompts import (
    PromptChatTemplate,
    PromptInvocationParameters,
    PromptResponseFormat,
    PromptTemplateFormat,
    PromptTools,
)


class InlineLLMEvaluatorPromptVersion(DBBaseModel):
    """The judge prompt and model of an inline LLM evaluator, frozen as drafted."""

    model_config = ConfigDict(frozen=True)

    template_format: PromptTemplateFormat
    template: PromptChatTemplate
    tools: PromptTools | None = None
    response_format: PromptResponseFormat | None = None
    invocation_parameters: PromptInvocationParameters
    model_provider: ModelProvider
    model_name: str
    custom_provider_id: int | None = None


class InlineLLMEvaluatorDefinition(DBBaseModel):
    """An LLM evaluator drafted inline: it exists only in this definition."""

    model_config = ConfigDict(frozen=True)

    type: Literal["inline_llm_evaluator"]
    name: str
    description: str | None = None
    prompt_version: InlineLLMEvaluatorPromptVersion
    output_configs: list[CategoricalOutputConfig]


class InlineCodeEvaluatorDefinition(DBBaseModel):
    """A code evaluator drafted inline, run in the named sandbox configuration."""

    model_config = ConfigDict(frozen=True)

    type: Literal["inline_code_evaluator"]
    name: str
    description: str | None = None
    language: str
    source_code: str
    sandbox_config_id: int
    output_configs: list[OutputConfigType]


class StoredCodeEvaluatorDefinition(DBBaseModel):
    """A stored code evaluator, run at the version current when the evaluator is built."""

    model_config = ConfigDict(frozen=True)

    type: Literal["code_evaluator"]
    code_evaluator_id: int


class BuiltInEvaluatorDefinition(DBBaseModel):
    """One of Phoenix's built-in evaluators."""

    model_config = ConfigDict(frozen=True)

    type: Literal["builtin_evaluator"]
    builtin_evaluator_id: int


EvaluatorDefinition = Annotated[
    Union[
        InlineLLMEvaluatorDefinition,
        InlineCodeEvaluatorDefinition,
        StoredCodeEvaluatorDefinition,
        BuiltInEvaluatorDefinition,
    ],
    Field(discriminator="type"),
]


class EvaluatorDefinitionRootModel(RootModel[EvaluatorDefinition]):
    root: EvaluatorDefinition


def evaluator_kind_of(definition: EvaluatorDefinition) -> Literal["LLM", "CODE", "BUILTIN"]:
    """The kind of evaluator a definition builds, as stored in ``evaluators.kind``."""
    if isinstance(definition, InlineLLMEvaluatorDefinition):
        return "LLM"
    if isinstance(definition, (InlineCodeEvaluatorDefinition, StoredCodeEvaluatorDefinition)):
        return "CODE"
    return "BUILTIN"
