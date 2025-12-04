from __future__ import annotations

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

from typing_extensions import TypeAlias, assert_never

from phoenix.client.__generated__ import v1
from phoenix.client.utils.template_formatters import TemplateFormatter, to_formatter

if TYPE_CHECKING:
    from google.genai import types

    _ContentPart: TypeAlias = Union[
        v1.TextContentPart,
        v1.ToolCallContentPart,
        v1.ToolResultContentPart,
    ]


class _ToolKwargs(TypedDict, total=False):
    tool_config: types.ToolConfig
    tools: list[types.Tool]


class _GenerateContentConfigKwargs(
    _ToolKwargs,
    v1.PromptGoogleInvocationParameters,
    TypedDict,
    total=False,
):
    system_instruction: str | list[str]


class GoogleModelKwargs(TypedDict):
    model: str
    config: types.GenerateContentConfig


logger = logging.getLogger(__name__)

__all__ = [
    "create_prompt_version_from_google",
    "to_chat_messages_and_kwargs",
]


def create_prompt_version_from_google(
    obj: Any,
    /,
    *,
    description: Optional[str] = None,
    template_format: Literal["F_STRING", "MUSTACHE", "NONE"] = "MUSTACHE",
    model_provider: Literal["GOOGLE"] = "GOOGLE",
) -> v1.PromptVersionData:
    raise NotImplementedError


def to_chat_messages_and_kwargs(
    obj: v1.PromptVersionData,
    /,
    *,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: Optional[TemplateFormatter] = None,
) -> tuple[list[types.Content], GoogleModelKwargs]:
    from google.genai import types

    formatter = formatter or to_formatter(obj)
    assert formatter is not None
    template = obj["template"]
    system_messages: list[str] = []
    messages: list[types.Content] = []
    if template["type"] == "chat":
        for message in template["messages"]:
            if message["role"] == "system":
                system_messages.extend(_extract_system_text(message, variables, formatter))
            else:
                messages.extend(_ContentConversion.to_google(message, variables, formatter))
    elif template["type"] == "string":
        raise NotImplementedError
    else:
        assert_never(template)

    config_kwargs = _to_config_kwargs(obj)
    if system_messages:
        if len(system_messages) == 1:
            config_kwargs["system_instruction"] = system_messages[0]
        else:
            config_kwargs["system_instruction"] = system_messages

    kwargs = GoogleModelKwargs(
        model=obj["model_name"],
        config=types.GenerateContentConfig(**config_kwargs),
    )
    return messages, kwargs


def _extract_system_text(
    message: v1.PromptMessage,
    variables: Mapping[str, str],
    formatter: TemplateFormatter,
) -> Iterator[str]:
    content = message["content"]
    if isinstance(content, str):
        yield formatter.format(content, variables=variables)
    else:
        for part in content:
            if part["type"] == "text":
                yield formatter.format(part["text"], variables=variables)


def _to_config_kwargs(
    obj: v1.PromptVersionData,
    /,
) -> _GenerateContentConfigKwargs:
    invocation_parameters: v1.PromptGoogleInvocationParametersContent = (
        obj["invocation_parameters"]["google"]
        if "invocation_parameters" in obj and obj["invocation_parameters"]["type"] == "google"
        else {}
    )
    ans: _GenerateContentConfigKwargs = {}
    if "temperature" in invocation_parameters:
        ans["temperature"] = invocation_parameters["temperature"]
    if "max_output_tokens" in invocation_parameters:
        ans["max_output_tokens"] = invocation_parameters["max_output_tokens"]
    if "stop_sequences" in invocation_parameters:
        ans["stop_sequences"] = list(invocation_parameters["stop_sequences"])
    if "presence_penalty" in invocation_parameters:
        ans["presence_penalty"] = invocation_parameters["presence_penalty"]
    if "frequency_penalty" in invocation_parameters:
        ans["frequency_penalty"] = invocation_parameters["frequency_penalty"]
    if "top_p" in invocation_parameters:
        ans["top_p"] = invocation_parameters["top_p"]
    if "top_k" in invocation_parameters:
        ans["top_k"] = invocation_parameters["top_k"]
    return ans


