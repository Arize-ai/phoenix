from __future__ import annotations

import json
import logging
from types import MappingProxyType
from typing import (
    TYPE_CHECKING,
    Any,
    Iterator,
    Literal,
    Mapping,
    Optional,
    Sequence,
    TypedDict,
    Union,
    cast,
)

from typing_extensions import Required, TypeAlias, assert_never

from phoenix.client.__generated__ import v1
from phoenix.client.utils.template_formatters import TemplateFormatter, to_formatter

if TYPE_CHECKING:
    from google.genai import types as genai_types

    _ContentPart: TypeAlias = Union[
        v1.TextContentPart,
        v1.ToolCallContentPart,
        v1.ToolResultContentPart,
    ]

    def _(obj: v1.PromptVersionData) -> None:
        from google import genai

        messages, kwargs = to_chat_messages_and_kwargs(obj)
        contents: list[genai_types.ContentUnionDict] = list(messages)
        with genai.Client() as client:
            client.models.generate_content(contents=contents, **kwargs)


class _ToolKwargs(TypedDict, total=False):
    tool_config: genai_types.ToolConfig
    tools: list[genai_types.Tool]


class GoogleGenAIModelKwargs(TypedDict):
    model: Required[str]
    config: Required[genai_types.GenerateContentConfig]


logger = logging.getLogger(__name__)

__all__ = [
    "create_prompt_version_from_google_genai",
    "to_chat_messages_and_kwargs",
]


def create_prompt_version_from_google_genai(
    model: str,
    contents: Sequence[genai_types.Content],
    /,
    *,
    config: Optional[
        Union[genai_types.GenerateContentConfig, genai_types.GenerateContentConfigDict]
    ] = None,
    description: Optional[str] = None,
    template_format: Literal["F_STRING", "MUSTACHE", "NONE"] = "MUSTACHE",
    model_provider: Literal["GOOGLE"] = "GOOGLE",
) -> v1.PromptVersionData:
    from google.genai import types as genai_types

    config = genai_types.GenerateContentConfig.model_validate(config or {})
    _validate_supported_config(config)
    messages = _system_messages_from_google(
        cast(
            Optional[
                Union[
                    str,
                    genai_types.Content,
                    genai_types.Part,
                    Sequence[Union[str, genai_types.Part]],
                ]
            ],
            config.system_instruction,
        )
    )
    tool_call_names: dict[str, str] = {}
    messages.extend(
        _ContentConversion.from_google(content, tool_call_names) for content in contents
    )
    ans = v1.PromptVersionData(
        model_provider=model_provider,
        model_name=model,
        template=v1.PromptChatTemplate(type="chat", messages=messages),
        template_type="CHAT",
        template_format=template_format,
        invocation_parameters=_InvocationParametersConversion.from_google(config),
    )
    tool_kwargs: _ToolKwargs = {}
    if tools := config.model_dump(exclude_none=True).get("tools"):
        tool_kwargs["tools"] = [genai_types.Tool.model_validate(tool) for tool in tools]
    if config.tool_config:
        tool_kwargs["tool_config"] = config.tool_config
    if tools := _ToolKwargsConversion.from_google(tool_kwargs):
        ans["tools"] = tools
    if response_format := _ResponseFormatConversion.from_google(config):
        ans["response_format"] = response_format
    if description:
        ans["description"] = description
    return ans


def _validate_supported_config(config: genai_types.GenerateContentConfig) -> None:
    supported_fields = {
        "temperature",
        "max_output_tokens",
        "stop_sequences",
        "presence_penalty",
        "frequency_penalty",
        "top_p",
        "top_k",
        "thinking_config",
        "system_instruction",
        "tools",
        "tool_config",
        "response_mime_type",
        "response_json_schema",
    }
    unsupported_fields = set(config.model_dump(exclude_none=True)) - supported_fields
    if unsupported_fields:
        raise NotImplementedError(
            "Unsupported Google GenAI config fields: " + ", ".join(sorted(unsupported_fields))
        )


