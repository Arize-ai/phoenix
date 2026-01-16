import json
import logging
import re
import zlib
from abc import ABC, abstractmethod
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Callable, Optional, TypeAlias, TypeVar, Union

from jsonpath_ng import parse as parse_jsonpath
from jsonschema import ValidationError, validate
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID
from typing_extensions import TypedDict, assert_never

from phoenix.db import models
from phoenix.db.types.annotation_configs import (
    CategoricalAnnotationConfig,
    CategoricalAnnotationConfigOverride,
    CategoricalAnnotationValue,
    ContinuousAnnotationConfig,
    ContinuousAnnotationConfigOverride,
    OptimizationDirection,
)
from phoenix.db.types.model_provider import (
    ModelProvider,
    is_sdk_compatible_with_model_provider,
)
from phoenix.server.api.exceptions import BadRequest, NotFound
from phoenix.server.api.helpers.playground_clients import (
    PlaygroundStreamingClient,
    get_playground_client,
)
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplate,
    PromptInvocationParameters,
    PromptTemplateFormat,
    PromptTools,
    RoleConversion,
    TextContentPart,
    denormalize_tools,
    get_raw_invocation_parameters,
)
from phoenix.server.api.helpers.prompts.template_helpers import get_template_formatter
from phoenix.server.api.input_types.GenerativeCredentialInput import (
    GenerativeCredentialInput,
)
from phoenix.server.api.input_types.GenerativeModelInput import (
    GenerativeModelBuiltinProviderInput,
    GenerativeModelCustomProviderInput,
    GenerativeModelInput,
)
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import EvaluatorInputMappingInput
from phoenix.server.api.input_types.PromptVersionInput import (
    PromptChatTemplateInput,
    TextContentValueInput,
)
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import ToolCallChunk
from phoenix.server.api.types.GenerativeProvider import GenerativeProviderKey
from phoenix.server.api.types.node import from_global_id

logger = logging.getLogger(__name__)


ToolCallId: TypeAlias = str


class ToolCall(TypedDict):
    name: str
    arguments: str


class EvaluationResult(TypedDict):
    name: str
    annotator_kind: str
    label: Optional[str]
    score: Optional[float]
    explanation: Optional[str]
    metadata: dict[str, Any]
    error: Optional[str]
    trace_id: Optional[str]
    start_time: datetime
    end_time: datetime


