from __future__ import annotations

import logging
from types import MappingProxyType
from typing import (
    TYPE_CHECKING,
    Any,
    Iterable,
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
    from google.generativeai import protos
    from google.generativeai.generative_models import GenerativeModel
    from google.generativeai.types import GenerationConfigDict, content_types

    _ContentPart: TypeAlias = Union[
        v1.TextContentPart,
        v1.ToolCallContentPart,
        v1.ToolResultContentPart,
    ]

    def _(obj: v1.PromptVersion) -> None:
        messages, kwargs = to_chat_messages_and_kwargs(obj)
        GenerativeModel(**kwargs)
        _: Iterable[protos.Content] = messages


class _ToolKwargs(TypedDict, total=False):
    tool_config: protos.ToolConfig
    tools: list[content_types.Tool]


class _ModelKwargs(_ToolKwargs, TypedDict, total=False):
    model_name: Required[str]
    generation_config: GenerationConfigDict
    system_instruction: str | list[str]


logger = logging.getLogger(__name__)

__all__ = [
    "to_chat_messages_and_kwargs",
]


def to_chat_messages_and_kwargs(
    obj: v1.PromptVersion,
    /,
    *,
    variables: Mapping[str, str] = MappingProxyType({}),
    formatter: Optional[TemplateFormatter] = None,
    **_: Any,
) -> tuple[list[protos.Content], _ModelKwargs]:
    formatter = formatter or to_formatter(obj)
    assert formatter is not None
    template = obj["template"]
    system_messages: list[str] = []
    messages: list[protos.Content] = []
    if template["type"] == "chat":
        for message in template["messages"]:
            if message["role"] == "SYSTEM":
                for content in _ContentConversion.to_google(message, variables, formatter):
                    for part in content.parts:
                        if text := part.text:
                            system_messages.append(text)
            else:
                messages.extend(_ContentConversion.to_google(message, variables, formatter))
    elif template["type"] == "string":
        text = formatter.format(template["template"], variables=variables)
        messages.append(protos.Content(role="user", parts=[protos.Part(text=text)]))  # type: ignore[no-untyped-call]
    elif TYPE_CHECKING:
        assert_never(template)
    kwargs: _ModelKwargs = _to_model_kwargs(obj)
    if system_messages:
        if len(system_messages) == 1:
            kwargs["system_instruction"] = system_messages[0]
        else:
            kwargs["system_instruction"] = system_messages
    return messages, kwargs


def _to_model_kwargs(
    obj: v1.PromptVersion,
    /,
) -> _ModelKwargs:
    invocation_parameters: Mapping[str, Any] = (
        obj["invocation_parameters"] if "invocation_parameters" in obj else {}
    )
    config: GenerationConfigDict = {}
    if (v := invocation_parameters.get("candidate_count")) is not None:
        try:
            config["candidate_count"] = int(v)
        except (ValueError, TypeError):
            logger.warning(f"Invalid candidate_count: {v}")
            pass
    if (v := invocation_parameters.get("stop_sequences")) is not None:
        try:
            config["stop_sequences"] = list(map(str, v))
        except (ValueError, TypeError):
            logger.warning(f"Invalid stop_sequences: {v}")
            pass
    if (v := invocation_parameters.get("max_output_tokens")) is not None:
        try:
            config["max_output_tokens"] = int(v)
        except (ValueError, TypeError):
            logger.warning(f"Invalid max_output_tokens: {v}")
            pass
    if (v := invocation_parameters.get("temperature")) is not None:
        try:
            config["temperature"] = float(v)
        except (ValueError, TypeError):
            logger.warning(f"Invalid temperature: {v}")
            pass
    if (v := invocation_parameters.get("response_mime_type")) is not None:
        try:
            config["response_mime_type"] = str(v)
        except (ValueError, TypeError):
            logger.warning(f"Invalid response_mime_type: {v}")
            pass
    if (v := invocation_parameters.get("response_schema")) is not None:
        try:
            config["response_schema"] = dict(v)
        except (ValueError, TypeError):
            logger.warning(f"Invalid response_schema: {v}")
            pass
    return {
        "model_name": obj["model_name"],
        "generation_config": config,
    }


class _ToolKwargsConversion:
    @staticmethod
    def to_google(
        obj: Optional[v1.PromptTools],
    ) -> _ToolKwargs:
        ans: _ToolKwargs = {}
        if not obj:
            return ans
        function_declarations: list[content_types.FunctionDeclaration] = []
        for t in obj["tools"]:
            if t["type"] == "function-tool":
                function_declarations.append(_FunctionDeclarationConversion.to_google(t))
        from google.generativeai.types import content_types

        ans["tools"] = [
            content_types.Tool(
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
        tools: list[v1.PromptFunctionTool] = []
        if "tools" in obj:
            for tool in obj["tools"]:
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
    ) -> protos.ToolConfig:
        from google.generativeai import protos
        from google.generativeai.types import content_types

        ans: protos.ToolConfig = protos.ToolConfig()  # type: ignore[no-untyped-call]
        if obj["type"] == "none":
            ans.function_calling_config.mode = content_types.FunctionCallingMode.NONE
            return ans
        if obj["type"] == "zero-or-more":
            ans.function_calling_config.mode = content_types.FunctionCallingMode.AUTO
            return ans
        if obj["type"] == "one-or-more":
            ans.function_calling_config.mode = content_types.FunctionCallingMode.ANY
            return ans
        if obj["type"] == "specific-function-tool":
            ans.function_calling_config.mode = content_types.FunctionCallingMode.ANY
            ans.function_calling_config.allowed_function_names = [obj["function_name"]]
            return ans
        else:
            assert_never(obj["type"])

    @staticmethod
    def from_google(
        obj: protos.ToolConfig,
    ) -> Union[
        v1.PromptToolChoiceNone,
        v1.PromptToolChoiceZeroOrMore,
        v1.PromptToolChoiceOneOrMore,
        v1.PromptToolChoiceSpecificFunctionTool,
    ]:
        from google.generativeai.types import content_types

        fcc: protos.FunctionCallingConfig = obj.function_calling_config
        if fcc.mode is content_types.FunctionCallingMode.NONE:
            choice_none: v1.PromptToolChoiceNone = {"type": "none"}
            return choice_none
        if fcc.mode is content_types.FunctionCallingMode.AUTO:
            choice_zero_or_more: v1.PromptToolChoiceZeroOrMore = {"type": "zero-or-more"}
            return choice_zero_or_more
        if fcc.mode is content_types.FunctionCallingMode.ANY:
            if not fcc.allowed_function_names:
                choice_one_or_more: v1.PromptToolChoiceOneOrMore = {"type": "one-or-more"}
                return choice_one_or_more
            choice_specific_function_tool: v1.PromptToolChoiceSpecificFunctionTool = {
                "type": "specific-function-tool",
                "function_name": fcc.allowed_function_names[0],
            }
            return choice_specific_function_tool
        raise NotImplementedError


class _FunctionDeclarationConversion:
    @staticmethod
    def to_google(
        obj: v1.PromptFunctionTool,
    ) -> content_types.FunctionDeclaration:
        from google.generativeai.types import content_types

        return content_types.FunctionDeclaration(
            name=obj["name"],
            description=obj["description"] if "description" in obj else "",
            parameters=dict(obj["schema"]["json"]) if "schema" in obj else None,
        )

    @staticmethod
    def from_google(
        obj: Union[content_types.FunctionDeclaration, protos.FunctionDeclaration],
    ) -> v1.PromptFunctionTool:
        return v1.PromptFunctionTool(
            type="function-tool",
            name=obj.name,
            description=obj.description,
            schema=v1.JSONSchemaDraft7ObjectSchema(
                type="json-schema-draft-7-object-schema",
                json=_SchemaConversion.from_google(obj.parameters),
            ),
        )


class _SchemaConversion:
    @staticmethod
    def to_google(
        obj: Mapping[str, Any],
    ) -> protos.Schema:
        from google.generativeai import protos

        ans: protos.Schema = protos.Schema()  # type: ignore[no-untyped-call]
        if isinstance(type_ := obj.get("type"), str):
            if type_ == "string":
                ans.type_ = protos.Type.STRING
            elif type_ == "number":
                ans.type_ = protos.Type.NUMBER
            elif type_ == "integer":
                ans.type_ = protos.Type.INTEGER
            elif type_ == "boolean":
                ans.type_ = protos.Type.BOOLEAN
            elif type_ == "array":
                ans.type_ = protos.Type.ARRAY
            elif type_ == "object":
                ans.type_ = protos.Type.OBJECT
        if isinstance(format_ := obj.get("format"), str):
            ans.format_ = format_
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
        obj: protos.Schema,
    ) -> dict[str, Any]:
        from google.generativeai import protos

        ans: dict[str, Any] = {}
        if obj.type_ is protos.Type.STRING:
            ans["type"] = "string"
        elif obj.type_ is protos.Type.NUMBER:
            ans["type"] = "number"
        elif obj.type_ is protos.Type.INTEGER:
            ans["type"] = "integer"
        elif obj.type_ is protos.Type.BOOLEAN:
            ans["type"] = "boolean"
        elif obj.type_ is protos.Type.ARRAY:
            ans["type"] = "array"
        elif obj.type_ is protos.Type.OBJECT:
            ans["type"] = "object"
        if obj.format_:
            ans["format"] = obj.format_
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
    ) -> Iterator[protos.Content]:
        from google.generativeai import protos

        role = _RoleConversion.to_google(obj)
        parts: list[protos.Part] = []
        for part in obj["content"]:
            if part["type"] == "text":
                parts.append(_TextContentPartConversion.to_google(part, variables, formatter))
            elif part["type"] == "tool_call":
                continue
            elif part["type"] == "tool_result":
                continue
            elif TYPE_CHECKING:
                assert_never(part["type"])
        yield protos.Content(role=role, parts=parts)  # type: ignore[no-untyped-call]

    @staticmethod
    def from_google(
        obj: protos.Content,
    ) -> v1.PromptMessage:
        role = _RoleConversion.from_google(obj)
        parts: list[_ContentPart] = []
        for part in obj.parts:
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
    ) -> protos.Part:
        from google.generativeai import protos

        text = formatter.format(obj["text"]["text"], variables=variables)
        ans: protos.Part = protos.Part()  # type: ignore[no-untyped-call]
        ans.text = text
        return ans

    @staticmethod
    def from_google(
        obj: protos.Part,
    ) -> v1.TextContentPart:
        return v1.TextContentPart(
            type="text",
            text=v1.TextContentValue(text=obj.text),
        )


class _RoleConversion:
    @staticmethod
    def to_google(
        obj: v1.PromptMessage,
    ) -> Literal["user", "model"]:
        role = obj["role"]
        if role == "USER":
            return "user"
        if role == "AI":
            return "model"
        if role == "SYSTEM":
            raise NotImplementedError
        if role == "TOOL":
            return "user"
        if TYPE_CHECKING:
            assert_never(role)
        return role

    @staticmethod
    def from_google(
        obj: protos.Content,
    ) -> Literal["USER", "AI", "TOOL"]:
        if obj.role in ("model", "assistant"):
            return "AI"
        if obj.role == "user":
            for part in obj.parts:
                p: protos.Part = part
                if _has_function_response(p):
                    return "TOOL"
                else:
                    continue
            return "USER"
        return obj.role  # type: ignore


def _has_text(obj: protos.Part) -> bool:
    return bool(obj.text)


def _has_function_call(obj: protos.Part) -> bool:
    fc: protos.FunctionCall = obj.function_call
    return bool(fc.id or fc.name or fc.args)


def _has_function_response(obj: protos.Part) -> bool:
    fr: protos.FunctionResponse = obj.function_response
    return bool(fr.id or fr.name or fr.response)