def _system_messages_from_google(
    obj: Optional[
        Union[
            str,
            genai_types.Content,
            genai_types.Part,
            Sequence[Union[str, genai_types.Part]],
        ]
    ],
    /,
) -> list[v1.PromptMessage]:
    from google.genai import types as genai_types

    if obj is None:
        return []
    if isinstance(obj, str):
        return [v1.PromptMessage(role="system", content=obj)]
    parts: Sequence[genai_types.Part]
    if isinstance(obj, genai_types.Content):
        parts = obj.parts or ()
    elif isinstance(obj, genai_types.Part):
        parts = (obj,)
    elif isinstance(obj, Sequence):
        parts = []
        for item in obj:
            if isinstance(item, str):
                parts.append(genai_types.Part(text=item))
            elif isinstance(item, genai_types.Part):
                parts.append(item)
            else:
                raise NotImplementedError(
                    "Only text Google GenAI system instruction lists are supported"
                )
    else:
        raise NotImplementedError("Unsupported Google GenAI system instruction")
    text_parts = [_TextContentPartConversion.from_google(part) for part in parts if _has_text(part)]
    if len(text_parts) != len(parts):
        raise NotImplementedError("Only text Google GenAI system instructions are supported")
    return [v1.PromptMessage(role="system", content=text_parts)] if text_parts else []


def to_chat_messages_and_kwargs(
    obj: v1.PromptVersionData,
    /,
    *,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: Optional[TemplateFormatter] = None,
) -> tuple[list[genai_types.Content], GoogleGenAIModelKwargs]:
    formatter = formatter or to_formatter(obj)
    assert formatter is not None
    template = obj["template"]
    system_messages: list[str] = []
    messages: list[genai_types.Content] = []
    # Google identifies tool results by function name rather than call id, so the
    # names advertised by preceding tool calls are collected up front.
    tool_call_names = _collect_tool_call_names(template)
    if template["type"] == "chat":
        for message in template["messages"]:
            if message["role"] == "system":
                content = message["content"]
                if isinstance(content, str):
                    if text := formatter.format(content, variables=variables):
                        system_messages.append(text)
                else:
                    for part in content:
                        if part["type"] == "text":
                            if text := formatter.format(part["text"], variables=variables):
                                system_messages.append(text)
            else:
                messages.extend(
                    _ContentConversion.to_google(message, variables, formatter, tool_call_names)
                )
    elif template["type"] == "string":
        raise NotImplementedError
    else:
        assert_never(template)
    kwargs: GoogleGenAIModelKwargs = _to_model_kwargs(obj)
    if system_messages:
        config = kwargs["config"]
        if len(system_messages) == 1:
            config.system_instruction = system_messages[0]
        else:
            config.system_instruction = "\n\n".join(system_messages)
    return messages, kwargs


def _collect_tool_call_names(
    template: Union[v1.PromptChatTemplate, v1.PromptStringTemplate],
    /,
) -> dict[str, str]:
    ans: dict[str, str] = {}
    if template["type"] != "chat":
        return ans
    for message in template["messages"]:
        content = message["content"]
        if isinstance(content, str):
            continue
        for part in content:
            if part["type"] == "tool_call":
                ans[part["tool_call_id"]] = part["tool_call"]["name"]
    return ans


def _to_model_kwargs(
    obj: v1.PromptVersionData,
    /,
) -> GoogleGenAIModelKwargs:
    invocation_parameters: v1.PromptGoogleInvocationParametersContent = (
        obj["invocation_parameters"]["google"]
        if "invocation_parameters" in obj and obj["invocation_parameters"]["type"] == "google"
        else {}
    )
    from google.genai import types as genai_types

    config = genai_types.GenerateContentConfig(
        temperature=invocation_parameters.get("temperature"),
        max_output_tokens=invocation_parameters.get("max_output_tokens"),
        stop_sequences=list(invocation_parameters["stop_sequences"])
        if "stop_sequences" in invocation_parameters
        else None,
        presence_penalty=invocation_parameters.get("presence_penalty"),
        frequency_penalty=invocation_parameters.get("frequency_penalty"),
        top_p=invocation_parameters.get("top_p"),
        top_k=invocation_parameters.get("top_k"),
    )
    if "thinking_config" in invocation_parameters:
        config.thinking_config = _ThinkingConfigConversion.to_google(
            invocation_parameters["thinking_config"]
        )
    tool_kwargs = _ToolKwargsConversion.to_google(obj.get("tools"))
    if "tools" in tool_kwargs:
        config.tools = list(tool_kwargs["tools"])
    if "tool_config" in tool_kwargs:
        config.tool_config = tool_kwargs["tool_config"]
    if "response_format" in obj:
        response_format = obj["response_format"]
        if response_format["type"] == "json_schema":
            config.response_mime_type = "application/json"
            if schema := response_format["json_schema"].get("schema"):
                config.response_json_schema = dict(schema)
        elif TYPE_CHECKING:
            assert_never(response_format["type"])
    return {
        "model": obj["model_name"],
        "config": config,
    }