class _ToolKwargsConversion:
    @staticmethod
    def to_google(
        obj: Optional[v1.PromptTools],
    ) -> _ToolKwargs:
        from google.genai import types

        ans: _ToolKwargs = {}
        if not obj:
            return ans
        function_declarations: list[types.FunctionDeclaration] = []
        for t in obj["tools"]:
            if t["type"] == "function":
                function_declarations.append(_FunctionDeclarationConversion.to_google(t))
        ans["tools"] = [
            types.Tool(
                function_declarations=function_declarations,
            )
        ]
        if "tool_choice" in obj:
            ans["tool_config"] = _ToolConfigConversion.to_google(obj["tool_choice"])
        return ans

    @staticmethod
    def from_google(
        obj: _ToolKwargs,
    ) -> Optional[v1.PromptTools]:
        if not obj:
            return None
        tools: list[v1.PromptToolFunction] = []
        if "tools" in obj:
            for tool in obj["tools"]:
                if tool.function_declarations:
                    for fd in tool.function_declarations:
                        tools.append(_FunctionDeclarationConversion.from_google(fd))
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
    ) -> types.ToolConfig:
        from google.genai import types

        if obj["type"] == "none":
            return types.ToolConfig(
                function_calling_config=types.FunctionCallingConfig(mode="none")
            )
        if obj["type"] == "zero_or_more":
            return types.ToolConfig(
                function_calling_config=types.FunctionCallingConfig(mode="auto")
            )
        if obj["type"] == "one_or_more":
            return types.ToolConfig(function_calling_config=types.FunctionCallingConfig(mode="any"))
        if obj["type"] == "specific_function":
            return types.ToolConfig(
                function_calling_config=types.FunctionCallingConfig(
                    mode="any",
                    allowed_function_names=[obj["function_name"]],
                )
            )
        assert_never(obj["type"])

    @staticmethod
    def from_google(
        obj: types.ToolConfig,
    ) -> Union[
        v1.PromptToolChoiceNone,
        v1.PromptToolChoiceZeroOrMore,
        v1.PromptToolChoiceOneOrMore,
        v1.PromptToolChoiceSpecificFunctionTool,
    ]:
        fcc = obj.function_calling_config
        if fcc is None:
            return v1.PromptToolChoiceZeroOrMore(type="zero_or_more")

        # Normalize mode to lowercase string
        mode = fcc.mode.value.lower() if fcc.mode else "auto"

        if mode == "none":
            return v1.PromptToolChoiceNone(type="none")
        if mode == "auto":
            return v1.PromptToolChoiceZeroOrMore(type="zero_or_more")
        if mode == "any":
            if fcc.allowed_function_names:
                if len(fcc.allowed_function_names) != 1:
                    raise ValueError("Only single allowed function name is currently supported")
                return v1.PromptToolChoiceSpecificFunctionTool(
                    type="specific_function",
                    function_name=fcc.allowed_function_names[0],
                )
            return v1.PromptToolChoiceOneOrMore(type="one_or_more")
        assert_never(mode)


class _FunctionDeclarationConversion:
    @staticmethod
    def to_google(
        obj: v1.PromptToolFunction,
    ) -> types.FunctionDeclaration:
        from google.genai import types

        function = obj["function"]
        return types.FunctionDeclaration(
            name=function["name"],
            description=function["description"] if "description" in function else "",
            parameters=dict(function["parameters"]) if "parameters" in function else None,
        )

    @staticmethod
    def from_google(
        obj: types.FunctionDeclaration,
    ) -> v1.PromptToolFunction:
        parameters: dict[str, Any] = {}
        if obj.parameters:
            parameters = _SchemaConversion.from_google(obj.parameters)
        fd: v1.PromptToolFunctionDefinition = {
            "name": obj.name or "",
            "parameters": parameters,
        }
        if obj.description:
            fd["description"] = obj.description
        return v1.PromptToolFunction(type="function", function=fd)