class LLMEvaluator:
    def __init__(
        self,
        name: str,
        description: Optional[str],
        metadata: dict[str, Any],
        template: PromptChatTemplate,
        template_format: PromptTemplateFormat,
        tools: PromptTools,
        invocation_parameters: PromptInvocationParameters,
        model_provider: ModelProvider,
        llm_client: "PlaygroundStreamingClient[Any]",
        output_config: CategoricalAnnotationConfig,
        id: Optional[int] = None,
    ):
        self._name = name
        self._description = description
        self._metadata = metadata
        self._template = template
        self._template_format = template_format
        self._tools = tools
        self._invocation_parameters = invocation_parameters
        self._model_provider = model_provider
        self._id = id
        self._llm_client = llm_client
        self._output_config = output_config

    @property
    def name(self) -> str:
        return self._name

    @property
    def description(self) -> Optional[str]:
        return self._description

    @property
    def metadata(self) -> dict[str, Any]:
        return self._metadata

    @property
    def template(self) -> PromptChatTemplate:
        return self._template

    @property
    def template_format(self) -> PromptTemplateFormat:
        return self._template_format

    @property
    def tools(self) -> PromptTools:
        return self._tools

    @property
    def model_provider(self) -> ModelProvider:
        return self._model_provider

    @property
    def output_config(self) -> CategoricalAnnotationConfig:
        return self._output_config

    @staticmethod
    def from_orm(
        llm_evaluator_orm: models.LLMEvaluator,
        prompt_version_orm: models.PromptVersion,
        llm_client: "PlaygroundStreamingClient[Any]",
    ) -> "LLMEvaluator":
        template = prompt_version_orm.template
        assert isinstance(template, PromptChatTemplate)
        tools = prompt_version_orm.tools
        assert tools is not None

        return LLMEvaluator(
            id=llm_evaluator_orm.id,
            name=llm_evaluator_orm.name.root,
            description=llm_evaluator_orm.description,
            metadata=llm_evaluator_orm.metadata_,
            template=template,
            template_format=prompt_version_orm.template_format,
            tools=tools,
            invocation_parameters=prompt_version_orm.invocation_parameters,
            model_provider=prompt_version_orm.model_provider,
            llm_client=llm_client,
            output_config=llm_evaluator_orm.output_config,
        )

    @property
    def node_id(self) -> GlobalID:
        if self._id is None:
            raise ValueError(
                "LLMEvaluator has not yet been persisted to the database and hence has no node ID"
            )
        from phoenix.server.api.types.Evaluator import LLMEvaluator as LLMEvaluatorNode

        return GlobalID(LLMEvaluatorNode.__name__, str(self._id))

    @property
    def input_schema(self) -> dict[str, Any]:
        formatter = get_template_formatter(self.template_format)
        variables: set[str] = set()

        for msg in self.template.messages:
            if isinstance(msg.content, str):
                variables.update(formatter.parse(msg.content))
            elif isinstance(msg.content, list):
                for part in msg.content:
                    if isinstance(part, TextContentPart):
                        variables.update(formatter.parse(part.text))
            else:
                assert_never(msg.content)

        properties = {var: {"type": "string"} for var in variables}
        return {
            "type": "object",
            "properties": properties,
            "required": list(variables),
        }

    async def evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: EvaluatorInputMappingInput,
        display_name: str,
        output_config: CategoricalAnnotationConfig,
    ) -> EvaluationResult:
        start_time = datetime.now(timezone.utc)
        try:
            template_variables = apply_input_mapping(
                input_schema=self.input_schema,
                input_mapping=input_mapping,
                context=context,
            )
            template_variables = cast_template_variable_types(
                template_variables=template_variables,
                input_schema=self.input_schema,
            )
            validate_template_variables(
                template_variables=template_variables,
                input_schema=self.input_schema,
            )
            template_formatter = get_template_formatter(self._template_format)
            messages: list[
                tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[str]]]
            ] = []
            for msg in self._template.messages:
                role = ChatCompletionMessageRole(RoleConversion.to_gql(msg.role))
                if isinstance(msg.content, str):
                    formatted_content = template_formatter.format(msg.content, **template_variables)
                else:
                    text_parts = []
                    for part in msg.content:
                        if isinstance(part, TextContentPart):
                            formatted_text = template_formatter.format(
                                part.text, **template_variables
                            )
                            text_parts.append(formatted_text)
                    formatted_content = "".join(text_parts)
                messages.append((role, formatted_content, None, None))

            denormalized_tools, denormalized_tool_choice = denormalize_tools(
                self._tools, self._model_provider
            )
            invocation_parameters = get_raw_invocation_parameters(self._invocation_parameters)
            invocation_parameters.update(denormalized_tool_choice)
            tool_call_by_id: dict[ToolCallId, ToolCall] = {}

            async for chunk in self._llm_client.chat_completion_create(
                messages=messages,
                tools=denormalized_tools,
                **invocation_parameters,
            ):
                if isinstance(chunk, ToolCallChunk):
                    if chunk.id not in tool_call_by_id:
                        tool_call_by_id[chunk.id] = ToolCall(
                            name=chunk.function.name,
                            arguments=chunk.function.arguments,
                        )
                    else:
                        tool_call_by_id[chunk.id]["arguments"] += chunk.function.arguments

            if not tool_call_by_id:
                raise ValueError("No tool calls received from LLM")

            tool_call = next(iter(tool_call_by_id.values()))
            args = json.loads(tool_call["arguments"])
            label = args.get("label")
            if label is None:
                raise ValueError("LLM response missing required 'label' field")

            scores_by_label = {
                config_value.label: config_value.score for config_value in output_config.values
            }
            score = scores_by_label.get(label)
            explanation = args.get("explanation")

            end_time = datetime.now(timezone.utc)
            return EvaluationResult(
                name=display_name,
                annotator_kind="LLM",
                label=label,
                score=score,
                explanation=explanation,
                metadata={},
                error=None,
                trace_id=None,
                start_time=start_time,
                end_time=end_time,
            )
        except Exception as e:
            logger.exception(f"LLM evaluator '{self._name}' failed")
            end_time = datetime.now(timezone.utc)
            return EvaluationResult(
                name=display_name,
                annotator_kind="LLM",
                label=None,
                score=None,
                explanation=None,
                metadata={},
                error=str(e),
                trace_id=None,
                start_time=start_time,
                end_time=end_time,
            )


BuiltInEvaluatorOutputConfig: TypeAlias = Union[
    CategoricalAnnotationConfig, ContinuousAnnotationConfig
]