class _ThinkingConfigConversion:
    @staticmethod
    def to_google(
        obj: v1.PromptGoogleThinkingConfig,
    ) -> Optional[genai_types.ThinkingConfig]:
        from google.genai import types as genai_types

        kwargs: dict[str, Any] = {}
        if "thinking_budget" in obj:
            kwargs["thinking_budget"] = obj["thinking_budget"]
        if "include_thoughts" in obj:
            kwargs["include_thoughts"] = obj["include_thoughts"]
        if thinking_level := obj.get("thinking_level"):
            # `thinking_level` was added in google-genai 1.50.0.
            if "thinking_level" in genai_types.ThinkingConfig.model_fields:
                kwargs["thinking_level"] = thinking_level.upper()
            else:
                logger.warning(
                    "Ignoring `thinking_level`: it requires `google-genai>=1.50.0`.",
                )
        if not kwargs:
            return None
        return genai_types.ThinkingConfig.model_validate(kwargs)

    @staticmethod
    def from_google(
        obj: genai_types.ThinkingConfig,
    ) -> v1.PromptGoogleThinkingConfig:
        ans = v1.PromptGoogleThinkingConfig()
        if obj.thinking_budget is not None:
            ans["thinking_budget"] = obj.thinking_budget
        if obj.include_thoughts is not None:
            ans["include_thoughts"] = obj.include_thoughts
        if thinking_level := getattr(obj, "thinking_level", None):
            ans["thinking_level"] = thinking_level.lower()
        return ans


class _InvocationParametersConversion:
    @staticmethod
    def from_google(
        obj: genai_types.GenerateContentConfig,
    ) -> v1.PromptGoogleInvocationParameters:
        parameters = v1.PromptGoogleInvocationParametersContent()
        for field in (
            "temperature",
            "max_output_tokens",
            "presence_penalty",
            "frequency_penalty",
            "top_p",
            "top_k",
        ):
            if (value := getattr(obj, field)) is not None:
                parameters[field] = value
        if obj.stop_sequences is not None:
            parameters["stop_sequences"] = list(obj.stop_sequences)
        if obj.thinking_config is not None:
            parameters["thinking_config"] = _ThinkingConfigConversion.from_google(
                obj.thinking_config
            )
        return v1.PromptGoogleInvocationParameters(type="google", google=parameters)


class _ResponseFormatConversion:
    @staticmethod
    def from_google(
        obj: genai_types.GenerateContentConfig,
    ) -> Optional[v1.PromptResponseFormatJSONSchema]:
        if obj.response_mime_type is None:
            if obj.response_json_schema is not None:
                raise NotImplementedError(
                    "Google GenAI response JSON schemas require `response_mime_type` "
                    "to be `application/json`"
                )
            return None
        if obj.response_mime_type != "application/json":
            raise NotImplementedError(
                "Only `application/json` Google GenAI response MIME types are supported"
            )
        if obj.response_json_schema is None:
            raise NotImplementedError(
                "Google GenAI JSON response formatting requires `response_json_schema`"
            )
        return v1.PromptResponseFormatJSONSchema(
            type="json_schema",
            json_schema=v1.PromptResponseFormatJSONSchemaDefinition(
                name="response",
                schema=cast("Mapping[str, Any]", obj.response_json_schema),
            ),
        )


