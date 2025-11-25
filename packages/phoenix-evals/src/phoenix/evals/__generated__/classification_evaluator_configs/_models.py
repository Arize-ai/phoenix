# This file is generated. Do not edit by hand.

from typing import Literal

from pydantic import BaseModel


class PromptMessage(BaseModel):
    role: Literal["user"]
    content: str


class ClassificationEvaluatorConfig(BaseModel):
    name: str
    description: str
    optimization_direction: Literal["minimize", "maximize"]
    messages: list[PromptMessage]
    choices: dict[str, float]