class BuiltInEvaluator(ABC):
    name: str
    description: Optional[str] = None
    metadata: dict[str, Any] = {}
    input_schema: dict[str, Any] = {}

    @classmethod
    @abstractmethod
    def output_config(cls) -> BuiltInEvaluatorOutputConfig:
        """Returns the base output config for this evaluator (before any overrides are applied)."""
        raise NotImplementedError

    @abstractmethod
    def evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: EvaluatorInputMappingInput,
        display_name: str,
        output_config: BuiltInEvaluatorOutputConfig,
    ) -> EvaluationResult:
        raise NotImplementedError

    def _map_boolean_to_label_and_score(
        self,
        matched: bool,
        output_config: BuiltInEvaluatorOutputConfig,
    ) -> tuple[Optional[str], Optional[float]]:
        """
        Map a boolean result to a label and score using the output config.
        For categorical configs, finds the matching label based on score.
        """
        if isinstance(output_config, CategoricalAnnotationConfig):
            target_score = 1.0 if matched else 0.0
            for value in output_config.values:
                if value.score == target_score:
                    return value.label, value.score
            return None, target_score
        else:
            return None, 1.0 if matched else 0.0


_BUILTIN_EVALUATORS: dict[str, type[BuiltInEvaluator]] = {}
_BUILTIN_EVALUATORS_BY_ID: dict[int, type[BuiltInEvaluator]] = {}

T = TypeVar("T", bound=BuiltInEvaluator)


def _generate_builtin_evaluator_id(name: str) -> int:
    """Generate a stable negative ID using CRC32 checksum."""
    return -abs(zlib.crc32(name.encode("utf-8")))


def register_builtin_evaluator(cls: type[T]) -> type[T]:
    evaluator_id = _generate_builtin_evaluator_id(cls.name)
    _BUILTIN_EVALUATORS[cls.name] = cls
    _BUILTIN_EVALUATORS_BY_ID[evaluator_id] = cls
    return cls


def get_builtin_evaluators() -> list[tuple[int, type[BuiltInEvaluator]]]:
    """Returns list of (id, evaluator_class) tuples."""
    return [(_generate_builtin_evaluator_id(cls.name), cls) for cls in _BUILTIN_EVALUATORS.values()]


def get_builtin_evaluator_ids() -> list[int]:
    return list(_BUILTIN_EVALUATORS_BY_ID.keys())


def get_builtin_evaluator_by_id(evaluator_id: int) -> Optional[type[BuiltInEvaluator]]:
    return _BUILTIN_EVALUATORS_BY_ID.get(evaluator_id)


async def get_llm_evaluators(
    evaluator_node_ids: list[GlobalID],
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    credentials: list[GenerativeCredentialInput] | None = None,
) -> list[LLMEvaluator]:
    from phoenix.server.api.types.Evaluator import LLMEvaluator as LLMEvaluatorNode

    if not evaluator_node_ids:
        return []

    llm_evaluator_db_to_node_id: dict[int, GlobalID] = {}
    for evaluator_node_id in evaluator_node_ids:
        type_name, evaluator_db_id = from_global_id(evaluator_node_id)
        if type_name == LLMEvaluatorNode.__name__:
            llm_evaluator_db_to_node_id[evaluator_db_id] = evaluator_node_id

    if not llm_evaluator_db_to_node_id:
        return []

    llm_evaluator_orms = (
        await session.scalars(
            select(
                models.LLMEvaluator,
            ).where(models.LLMEvaluator.id.in_(llm_evaluator_db_to_node_id.keys()))
        )
    ).all()

    llm_evaluators: list[LLMEvaluator] = []
    for llm_evaluator_orm in llm_evaluator_orms:
        llm_evaluator_node_id = llm_evaluator_db_to_node_id[llm_evaluator_orm.id]
        prompt_id = llm_evaluator_orm.prompt_id
        prompt_version_tag_id = llm_evaluator_orm.prompt_version_tag_id
        if prompt_version_tag_id is not None:
            # Get the tagged version
            prompt_version_query = (
                select(models.PromptVersion)
                .join(models.PromptVersionTag)
                .where(models.PromptVersionTag.id == prompt_version_tag_id)
            )
        else:
            # Get the latest version
            prompt_version_query = (
                select(models.PromptVersion)
                .where(models.PromptVersion.prompt_id == prompt_id)
                .order_by(models.PromptVersion.id.desc())
                .limit(1)
            )
        prompt_version = await session.scalar(prompt_version_query)
        if prompt_version is None:
            raise NotFound(f"Prompt version not found for LLM evaluator '{llm_evaluator_node_id}'")

        # Create model input based on whether a custom provider is configured
        if prompt_version.custom_provider_id is not None:
            # Use custom provider - construct GlobalID for the provider
            from phoenix.server.api.types.GenerativeModelCustomProvider import (
                GenerativeModelCustomProvider,
            )

            # Validate SDK compatibility at runtime. This catches cases where someone
            # modified the custom provider's SDK in the database after it was attached
            # to this prompt.
            custom_provider = await session.get(
                models.GenerativeModelCustomProvider, prompt_version.custom_provider_id
            )
            if custom_provider is None:
                raise NotFound(
                    f"Custom provider with ID '{prompt_version.custom_provider_id}' not found"
                )
            if not is_sdk_compatible_with_model_provider(
                custom_provider.sdk, prompt_version.model_provider
            ):
                raise BadRequest(
                    f"Custom provider '{custom_provider.name}' has SDK '{custom_provider.sdk}' "
                    f"which is not compatible with prompt's model provider "
                    f"'{prompt_version.model_provider.value}'. The custom provider's SDK may have "
                    f"been changed after it was attached to this prompt."
                )

            provider_global_id = GlobalID(
                type_name=GenerativeModelCustomProvider.__name__,
                node_id=str(prompt_version.custom_provider_id),
            )
            model_input = GenerativeModelInput(
                custom=GenerativeModelCustomProviderInput(
                    provider_id=provider_global_id,
                    model_name=prompt_version.model_name,
                )
            )
        else:
            # Use built-in provider
            provider_key = GenerativeProviderKey.from_model_provider(prompt_version.model_provider)
            model_input = GenerativeModelInput(
                builtin=GenerativeModelBuiltinProviderInput(
                    provider_key=provider_key,
                    name=prompt_version.model_name,
                )
            )

        llm_client = await get_playground_client(
            model=model_input,
            session=session,
            decrypt=decrypt,
            credentials=credentials,
        )

        llm_evaluators.append(
            LLMEvaluator.from_orm(
                llm_evaluator_orm=llm_evaluator_orm,
                prompt_version_orm=prompt_version,
                llm_client=llm_client,
            )
        )

    return llm_evaluators