class _ToolKwargsConversion:
    @staticmethod
    def to_google(
        obj: Optional[v1.PromptTools],
    ) -> _ToolKwargs:
        ans: _ToolKwargs = {}
        if not obj:
            return ans
        from google.genai import types as genai_types

        tools: list[genai_types.Tool] = []
        function_declarations: list[genai_types.FunctionDeclaration] = []
        for t in obj["tools"]:
            if t["type"] == "function":
                function_declarations.append(_FunctionDeclarationConversion.to_google(t))
            elif t["type"] == "raw":
                tools.append(genai_types.Tool.model_validate(dict(t["raw"])))
            elif TYPE_CHECKING:
                assert_never(t["type"])
        if function_declarations:
            tools.append(genai_types.Tool(function_declarations=function_declarations))
        if tools:
            ans["tools"] = tools
        # `function_calling_config` only applies when function declarations are present;
        # Google rejects it for built-in tools such as `google_search`.
        if function_declarations and "tool_choice" in obj:
            ans["tool_config"] = _ToolConfigConversion.to_google(obj["tool_choice"])
        return ans

    @staticmethod
    def from_google(
        obj: _ToolKwargs,
    ) -> Optional[v1.PromptTools]:
        if not obj:
            return None
        tools: list[Union[v1.PromptToolFunction, v1.PromptToolRaw]] = []
        if "tools" in obj:
            for tool in obj["tools"]:
                for fd in tool.function_declarations or ():
                    tools.append(_FunctionDeclarationConversion.from_google(fd))
                raw = tool.model_dump(exclude_none=True)
                raw.pop("function_declarations", None)
                if raw:
                    tools.append(v1.PromptToolRaw(type="raw", raw=raw))
        if not tools:
            return None
        ans = v1.PromptTools(
            type="tools",
            tools=tools,
        )
        if "tool_config" in obj:
            ans["tool_choice"] = _ToolConfigConversion.from_google(obj["tool_config"])
        return ans


class _ToolConfigConversion:
    @staticmethod
    def to_google(
        obj: Union[
            v1.PromptToolChoiceNone,
            v1.PromptToolChoiceZeroOrMore,
            v1.PromptToolChoiceOneOrMore,
            v1.PromptToolChoiceSpecificFunctionTool,
        ],
    ) -> genai_types.ToolConfig:
        from google.genai import types as genai_types

        if obj["type"] == "none":
            return genai_types.ToolConfig(
                function_calling_config=genai_types.FunctionCallingConfig(
                    mode=genai_types.FunctionCallingConfigMode.NONE,
                ),
            )
        if obj["type"] == "zero_or_more":
            return genai_types.ToolConfig(
                function_calling_config=genai_types.FunctionCallingConfig(
                    mode=genai_types.FunctionCallingConfigMode.AUTO,
                ),
            )
        if obj["type"] == "one_or_more":
            return genai_types.ToolConfig(
                function_calling_config=genai_types.FunctionCallingConfig(
                    mode=genai_types.FunctionCallingConfigMode.ANY,
                ),
            )
        if obj["type"] == "specific_function":
            return genai_types.ToolConfig(
                function_calling_config=genai_types.FunctionCallingConfig(
                    mode=genai_types.FunctionCallingConfigMode.ANY,
                    allowed_function_names=[obj["function_name"]],
                ),
            )
        assert_never(obj["type"])

    @staticmethod
    def from_google(
        obj: genai_types.ToolConfig,
    ) -> Union[
        v1.PromptToolChoiceNone,
        v1.PromptToolChoiceZeroOrMore,
        v1.PromptToolChoiceOneOrMore,
        v1.PromptToolChoiceSpecificFunctionTool,
    ]:
        from google.genai import types as genai_types

        fcc = obj.function_calling_config
        mode = fcc.mode if fcc is not None else None
        if mode is genai_types.FunctionCallingConfigMode.NONE:
            choice_none: v1.PromptToolChoiceNone = {"type": "none"}
            return choice_none
        if mode is genai_types.FunctionCallingConfigMode.AUTO:
            choice_zero_or_more: v1.PromptToolChoiceZeroOrMore = {"type": "zero_or_more"}
            return choice_zero_or_more
        if mode is genai_types.FunctionCallingConfigMode.ANY:
            assert fcc is not None
            if not fcc.allowed_function_names:
                choice_one_or_more: v1.PromptToolChoiceOneOrMore = {"type": "one_or_more"}
                return choice_one_or_more
            if len(fcc.allowed_function_names) > 1:
                raise NotImplementedError(
                    "Google GenAI tool configuration with multiple allowed function names "
                    "is not supported"
                )
            choice_specific_function_tool: v1.PromptToolChoiceSpecificFunctionTool = {
                "type": "specific_function",
                "function_name": fcc.allowed_function_names[0],
            }
            return choice_specific_function_tool
        raise NotImplementedError


