from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.server.api.helpers.prompts.models import PromptTemplateFormat
from phoenix.server.api.input_types.ChatCompletionMessageInput import (
    ChatCompletionMessageInput,
)
from phoenix.server.api.input_types.GenerativeModelInput import GenerativeModelInput
from phoenix.server.api.input_types.InvocationParameters import InvocationParameterInput
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import EvaluatorInputMappingInput
from phoenix.server.api.input_types.PromptVersionInput import ChatPromptVersionInput
from phoenix.server.api.mutations.annotation_config_mutations import (
    CategoricalAnnotationConfigInput,
)


@strawberry.input
class GenerationConfigInput:
    """Configuration for generating output using an LLM."""

    model: GenerativeModelInput
    messages: list[ChatCompletionMessageInput]
    tools: Optional[list[JSON]] = UNSET
    invocation_parameters: list[InvocationParameterInput] = strawberry.field(default_factory=list)
    template_format: PromptTemplateFormat = PromptTemplateFormat.MUSTACHE


@strawberry.input
class InlineLLMEvaluatorInput:
    """Defines an inline LLM evaluator without requiring persistence."""

    model: GenerativeModelInput
    prompt_version: ChatPromptVersionInput
    output_config: CategoricalAnnotationConfigInput
    description: Optional[str] = None


@strawberry.input(one_of=True)
class EvaluatorPreviewInput:
    """
    Input for previewing an evaluator. Either provide an existing evaluator ID
    or an inline LLM evaluator definition.
    """

    evaluator_id: Optional[GlobalID] = UNSET
    inline_llm_evaluator: Optional[InlineLLMEvaluatorInput] = UNSET


@strawberry.input
class EvaluatorPreviewsInput:
    """Input for the evaluatorPreviews mutation."""

    previews: list["EvaluatorPreviewItemInput"]


@strawberry.input
class EvaluatorPreviewItemInput:
    """A single evaluator preview request with one or more contexts."""

    evaluator: EvaluatorPreviewInput
    contexts: list[JSON]
    input_mapping: EvaluatorInputMappingInput = strawberry.field(
        default_factory=EvaluatorInputMappingInput
    )
    model: Optional[GenerativeModelInput] = UNSET
    generation_config: Optional[GenerationConfigInput] = UNSET
