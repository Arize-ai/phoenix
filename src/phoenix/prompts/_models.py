from typing import Literal

from pydantic import BaseModel


class _PromptMessage(BaseModel):
    role: Literal["user"]
    content: str


class _BuiltInLLMEvaluatorConfig(BaseModel):
    name: str
    description: str
    messages: list[_PromptMessage]
    choices: dict[str, float]