def apply_input_mapping(
    *,
    input_schema: dict[str, Any],
    input_mapping: "EvaluatorInputMappingInput",
    context: dict[str, Any],
) -> dict[str, Any]:
    result: dict[str, Any] = {}
    # apply path mappings
    if hasattr(input_mapping, "path_mapping"):
        for key, path_expr in input_mapping.path_mapping.items():
            try:
                jsonpath = parse_jsonpath(path_expr)
            except Exception as e:
                raise ValueError(f"Invalid JSONPath expression '{path_expr}' for key '{key}': {e}")
            matches = jsonpath.find(context)
            if matches:
                if len(matches) == 1:
                    result[key] = matches[0].value
                else:
                    result[key] = [match.value for match in matches]

    # literal mappings take priority over path mappings
    if hasattr(input_mapping, "literal_mapping"):
        for key, value in input_mapping.literal_mapping.items():
            result[key] = value

    # for any key in the input schema that is still not in result,
    # set result[input_schema_key] to context[input_schema_key]
    for key in input_schema.get("properties", {}).keys():
        if key not in result and key in context:
            result[key] = context[key]

    return result


def cast_template_variable_types(
    *,
    template_variables: dict[str, Any],
    input_schema: dict[str, Any],
) -> dict[str, Any]:
    casted_template_variables = deepcopy(template_variables)
    properties = input_schema.get("properties", {})

    for key, prop_schema in properties.items():
        if key in casted_template_variables:
            prop_type = prop_schema.get("type")
            if prop_type == "string" and not isinstance(casted_template_variables[key], str):
                casted_template_variables[key] = str(casted_template_variables[key])

    return casted_template_variables


def validate_template_variables(
    *,
    template_variables: dict[str, Any],
    input_schema: dict[str, Any],
) -> None:
    try:
        validate(instance=template_variables, schema=input_schema)
    except ValidationError as e:
        raise ValueError(f"Input validation failed: {e.message}")


def infer_input_schema_from_template(
    *,
    template: PromptChatTemplateInput,
    template_format: PromptTemplateFormat,
) -> dict[str, Any]:
    formatter = get_template_formatter(template_format)
    variables: set[str] = set()
    for msg in template.messages:
        content = msg.content
        for part in content:
            if isinstance(part.text, TextContentValueInput):
                variables.update(formatter.parse(part.text.text))

    return {
        "type": "object",
        "properties": {var: {} for var in variables},
        "required": list(variables),
    }


def evaluation_result_to_model(
    result: EvaluationResult,
    *,
    experiment_run_id: int,
) -> models.ExperimentRunAnnotation:
    return models.ExperimentRunAnnotation(
        experiment_run_id=experiment_run_id,
        name=result["name"],
        annotator_kind=result["annotator_kind"],
        label=result["label"],
        score=result["score"],
        explanation=result["explanation"],
        trace_id=result["trace_id"],
        error=result["error"],
        metadata_=result["metadata"],
        start_time=result["start_time"],
        end_time=result["end_time"],
    )


