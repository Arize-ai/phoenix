# This file is generated. Do not edit by hand.

from enum import Enum
from typing import Any, Literal, Optional

import pystache
from pydantic import BaseModel, field_validator, model_validator
from pystache.parser import _EscapeNode, _LiteralNode  # type: ignore[import-untyped]


class PromptMessage(BaseModel):
    role: Literal["user"]
    content: str


class EvaluatorScope(str, Enum):
    SPAN = "span"
    TRACE = "trace"
    SESSION = "session"


class EvaluatorCategory(str, Enum):
    GROUNDING_AND_RETRIEVAL = "grounding_and_retrieval"
    AGENTS = "agents"
    RESPONSE_QUALITY = "response_quality"
    SAFETY_AND_SECURITY = "safety_and_security"
    USER_EXPERIENCE = "user_experience"


class EvaluatorKind(str, Enum):
    LLM = "LLM"
    CODE = "CODE"


class EvaluatorInput(BaseModel):
    description: str
    format: Optional[str] = None

    @field_validator("description")
    @classmethod
    def description_must_not_be_empty(cls, description: str) -> str:
        if not description.strip():
            raise ValueError("input description must not be empty")
        return description


class ClassificationEvaluatorConfig(BaseModel):
    name: str
    description: str
    optimization_direction: Literal["minimize", "maximize", "neutral"]
    messages: list[PromptMessage]
    choices: dict[str, float]
    substitutions: Optional[dict[str, str]] = None  # placeholder -> substitution_name
    labels: list[str] = []
    scope: Optional[EvaluatorScope] = None
    recommended: bool = False
    category: Optional[EvaluatorCategory] = None
    kind: EvaluatorKind = EvaluatorKind.LLM
    details: Optional[str] = None
    inputs: Optional[dict[str, EvaluatorInput]] = None
    docs_link: Optional[str] = None

    @field_validator("inputs")
    @classmethod
    def input_names_must_not_be_empty(
        cls, inputs: Optional[dict[str, EvaluatorInput]]
    ) -> Optional[dict[str, EvaluatorInput]]:
        if inputs is not None and any(not input_name.strip() for input_name in inputs):
            raise ValueError("input name must not be empty")
        return inputs

    @model_validator(mode="after")
    def validate_source_inputs(self) -> "ClassificationEvaluatorConfig":
        if self.inputs is None:
            return self

        source_variables = set(self.substitutions or {})
        for message in self.messages:
            source_variables.update(_get_direct_mustache_variables(message.content))

        declared_inputs = set(self.inputs)
        missing_inputs = source_variables - declared_inputs
        unused_inputs = declared_inputs - source_variables
        if missing_inputs or unused_inputs:
            errors = []
            if missing_inputs:
                errors.append(f"missing inputs: {sorted(missing_inputs)}")
            if unused_inputs:
                errors.append(f"unused inputs: {sorted(unused_inputs)}")
            raise ValueError("; ".join(errors))
        return self


def _get_direct_mustache_variables(template: str) -> set[str]:
    parsed = pystache.parse(template, raise_on_mismatch=True)
    parse_tree: list[Any] = parsed._parse_tree
    variables: set[str] = set()
    for node in parse_tree:
        if not isinstance(node, (_EscapeNode, _LiteralNode)):
            continue
        key = getattr(node, "key", None)
        if isinstance(key, str) and key != "." and "." not in key:
            variables.add(key)
    return variables
