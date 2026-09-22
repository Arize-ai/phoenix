from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID
from strawberry.scalars import JSON

from phoenix.db.types.annotation_configs import CategoricalOutputConfig
from phoenix.db.types.evaluator_definition import (
    BuiltInEvaluatorDefinition,
    EvaluatorDefinition,
    InlineCodeEvaluatorDefinition,
    InlineLLMEvaluatorDefinition,
    InlineLLMEvaluatorPromptVersion,
    StoredCodeEvaluatorDefinition,
)
from phoenix.db.types.prompts import PromptChatTemplate
from phoenix.server.api.exceptions import BadRequest
from phoenix.server.api.input_types.AnnotationConfigInput import (
    AnnotationConfigInput,
)
from phoenix.server.api.input_types.GenerativeCredentialInput import GenerativeCredentialInput
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import EvaluatorInputMappingInput
from phoenix.server.api.input_types.PromptVersionInput import ChatPromptVersionInput
from phoenix.server.api.types.node import from_global_id, from_global_id_with_expected_type
from phoenix.server.api.types.SandboxConfig import Language


@strawberry.input
class InlineLLMEvaluatorInput:
    """Defines an inline LLM evaluator without requiring persistence."""

    name: str
    prompt_version: ChatPromptVersionInput
    output_configs: list[AnnotationConfigInput]
    description: Optional[str] = None

    def to_definition(self) -> InlineLLMEvaluatorDefinition:
        """Freeze the drafted judge prompt and output configs into a definition."""
        try:
            prompt_version = self.prompt_version.to_orm_prompt_version(user_id=None)
        except ValueError as error:  # pydantic's ValidationError is a ValueError
            raise BadRequest(str(error))
        template = prompt_version.template
        assert isinstance(template, PromptChatTemplate)  # a chat prompt version by construction
        output_configs: list[CategoricalOutputConfig] = []
        for config_input in self.output_configs:
            config = config_input.to_output_config()
            if not isinstance(config, CategoricalOutputConfig):
                raise BadRequest(
                    "Only categorical annotation configs are supported for LLM evaluators"
                )
            output_configs.append(config)
        return InlineLLMEvaluatorDefinition(
            type="inline_llm_evaluator",
            name=self.name,
            description=self.description,
            prompt_version=InlineLLMEvaluatorPromptVersion(
                template_format=prompt_version.template_format,
                template=template,
                tools=prompt_version.tools,
                response_format=prompt_version.response_format,
                invocation_parameters=prompt_version.invocation_parameters,
                model_provider=prompt_version.model_provider,
                model_name=prompt_version.model_name,
                custom_provider_id=prompt_version.custom_provider_id,
            ),
            output_configs=output_configs,
        )


@strawberry.input
class InlineCodeEvaluatorInput:
    """Defines an inline code evaluator without requiring persistence."""

    name: str
    language: Language
    source_code: str
    output_configs: list[AnnotationConfigInput]
    sandbox_config_id: Optional[GlobalID] = None
    description: Optional[str] = None

    def to_definition(self) -> InlineCodeEvaluatorDefinition:
        """Freeze the drafted code and its sandbox configuration into a definition."""
        language = self.language.value
        if self.sandbox_config_id is None:
            raise BadRequest(
                f"No sandbox configuration selected for language '{language}'. "
                "Choose a sandbox configuration before testing this evaluator."
            )
        try:
            sandbox_config_id = from_global_id_with_expected_type(
                self.sandbox_config_id, "SandboxConfig"
            )
        except ValueError as error:
            raise BadRequest(str(error))
        return InlineCodeEvaluatorDefinition(
            type="inline_code_evaluator",
            name=self.name,
            description=self.description,
            language=language,
            source_code=self.source_code,
            sandbox_config_id=sandbox_config_id,
            output_configs=[config.to_output_config() for config in self.output_configs],
        )


@strawberry.input(one_of=True)
class EvaluatorPreviewInput:
    """
    Input for previewing an evaluator. Either provide an existing evaluator ID
    or an inline evaluator definition.
    """

    built_in_evaluator_id: Optional[GlobalID] = UNSET
    inline_llm_evaluator: Optional[InlineLLMEvaluatorInput] = UNSET
    code_evaluator_id: Optional[GlobalID] = UNSET
    inline_code_evaluator: Optional[InlineCodeEvaluatorInput] = UNSET

    def to_definition(self) -> EvaluatorDefinition:
        """The evaluator this input names or drafts, as previews and experiments build it."""
        if built_in_evaluator_id := self.built_in_evaluator_id:
            return BuiltInEvaluatorDefinition(
                type="builtin_evaluator",
                builtin_evaluator_id=_node_id(
                    built_in_evaluator_id, "BuiltInEvaluator", "built-in evaluator"
                ),
            )
        if inline_llm_evaluator := self.inline_llm_evaluator:
            return inline_llm_evaluator.to_definition()
        if code_evaluator_id := self.code_evaluator_id:
            return StoredCodeEvaluatorDefinition(
                type="code_evaluator",
                code_evaluator_id=_node_id(code_evaluator_id, "CodeEvaluator", "code evaluator"),
            )
        if inline_code_evaluator := self.inline_code_evaluator:
            return inline_code_evaluator.to_definition()
        raise BadRequest("Either evaluator_id or inline evaluator must be provided")


def _node_id(global_id: GlobalID, expected_type_name: str, noun: str) -> int:
    type_name, node_id = from_global_id(global_id)
    if type_name != expected_type_name:
        raise BadRequest(f"Expected {noun}, got {type_name}")
    return node_id


@strawberry.input
class EvaluatorPreviewsInput:
    """Input for the evaluatorPreviews mutation."""

    previews: list["EvaluatorPreviewItemInput"]
    credentials: Optional[list[GenerativeCredentialInput]] = UNSET


@strawberry.input
class EvaluatorPreviewItemInput:
    """A single evaluator preview request with one or more contexts."""

    evaluator: EvaluatorPreviewInput
    context: JSON
    input_mapping: EvaluatorInputMappingInput
    apply_online_evaluation_limits: bool = strawberry.field(
        default=False,
        description=(
            "Whether to enforce the execution limits an online evaluation runs "
            "under: the rendered LLM message cap and the sandbox payload cap. "
            "Set this when the preview stands in for a scheduled run, so a "
            "preview cannot succeed where the live evaluation would be "
            "rejected. The limits themselves come from the server's "
            "configuration, never from this request."
        ),
    )
