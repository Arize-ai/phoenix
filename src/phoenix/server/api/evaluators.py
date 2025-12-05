import json
import zlib
from abc import ABC, abstractmethod
from datetime import datetime, timezone
from typing import Any, Optional, TypeAlias, TypeVar

from jsonpath_ng import parse as parse_jsonpath
from jsonschema import ValidationError, validate
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.relay import GlobalID
from typing_extensions import TypedDict, assert_never

from phoenix.db import models
from phoenix.server.api.exceptions import NotFound
from phoenix.server.api.helpers.evaluators import (
    validate_consistent_llm_evaluator_and_prompt_version,
)
from phoenix.server.api.helpers.playground_clients import PlaygroundStreamingClient
from phoenix.server.api.helpers.prompts.models import (
    PromptChatTemplate,
    PromptTemplateFormat,
    TextContentPart,
    denormalize_tools,
)
from phoenix.server.api.input_types.PlaygroundEvaluatorInput import EvaluatorInputMappingInput
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import ToolCallChunk
from phoenix.server.api.types.node import from_global_id
from phoenix.utilities.template_formatters import (
    FStringTemplateFormatter,
    MustacheTemplateFormatter,
    NoOpFormatter,
    TemplateFormatter,
)

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
        self, llm_evaluator_orm: models.LLMEvaluator, prompt_version_orm: models.PromptVersion
    ) -> None:
        validate_consistent_llm_evaluator_and_prompt_version(prompt_version_orm, llm_evaluator_orm)
        self._llm_evaluator_orm = llm_evaluator_orm
        self._prompt_version_orm = prompt_version_orm

    @property
    def id(self) -> GlobalID:
        return GlobalID(type_name="LLMEvaluator", node_id=str(self._llm_evaluator_orm.id))

    @property
    def name(self) -> str:
        return self._llm_evaluator_orm.name.root

    @property
    def description(self) -> Optional[str]:
        return self._llm_evaluator_orm.description

    @property
    def metadata(self) -> dict[str, Any]:
        return self._llm_evaluator_orm.metadata_

    @property
    def input_schema(self) -> dict[str, Any]:
        prompt_version = self._prompt_version_orm
        template = prompt_version.template
        assert isinstance(template, PromptChatTemplate)
        formatter = _get_template_formatter(prompt_version.template_format)
        variables: set[str] = set()

        for msg in template.messages:
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
        llm_client: PlaygroundStreamingClient,
    ) -> EvaluationResult:
        prompt_version = self._prompt_version_orm
        evaluator = self._llm_evaluator_orm
        prompt_tools = prompt_version.tools
        assert prompt_tools is not None
        template = prompt_version.template
        assert isinstance(template, PromptChatTemplate)
        template_variables = apply_input_mapping(
            input_schema=self.input_schema,
            input_mapping=input_mapping,
            context=context,
        )
        template_formatter = _get_template_formatter(prompt_version.template_format)
        messages: list[
            tuple[ChatCompletionMessageRole, str, Optional[str], Optional[list[str]]]
        ] = []
        for msg in template.messages:
            role = _prompt_role_to_chat_role(msg.role)
            if isinstance(msg.content, str):
                formatted_content = template_formatter.format(msg.content, **template_variables)
            else:
                text_parts = []
                for part in msg.content:
                    if isinstance(part, TextContentPart):
                        formatted_text = template_formatter.format(part.text, **template_variables)
                        text_parts.append(formatted_text)
                formatted_content = "".join(text_parts)
            messages.append((role, formatted_content, None, None))

        denormalized_tools, _ = denormalize_tools(
            prompt_tools, prompt_version.model_provider
        )  # todo: denormalize tool choice and pass as part of invocation parameters

        tool_call_by_id: dict[ToolCallId, ToolCall] = {}
        error_message: Optional[str] = None
        start_time = datetime.now(timezone.utc)
        try:
            async for chunk in llm_client.chat_completion_create(
                messages=messages,
                tools=denormalized_tools,
            ):
                if isinstance(chunk, ToolCallChunk):
                    if chunk.id not in tool_call_by_id:
                        tool_call_by_id[chunk.id] = ToolCall(
                            name=chunk.function.name,
                            arguments=chunk.function.arguments,
                        )
                    else:
                        tool_call_by_id[chunk.id]["arguments"] += chunk.function.arguments
        except Exception as e:
            error_message = str(e)
            end_time = datetime.now(timezone.utc)
            return EvaluationResult(
                name=evaluator.annotation_name,
                annotator_kind="LLM",
                label=None,
                score=None,
                explanation=None,
                metadata={},
                error=error_message or "No tool calls received",
                trace_id=None,
                start_time=start_time,
                end_time=end_time,
            )
        finally:
            end_time = datetime.now(timezone.utc)

        tool_call = next(iter(tool_call_by_id.values()))
        args = json.loads(tool_call["arguments"])
        assert len(args) == 1
        label = next(iter(args.values()))
        output_config = evaluator.output_config
        scores_by_label = {
            config_value.label: config_value.score for config_value in output_config.values
        }
        score = scores_by_label.get(label)

        return EvaluationResult(
            name=evaluator.annotation_name,
            annotator_kind="LLM",
            label=label,
            score=score,
            explanation=None,
            metadata={},
            error=None,
            trace_id=None,
            start_time=start_time,
            end_time=end_time,
        )


