# Part of the Phoenix PromptHub feature set

from datetime import datetime
from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import Connection, Node, NodeID
from strawberry.types import Info

from phoenix.server.api.context import Context
from phoenix.server.api.types.pagination import ConnectionArgs, CursorString, connection_from_list

from .PromptVersion import PromptTemplateFormat, PromptTemplateType, PromptVersion


@strawberry.type
class Prompt(Node):
    id_attr: NodeID[int]
    name: str
    description: Optional[str]
    created_at: datetime

    @strawberry.field
    async def prompt_versions(
        self,
        info: Info[Context, None],
        first: Optional[int] = 50,
        last: Optional[int] = UNSET,
        after: Optional[CursorString] = UNSET,
        before: Optional[CursorString] = UNSET,
    ) -> Connection[PromptVersion]:
        args = ConnectionArgs(
            first=first,
            after=after if isinstance(after, CursorString) else None,
            last=last,
            before=before if isinstance(before, CursorString) else None,
        )

        dummy_data = [
            PromptVersion(
                id_attr=2,
                user="alice",
                description="A dummy prompt version",
                template_type=PromptTemplateType.CHAT,
                template_format=PromptTemplateFormat.MUSTACHE,
                template={
                    "_version": "messages-v1",
                    "messages": [
                        {"role": "system", "content": "You are a helpful assistant"},
                        {"role": "user", "content": "Hello what's the weather in Antarctica like?"},
                        {"role": "ai", "content": "The weather in Antarctica is very cold."},
                    ],
                },
                invocation_parameters={
                    "temperature": 0.5,
                    "model": "gpt-4o",
                    "max_tokens": 100,
                },
                tools={
                    "_version": "tools-v1",
                    "tools": [
                        {
                            "definition": {
                                "name": "get_current_weather",
                                "description": "Get the current weather in a given location",
                                "parameters": {
                                    "type": "object",
                                    "properties": {
                                        "location": {
                                            "type": "string",
                                            "description": "A location in the world",
                                        },
                                        "unit": {
                                            "type": "string",
                                            "enum": ["celsius", "fahrenheit"],
                                            "default": "fahrenheit",
                                            "description": "The unit of temperature",
                                        },
                                    },
                                    "required": ["location"],
                                },
                            }
                        }
                    ],
                },
                model_name="gpt-4o",
                model_provider="openai",
            ),
            PromptVersion(
                id_attr=1,
                user="alice",
                description="A dummy prompt version",
                template_type=PromptTemplateType.CHAT,
                template_format=PromptTemplateFormat.MUSTACHE,
                template={
                    "_version": "messages-v1",
                    "messages": [
                        {"role": "user", "content": "Hello what's the weather in Antarctica like?"}
                    ],
                },
                model_name="gpt-4o",
                model_provider="openai",
            ),
        ]

        return connection_from_list(data=dummy_data, args=args)
