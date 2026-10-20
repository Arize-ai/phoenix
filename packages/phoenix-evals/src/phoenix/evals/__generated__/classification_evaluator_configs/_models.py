# This file is generated. Do not edit by hand.

import re
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, field_validator, model_validator

from phoenix.evals.llm.prompts import FormatterFactory


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


class EvaluatorInput(BaseModel):
    description: str

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
    details: Optional[str] = None
    inputs: Optional[dict[str, EvaluatorInput]] = None
    # Gallery defaults for a project evaluator created from this config: the
    # filter condition in the DSL of `scope`, and JSONPath expressions keyed by
    # declared input name. Omit either to fall back to the level's defaults.
    default_filter_condition: Optional[str] = None
    default_path_mapping: Optional[dict[str, str]] = None

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

        source_variables = set()
        for message in self.messages:
            source_variables.update(_get_template_variables(message.content))

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

    @model_validator(mode="after")
    def validate_gallery_defaults(self) -> "ClassificationEvaluatorConfig":
        filter_condition = self.default_filter_condition
        if filter_condition is not None and not filter_condition.strip():
            raise ValueError("default filter condition must not be empty")
        if self.default_path_mapping is None:
            return self
        if self.inputs is None:
            raise ValueError("default path mapping requires declared inputs")
        undeclared = sorted(set(self.default_path_mapping) - set(self.inputs))
        if undeclared:
            raise ValueError(f"default path mapping names undeclared inputs: {undeclared}")
        if any(not path.strip() for path in self.default_path_mapping.values()):
            raise ValueError("default path mapping paths must not be empty")
        return self


def _get_template_variables(template: str) -> set[str]:
    formatter = FormatterFactory.auto_detect_and_create(template)
    return {
        re.split(r"[.\[]", variable, maxsplit=1)[0]
        for variable in formatter.extract_variables(template)
        if variable != "."
    }