class _FunctionDeclarationConversion:
    @staticmethod
    def to_google(
        obj: v1.PromptToolFunction,
    ) -> genai_types.FunctionDeclaration:
        from google.genai import types as genai_types

        function = obj["function"]
        ans = genai_types.FunctionDeclaration(
            name=function["name"],
            description=function["description"] if "description" in function else "",
        )
        if "parameters" in function:
            # Passing the JSON schema through verbatim preserves constructs that
            # `genai_types.Schema` cannot express, such as `anyOf`, `$ref`/`$defs`
            # and `default` — which Pydantic-generated schemas rely on.
            ans.parameters_json_schema = dict(function["parameters"])
        return ans

    @staticmethod
    def from_google(
        obj: genai_types.FunctionDeclaration,
    ) -> v1.PromptToolFunction:
        if obj.response is not None or obj.response_json_schema is not None:
            raise NotImplementedError("Google GenAI function response schemas are not supported")
        if obj.behavior is not None:
            raise NotImplementedError("Google GenAI function behavior is not supported")
        function = v1.PromptToolFunctionDefinition(
            name=obj.name or "",
            description=obj.description or "",
        )
        if obj.parameters_json_schema is not None:
            function["parameters"] = dict(
                cast("Mapping[str, Any]", obj.parameters_json_schema),
            )
        elif obj.parameters is not None:
            function["parameters"] = _SchemaConversion.from_google(obj.parameters)
        return v1.PromptToolFunction(
            type="function",
            function=function,
        )


class _SchemaConversion:
    """
    Converts a ``genai_types.Schema`` into a JSON schema mapping.

    Only this direction is needed: tool parameters are sent to Google as raw JSON
    schema via ``FunctionDeclaration.parameters_json_schema``, which avoids the
    lossy translation into ``genai_types.Schema``.
    """

    @staticmethod
    def from_google(
        obj: genai_types.Schema,
    ) -> dict[str, Any]:
        from google.genai import types as genai_types

        def convert_list(values: Sequence[Any]) -> list[Any]:
            return [convert(value) for value in values]

        def convert(value: Any) -> Any:
            if isinstance(value, genai_types.Schema):
                return _SchemaConversion.from_google(value)
            if isinstance(value, genai_types.Type):
                return value.value.lower()
            if isinstance(value, list):
                return convert_list(value)  # pyright: ignore[reportUnknownArgumentType]
            if isinstance(value, Mapping):
                mapping = cast("Mapping[str, Any]", value)
                converted: dict[str, Any] = {}
                for key in mapping:
                    converted[key] = convert(mapping[key])
                return converted
            return value

        ans: dict[str, Any] = {
            "additionalProperties": obj.additional_properties,
            "$defs": obj.defs,
            "$ref": obj.ref,
            "anyOf": obj.any_of,
            "default": obj.default,
            "description": obj.description,
            "enum": obj.enum,
            "example": obj.example,
            "format": obj.format,
            "maxItems": obj.max_items,
            "maxLength": obj.max_length,
            "maxProperties": obj.max_properties,
            "maximum": obj.maximum,
            "minItems": obj.min_items,
            "minLength": obj.min_length,
            "minProperties": obj.min_properties,
            "minimum": obj.minimum,
            "nullable": obj.nullable,
            "pattern": obj.pattern,
            "propertyOrdering": obj.property_ordering,
            "required": obj.required,
            "title": obj.title,
        }
        if obj.type is genai_types.Type.STRING:
            ans["type"] = "string"
        elif obj.type is genai_types.Type.NUMBER:
            ans["type"] = "number"
        elif obj.type is genai_types.Type.INTEGER:
            ans["type"] = "integer"
        elif obj.type is genai_types.Type.BOOLEAN:
            ans["type"] = "boolean"
        elif obj.type is genai_types.Type.NULL:
            ans["type"] = "null"
        elif obj.type is genai_types.Type.ARRAY:
            ans["type"] = "array"
        elif obj.type is genai_types.Type.OBJECT:
            ans["type"] = "object"
        if obj.items is not None:
            ans["items"] = _SchemaConversion.from_google(obj.items)
        if obj.properties:
            ans["properties"] = {
                k: _SchemaConversion.from_google(v) for k, v in obj.properties.items()
            }
        return {
            key: convert(value)
            for key, value in ans.items()
            if value is not None or (key == "default" and "default" in obj.model_fields_set)
        }


