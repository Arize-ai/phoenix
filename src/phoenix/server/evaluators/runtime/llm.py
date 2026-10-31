"""LLM evaluator runtime and template span attribute helpers."""

import json
from datetime import datetime, timezone
from typing import Any, Optional, Sequence, TypeAlias

import openinference.instrumentation as oi
from opentelemetry.context import Context
from opentelemetry.trace import NoOpTracer, Status, StatusCode, Tracer, format_trace_id
from typing_extensions import TypedDict

from phoenix.db.types.annotation_configs import CategoricalOutputConfig, OutputConfigType
from phoenix.db.types.evaluators import InputMapping
from phoenix.db.types.model_provider import ModelProvider
from phoenix.db.types.prompts import (
    PromptChatTemplate,
    PromptInvocationParameters,
    PromptTemplateFormat,
    PromptTools,
    RoleConversion,
    TextContentPart,
)
from phoenix.server.api.helpers.message_helpers import PlaygroundMessage, create_playground_message
from phoenix.server.api.helpers.playground_clients import PlaygroundClient
from phoenix.server.api.types.ChatCompletionMessageRole import ChatCompletionMessageRole
from phoenix.server.api.types.ChatCompletionSubscriptionPayload import ToolCallChunk
from phoenix.server.evaluators.input_mapping import (
    apply_input_mapping,
    cast_template_variable_types,
    validate_template_variables,
)
from phoenix.server.evaluators.runtime.base import (
    BaseEvaluator,
    EvaluationResult,
    EvaluatorAnnotatorKind,
    EvaluatorProviderClient,
    RenderedMessageTooLargeError,
    result_annotation_names,
)
from phoenix.server.evaluators.schemas import infer_input_schema_from_prompt_template
from phoenix.utilities.template_formatters import get_template_formatter

ToolCallId: TypeAlias = str


class ToolCall(TypedDict):
    name: str
    arguments: str


