"""
Compiles YAML prompts into Python code.
"""

import argparse
import inspect
import re
from enum import Enum
from pathlib import Path
from typing import Literal, Optional

import yaml
from jinja2 import Template
from phoenix.evals.llm.prompts import FormatterFactory
from pydantic import BaseModel, field_validator, model_validator


# Based message class copied into the compiled module.
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


# Base classification evaluator config class copied into the compiled module.
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


def _get_template_variables(template: str) -> set[str]:
    formatter = FormatterFactory.auto_detect_and_create(template)
    return {
        re.split(r"[.\[]", variable, maxsplit=1)[0]
        for variable in formatter.extract_variables(template)
        if variable != "."
    }


MODELS_TEMPLATE = """\
# This file is generated. Do not edit by hand.

from enum import Enum
import re
from typing import Literal, Optional

from phoenix.evals.llm.prompts import FormatterFactory
from pydantic import BaseModel
from pydantic import field_validator, model_validator


{{ prompt_message_source }}

{{ evaluator_scope_source }}

{{ evaluator_category_source }}

{{ evaluator_input_source }}

{{ classification_evaluator_config_source }}

{{ get_template_variables_source }}
"""

CLASSIFICATION_EVALUATOR_CONFIG_TEMPLATE = """\
# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import (
{% for model_import in model_imports -%}
    {{ model_import }},
{% endfor -%}
)

{{ classification_evaluator_config_name }} = {{ classification_evaluator_config_definition }}
"""

INIT_TEMPLATE = """\
# This file is generated. Do not edit by hand.

from ._models import (
    ClassificationEvaluatorConfig,
    EvaluatorCategory,
    EvaluatorInput,
    EvaluatorScope,
    PromptMessage,
)
{% for name in prompt_names -%}
from ._{{ name.lower() }} import {{ name }}
{% endfor %}

__all__ = [
    "ClassificationEvaluatorConfig",
    "EvaluatorCategory",
    "EvaluatorInput",
    "EvaluatorScope",
    "PromptMessage",
    {{ prompt_names|map('tojson')|join(', ') }}
]
"""


def get_models_file_contents() -> str:
    """
    Gets the contents of _models.py containing Pydantic model definitions.
    """
    template = Template(MODELS_TEMPLATE)
    prompt_message_source = inspect.getsource(PromptMessage).strip()
    evaluator_scope_source = inspect.getsource(EvaluatorScope).strip()
    evaluator_category_source = inspect.getsource(EvaluatorCategory).strip()
    evaluator_input_source = inspect.getsource(EvaluatorInput).strip()
    classification_evaluator_config_source = inspect.getsource(
        ClassificationEvaluatorConfig
    ).strip()
    get_template_variables_source = inspect.getsource(_get_template_variables).strip()
    content = template.render(
        prompt_message_source=prompt_message_source,
        evaluator_scope_source=evaluator_scope_source,
        evaluator_category_source=evaluator_category_source,
        evaluator_input_source=evaluator_input_source,
        classification_evaluator_config_source=classification_evaluator_config_source,
        get_template_variables_source=get_template_variables_source,
    )
    return content


def get_prompt_file_contents(config: ClassificationEvaluatorConfig, name: str) -> str:
    """
    Gets the Python code contents for a ClassificationEvaluatorConfig.
    """
    template = Template(CLASSIFICATION_EVALUATOR_CONFIG_TEMPLATE)
    base_field_names = (
        "name",
        "description",
        "optimization_direction",
        "messages",
        "choices",
        "substitutions",
        "labels",
    )
    arguments = [f"{field_name}={getattr(config, field_name)!r}" for field_name in base_field_names]
    model_imports = {"ClassificationEvaluatorConfig", "PromptMessage"}
    if config.scope is not None:
        model_imports.add("EvaluatorScope")
        arguments.append(f"scope=EvaluatorScope.{config.scope.name}")
    if config.recommended:
        arguments.append("recommended=True")
    if config.category is not None:
        model_imports.add("EvaluatorCategory")
        arguments.append(f"category=EvaluatorCategory.{config.category.name}")
    if config.details is not None:
        arguments.append(f"details={config.details!r}")
    if config.inputs is not None:
        model_imports.add("EvaluatorInput")
        input_definitions = []
        for input_name, evaluator_input in config.inputs.items():
            input_definitions.append(
                f"{input_name!r}: EvaluatorInput(description={evaluator_input.description!r})"
            )
        arguments.append(f"inputs={{{', '.join(input_definitions)}}}")
    config_definition = f"ClassificationEvaluatorConfig({', '.join(arguments)})"
    content = template.render(
        model_imports=sorted(model_imports),
        classification_evaluator_config_name=name,
        classification_evaluator_config_definition=config_definition,
    )
    return content


def get_init_file_contents(prompt_names: list[str]) -> str:
    """
    Gets the __init__.py file contents with exports for all prompts.
    """
    template = Template(INIT_TEMPLATE)
    content = template.render(prompt_names=prompt_names)
    return content


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Compile YAML prompts to Python code")
    parser.add_argument(
        "compiled_module_path",
        type=Path,
        help="Path to the compiled module",
    )

    args = parser.parse_args()

    output_dir = args.compiled_module_path
    prompts_dir = Path("prompts/classification_evaluator_configs")

    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)

    # Generate _models.py containing Pydantic model definitions
    models_content = get_models_file_contents()
    models_path = output_dir / "_models.py"
    models_path.write_text(models_content, encoding="utf-8")

    # Compile all YAML prompts to Python
    yaml_files = list(prompts_dir.glob("*_CLASSIFICATION_EVALUATOR_CONFIG.yaml"))
    prompt_names = []

    for yaml_file in sorted(yaml_files):
        # Read and validate YAML
        with open(yaml_file, "r", encoding="utf-8") as f:
            raw_config = yaml.safe_load(f)
        config = ClassificationEvaluatorConfig.model_validate(raw_config)

        # Generate Python code using YAML filename as the module/variable name
        name = yaml_file.stem
        content = get_prompt_file_contents(config, name)
        prompt_names.append(name)

        # Write to file
        output_path = output_dir / f"_{name.lower()}.py"
        output_path.write_text(content, encoding="utf-8")

    # Generate the __init__.py file
    init_content = get_init_file_contents(prompt_names)
    init_path = output_dir / "__init__.py"
    init_path.write_text(init_content, encoding="utf-8")