def evaluation_result_to_span_annotation(
    result: EvaluationResult,
    *,
    span_rowid: int,
) -> models.SpanAnnotation:
    return models.SpanAnnotation(
        span_rowid=span_rowid,
        name=result["name"],
        annotator_kind=result["annotator_kind"],
        label=result["label"],
        score=result["score"],
        explanation=result["explanation"],
        metadata_=result["metadata"],
        identifier=result["name"],
        source="API",
        created_at=result["start_time"],
        updated_at=result["end_time"],
        user_id=None,
    )


def create_llm_evaluator_from_inline(
    *,
    prompt_version_orm: models.PromptVersion,
    llm_client: "PlaygroundStreamingClient[Any]",
    output_config: CategoricalAnnotationConfig,
    description: Optional[str] = None,
) -> LLMEvaluator:
    """
    Creates an LLMEvaluator instance from inline definition without database persistence.
    Used for evaluator preview functionality.
    """
    template = prompt_version_orm.template
    assert isinstance(template, PromptChatTemplate)
    tools = prompt_version_orm.tools
    assert tools is not None

    return LLMEvaluator(
        id=None,
        name="preview",
        description=description,
        metadata={},
        template=template,
        template_format=prompt_version_orm.template_format,
        tools=tools,
        invocation_parameters=prompt_version_orm.invocation_parameters,
        model_provider=prompt_version_orm.model_provider,
        llm_client=llm_client,
        output_config=output_config,
    )


@register_builtin_evaluator
class ContainsEvaluator(BuiltInEvaluator):
    name = "Contains"
    description = "Evaluates whether the output contains a specific string"
    metadata = {"type": "string_matching"}
    input_schema = {
        "type": "object",
        "properties": {
            "words": {
                "type": "string",
                "description": "A comma separated list of words to search for in the output",
            },
            "text": {
                "type": "string",
                "description": "The text to search for the words in",
            },
            "case_sensitive": {
                "type": "boolean",
                "description": "Whether to match the string case sensitive",
            },
            "require_all": {
                "type": "boolean",
                "description": (
                    "If true, all words must be present. If false (default), any word matches."
                ),
            },
        },
        "required": ["words", "text"],
    }

    @classmethod
    def output_config(cls) -> CategoricalAnnotationConfig:
        return CategoricalAnnotationConfig(
            type="CATEGORICAL",
            name="contains",
            optimization_direction=OptimizationDirection.MAXIMIZE,
            values=[
                CategoricalAnnotationValue(label="true", score=1.0),
                CategoricalAnnotationValue(label="false", score=0.0),
            ],
        )

    def evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: EvaluatorInputMappingInput,
        display_name: str,
        output_config: BuiltInEvaluatorOutputConfig,
    ) -> EvaluationResult:
        start_time = datetime.now(timezone.utc)
        try:
            inputs = apply_input_mapping(
                input_schema=self.input_schema,
                input_mapping=input_mapping,
                context=context,
            )
            inputs = cast_template_variable_types(
                template_variables=inputs,
                input_schema=self.input_schema,
            )
            validate_template_variables(
                template_variables=inputs,
                input_schema=self.input_schema,
            )
            words = [word.strip() for word in inputs.get("words", "").split(",")]
            text = inputs.get("text", "")
            case_sensitive = inputs.get("case_sensitive", False)
            require_all = inputs.get("require_all", False)

            match_fn = all if require_all else any
            if case_sensitive:
                matched = match_fn(word in text for word in words)
            else:
                matched = match_fn(word.lower() in text.lower() for word in words)

            if require_all:
                all_or_not = "all" if matched else "not all"
                explanation = f"{all_or_not} of the words {repr(words)} were found in the text"
            else:
                found_or_not = "found" if matched else "not found"
                explanation = (
                    f"one or more of the words {repr(words)} were {found_or_not} in the text"
                )
            label, score = self._map_boolean_to_label_and_score(matched, output_config)
            end_time = datetime.now(timezone.utc)
            return EvaluationResult(
                name=display_name,
                annotator_kind="CODE",
                label=label,
                score=score,
                explanation=explanation,
                metadata={
                    "words": words,
                    "text": text,
                    "case_sensitive": case_sensitive,
                    "require_all": require_all,
                },
                error=None,
                trace_id=None,
                start_time=start_time,
                end_time=end_time,
            )
        except Exception as e:
            logger.exception(f"Builtin evaluator '{self.name}' failed")
            end_time = datetime.now(timezone.utc)
            return EvaluationResult(
                name=display_name,
                annotator_kind="CODE",
                label=None,
                score=None,
                explanation=None,
                metadata={},
                error=str(e),
                trace_id=None,
                start_time=start_time,
                end_time=end_time,
            )


