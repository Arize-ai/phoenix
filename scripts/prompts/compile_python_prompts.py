"""
Compiles YAML prompts into Python code.
"""

import argparse
import inspect
from pathlib import Path
from typing import Literal, Optional

import yaml
from jinja2 import Template
from pydantic import BaseModel


# Based message class copied into the compiled module.
class PromptMessage(BaseModel):
    role: Literal["user"]
    content: str


# Base classification evaluator config class copied into the compiled module.
class ClassificationEvaluatorConfig(BaseModel):
    name: str
    description: str
    optimization_direction: Literal["minimize", "maximize"]
    messages: list[PromptMessage]
    choices: dict[str, float]
    formatters: Optional[dict[str, str]] = None  # placeholder -> formatter_name


MODELS_TEMPLATE = """\
# This file is generated. Do not edit by hand.

from typing import Literal, Optional

from pydantic import BaseModel


{{ prompt_message_source }}

{{ classification_evaluator_config_source }}
"""

CLASSIFICATION_EVALUATOR_CONFIG_TEMPLATE = """\
# This file is generated. Do not edit by hand.
# ruff: noqa: E501

from ._models import ClassificationEvaluatorConfig, PromptMessage

{{ classification_evaluator_config_name }} = {{ classification_evaluator_config_definition }}
"""

INIT_TEMPLATE = """\
# This file is generated. Do not edit by hand.

from ._models import ClassificationEvaluatorConfig, PromptMessage
{% for name in prompt_names -%}
from ._{{ name.lower() }} import {{ name }}
{% endfor %}

__all__ = [
    "ClassificationEvaluatorConfig",
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
    classification_evaluator_config_source = inspect.getsource(
        ClassificationEvaluatorConfig
    ).strip()
    content = template.render(
        prompt_message_source=prompt_message_source,
        classification_evaluator_config_source=classification_evaluator_config_source,
    )
    return content


def get_prompt_file_contents(config: ClassificationEvaluatorConfig, name: str) -> str:
    """
    Gets the Python code contents for a ClassificationEvaluatorConfig.
    """
    template = Template(CLASSIFICATION_EVALUATOR_CONFIG_TEMPLATE)
    content = template.render(
        classification_evaluator_config_name=name,
        classification_evaluator_config_definition=repr(config),
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
    yaml_files = list(prompts_dir.glob("*.yaml"))
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
