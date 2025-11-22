from typing import Literal

from pydantic import BaseModel


class _PromptMessage(BaseModel):
    role: Literal["user"]
    content: str


class _BuiltInLLMEvaluatorPrompt(BaseModel):
    messages: list[_PromptMessage]
    choices: dict[str, float]