@register_builtin_evaluator
class ExactMatchEvaluator(BuiltInEvaluator):
    name = "ExactMatch"
    description = "Evaluates whether the actual text exactly matches the expected text"
    metadata = {"type": "string_matching"}
    input_schema = {
        "type": "object",
        "properties": {
            "expected": {
                "type": "string",
                "description": "The expected text",
            },
            "actual": {
                "type": "string",
                "description": "The actual text to compare",
            },
            "case_sensitive": {
                "type": "boolean",
                "description": "Whether comparison is case-sensitive (default: True)",
            },
        },
        "required": ["expected", "actual"],
    }

    @classmethod
    def output_config(cls) -> CategoricalAnnotationConfig:
        return CategoricalAnnotationConfig(
            type="CATEGORICAL",
            name="exact_match",
            optimization_direction=OptimizationDirection.MAXIMIZE,
            values=[
                CategoricalAnnotationValue(label="true", score=1.0),
                CategoricalAnnotationValue(label="false", score=0.0),
            ],
        )

    def evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: EvaluatorInputMappingInput,
        display_name: str,
        output_config: BuiltInEvaluatorOutputConfig,
    ) -> EvaluationResult:
        start_time = datetime.now(timezone.utc)
        try:
            inputs = apply_input_mapping(
                input_schema=self.input_schema,
                input_mapping=input_mapping,
                context=context,
            )
            inputs = cast_template_variable_types(
                template_variables=inputs,
                input_schema=self.input_schema,
            )
            validate_template_variables(
                template_variables=inputs,
                input_schema=self.input_schema,
            )
            expected = inputs.get("expected", "")
            actual = inputs.get("actual", "")
            case_sensitive = inputs.get("case_sensitive", True)

            if case_sensitive:
                matched = expected == actual
            else:
                matched = expected.lower() == actual.lower()

            explanation = f"expected {'matches' if matched else 'does not match'} actual"
            label, score = self._map_boolean_to_label_and_score(matched, output_config)
            end_time = datetime.now(timezone.utc)
            return EvaluationResult(
                name=display_name,
                annotator_kind="CODE",
                label=label,
                score=score,
                explanation=explanation,
                metadata={"expected": expected, "actual": actual, "case_sensitive": case_sensitive},
                error=None,
                trace_id=None,
                start_time=start_time,
                end_time=end_time,
            )
        except Exception as e:
            logger.exception(f"Builtin evaluator '{self.name}' failed")
            end_time = datetime.now(timezone.utc)
            return EvaluationResult(
                name=display_name,
                annotator_kind="CODE",
                label=None,
                score=None,
                explanation=None,
                metadata={},
                error=str(e),
                trace_id=None,
                start_time=start_time,
                end_time=end_time,
            )


@register_builtin_evaluator
class RegexEvaluator(BuiltInEvaluator):
    name = "Regex"
    description = "Evaluates whether the text matches a regex pattern"
    metadata = {"type": "pattern_matching"}
    input_schema = {
        "type": "object",
        "properties": {
            "pattern": {
                "type": "string",
                "description": "The regex pattern to match",
            },
            "text": {
                "type": "string",
                "description": "The text to search",
            },
            "full_match": {
                "type": "boolean",
                "description": (
                    "If true, pattern must match entire text; "
                    "if false, searches for pattern anywhere (default: False)"
                ),
            },
        },
        "required": ["pattern", "text"],
    }

    @classmethod
    def output_config(cls) -> CategoricalAnnotationConfig:
        return CategoricalAnnotationConfig(
            type="CATEGORICAL",
            name="regex",
            optimization_direction=OptimizationDirection.MAXIMIZE,
            values=[
                CategoricalAnnotationValue(label="true", score=1.0),
                CategoricalAnnotationValue(label="false", score=0.0),
            ],
        )

    def evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: EvaluatorInputMappingInput,
        display_name: str,
        output_config: BuiltInEvaluatorOutputConfig,
    ) -> EvaluationResult:
        start_time = datetime.now(timezone.utc)
        try:
            inputs = apply_input_mapping(
                input_schema=self.input_schema,
                input_mapping=input_mapping,
                context=context,
            )
            inputs = cast_template_variable_types(
                template_variables=inputs,
                input_schema=self.input_schema,
            )
            validate_template_variables(
                template_variables=inputs,
                input_schema=self.input_schema,
            )
            pattern = inputs.get("pattern", "")
            text = inputs.get("text", "")
            full_match = inputs.get("full_match", False)

            try:
                if full_match:
                    match = re.fullmatch(pattern, text)
                else:
                    match = re.search(pattern, text)
                matched = match is not None
                error = None
            except re.error as e:
                matched = False
                error = f"Invalid regex pattern: {e}"

            if error:
                explanation = error
                label, score = None, None
            else:
                match_type = "full match" if full_match else "search"
                explanation = f"pattern {'matched' if matched else 'did not match'} ({match_type})"
                label, score = self._map_boolean_to_label_and_score(matched, output_config)
            end_time = datetime.now(timezone.utc)
            return EvaluationResult(
                name=display_name,
                annotator_kind="CODE",
                label=label,
                score=score,
                explanation=explanation,
                metadata={"pattern": pattern, "text": text, "full_match": full_match},
                error=error,
                trace_id=None,
                start_time=start_time,
                end_time=end_time,
            )
        except Exception as e:
            logger.exception(f"Builtin evaluator '{self.name}' failed")
            end_time = datetime.now(timezone.utc)
            return EvaluationResult(
                name=display_name,
                annotator_kind="CODE",
                label=None,
                score=None,
                explanation=None,
                metadata={},
                error=str(e),
                trace_id=None,
                start_time=start_time,
                end_time=end_time,
            )


