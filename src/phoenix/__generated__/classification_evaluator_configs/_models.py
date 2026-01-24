# This file is generated. Do not edit by hand.

from typing import Literal

from pydantic import BaseModel


class PromptMessage(BaseModel):
    role: Literal["user"]
    content: str


class EvaluatorSpecification(BaseModel):
    use_cases: list[Literal["chat", "rag", "agent", "code", "general"]]
    measures: Literal["correctness", "grounding", "safety", "quality", "tool_use"]
    requires: list[
        Literal["input", "output", "context", "reference", "tools", "tool_calls", "messages"]
    ]
    level: list[Literal["document", "span", "trace", "session"]]
    span_kind: list[Literal["llm", "tool", "retriever", "any"]] | None = None


class ClassificationEvaluatorConfig(BaseModel):
    name: str
    description: str
    optimization_direction: Literal["minimize", "maximize"]
    specification: EvaluatorSpecification
    messages: list[PromptMessage]
    choices: dict[str, float]
