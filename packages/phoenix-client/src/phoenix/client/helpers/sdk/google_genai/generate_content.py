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
        genai.Client().models.generate_content(contents=contents, **kwargs)


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
) -> tuple[list[genai_types.Content], GoogleGenAIModelKwargs]:
    formatter = formatter or to_formatter(obj)
    assert formatter is not None
    template = obj["template"]
    system_messages: list[str] = []
    messages: list[genai_types.Content] = []
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
                messages.extend(_ContentConversion.to_google(message, variables, formatter))
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
    tool_kwargs = _ToolKwargsConversion.to_google(obj.get("tools"))
    if "tools" in tool_kwargs:
        config.tools = list(tool_kwargs["tools"])
    if "tool_config" in tool_kwargs:
        config.tool_config = tool_kwargs["tool_config"]
    return {
        "model": obj["model_name"],
        "config": config,
    }


class _ToolKwargsConversion:
    @staticmethod
    def to_google(
        obj: Optional[v1.PromptTools],
    ) -> _ToolKwargs:
        ans: _ToolKwargs = {}
        if not obj:
            return ans
        from google.genai import types as genai_types

        function_declarations: list[genai_types.FunctionDeclaration] = []
        for t in obj["tools"]:
            if t["type"] == "function":
                function_declarations.append(_FunctionDeclarationConversion.to_google(t))
        ans["tools"] = [
            genai_types.Tool(
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
                for fd in tool.function_declarations or ():
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
        return genai_types.FunctionDeclaration(
            name=function["name"],
            description=function["description"] if "description" in function else "",
            parameters=_SchemaConversion.to_google(function["parameters"])
            if "parameters" in function
            else None,
        )

    @staticmethod
    def from_google(
        obj: genai_types.FunctionDeclaration,
    ) -> v1.PromptToolFunction:
        function = v1.PromptToolFunctionDefinition(
            name=obj.name or "",
            description=obj.description or "",
        )
        if obj.parameters is not None:
            function["parameters"] = _SchemaConversion.from_google(obj.parameters)
        return v1.PromptToolFunction(
            type="function",
            function=function,
        )


class _SchemaConversion:
    @staticmethod
    def to_google(
        obj: Mapping[str, Any],
    ) -> genai_types.Schema:
        from google.genai import types as genai_types

        ans = genai_types.Schema()
        if isinstance(type_ := obj.get("type"), str):
            if type_ == "string":
                ans.type = genai_types.Type.STRING
            elif type_ == "number":
                ans.type = genai_types.Type.NUMBER
            elif type_ == "integer":
                ans.type = genai_types.Type.INTEGER
            elif type_ == "boolean":
                ans.type = genai_types.Type.BOOLEAN
            elif type_ == "array":
                ans.type = genai_types.Type.ARRAY
            elif type_ == "object":
                ans.type = genai_types.Type.OBJECT
        if isinstance(format_ := obj.get("format"), str):
            ans.format = format_
        if isinstance(description := obj.get("description"), str):
            ans.description = description
        if isinstance(nullable := obj.get("nullable"), bool):
            ans.nullable = nullable
        if isinstance(enum := obj.get("enum"), Sequence):
            ans.enum = list(cast(Sequence[str], enum))
        if isinstance(items := obj.get("items"), Mapping):
            ans.items = _SchemaConversion.to_google(cast(Mapping[str, Any], items))
        if isinstance(max_items := obj.get("maxItems"), int):
            ans.max_items = max_items
        if isinstance(min_items := obj.get("minItems"), int):
            ans.min_items = min_items
        if isinstance(properties := obj.get("properties"), Mapping):
            ans.properties = {
                k: _SchemaConversion.to_google(v)
                for k, v in cast(Mapping[str, Mapping[str, Any]], properties).items()
            }
        if isinstance(required := obj.get("required"), Sequence):
            ans.required = list(cast(Sequence[str], required))
        return ans

    @staticmethod
    def from_google(
        obj: genai_types.Schema,
    ) -> dict[str, Any]:
        from google.genai import types as genai_types

        ans: dict[str, Any] = {}
        if obj.type is genai_types.Type.STRING:
            ans["type"] = "string"
        elif obj.type is genai_types.Type.NUMBER:
            ans["type"] = "number"
        elif obj.type is genai_types.Type.INTEGER:
            ans["type"] = "integer"
        elif obj.type is genai_types.Type.BOOLEAN:
            ans["type"] = "boolean"
        elif obj.type is genai_types.Type.ARRAY:
            ans["type"] = "array"
        elif obj.type is genai_types.Type.OBJECT:
            ans["type"] = "object"
        if obj.format:
            ans["format"] = obj.format
        if obj.description:
            ans["description"] = obj.description
        if obj.nullable:
            ans["nullable"] = obj.nullable
        if obj.enum:
            ans["enum"] = list(obj.enum)
        if obj.items is not None:
            ans["items"] = _SchemaConversion.from_google(obj.items)
        if obj.max_items:
            ans["maxItems"] = obj.max_items
        if obj.min_items:
            ans["minItems"] = obj.min_items
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
                continue
            elif part["type"] == "tool_result":
                continue
            elif TYPE_CHECKING:
                assert_never(part["type"])
        yield genai_types.Content(role=role, parts=parts)

    @staticmethod
    def from_google(
        obj: genai_types.Content,
    ) -> v1.PromptMessage:
        role = _RoleConversion.from_google(obj)
        parts: list[_ContentPart] = []
        for part in obj.parts or ():
            if _has_text(part):
                parts.append(_TextContentPartConversion.from_google(part))
            elif _has_function_call(part):
                continue
            elif _has_function_response(part):
                continue
        return v1.PromptMessage(role=role, content=parts)


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
    return bool(obj.text)


def _has_function_call(obj: genai_types.Part) -> bool:
    return obj.function_call is not None


def _has_function_response(obj: genai_types.Part) -> bool:
    return obj.function_response is not None