class _SchemaConversion:
    @staticmethod
    def to_google(
        obj: Mapping[str, Any],
    ) -> types.Schema:
        from google.genai import types

        schema_dict: dict[str, Any] = {}
        if isinstance(type_ := obj.get("type"), str):
            schema_dict["type"] = type_.upper()
        if isinstance(format_ := obj.get("format"), str):
            schema_dict["format"] = format_
        if isinstance(description := obj.get("description"), str):
            schema_dict["description"] = description
        if isinstance(nullable := obj.get("nullable"), bool):
            schema_dict["nullable"] = nullable
        if isinstance(enum := obj.get("enum"), Sequence):
            schema_dict["enum"] = list(cast(Sequence[str], enum))
        if isinstance(items := obj.get("items"), Mapping):
            schema_dict["items"] = _SchemaConversion.to_google(cast(Mapping[str, Any], items))
        if isinstance(max_items := obj.get("maxItems"), int):
            schema_dict["max_items"] = max_items
        if isinstance(min_items := obj.get("minItems"), int):
            schema_dict["min_items"] = min_items
        if isinstance(properties := obj.get("properties"), Mapping):
            schema_dict["properties"] = {
                k: _SchemaConversion.to_google(v)
                for k, v in cast(Mapping[str, Mapping[str, Any]], properties).items()
            }
        if isinstance(required := obj.get("required"), Sequence):
            schema_dict["required"] = list(cast(Sequence[str], required))
        return types.Schema(**schema_dict)

    @staticmethod
    def from_google(
        obj: types.Schema,
    ) -> dict[str, Any]:
        ans: dict[str, Any] = {}
        if obj.type:
            type_str = obj.type.value.lower() if hasattr(obj.type, "value") else str(obj.type)
            ans["type"] = type_str
        if obj.format:
            ans["format"] = obj.format
        if obj.description:
            ans["description"] = obj.description
        if obj.nullable:
            ans["nullable"] = obj.nullable
        if obj.enum:
            ans["enum"] = list(obj.enum)
        if obj.items:
            ans["items"] = _SchemaConversion.from_google(obj.items)
        if obj.max_items:
            ans["max_items"] = obj.max_items
        if obj.min_items:
            ans["min_items"] = obj.min_items
        if obj.properties:
            ans["properties"] = {
                k: _SchemaConversion.from_google(v) for k, v in obj.properties.items()
            }
        if obj.required:
            ans["required"] = list(obj.required)
        return ans


class _ContentConversion:
    @staticmethod
    def to_google(
        obj: v1.PromptMessage,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> Iterator[types.Content]:
        from google.genai import types

        role = _RoleConversion.to_google(obj)
        parts: list[types.Part] = []
        if isinstance(obj["content"], str):
            text = formatter.format(obj["content"], variables=variables)
            yield types.Content(role=role, parts=[types.Part(text=text)])
            return
        for part in obj["content"]:
            if part["type"] == "text":
                parts.append(_TextContentPartConversion.to_google(part, variables, formatter))
            elif part["type"] == "tool_call":
                continue
            elif part["type"] == "tool_result":
                continue
            elif TYPE_CHECKING:
                assert_never(part["type"])
        yield types.Content(role=role, parts=parts)

    @staticmethod
    def from_google(
        obj: types.Content,
    ) -> v1.PromptMessage:
        role = _RoleConversion.from_google(obj)
        parts: list[_ContentPart] = []
        for part in obj.parts or []:
            if part.text:
                parts.append(_TextContentPartConversion.from_google(part))
            elif part.function_call:
                continue
            elif part.function_response:
                continue
        return v1.PromptMessage(role=role, content=parts)


class _TextContentPartConversion:
    @staticmethod
    def to_google(
        obj: v1.TextContentPart,
        variables: Mapping[str, str],
        formatter: TemplateFormatter,
        /,
    ) -> types.Part:
        from google.genai import types

        text = formatter.format(obj["text"], variables=variables)
        return types.Part(text=text)

    @staticmethod
    def from_google(
        obj: types.Part,
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
        obj: types.Content,
    ) -> Literal["user", "assistant", "tool"]:
        if obj.role in ("model", "assistant"):
            return "assistant"
        if obj.role == "user":
            for part in obj.parts or []:
                if part.function_response:
                    return "tool"
            return "user"
        if obj.role == "tool":
            return obj.role
        raise NotImplementedError(f"Unknown role: {obj.role}")