class _ContentConversion:
    @staticmethod
    def to_google(
        obj: v1.PromptMessage,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
        tool_call_names: Optional[Mapping[str, str]] = None,
    ) -> Iterator[genai_types.Content]:
        from google.genai import types as genai_types

        role = _RoleConversion.to_google(obj)
        parts: list[genai_types.Part] = []
        if isinstance(obj["content"], str):
            text = formatter.format(obj["content"], variables=variables)
            yield genai_types.Content(role=role, parts=[genai_types.Part(text=text)])
            return
        for part in obj["content"]:
            if part["type"] == "text":
                parts.append(_TextContentPartConversion.to_google(part, variables, formatter))
            elif part["type"] == "tool_call":
                parts.append(_ToolCallContentPartConversion.to_google(part))
            elif part["type"] == "tool_result":
                parts.append(
                    _ToolResultContentPartConversion.to_google(part, tool_call_names or {})
                )
            elif TYPE_CHECKING:
                assert_never(part["type"])
        if not parts:
            raise ValueError("Google GenAI messages require at least one content part")
        yield genai_types.Content(role=role, parts=parts)

    @staticmethod
    def from_google(
        obj: genai_types.Content,
        tool_call_names: Optional[dict[str, str]] = None,
    ) -> v1.PromptMessage:
        role = _RoleConversion.from_google(obj)
        parts: list[_ContentPart] = []
        for part in obj.parts or ():
            if part.thought or part.thought_signature:
                raise NotImplementedError("Google GenAI thought parts are not supported")
            if _has_text(part):
                parts.append(_TextContentPartConversion.from_google(part))
            elif _has_function_call(part):
                tool_call = _ToolCallContentPartConversion.from_google(part)
                if tool_call_names is not None:
                    tool_call_names[tool_call["tool_call_id"]] = tool_call["tool_call"]["name"]
                parts.append(tool_call)
            elif _has_function_response(part):
                function_response = part.function_response
                assert function_response is not None
                if not function_response.id and not function_response.name:
                    raise NotImplementedError(
                        "Google GenAI function responses require an id, name, "
                        "or preceding matching function call"
                    )
                if not function_response.name and (
                    tool_call_names is None
                    or function_response.id is None
                    or tool_call_names.get(function_response.id) is None
                ):
                    raise NotImplementedError(
                        "Google GenAI function responses without a name require a preceding "
                        "matching function call"
                    )
                parts.append(_ToolResultContentPartConversion.from_google(part))
            else:
                raise NotImplementedError("Unsupported Google GenAI content part")
        return v1.PromptMessage(role=role, content=parts)