def levenshtein_distance(s1: str, s2: str) -> int:
    if len(s1) < len(s2):
        s1, s2 = s2, s1
    if len(s2) == 0:
        return len(s1)

    previous_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]


@register_builtin_evaluator
class LevenshteinDistanceEvaluator(BuiltInEvaluator):
    name = "LevenshteinDistance"
    description = "Calculates the Levenshtein (edit) distance between two strings"
    metadata = {"type": "string_distance"}
    input_schema = {
        "type": "object",
        "properties": {
            "expected": {
                "type": "string",
                "description": "The expected text",
            },
            "actual": {
                "type": "string",
                "description": "The actual text to compare",
            },
            "case_sensitive": {
                "type": "boolean",
                "description": "Whether comparison is case-sensitive (default: True)",
            },
        },
        "required": ["expected", "actual"],
    }

    @classmethod
    def output_config(cls) -> ContinuousAnnotationConfig:
        return ContinuousAnnotationConfig(
            type="CONTINUOUS",
            name="levenshtein_distance",
            optimization_direction=OptimizationDirection.MAXIMIZE,
            lower_bound=0.0,
            upper_bound=1.0,
        )

    def evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: EvaluatorInputMappingInput,
        display_name: str,
        output_config: BuiltInEvaluatorOutputConfig,
    ) -> EvaluationResult:
        start_time = datetime.now(timezone.utc)
        try:
            inputs = apply_input_mapping(
                input_schema=self.input_schema,
                input_mapping=input_mapping,
                context=context,
            )
            inputs = cast_template_variable_types(
                template_variables=inputs,
                input_schema=self.input_schema,
            )
            validate_template_variables(
                template_variables=inputs,
                input_schema=self.input_schema,
            )
            expected = inputs.get("expected", "")
            actual = inputs.get("actual", "")
            case_sensitive = inputs.get("case_sensitive", True)

            if case_sensitive:
                distance = levenshtein_distance(expected, actual)
            else:
                distance = levenshtein_distance(expected.lower(), actual.lower())

            explanation = f"edit distance between expected and actual is {distance}"
            end_time = datetime.now(timezone.utc)
            return EvaluationResult(
                name=display_name,
                annotator_kind="CODE",
                label=None,
                score=float(distance),
                explanation=explanation,
                metadata={"expected": expected, "actual": actual, "case_sensitive": case_sensitive},
                error=None,
                trace_id=None,
                start_time=start_time,
                end_time=end_time,
            )
        except Exception as e:
            logger.exception(f"Builtin evaluator '{self.name}' failed")
            end_time = datetime.now(timezone.utc)
            return EvaluationResult(
                name=display_name,
                annotator_kind="CODE",
                label=None,
                score=None,
                explanation=None,
                metadata={},
                error=str(e),
                trace_id=None,
                start_time=start_time,
                end_time=end_time,
            )


def json_diff_count(expected: Any, actual: Any) -> int:
    if type(expected) is not type(actual):
        return 1

    if isinstance(expected, dict) and isinstance(actual, dict):
        diff = 0
        all_keys = set(expected.keys()) | set(actual.keys())
        for key in all_keys:
            if key not in expected:
                diff += 1
            elif key not in actual:
                diff += 1
            else:
                diff += json_diff_count(expected[key], actual[key])
        return diff

    if isinstance(expected, list) and isinstance(actual, list):
        diff = abs(len(expected) - len(actual))
        for i in range(min(len(expected), len(actual))):
            diff += json_diff_count(expected[i], actual[i])
        return diff

    return 0 if expected == actual else 1


