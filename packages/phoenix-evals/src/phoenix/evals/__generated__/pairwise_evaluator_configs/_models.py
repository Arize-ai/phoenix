# This file is generated. Do not edit by hand.

from typing import Literal

from pydantic import BaseModel


class PromptMessage(BaseModel):
    role: Literal["user"]
    content: str


class PairwiseEvaluatorConfig(BaseModel):
    name: str
    description: str
    optimization_direction: Literal["minimize", "maximize", "neutral"]
    messages: list[PromptMessage]