class BuiltInEvaluator(ABC):
    name: str
    description: Optional[str] = None
    metadata: dict[str, Any] = {}
    input_schema: dict[str, Any] = {}

    @abstractmethod
    def evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: EvaluatorInputMappingInput,
    ) -> EvaluationResult:
        raise NotImplementedError


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
    evaluator_ids: list[GlobalID],
    session: AsyncSession,
) -> list[LLMEvaluator]:
    if not evaluator_ids:
        return []

    llm_evaluator_db_to_node_id: dict[int, GlobalID] = {}
    for evaluator_id in evaluator_ids:
        type_name, db_id = from_global_id(evaluator_id)
        if type_name == "LLMEvaluator":
            llm_evaluator_db_to_node_id[db_id] = evaluator_id

    if not llm_evaluator_db_to_node_id:
        return []

    llm_evaluator_orms: list[models.LLMEvaluator] = list(
        await session.scalars(
            select(models.LLMEvaluator).where(
                models.LLMEvaluator.id.in_(llm_evaluator_db_to_node_id.keys())
            )
        )
    )

    if len(llm_evaluator_orms) < len(llm_evaluator_db_to_node_id):
        missing_db_ids = set(llm_evaluator_db_to_node_id.keys()) - set(
            evaluator.id for evaluator in llm_evaluator_orms
        )
        missing_node_ids = [llm_evaluator_db_to_node_id[db_id] for db_id in missing_db_ids]
        raise NotFound(
            f"Could not find all LLM evaluators with IDs {', '.join(map(_quote, missing_node_ids))}"
        )

    llm_evaluators: list[LLMEvaluator] = []
    for llm_evaluator_orm in llm_evaluator_orms:
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
            llm_evaluator_node_id = llm_evaluator_db_to_node_id[llm_evaluator_orm.id]
            raise NotFound(f"Prompt version not found for evaluator '{llm_evaluator_node_id}'")

        llm_evaluators.append(LLMEvaluator(llm_evaluator_orm, prompt_version))

    return llm_evaluators


def _prompt_role_to_chat_role(role: str) -> "ChatCompletionMessageRole":
    role_lower = role.lower()
    if role_lower in ("user",):
        return ChatCompletionMessageRole.USER
    if role_lower in ("system", "developer"):
        return ChatCompletionMessageRole.SYSTEM
    if role_lower in ("ai", "assistant", "model"):
        return ChatCompletionMessageRole.AI
    if role_lower in ("tool",):
        return ChatCompletionMessageRole.TOOL
    # Default to user
    return ChatCompletionMessageRole.USER


def _quote(value: Any) -> str:
    return f'"{value}"'


def _get_template_formatter(template_format: PromptTemplateFormat) -> TemplateFormatter:
    if template_format is PromptTemplateFormat.MUSTACHE:
        return MustacheTemplateFormatter()
    if template_format is PromptTemplateFormat.F_STRING:
        return FStringTemplateFormatter()
    if template_format is PromptTemplateFormat.NONE:
        return NoOpFormatter()
    assert_never(template_format)


def get_template_input_schema(
    prompt_version: models.PromptVersion,
) -> dict[str, Any]:
    """
    Extract the input schema (JSON Schema) from a prompt version's template.

    This parses the template messages to find all template variables (e.g., {{input}}, {output})
    and returns a JSON Schema with those variables as required string properties.

    Args:
        prompt_version: The prompt version containing the template

    Returns:
        A JSON Schema dict with template variables as properties
    """
    template = prompt_version.template
    if not isinstance(template, PromptChatTemplate):
        raise ValueError("Only PromptChatTemplate is currently supported for LLM evaluators")

    formatter = _get_template_formatter(prompt_version.template_format)
    variables: set[str] = set()

    for msg in template.messages:
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


def apply_input_mapping(
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
                matches = jsonpath.find(context)
                if matches:
                    result[key] = matches[0].value
            except Exception:
                pass

    # literal mappings take priority over path mappings
    if hasattr(input_mapping, "literal_mapping"):
        for key, value in input_mapping.literal_mapping.items():
            result[key] = value

    # for any key in the input schema that is still not in result,
    # set result[input_schema_key] to context[input_schema_key]
    for key in input_schema.get("properties", {}).keys():
        if key not in result:
            result[key] = context.get(key, None)

    try:
        validate(instance=result, schema=input_schema)
    except ValidationError as e:
        raise ValueError(f"Input validation failed: {e.message}")

    return result


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


@register_builtin_evaluator
class ContainsEvaluator(BuiltInEvaluator):
    name = "Contains"
    description = "Evaluates whether the output contains a specific string"
    metadata = {"type": "string_matching"}
    input_schema = {
        "type": "object",
        "properties": {
            "contains": {
                "type": "string",
                "description": "String to search for in the output",
            },
            "output": {
                "type": "string",
                "description": "Output to search for the string in",
            },
        },
        "required": ["contains", "output"],
    }

    def evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: EvaluatorInputMappingInput,
    ) -> EvaluationResult:
        inputs = apply_input_mapping(self.input_schema, input_mapping, context)
        contains = inputs.get("contains", "")
        output = inputs.get("output", "")
        now = datetime.now(timezone.utc)
        matched = str(contains).lower() in str(output).lower()
        return EvaluationResult(
            name=self.name,
            annotator_kind="CODE",
            label=None,
            score=1.0 if matched else 0.0,
            explanation=(
                f"the string {repr(contains)} was {'found' if matched else 'not found'} "
                "in the output"
            ),
            metadata={"contains": contains},
            error=None,
            trace_id=None,
            start_time=now,
            end_time=now,
        )