class LLMEvaluator(BaseEvaluator):
    def __init__(
        self,
        name: str,
        description: Optional[str],
        template: PromptChatTemplate,
        template_format: PromptTemplateFormat,
        tools: PromptTools,
        invocation_parameters: PromptInvocationParameters,
        model_provider: ModelProvider,
        llm_client: PlaygroundClient[Any],
        output_configs: Sequence[CategoricalOutputConfig],
        prompt_name: str,
        max_message_bytes: Optional[int] = None,
    ):
        self._name = name
        self._description = description
        self._template = template
        self._template_format = template_format
        self._tools = tools
        self._invocation_parameters = invocation_parameters
        self._model_provider = model_provider
        self._llm_client = llm_client
        self._output_configs = output_configs
        self._prompt_name = prompt_name
        self._max_message_bytes = max_message_bytes

    @property
    def provider_client(self) -> EvaluatorProviderClient:
        return self._llm_client

    @property
    def annotator_kind(self) -> EvaluatorAnnotatorKind:
        return "LLM"

    @property
    def name(self) -> str:
        return self._name

    @property
    def description(self) -> Optional[str]:
        return self._description

    @property
    def output_configs(self) -> Sequence[OutputConfigType]:
        return self._output_configs

    @property
    def input_schema(self) -> dict[str, Any]:
        return infer_input_schema_from_prompt_template(
            template=self._template,
            template_format=self._template_format,
        )

    async def evaluate(
        self,
        *,
        context: dict[str, Any],
        input_mapping: InputMapping,
        name: str,
        output_configs: Sequence[OutputConfigType],
        tracer: Optional[Tracer] = None,
    ) -> list[EvaluationResult]:
        start_time = datetime.now(timezone.utc)

        # LLMEvaluator only supports categorical output configs
        categorical_configs: list[CategoricalOutputConfig] = []
        for config in output_configs:
            if not isinstance(config, CategoricalOutputConfig):
                raise ValueError(
                    f"LLMEvaluator only supports CategoricalOutputConfig, "
                    f"got {type(config).__name__}"
                )
            categorical_configs.append(config)

        configs_by_name: dict[str, CategoricalOutputConfig] = {
            config.name: config for config in categorical_configs
        }
        annotation_name_by_config_name = dict(
            zip(configs_by_name, result_annotation_names(name, categorical_configs))
        )

        tracer_ = tracer or NoOpTracer()

        with tracer_.start_as_current_span(
            f"Evaluator: {name}",
            attributes={
                **oi.get_span_kind_attributes("evaluator"),
                **oi.get_input_attributes(context),
            },
            context=Context(),  # inject blank context to ensure the evaluator span is the root
        ) as evaluator_span:
            trace_id = (
                format_trace_id(evaluator_span.get_span_context().trace_id) if tracer else None
            )

            try:
                with tracer_.start_as_current_span(
                    "Input Mapping",
                    attributes={
                        **oi.get_span_kind_attributes("chain"),
                        **oi.get_input_attributes(
                            {
                                "input_mapping": {
                                    "path_mapping": input_mapping.path_mapping or {},
                                    "literal_mapping": input_mapping.literal_mapping or {},
                                },
                                "template_variables": context,
                            }
                        ),
                    },
                ) as input_mapping_span:
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
                    input_mapping_span.set_attributes(oi.get_output_attributes(template_variables))
                    input_mapping_span.set_status(Status(StatusCode.OK))

                with tracer_.start_as_current_span(
                    f"Prompt: {self._prompt_name}",
                    attributes={
                        **oi.get_span_kind_attributes("prompt"),
                        **oi.get_input_attributes(template_variables),
                    },
                ) as prompt_span:
                    template_formatter = get_template_formatter(self._template_format)
                    messages: list[PlaygroundMessage] = []
                    for msg in self._template.messages:
                        role = ChatCompletionMessageRole(RoleConversion.to_gql(msg.role))
                        if isinstance(msg.content, str):
                            formatted_content = template_formatter.format(
                                msg.content, **template_variables
                            )
                        else:
                            text_parts = []
                            for part in msg.content:
                                if isinstance(part, TextContentPart):
                                    formatted_text = template_formatter.format(
                                        part.text, **template_variables
                                    )
                                    text_parts.append(formatted_text)
                            formatted_content = "".join(text_parts)
                        messages.append(create_playground_message(role, formatted_content))

                    rendered_message_bytes = sum(
                        len(message["content"].encode("utf-8")) for message in messages
                    )
                    if (
                        self._max_message_bytes is not None
                        and rendered_message_bytes > self._max_message_bytes
                    ):
                        raise RenderedMessageTooLargeError(
                            f"Rendered online-eval messages are {rendered_message_bytes} bytes, "
                            f"exceeding the {self._max_message_bytes}-byte limit. Narrow the "
                            "slot with a path mapping, shorten the prompt, or raise the limit "
                            "with PHOENIX_ONLINE_EVAL_MAX_LLM_MESSAGE_BYTES."
                        )

                    formatted_messages = [
                        oi.Message(role=msg["role"].value.lower(), content=msg["content"])
                        for msg in messages
                    ]
                    prompt_span.set_attributes(
                        oi.get_output_attributes(
                            {
                                "messages": [
                                    {"role": msg["role"], "content": msg["content"]}
                                    for msg in formatted_messages
                                ]
                            }
                        )
                    )
                    prompt_span.set_status(Status(StatusCode.OK))

                tool_call_by_id: dict[ToolCallId, ToolCall] = {}

                async for chunk in self._llm_client.chat_completion_create(
                    messages=messages,
                    tools=self._tools,
                    tracer=tracer_,
                    invocation_parameters=self._invocation_parameters,
                    stream_model_output=False,
                ):
                    if isinstance(chunk, ToolCallChunk):
                        if chunk.id not in tool_call_by_id:
                            tool_call_by_id[chunk.id] = ToolCall(
                                name=chunk.function.name,
                                arguments=chunk.function.arguments,
                            )
                        else:
                            tool_call_by_id[chunk.id]["arguments"] += chunk.function.arguments

                with tracer_.start_as_current_span(
                    "Parse Eval Result",
                    attributes={
                        **oi.get_span_kind_attributes("chain"),
                        **oi.get_input_attributes(
                            {
                                "tool_calls": {
                                    call_id: {"name": call["name"], "arguments": call["arguments"]}
                                    for call_id, call in tool_call_by_id.items()
                                },
                                "output_configs": {
                                    config_name: {
                                        "values": [
                                            {"label": v.label, "score": v.score}
                                            for v in config.values
                                        ]
                                    }
                                    for config_name, config in configs_by_name.items()
                                },
                            }
                        ),
                    },
                ) as chain_span:
                    if not tool_call_by_id:
                        raise ValueError("No tool calls received from LLM")

                    # Match each tool call to its output config by name.
                    # Tool calls whose name doesn't match any config are skipped.
                    # Configs with no matching tool call are skipped.
                    results: list[EvaluationResult] = []
                    for tool_call in tool_call_by_id.values():
                        matched_config = configs_by_name.get(tool_call["name"])
                        if matched_config is None:
                            continue
                        args = json.loads(tool_call["arguments"])
                        label = args.get("label")
                        if label is None:
                            raise ValueError(
                                "LLM response missing required 'label' field in tool call arguments"
                            )
                        scores_by_label = {
                            config_value.label: config_value.score
                            for config_value in matched_config.values
                        }
                        score = scores_by_label.get(label)
                        explanation = args.get("explanation")
                        annotation_name = annotation_name_by_config_name[matched_config.name]
                        end_time = datetime.now(timezone.utc)
                        results.append(
                            EvaluationResult(
                                name=annotation_name,
                                annotator_kind="LLM",
                                label=label,
                                score=score,
                                explanation=explanation,
                                metadata={},
                                error=None,
                                trace_id=trace_id,
                                start_time=start_time,
                                end_time=end_time,
                            )
                        )

                    chain_span.set_attributes(
                        oi.get_output_attributes(
                            {
                                "results": [
                                    {
                                        "name": r["name"],
                                        "label": r["label"],
                                        "score": r["score"],
                                        "explanation": r["explanation"],
                                    }
                                    for r in results
                                ]
                            }
                        )
                    )
                    chain_span.set_status(Status(StatusCode.OK))

                evaluator_span.set_attributes(
                    oi.get_output_attributes(
                        {
                            "results": [
                                {
                                    "name": r["name"],
                                    "label": r["label"],
                                    "score": r["score"],
                                    "explanation": r["explanation"],
                                }
                                for r in results
                            ]
                        }
                    )
                )
                evaluator_span.set_status(Status(StatusCode.OK))

            except Exception as e:
                evaluator_span.record_exception(e)
                evaluator_span.set_status(Status(StatusCode.ERROR, str(e)))

                end_time = datetime.now(timezone.utc)
                # On error, return a single error result for the evaluator.
                results = [
                    EvaluationResult(
                        name=name,
                        annotator_kind="LLM",
                        label=None,
                        score=None,
                        explanation=None,
                        metadata={},
                        error=str(e),
                        trace_id=trace_id,
                        start_time=start_time,
                        end_time=end_time,
                        error_exc=e,
                    )
                ]

        return results