@register_builtin_evaluator
class JSONDistanceEvaluator(BuiltInEvaluator):
    name = "JSONDistance"
    description = "Compares two JSON structures and returns the number of differences"
    metadata = {"type": "json_comparison"}
    input_schema = {
        "type": "object",
        "properties": {
            "expected": {
                "type": "string",
                "description": "The expected JSON string",
            },
            "actual": {
                "type": "string",
                "description": "The actual JSON string to compare",
            },
        },
        "required": ["expected", "actual"],
    }

    @classmethod
    def output_config(cls) -> ContinuousAnnotationConfig:
        return ContinuousAnnotationConfig(
            type="CONTINUOUS",
            name="json_distance",
            optimization_direction=OptimizationDirection.MAXIMIZE,
            lower_bound=0.0,
            upper_bound=1.0,
        )

    def evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: EvaluatorInputMappingInput,
        display_name: str,
        output_config: BuiltInEvaluatorOutputConfig,
    ) -> EvaluationResult:
        start_time = datetime.now(timezone.utc)
        try:
            inputs = apply_input_mapping(
                input_schema=self.input_schema,
                input_mapping=input_mapping,
                context=context,
            )
            inputs = cast_template_variable_types(
                template_variables=inputs,
                input_schema=self.input_schema,
            )
            validate_template_variables(
                template_variables=inputs,
                input_schema=self.input_schema,
            )
            expected_str = inputs.get("expected", "")
            actual_str = inputs.get("actual", "")

            try:
                expected = json.loads(expected_str)
                actual = json.loads(actual_str)
                distance = json_diff_count(expected, actual)
                error = None
                explanation = f"JSON structures have {distance} difference(s)"
            except json.JSONDecodeError as e:
                distance = -1
                error = f"Invalid JSON: {e}"
                explanation = error

            end_time = datetime.now(timezone.utc)
            return EvaluationResult(
                name=display_name,
                annotator_kind="CODE",
                label=None,
                score=float(distance) if error is None else None,
                explanation=explanation,
                metadata={"expected": expected_str, "actual": actual_str},
                error=error,
                trace_id=None,
                start_time=start_time,
                end_time=end_time,
            )
        except Exception as e:
            logger.exception(f"Builtin evaluator '{self.name}' failed")
            end_time = datetime.now(timezone.utc)
            return EvaluationResult(
                name=display_name,
                annotator_kind="CODE",
                label=None,
                score=None,
                explanation=None,
                metadata={},
                error=str(e),
                trace_id=None,
                start_time=start_time,
                end_time=end_time,
            )


def merge_categorical_output_config(
    base: CategoricalAnnotationConfig,
    override: Optional[CategoricalAnnotationConfigOverride],
    display_name: str,
    description_override: Optional[str],
) -> CategoricalAnnotationConfig:
    """
    Merge a base categorical output config with optional overrides.

    Args:
        base: The base CategoricalAnnotationConfig from the LLM evaluator
        override: Optional overrides from the dataset evaluator
        display_name: The display name to use as the config name
        description_override: Optional description override

    Returns:
        A new CategoricalAnnotationConfig with overrides applied
    """
    values = base.values
    optimization_direction = base.optimization_direction
    description = base.description

    if override is not None:
        if override.values is not None:
            values = override.values
        if override.optimization_direction is not None:
            optimization_direction = override.optimization_direction

    if description_override is not None:
        description = description_override

    return CategoricalAnnotationConfig(
        type=base.type,
        name=display_name,
        description=description,
        optimization_direction=optimization_direction,
        values=values,
    )


def merge_continuous_output_config(
    base: ContinuousAnnotationConfig,
    override: Optional[ContinuousAnnotationConfigOverride],
    display_name: str,
    description_override: Optional[str],
) -> ContinuousAnnotationConfig:
    """
    Merge a base continuous output config with optional overrides.

    Args:
        base: The base ContinuousAnnotationConfig from the builtin evaluator
        override: Optional overrides from the dataset evaluator
        display_name: The display name to use as the config name
        description_override: Optional description override

    Returns:
        A new ContinuousAnnotationConfig with overrides applied
    """
    optimization_direction = base.optimization_direction
    lower_bound = base.lower_bound
    upper_bound = base.upper_bound
    description = base.description

    if override is not None:
        if override.optimization_direction is not None:
            optimization_direction = override.optimization_direction
        if override.lower_bound is not None:
            lower_bound = override.lower_bound
        if override.upper_bound is not None:
            upper_bound = override.upper_bound

    if description_override is not None:
        description = description_override

    return ContinuousAnnotationConfig(
        type=base.type,
        name=display_name,
        description=description,
        optimization_direction=optimization_direction,
        lower_bound=lower_bound,
        upper_bound=upper_bound,
    )