class _ToolCallContentPartConversion:
    @staticmethod
    def to_google(
        obj: v1.ToolCallContentPart,
    ) -> genai_types.Part:
        from google.genai import types as genai_types

        function = obj["tool_call"]
        args: dict[str, Any] = {}
        if arguments := function.get("arguments"):
            try:
                loaded = json.loads(arguments)
            except json.JSONDecodeError:
                logger.warning(
                    "Ignoring malformed JSON arguments for tool call %r", function.get("name")
                )
            else:
                if isinstance(loaded, dict):
                    args = cast("dict[str, Any]", loaded)
        return genai_types.Part(
            function_call=genai_types.FunctionCall(
                id=(
                    None if obj["tool_call_id"] == function["name"] else obj["tool_call_id"] or None
                ),
                name=function["name"],
                args=args,
            )
        )

    @staticmethod
    def from_google(
        obj: genai_types.Part,
    ) -> v1.ToolCallContentPart:
        assert obj.function_call is not None
        fc = obj.function_call
        return v1.ToolCallContentPart(
            type="tool_call",
            # Google matches id-less responses by function name. Phoenix uses
            # `tool_call_id` for that relation, so use the name as a stable key.
            tool_call_id=fc.id or fc.name or "",
            tool_call=v1.ToolCallFunction(
                type="function",
                name=fc.name or "",
                arguments=json.dumps(fc.args) if fc.args else "{}",
            ),
        )


class _ToolResultContentPartConversion:
    @staticmethod
    def to_google(
        obj: v1.ToolResultContentPart,
        tool_call_names: Mapping[str, str],
        /,
    ) -> genai_types.Part:
        from google.genai import types as genai_types

        tool_call_id = obj["tool_call_id"]
        result = obj.get("tool_result")
        # Google requires `response` to be a mapping, so scalars and sequences are wrapped.
        response: dict[str, Any] = (
            dict(result) if isinstance(result, Mapping) else {"output": result}
        )
        return genai_types.Part(
            function_response=genai_types.FunctionResponse(
                # Google identifies responses by function name; fall back to the call id
                # when the originating tool call is not part of the same prompt.
                name=tool_call_names.get(tool_call_id, tool_call_id),
                id=(
                    None
                    if tool_call_id == tool_call_names.get(tool_call_id, tool_call_id)
                    else tool_call_id or None
                ),
                response=response,
            )
        )

    @staticmethod
    def from_google(
        obj: genai_types.Part,
    ) -> v1.ToolResultContentPart:
        assert obj.function_response is not None
        fr = obj.function_response
        response = fr.response
        return v1.ToolResultContentPart(
            type="tool_result",
            tool_call_id=fr.id or fr.name or "",
            tool_result=dict(response) if isinstance(response, Mapping) else response,
        )


class _TextContentPartConversion:
    @staticmethod
    def to_google(
        obj: v1.TextContentPart,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> genai_types.Part:
        from google.genai import types as genai_types

        text = formatter.format(obj["text"], variables=variables)
        return genai_types.Part(text=text)

    @staticmethod
    def from_google(
        obj: genai_types.Part,
    ) -> v1.TextContentPart:
        return v1.TextContentPart(
            type="text",
            text=obj.text or "",
        )


class _RoleConversion:
    @staticmethod
    def to_google(
        obj: v1.PromptMessage,
    ) -> Literal["user", "model"]:
        role = obj["role"]
        if role == "user":
            return "user"
        if role == "assistant":
            return "model"
        if role == "model":
            return "model"
        if role == "ai":
            return "model"
        if role == "system":
            raise NotImplementedError
        if role == "developer":
            raise NotImplementedError
        if role == "tool":
            return "user"
        if TYPE_CHECKING:
            assert_never(role)
        return role

    @staticmethod
    def from_google(
        obj: genai_types.Content,
    ) -> Literal["user", "assistant", "tool"]:
        if obj.role in ("model", "assistant"):
            return "assistant"
        if obj.role == "user":
            for part in obj.parts or ():
                if _has_function_response(part):
                    return "tool"
                else:
                    continue
            return "user"
        return cast(Literal["user", "assistant", "tool"], obj.role)


def _has_text(obj: genai_types.Part) -> bool:
    return obj.text is not None


def _has_function_call(obj: genai_types.Part) -> bool:
    return obj.function_call is not None


def _has_function_response(obj: genai_types.Part) -> bool:
    return obj.function_response is not None
