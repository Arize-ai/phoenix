from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.server.api.input_types.AnnotationConfigInput import (
    CategoricalAnnotationConfigInput,
)
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import EvaluatorInputMappingInput
from phoenix.server.api.input_types.PromptVersionInput import ChatPromptVersionInput


@strawberry.input
class InlineLLMEvaluatorInput:
    """Defines an inline LLM evaluator without requiring persistence."""

    prompt_version: ChatPromptVersionInput
    output_config: CategoricalAnnotationConfigInput
    description: Optional[str] = None


@strawberry.input(one_of=True)
class EvaluatorPreviewInput:
    """
    Input for previewing an evaluator. Either provide an existing evaluator ID
    or an inline LLM evaluator definition.
    """

    built_in_evaluator_id: Optional[GlobalID] = UNSET
    inline_llm_evaluator: Optional[InlineLLMEvaluatorInput] = UNSET


@strawberry.input
class EvaluatorPreviewsInput:
    """Input for the evaluatorPreviews mutation."""

    previews: list["EvaluatorPreviewItemInput"]


@strawberry.input
class EvaluatorPreviewItemInput:
    """A single evaluator preview request with one or more contexts."""

    evaluator: EvaluatorPreviewInput
    context: JSON
    input_mapping: EvaluatorInputMappingInput = strawberry.field(
        default_factory=EvaluatorInputMappingInput
    )
